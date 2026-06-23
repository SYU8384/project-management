import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

import { normalizeLinkPath, parseWikiLinkBody, pmWikiLink } from "./obsidian-links.mjs";

export const MILESTONE_UPDATE_TRIGGERS_HEADING = "Update Triggers";
export const MILESTONE_RELATED_NOTES_HEADING = "Related Notes";

export const MILESTONE_UPDATE_TRIGGERS_SECTION = `## ${MILESTONE_UPDATE_TRIGGERS_HEADING}

Agents must review and update this milestone before history whenever:

- The current phase changes to or from this milestone.
- An active plan is created, changed, shipped, rejected, or superseded.
- \`roadmap/done-pending.md\` mirrors work that changes this milestone's priorities or steps.
- A decision changes milestone scope, priorities, exit criteria, inline evidence links, or deferred scope.
- A feature, system note, or docs note completes or changes a milestone step.
- A known issue, blocker, or risk affects milestone priority order or exit criteria.
- \`CURRENT_STATUS.md\` top priorities or current phase change.

If review finds no prose changes, refresh \`updated\` and \`last_reviewed\` to record the review.`;

const GENERIC_RELATED_NOTE_LABELS = new Set([
  "current status",
  "current-status",
  "plans",
  "done/pending",
  "done-pending",
  "known issues",
  "known-issues",
  "decisions",
  "features",
  "docs",
  "system",
  "roadmap",
  "milestones",
]);

const GENERIC_RELATED_NOTE_TARGETS = [
  "current_status",
  "roadmap/plans/plans",
  "roadmap/done-pending",
  "roadmap/known-issues",
  "decisions/decisions",
  "features/features",
  "docs/docs",
  "system/system",
  "roadmap/roadmap",
  "roadmap/milestones/milestones",
];

export function slugifyMilestone(value) {
  const slug = String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "mvp";
}

export function milestoneSlugForPhase(phase) {
  const normalized = slugifyMilestone(phase);
  if (normalized === "pre-alpha" || normalized === "prealpha") return "mvp";
  if (["alpha", "beta", "stable", "deprecated"].includes(normalized)) return normalized;
  return normalized;
}

export function milestoneRel(slug) {
  return `roadmap/milestones/${slugifyMilestone(slug)}.md`;
}

export function extractH2Body(content, heading) {
  const escaped = String(heading).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(content ?? "").match(new RegExp(`^##\\s+${escaped}\\s*$`, "m"));
  if (!match) return "";
  const start = match.index + match[0].length;
  const rest = String(content ?? "").slice(start);
  const next = rest.match(/\n##\s+/);
  return rest.slice(0, next ? next.index : rest.length).trim();
}

function h2SectionRange(content, heading) {
  const normalized = String(content ?? "").replace(/\r\n/g, "\n");
  const escaped = String(heading).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = normalized.match(new RegExp(`^##\\s+${escaped}\\s*$`, "m"));
  if (!match) return null;
  const bodyStart = match.index + match[0].length;
  const rest = normalized.slice(bodyStart);
  const next = rest.match(/\n##\s+/);
  const bodyEnd = next ? bodyStart + next.index : normalized.length;
  const sectionEnd = next ? bodyEnd + 1 : normalized.length;
  return {
    start: match.index,
    end: sectionEnd,
    body: normalized.slice(bodyStart, bodyEnd).trim(),
  };
}

function isPlaceholderRelatedNotesLine(line) {
  const normalized = String(line ?? "")
    .trim()
    .replace(/^[-*]\s+/, "")
    .toLowerCase();
  return [
    "*(none)*",
    "*(no items)*",
    "(none)",
    "(no items)",
    "none",
    "no items",
  ].includes(normalized);
}

function isGenericRelatedNotesTarget(rawBody) {
  const parsed = parseWikiLinkBody(rawBody);
  if (parsed.heading) return false;
  const target = normalizeLinkPath(parsed.target).toLowerCase();
  return GENERIC_RELATED_NOTE_TARGETS.some((generic) => target === generic || target.endsWith(`/${generic}`));
}

function isGenericRelatedNotesLine(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed || trimmed.startsWith("<!--")) return true;
  if (isPlaceholderRelatedNotesLine(trimmed)) return true;
  if (!/^[-*]\s+/.test(trimmed)) return false;

  const links = [...trimmed.matchAll(/!?\[\[([^\]\n]+)\]\]/g)];
  if (links.length === 0) return false;
  if (!links.every((match) => isGenericRelatedNotesTarget(match[1]))) return false;

  const label = trimmed
    .replace(/!?\[\[[^\]\n]+\]\]/g, "")
    .replace(/^[-*]\s+/, "")
    .replace(/[:\-–—\s]+$/g, "")
    .trim()
    .toLowerCase();
  return GENERIC_RELATED_NOTE_LABELS.has(label);
}

export function milestoneRelatedNotesState(content, relPath = "milestone note") {
  const range = h2SectionRange(content, MILESTONE_RELATED_NOTES_HEADING);
  if (!range) {
    return { hasSection: false, removable: false, manualReview: [] };
  }
  const lines = range.body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("<!--"));
  const removable = lines.length === 0 || lines.every(isGenericRelatedNotesLine);
  if (removable) {
    return { hasSection: true, removable: true, manualReview: [] };
  }
  return {
    hasSection: true,
    removable: false,
    manualReview: [
      `${relPath}: deprecated \`## Related Notes\` contains specific links or prose; integrate them inline into \`## Priorities\`, \`## Major Steps\`, \`## Exit Criteria\`, or \`## Deferred\`, then remove the section.`,
    ],
  };
}

export function removeDeprecatedMilestoneRelatedNotes(content, relPath = "milestone note") {
  const state = milestoneRelatedNotesState(content, relPath);
  if (!state.hasSection || !state.removable) {
    return { updated: content, changes: [], manualReview: state.manualReview };
  }
  const normalized = String(content ?? "").replace(/\r\n/g, "\n");
  const range = h2SectionRange(normalized, MILESTONE_RELATED_NOTES_HEADING);
  const before = normalized.slice(0, range.start).replace(/\n+$/, "\n\n");
  const after = normalized.slice(range.end).replace(/^\n+/, "");
  const updated = `${before}${after}`.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  return {
    updated,
    changes: [`removed deprecated generic \`## ${MILESTONE_RELATED_NOTES_HEADING}\``],
    manualReview: [],
  };
}

export function phaseFromCurrentStatusContent(content) {
  const body = extractH2Body(content, "Current Phase");
  if (!body) return null;
  const firstLine = body.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (!firstLine || firstLine.startsWith("*(")) return null;
  return firstLine.replace(/^`|`$/g, "");
}

export function configuredPhaseForProject(configPath, project) {
  if (!configPath || !project || !existsSync(configPath)) return null;
  try {
    const cfg = JSON.parse(readFileSync(configPath, "utf8"));
    return cfg.projects?.[project]?.phase ? String(cfg.projects[project].phase) : null;
  } catch {
    return null;
  }
}

export function activeMilestoneInfo({ pmFolder, project = null, configPath = null, fallbackPhase = null } = {}) {
  let phase = null;
  const currentStatusPath = pmFolder ? join(pmFolder, "CURRENT_STATUS.md") : null;
  if (currentStatusPath && existsSync(currentStatusPath)) {
    phase = phaseFromCurrentStatusContent(readFileSync(currentStatusPath, "utf8"));
  }
  phase = phase || configuredPhaseForProject(configPath, project) || fallbackPhase || null;
  if (!phase) return null;
  const slug = milestoneSlugForPhase(phase);
  return {
    phase,
    slug,
    rel: milestoneRel(slug),
    abs: pmFolder ? join(pmFolder, milestoneRel(slug)) : null,
  };
}

export function listMilestoneNoteRels(pmFolder) {
  const dir = join(pmFolder, "roadmap", "milestones");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "milestones.md")
    .map((entry) => `roadmap/milestones/${entry.name}`)
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

export function ensureMilestoneUpdateTriggers(content) {
  const normalized = String(content ?? "").replace(/\r\n/g, "\n").trimEnd();
  if (new RegExp(`^##\\s+${MILESTONE_UPDATE_TRIGGERS_HEADING}\\s*$`, "m").test(normalized)) {
    return { updated: content, changes: [] };
  }

  const navigation = normalized.match(/^##\s+Navigation\s*$/m);
  const updated = navigation
    ? `${normalized.slice(0, navigation.index).replace(/\n+$/, "\n\n")}${MILESTONE_UPDATE_TRIGGERS_SECTION}\n\n${normalized.slice(navigation.index)}\n`
    : `${normalized}\n\n${MILESTONE_UPDATE_TRIGGERS_SECTION}\n`;
  return { updated, changes: [`inserted \`## ${MILESTONE_UPDATE_TRIGGERS_HEADING}\``] };
}

function yamlScalar(value) {
  return JSON.stringify(String(value));
}

function projectTag(project) {
  return String(project ?? "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

export function milestoneNoteContent({ project, slug, phase = null, notes = "", date, linkOptions = {} }) {
  const safeSlug = slugifyMilestone(slug);
  const phaseText = phase ? ` for phase \`${phase}\`` : "";
  const goal = notes || `Agent-created active milestone${phaseText}. Replace this with the concrete outcome this phase is trying to prove or ship.`;
  return `---
title: ${yamlScalar(safeSlug)}
aliases: [${project} ${safeSlug} milestone]
tags:
  - ${projectTag(project)}
  - roadmap
  - milestone
created: ${date}
updated: ${date}
last_reviewed: ${date}
pageType: roadmap
status: active
owner: PM
icon: "LiFlag"
iconColor: "#2563eb"
---
# ${safeSlug}

## Goal

${goal}

## Priorities

- [ ] **PENDING:** Review current top priorities and active plans, then replace this placeholder with milestone-specific priorities. Link the specific plan, decision, feature, known issue, or doc inline when it exists.

## Major Steps

- [ ] **PENDING:** Create or update concrete plans as work becomes actionable, linking each step to its specific plan when available.
- [ ] **PENDING:** Mirror active plan checklists in ${pmWikiLink("roadmap/done-pending", "done-pending", linkOptions)} and link directly to the relevant mirror section when available.

## Exit Criteria

- [ ] The milestone's priorities are shipped, intentionally deferred, or replaced by a newer milestone note. Link the defining plan, decision, feature, or known issue inline when available.
- [ ] Durable current-state docs and feature pages reflect shipped behavior. Link the specific docs or feature notes inline when available.

## Deferred

*(no items; link a specific idea, rejected decision, plan NOT-in-scope section, or later milestone when one exists)*

${MILESTONE_UPDATE_TRIGGERS_SECTION}

## Navigation

- ${pmWikiLink("roadmap/milestones/milestones", "Back to milestones", linkOptions)}
- ${pmWikiLink("roadmap/roadmap", "Back to roadmap", linkOptions)}
- ${pmWikiLink(project, `Back to ${project}`, linkOptions)}
- [[Projects/Projects|Back to Projects]]
- [[Home|Back to Home]]
`;
}

export function milestonesIndexContent({ project, date, linkOptions = {} }) {
  return `---
title: "milestones"
tags:
  - project-management
created: ${date}
updated: ${date}
last_reviewed: ${date}
pageType: index
status: active
owner: PM
icon: "LiFlag"
iconColor: "#2563eb"
---
# milestones

Phase-level roadmap notes. Agents create, review, and update milestone notes as live PM state. Concrete execution lives in \`roadmap/plans/\` and \`roadmap/done-pending.md\`; milestone priorities, steps, exit criteria, and deferred items link to their specific supporting notes inline.

<!-- vault-maintain:index:start -->
## Subfolders

*(no items)*

## Notes

*(no items)*
<!-- vault-maintain:index:end -->

## Navigation

- ${pmWikiLink("roadmap/roadmap", "Back to roadmap", linkOptions)}
- ${pmWikiLink(project, `Back to ${project}`, linkOptions)}
- [[Projects/Projects|Back to Projects]]
- [[Home|Back to Home]]
`;
}

export function ensureMilestonesIndexLink(content, { slug, linkOptions = {}, description = null }) {
  const safeSlug = slugifyMilestone(slug);
  const line = `- ${pmWikiLink(`roadmap/milestones/${safeSlug}`, safeSlug, linkOptions)} - ${description ?? "Agent-maintained milestone"}`;
  const normalized = String(content ?? "").replace(/\r\n/g, "\n");
  if (normalized.includes(`roadmap/milestones/${safeSlug}`)) return { updated: content, changes: [] };

  const markerRe = /(<!--\s*vault-maintain:index:start\s*-->[\s\S]*?^## Notes\s*$\n)([\s\S]*?)(\n<!--\s*vault-maintain:index:end\s*-->)/m;
  const match = normalized.match(markerRe);
  if (!match) {
    return { updated: `${normalized.trimEnd()}\n\n## Notes\n\n${line}\n`, changes: [`linked ${safeSlug} in milestones index`] };
  }

  const existing = match[2]
    .split(/\r?\n/)
    .map((item) => item.trimEnd())
    .filter((item) => item.trim() && item.trim() !== "*(no items)*");
  const notes = [...existing, line].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  return {
    updated: normalized.replace(markerRe, `${match[1]}${notes.join("\n")}${match[3]}`),
    changes: [`linked ${safeSlug} in milestones index`],
  };
}

export function milestoneSlugFromRel(rel) {
  return basename(rel, ".md");
}
