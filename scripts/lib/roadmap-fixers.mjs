/**
 * lib/roadmap-fixers.mjs
 *
 * Auto-fixer functions for roadmap content conventions
 * (D-007 / D-008 / D-009 / D-012 / D-015 / D-016). Imported by both the
 * `check-roadmap-conventions.mjs` validator (for `--fix` mode) and the
 * `1.7.0-roadmap-content-conventions.mjs` migration (for `apply()`).
 *
 * Design: each fixer is a pure function that takes the file content (and
 * any needed context) and returns `{ updated, changes, manualReview }`.
 * The caller is responsible for writing `updated` to disk and reporting
 * `changes` to the user. No I/O happens inside the fixers themselves.
 *
 * All fixers are idempotent: re-running on a conformant file returns
 * `updated === content` and `changes === []`. The migration relies on
 * this property to be safe to re-apply.
 */

import { MILESTONE_REQUIRED_SECTIONS } from "./convention.mjs";
import { milestoneRelatedNotesState } from "./milestones.mjs";
import { pmWikiLink } from "./obsidian-links.mjs";

const STATUS_EMOJI = Object.freeze({
  Brainstorming: "🟣",
  Scoping: "🟡",
  Approved: "🔵",
  Implemented: "🟢",
  Declined: "🔴",
});

const STATUS_NAMES = Object.freeze(Object.keys(STATUS_EMOJI));
export const HUMAN_ARCHIVE_CONFIRMATION_TEXT =
  "Human verification for archival: user has tested the implemented plan and explicitly approved archiving this section and linked plan.";
export const HUMAN_ARCHIVE_CONFIRMATION_LINE = `- [ ] PENDING: ${HUMAN_ARCHIVE_CONFIRMATION_TEXT}`;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeRelPath(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/\.md$/i, "")
    .replace(/^\/+/, "")
    .trim();
}

function basenameNoExt(relPath) {
  const normalized = normalizeRelPath(relPath);
  return normalized.split("/").pop() ?? normalized;
}

function normalizeToken(value) {
  return String(value ?? "")
    .trim()
    .replace(/^`|`$/g, "")
    .replace(/^\*\*|\*\*$/g, "")
    .replace(/[.;]$/g, "")
    .trim();
}

function buildTargetIndex(targets = []) {
  const normalizedTargets = [...new Set(targets.map(normalizeRelPath).filter(Boolean))];
  return normalizedTargets.map((rel) => ({
    rel,
    base: basenameNoExt(rel),
    lowerRel: rel.toLowerCase(),
    lowerBase: basenameNoExt(rel).toLowerCase(),
  }));
}

function lanePrefixFor(kind) {
  if (kind === "decisions") return "decisions/";
  if (kind === "features") return "features/";
  if (kind === "system") return "system/";
  if (kind === "docs") return "docs/";
  if (kind === "plans") return "roadmap/plans/";
  return "";
}

function isNoneValue(value) {
  const normalized = normalizeToken(value).toLowerCase();
  return (
    normalized === "" ||
    normalized === "-" ||
    normalized === "—" ||
    normalized === "none" ||
    normalized === "none yet" ||
    normalized === "*(none)*" ||
    normalized === "`*(none)*`"
  );
}

function splitCommaList(value) {
  const parts = [];
  let current = "";
  let bracketDepth = 0;
  for (const ch of value) {
    if (ch === "[" || ch === "(") bracketDepth++;
    if (ch === "]" || ch === ")") bracketDepth = Math.max(0, bracketDepth - 1);
    if (ch === "," && bracketDepth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function isWikiLink(value) {
  return /^\[\[[^\]]+\]\]$/.test(value.trim());
}

function linkFor(target, display, options = {}) {
  const base = basenameNoExt(target.rel);
  return pmWikiLink(target.rel, display || base, options);
}

function targetMatchesToken(target, token, kind) {
  const lowerToken = token.toLowerCase();
  if (!lowerToken) return false;

  if (target.lowerRel === lowerToken || target.lowerBase === lowerToken) return true;
  if (target.lowerBase.startsWith(`${lowerToken}_`) || target.lowerBase.startsWith(`${lowerToken}-`)) return true;

  if (kind === "decisions") {
    const decisionId = lowerToken.match(/^d-(\d{3})$/);
    if (decisionId && target.lowerBase.startsWith(`d-${decisionId[1]}_`)) return true;

    const legacyAdr = lowerToken.match(/^adr-(\d{3})(?:[_-](.+))?$/);
    if (legacyAdr) {
      const prefix = `d-${legacyAdr[1]}_adr`;
      if (!target.lowerBase.startsWith(prefix)) return false;
      const slug = legacyAdr[2];
      return !slug || target.lowerBase.includes(slug.replace(/-/g, "_")) || target.lowerBase.includes(slug);
    }
  }

  return false;
}

function findUniqueTarget(rawToken, kind, targets) {
  const token = normalizeToken(rawToken);
  if (!token || token.includes("<") || token.includes(">")) {
    return { status: "skip", token };
  }
  const prefix = lanePrefixFor(kind);
  const scopedTargets = buildTargetIndex(targets).filter((target) => !prefix || target.rel.startsWith(prefix));
  const matches = scopedTargets.filter((target) => targetMatchesToken(target, token, kind));
  if (matches.length === 1) return { status: "found", token, target: matches[0] };
  if (matches.length > 1) return { status: "ambiguous", token, matches };
  return { status: "missing", token };
}

function h2Headings(content) {
  return [...content.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1].trim());
}

function replaceH2Section(content, heading, replacement) {
  const escaped = escapeRegExp(heading);
  const match = content.match(new RegExp(`^##\\s+${escaped}\\s*$`, "m"));
  if (!match) return content;
  const start = match.index;
  const afterHeading = start + match[0].length;
  const rest = content.slice(afterHeading);
  const next = rest.match(/\n##\s+/);
  const end = next ? afterHeading + next.index : content.length;
  const before = content.slice(0, start).replace(/\n+$/, "\n\n");
  const after = content.slice(end).replace(/^\n+/, "\n\n");
  return `${before}${replacement}${after}`.replace(/\n{3,}/g, "\n\n");
}

function h2Sections(content) {
  const matches = [...content.matchAll(/^##\s+(.+?)\s*$/gm)];
  return matches.map((match, index) => {
    const bodyStart = match.index + match[0].length;
    const next = matches[index + 1];
    const bodyEnd = next ? next.index : content.length;
    return {
      heading: match[1].trim(),
      body: content.slice(bodyStart, bodyEnd),
      start: match.index,
      end: bodyEnd,
    };
  });
}

function hasPlanningNote(body) {
  return Boolean(planningNoteTarget(body));
}

function humanArchiveConfirmationMatch(body) {
  const escaped = escapeRegExp(HUMAN_ARCHIVE_CONFIRMATION_TEXT);
  return body.match(new RegExp(`^\\s*-\\s*\\[([ xX])\\].*${escaped}\\s*$`, "m"));
}

function hasHumanArchiveConfirmation(body) {
  return Boolean(humanArchiveConfirmationMatch(body));
}

function planningNoteTarget(body) {
  const line = body.match(/^Planning note:\s*(.+?)\s*$/m)?.[1]?.trim();
  if (!line) return null;
  const wiki = line.match(/^\[\[([^\]]+)\]\]$/);
  if (!wiki) {
    return { status: "plain", raw: line };
  }
  const raw = wiki[1];
  const pipe = raw.indexOf("|");
  const target = pipe === -1 ? raw : raw.slice(0, pipe);
  const hash = target.indexOf("#");
  return {
    status: "wiki",
    raw,
    target: normalizeRelPath(hash === -1 ? target : target.slice(0, hash)),
  };
}

function resolvePlanningTarget(rawTarget, targets) {
  const normalized = normalizeRelPath(rawTarget);
  const planTargets = buildTargetIndex(targets).filter((target) => target.rel.startsWith("roadmap/plans/"));
  if (!normalized) return { status: "missing", target: normalized };
  if (normalized.startsWith("archive/") || normalized.includes("/archive/")) {
    return { status: "already-archived", target: normalized };
  }

  let rel = null;
  if (normalized.startsWith("roadmap/plans/")) {
    rel = normalized;
  } else {
    const marker = "/roadmap/plans/";
    const index = normalized.indexOf(marker);
    if (index !== -1) rel = normalized.slice(index + 1);
  }
  if (rel) {
    const matches = planTargets.filter((target) => target.rel === rel);
    if (matches.length === 1) return { status: "found", rel };
    return { status: "missing", target: normalized, rel };
  }

  if (!normalized.includes("/")) {
    const matches = planTargets.filter((target) => target.base === normalized);
    if (matches.length === 1) return { status: "found", rel: matches[0].rel };
    if (matches.length > 1) return { status: "ambiguous", target: normalized, matches: matches.map((target) => target.rel) };
  }

  return { status: "missing", target: normalized };
}

function archiveRelForPlan(planRel) {
  const stem = basenameNoExt(planRel);
  const slug = stem.replace(/^\d{4}-\d{2}-\d{2}[_-]?/, "");
  return `archive/${slug}-archived`;
}

export function findArchiveReadyDonePendingSections(content) {
  const findings = [];
  for (const section of h2Sections(content)) {
    if (!hasPlanningNote(section.body)) continue;
    if (!hasHumanArchiveConfirmation(section.body)) continue;
    const checkboxMatches = [...section.body.matchAll(/^\s*-\s*\[([ xX])\]/gm)];
    if (checkboxMatches.length === 0) continue;
    const unchecked = checkboxMatches.some((match) => match[1] === " ");
    if (unchecked) continue;
    findings.push(section.heading);
  }
  return findings;
}

export function findPlanningMirrorsMissingHumanArchiveConfirmation(content) {
  const findings = [];
  for (const section of h2Sections(content)) {
    if (!hasPlanningNote(section.body)) continue;
    if (hasHumanArchiveConfirmation(section.body)) continue;
    findings.push(section.heading);
  }
  return findings;
}

function insertHumanArchiveConfirmation(section) {
  const body = section.body.replace(/^\n+/, "").replace(/\n+$/, "");
  const lines = body.split("\n");
  const relevantIndex = lines.findIndex((line) => /^\s*-\s*(?:\*\*)?Relevant\b/i.test(line));
  let insertIndex = -1;

  if (relevantIndex !== -1) {
    insertIndex = relevantIndex;
    while (insertIndex > 0 && lines[insertIndex - 1].trim() === "") {
      insertIndex -= 1;
    }
  } else {
    const checkboxIndexes = [];
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*-\s*\[[ xX]\]/.test(lines[i])) checkboxIndexes.push(i);
    }
    if (checkboxIndexes.length > 0) {
      insertIndex = checkboxIndexes[checkboxIndexes.length - 1] + 1;
    } else {
      const planningIndex = lines.findIndex((line) => /^Planning note:\s*/.test(line));
      insertIndex = planningIndex === -1 ? lines.length : planningIndex + 1;
    }
  }

  lines.splice(insertIndex, 0, HUMAN_ARCHIVE_CONFIRMATION_LINE);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

export function ensureHumanArchiveConfirmation(content) {
  const changes = [];
  let updated = content;
  const sections = h2Sections(content)
    .filter((section) => hasPlanningNote(section.body) && !hasHumanArchiveConfirmation(section.body))
    .sort((a, b) => b.start - a.start);

  for (const section of sections) {
    const replacement = `## ${section.heading}\n\n${insertHumanArchiveConfirmation(section)}\n\n`;
    updated = `${updated.slice(0, section.start)}${replacement}${updated.slice(section.end)}`.replace(/\n{3,}/g, "\n\n");
    changes.push(`planning mirror \`## ${section.heading}\` missing human archive confirmation checkbox`);
  }

  return { updated, changes, manualReview: [] };
}

export function planArchiveReadyDonePendingSections(content, targets = []) {
  const targetSet = new Set(targets.map(normalizeRelPath));
  const archives = [];
  const manualReview = [];

  for (const section of h2Sections(content)) {
    const note = planningNoteTarget(section.body);
    if (!note) continue;
    if (!hasHumanArchiveConfirmation(section.body)) continue;

    const checkboxMatches = [...section.body.matchAll(/^\s*-\s*\[([ xX])\]/gm)];
    if (checkboxMatches.length === 0) continue;
    const unchecked = checkboxMatches.some((match) => match[1] === " ");
    if (unchecked) continue;

    if (note.status !== "wiki") {
      manualReview.push(`completed planning mirror \`## ${section.heading}\` has a non-wiki Planning note; link the active plan before auto-archive`);
      continue;
    }

    const resolved = resolvePlanningTarget(note.target, targets);
    if (resolved.status === "already-archived") {
      manualReview.push(`completed planning mirror \`## ${section.heading}\` already points outside roadmap/plans/: ${resolved.target}`);
      continue;
    }
    if (resolved.status === "ambiguous") {
      manualReview.push(`completed planning mirror \`## ${section.heading}\` planning note is ambiguous: ${resolved.matches.join(", ")}`);
      continue;
    }
    if (resolved.status !== "found") {
      manualReview.push(`completed planning mirror \`## ${section.heading}\` planning note has no existing roadmap/plans target: ${note.target}`);
      continue;
    }

    const archiveRel = archiveRelForPlan(resolved.rel);
    if (targetSet.has(archiveRel)) {
      manualReview.push(`completed planning mirror \`## ${section.heading}\` archive target already exists: ${archiveRel}.md`);
      continue;
    }

    archives.push({
      heading: section.heading,
      body: section.body,
      start: section.start,
      end: section.end,
      planRel: resolved.rel,
      archiveRel,
    });
  }

  return { archives, manualReview };
}

export function removeDonePendingSections(content, sections) {
  let updated = content;
  for (const section of [...sections].sort((a, b) => b.start - a.start)) {
    const before = updated.slice(0, section.start).replace(/\n+$/, "\n\n");
    const after = updated.slice(section.end).replace(/^\n+/, "\n\n");
    updated = `${before}${after}`.replace(/\n{3,}/g, "\n\n");
  }
  return updated;
}

/**
 * D-008: insert the canonical status emoji in three places inside
 * `roadmap/ideas.md`:
 *   1. The `## Status Key` table (Status column rows).
 *   2. The `## Idea Register` table (Status column rows).
 *   3. The `## Idea Details` `**Status:** <name>` lines.
 *
 * Idempotent: a status name that already has the emoji prefix is left
 * alone. Unknown status names are left alone (caller surfaces a finding
 * via `manualReview`).
 */
export function insertStatusEmojisInIdeas(content) {
  const changes = [];
  const manualReview = [];
  let updated = content;

  // 1) Status Key table: rows look like `| Brainstorming | Rough idea, ... |`
  //    Match the row start, prepend the emoji if missing.
  for (const name of STATUS_NAMES) {
    const emoji = STATUS_EMOJI[name];
    const re = new RegExp(`^(\\|\\s*)${escapeRegExp(name)}(\\s*\\|)`, "gm");
    updated = updated.replace(re, (match, before, after) => {
      if (before.includes(emoji)) return match;
      changes.push(`status-key row "${name}" -> ${emoji} ${name}`);
      return `${before}${emoji} ${name}${after}`;
    });
  }

  // 2) Idea Register table: a row like
  //    `| IDEA-001 | ... | Brainstorming | ... |`
  //    The Status column is whichever cell contains a plain status name
  //    (no emoji). Match conservatively: only touch rows that have
  //    exactly one plain status token in a cell.
  const lines = updated.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trimStart().startsWith("|")) continue;
    if (line.includes("|---") || line.includes("|:--")) continue;
    if (line.includes("**Status:**")) continue;
    const cells = line.split("|");
    let touched = false;
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c].trim();
      if (STATUS_NAMES.includes(cell)) {
        const emoji = STATUS_EMOJI[cell];
        cells[c] = cells[c].replace(cell, `${emoji} ${cell}`);
        changes.push(`register row line ${i + 1}: ${cell} -> ${emoji} ${cell}`);
        touched = true;
      } else if (Object.values(STATUS_EMOJI).some((e) => cell.startsWith(`${e} `)) && STATUS_NAMES.some((n) => cell === `${STATUS_EMOJI[n]} ${n}`)) {
        // already conformant; skip
      }
    }
    if (touched) lines[i] = cells.join("|");
  }
  updated = lines.join("\n");

  // 3) Idea Details `**Status:** <name>` lines.
  for (const name of STATUS_NAMES) {
    const emoji = STATUS_EMOJI[name];
    const re = new RegExp(`(\\*\\*Status:\\*\\*\\s*)${escapeRegExp(name)}\\b`, "g");
    updated = updated.replace(re, (match, before) => {
      if (before.includes(emoji)) return match;
      changes.push(`idea details "**Status:** ${name}" -> **Status:** ${emoji} ${name}`);
      return `${before}${emoji} ${name}`;
    });
  }

  return { updated, changes, manualReview };
}

/**
 * D-009: drop the `## Fixed` section from `roadmap/known-issues.md` if it
 * contains no items (no `- [x]` or `- [ ]` lines under the heading).
 * If the section HAS items, the fixer leaves it alone and reports a
 * `manualReview` finding (the migration's user needs to migrate items
 * to `docs/Developer Guide/known-bugs.md` or delete them by hand).
 *
 * Also removes the `## Contents` TOC link to `## Fixed` if present.
 */
export function dropEmptyFixedSection(content) {
  const changes = [];
  const manualReview = [];
  let updated = content;

  const fixedH2Re = /^## Fixed\s*$/m;
  const m = updated.match(fixedH2Re);
  if (!m) {
    return { updated, changes, manualReview };
  }
  const start = m.index + m[0].length;
  const rest = updated.slice(start);
  const nextH2 = rest.match(/\n## (?!#)/);
  const sectionEnd = nextH2 ? start + nextH2.index : updated.length;
  const body = updated.slice(start, sectionEnd);

  const hasItems = /^\s*-\s*\[[ x]\]/m.test(body);
  if (hasItems) {
    manualReview.push(
      "`## Fixed` section has items; auto-fixer skips it. Migrate items to `docs/Developer Guide/known-bugs.md` (D-009 lifecycle) or delete them, then re-run."
    );
    return { updated, changes, manualReview };
  }

  // Drop the H2 heading + body. Collapse the surrounding blank lines
  // (the section is preceded by a `\n\n` to separate it from the prior
  // section, and followed by `\n\n` to separate from the next section;
  // after removal we want exactly `\n\n` between the prior and next
  // section headings).
  const before = updated.slice(0, m.index).replace(/\n+$/, "\n");
  const after = updated.slice(sectionEnd).replace(/^\n+/, "\n");
  updated = before + "\n" + after;
  changes.push("dropped empty `## Fixed` section");

  // Update the `## Contents` TOC: remove the `[[#Fixed]]` line.
  const tocRe = /^- \[\[#Fixed\]\]\s*$/m;
  if (tocRe.test(updated)) {
    updated = updated.replace(tocRe, "");
    changes.push("removed `[[#Fixed]]` from Contents TOC");
  }

  return { updated, changes, manualReview };
}

/**
 * D-009 (additional): the `## Active` section in `roadmap/known-issues.md`
 * SHOULD have `### <Domain>` H3 subsections when it has multiple items.
 * The fixer cannot pick the right domain names (they're project-specific),
 * so it only DETECTS the violation. The validator surfaces it as a
 * `manualReview` finding.
 */
export function checkDomainGroupingInActive(content) {
  const manualReview = [];
  const h2 = content.match(/^## Active\s*$/m);
  if (!h2) return { manualReview };
  const start = h2.index + h2[0].length;
  const rest = content.slice(start);
  const nextH2 = rest.match(/\n## (?!#)/);
  const sectionEnd = nextH2 ? start + nextH2.index : content.length;
  const body = content.slice(start, sectionEnd);

  const itemRe = /^\s*-\s*\[[ x]\]/gm;
  const items = body.match(itemRe) ?? [];
  const hasDomainH3 = /^###\s+\S+/m.test(body);

  if (items.length >= 2 && !hasDomainH3) {
    manualReview.push(
      `\`## Active\` has ${items.length} items but no \`### <Domain>\` H3 subsections. Group items under project-specific domain names (e.g. \`### Migrations\`, \`### Validators\`, \`### Connectors\`). The auto-fixer cannot pick the right names.`
    );
  }
  return { manualReview };
}

/**
 * D-010: the `## MVP Priorities` section in `roadmap/mvp-priorities.md`
 * SHOULD have `### <Lane>` H3 subsections when it has items. Like
 * domain grouping, lane names are project-specific; the fixer only
 * DETECTS the violation.
 */
export function checkLaneGroupingInMvpPriorities(content) {
  const manualReview = [];
  const h2 = content.match(/^## MVP Priorities\s*$/m);
  if (!h2) return { manualReview };
  const start = h2.index + h2[0].length;
  const rest = content.slice(start);
  const nextH2 = rest.match(/\n## (?!#)/);
  const sectionEnd = nextH2 ? start + nextH2.index : content.length;
  const body = content.slice(start, sectionEnd);

  const itemRe = /^\s*-\s*\[[ x]\]/gm;
  const items = body.match(itemRe) ?? [];
  const hasLaneH3 = /^###\s+\S+/m.test(body);

  if (items.length >= 1 && !hasLaneH3) {
    manualReview.push(
      `\`## MVP Priorities\` has ${items.length} item(s) but no \`### <Lane>\` H3 subsections. Group items under project-specific lane names. The auto-fixer cannot pick the right names.`
    );
  }
  return { manualReview };
}

/**
 * D-015/D-016: milestone notes in `roadmap/milestones/` have a predictable
 * scan shape and no generic related-note link dump. The checker does not
 * invent strategy, priorities, or inline evidence placement.
 */
export function checkMilestoneNoteShape(content, relPath) {
  const manualReview = [];
  const headings = new Set(h2Headings(content));
  for (const section of MILESTONE_REQUIRED_SECTIONS) {
    if (!headings.has(section)) {
      manualReview.push(`${relPath}: missing \`## ${section}\``);
    }
  }
  const relatedNotes = milestoneRelatedNotesState(content, relPath);
  if (relatedNotes.hasSection) {
    manualReview.push(
      ...(
        relatedNotes.removable
          ? [`${relPath}: deprecated generic \`## Related Notes\` section should be removed; run \`check-roadmap-conventions --fix\` or delete the section.`]
          : relatedNotes.manualReview
      )
    );
  }
  return { manualReview };
}

/**
 * D-007: rename date-prefixed H2s in `roadmap/done-pending.md` to
 * slug-only H2s. E.g. `## 2026-05-22_tier-system` -> `## tier-system`.
 *
 * Also updates the `## Contents` TOC: replaces the date-prefixed entry
 * with the slug-only form. The `Planning note:` wikilink inside each
 * mirror section is NOT touched (the link target stays date-prefixed
 * because the planning-note filename is date-prefixed).
 */
export function renameDatePrefixedH2s(content) {
  const changes = [];
  const manualReview = [];
  let updated = content;

  const dateRe = /^## (\d{4}-\d{2}-\d{2}_(.+?))\s*$/gm;
  updated = updated.replace(dateRe, (match, fullSlug, slug) => {
    if (slug === fullSlug) return match;
    // The convention in OpenManager is hyphen-separated slugs
    // (e.g. `## openclaw-inspired-agent-memory`), so convert any
    // underscores in the slug part to hyphens to match.
    const slugHyphen = slug.replace(/_/g, "-");
    changes.push(`H2: \`## ${fullSlug}\` -> \`## ${slugHyphen}\``);
    return `## ${slugHyphen}`;
  });

  // Update the Contents TOC if it references the old slug.
  if (changes.length > 0) {
    const tocRe = /^- \[\[#(\d{4}-\d{2}-\d{2}_([^\]]+))\]\]\s*$/gm;
    updated = updated.replace(tocRe, (match, _fullSlug, slug) => `- [[#${slug.replace(/_/g, "-")}]]`);
  }

  return { updated, changes, manualReview };
}

/**
 * D-012: keep `roadmap/done-pending.md` Contents aligned to the actual
 * H2 headings in the file. The TOC links only to H2s in this note; links
 * to planning notes, decisions, features, system docs, or docs guide notes
 * belong inside the relevant sections.
 */
export function syncDonePendingContents(content) {
  const changes = [];
  const manualReview = [];
  const headings = h2Headings(content).filter((heading) => heading !== "Contents");
  if (headings.length === 0) {
    manualReview.push("no H2 sections found for done-pending Contents");
    return { updated: content, changes, manualReview };
  }

  const toc = `## Contents\n\n${headings.map((heading) => `- [[#${heading}]]`).join("\n")}`;
  let updated = content;

  const markerRe = /<!--\s*vault-maintain:toc:start\s*-->[\s\S]*?<!--\s*vault-maintain:toc:end\s*-->/m;
  if (markerRe.test(updated)) {
    const block = `<!-- vault-maintain:toc:start -->\n${toc}\n<!-- vault-maintain:toc:end -->`;
    updated = updated.replace(markerRe, block);
  } else if (/^##\s+Contents\s*$/m.test(updated)) {
    const match = updated.match(/^##\s+Contents\s*$/m);
    const sectionStart = match.index;
    const bodyStart = sectionStart + match[0].length;
    const rest = updated.slice(bodyStart);
    const next = rest.match(/\n##\s+/);
    const sectionEnd = next ? bodyStart + next.index : updated.length;
    const oldBody = updated.slice(bodyStart, sectionEnd);
    const preserved = oldBody
      .split("\n")
      .filter((line) => !/^\s*-\s*\[\[#.+\]\]\s*$/.test(line))
      .join("\n")
      .trim();
    const replacement = preserved ? `${toc}\n\n${preserved}` : toc;
    const before = updated.slice(0, sectionStart).replace(/\n+$/, "\n\n");
    const after = updated.slice(sectionEnd).replace(/^\n+/, "\n\n");
    updated = `${before}${replacement}${after}`.replace(/\n{3,}/g, "\n\n");
  } else {
    const h1 = updated.match(/^# .+\n/m);
    if (!h1) {
      manualReview.push("could not locate insertion point for done-pending Contents (no H1, no existing Contents)");
      return { updated: content, changes, manualReview };
    }
    const idx = h1.index + h1[0].length;
    updated = `${updated.slice(0, idx)}\n${toc}\n\n${updated.slice(idx).replace(/^\n+/, "")}`;
  }

  if (updated !== content) {
    changes.push("regenerated Contents TOC from actual H2 headings");
  }
  return { updated, changes, manualReview };
}

/**
 * D-012: convert plain `Planning note: YYYY-MM-DD_slug` lines to wiki
 * links when the matching `roadmap/plans/YYYY-MM-DD_slug.md` target is
 * present. Missing targets are surfaced as manual review; the fixer does
 * not invent plan notes.
 */
export function linkDonePendingPlanningNotes(content, targets = [], options = {}) {
  const changes = [];
  const manualReview = [];
  let updated = content;

  updated = updated.replace(
    /^(Planning note:\s*)(?!\[\[)(\d{4}-\d{2}-\d{2}_[A-Za-z0-9_.-]+)\s*$/gm,
    (match, prefix, stem) => {
      const found = findUniqueTarget(stem, "plans", targets);
      if (found.status === "found") {
        changes.push(`linked planning note ${stem}`);
        return `${prefix}${linkFor(found.target, stem, options)}`;
      }
      if (found.status === "missing") {
        manualReview.push(`Planning note \`${stem}\` has no matching \`roadmap/plans/${stem}.md\` target`);
      } else if (found.status === "ambiguous") {
        manualReview.push(`Planning note \`${stem}\` matched multiple targets; link it by hand`);
      }
      return match;
    }
  );

  return { updated, changes, manualReview };
}

/**
 * D-012: normalize `Relevant ADRs:` / singular labels to canonical labels
 * and link relevant decision/feature/system/docs tokens when they resolve
 * to exactly one existing target in the expected lane.
 */
export function normalizeDonePendingRelevantLinks(content, targets = [], options = {}) {
  const changes = [];
  const manualReview = [];
  const lines = content.split("\n");

  const updatedLines = lines.map((line, index) => {
    const match = line.match(/^(\s*-\s*)(?:\*\*)?Relevant\s+(ADRs?|decisions?|features?|feature|systems?|system|docs?|doc)(?:\*\*)?\s*:\s*(.*)$/i);
    if (!match) return line;

    const [, prefix, rawKind, rawRest] = match;
    const kindLower = rawKind.toLowerCase();
    const kind = kindLower.startsWith("adr") || kindLower.startsWith("decision")
      ? "decisions"
      : kindLower.startsWith("feature")
        ? "features"
        : kindLower.startsWith("system")
          ? "system"
          : "docs";
    const canonicalLabel = `Relevant ${kind}`;
    const rest = rawRest.trim();

    if (isNoneValue(rest)) {
      const normalizedLine = `${prefix}${canonicalLabel}: ${rest || "*(none)*"}`;
      if (normalizedLine !== line) changes.push(`normalized relevant-${kind} label on line ${index + 1}`);
      return normalizedLine;
    }

    const tokens = splitCommaList(rest);
    if (tokens.length === 0) return line;
    let touched = false;
    const nextTokens = tokens.map((token) => {
      const trimmed = token.trim();
      if (isWikiLink(trimmed) || isNoneValue(trimmed)) return trimmed;
      const found = findUniqueTarget(trimmed, kind, targets);
      if (found.status === "found") {
        touched = true;
        changes.push(`linked ${canonicalLabel.toLowerCase()} token \`${found.token}\` on line ${index + 1}`);
        return linkFor(found.target, found.token, options);
      }
      if (found.status === "missing") {
        manualReview.push(`line ${index + 1}: \`${trimmed}\` has no unique ${kind} target to link`);
      } else if (found.status === "ambiguous") {
        manualReview.push(`line ${index + 1}: \`${trimmed}\` matched multiple ${kind} targets; link it by hand`);
      }
      return trimmed;
    });

    const normalizedLine = `${prefix}${canonicalLabel}: ${nextTokens.join(", ")}`;
    if (normalizedLine !== line) {
      if (!touched) changes.push(`normalized relevant-${kind} label on line ${index + 1}`);
      return normalizedLine;
    }
    return line;
  });

  return { updated: updatedLines.join("\n"), changes, manualReview };
}

/**
 * D-012: every idea detail section needs a real summary field. The
 * fixer inserts `TBD`; it never fabricates idea prose.
 */
export function ensureIdeaDetailSummaries(content) {
  const changes = [];
  const manualReview = [];
  const heading = content.match(/^##\s+Idea Details\s*$/m);
  if (!heading) {
    manualReview.push("missing `## Idea Details` section");
    return { updated: content, changes, manualReview };
  }

  const sectionStart = heading.index + heading[0].length;
  const rest = content.slice(sectionStart);
  const nextH2 = rest.match(/\n##\s+/);
  const sectionEnd = nextH2 ? sectionStart + nextH2.index : content.length;
  const before = content.slice(0, sectionStart);
  const section = content.slice(sectionStart, sectionEnd);
  const after = content.slice(sectionEnd);
  const lines = section.split("\n");
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const idea = line.match(/^###\s+(IDEA-\d+\b.*)$/);
    if (!idea) {
      out.push(line);
      continue;
    }

    const body = [];
    let j = i + 1;
    while (j < lines.length && !/^###\s+/.test(lines[j]) && !/^##\s+/.test(lines[j])) {
      body.push(lines[j]);
      j++;
    }
    const hasSummary = body.some((bodyLine) => /\*\*Summary:\*\*/.test(bodyLine));
    out.push(line);
    if (!hasSummary) {
      out.push("");
      out.push("- **Summary:** TBD");
      changes.push(`added TBD Summary to ${idea[1]}`);
      manualReview.push(`${idea[1]} has a TBD Summary; replace it with a 2-4 sentence human-readable description`);
      while (body.length > 0 && body[0].trim() === "") body.shift();
    } else if (body.some((bodyLine) => /\*\*Summary:\*\*\s*TBD\b/i.test(bodyLine))) {
      manualReview.push(`${idea[1]} has a TBD Summary; replace it with a 2-4 sentence human-readable description`);
    }
    out.push(...body);
    i = j - 1;
  }

  return {
    updated: `${before}${out.join("\n")}${after}`,
    changes,
    manualReview,
  };
}

/**
 * D-008 lead note: insert the "Status colors" lead note after the
 * `## Contents` TOC if missing. The note is a single paragraph that
 * documents the convention. The text matches the canonical phrasing
 * used in `templates/ideas.md` and the Project Management PM folder.
 */
export function insertIdeasStatusColorsLeadNote(content) {
  const changes = [];
  const manualReview = [];
  let updated = content;

  const LEAD_NOTE = "**Status colors:** 🟣 Brainstorming · 🟡 Scoping · 🔵 Approved · 🟢 Implemented · 🔴 Declined. The colors appear in the Status Key, the Idea Register, and the Idea Details sections. (Convention adopted in `decisions/D-008_POL_ideas-status-colors.md`.)";

  if (updated.includes("Status colors:") && updated.includes("🟣 Brainstorming")) {
    return { updated, changes, manualReview };
  }

  // Find the `## Contents` TOC's end marker and insert the lead note
  // after it. If the marker is missing, fall back to inserting after
  // the H1 heading.
  const tocEnd = /<!--\s*vault-maintain:toc:end\s*-->/;
  if (tocEnd.test(updated)) {
    updated = updated.replace(tocEnd, (m) => `${m}\n\n${LEAD_NOTE}`);
    changes.push("inserted Status colors lead note after Contents TOC");
  } else {
    const h1 = updated.match(/^# .+\n/);
    if (h1) {
      const idx = h1.index + h1[0].length;
      updated = updated.slice(0, idx) + `\n${LEAD_NOTE}\n` + updated.slice(idx);
      changes.push("inserted Status colors lead note after H1 (no TOC end marker found)");
    } else {
      manualReview.push("could not locate insertion point for Status colors lead note (no H1, no TOC end marker)");
    }
  }

  return { updated, changes, manualReview };
}

export const __test = { STATUS_EMOJI, STATUS_NAMES, buildTargetIndex, findUniqueTarget };
