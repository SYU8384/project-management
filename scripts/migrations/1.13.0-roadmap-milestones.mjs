#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import { findVaultRoot } from "../lib/paths.mjs";
import { parseWikiLinkBody, projectPathFromVault, renderWikiLinkBody } from "../lib/obsidian-links.mjs";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function collectLiveMarkdownFiles(pmFolder) {
  const files = [];
  function walk(abs) {
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const child = join(abs, entry.name);
      const rel = relative(pmFolder, child).split("\\").join("/");
      if (entry.isDirectory()) {
        if (rel === "history" || rel === "archive" || rel.startsWith("history/") || rel.startsWith("archive/")) continue;
        walk(child);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push({ abs: child, rel });
      }
    }
  }
  walk(pmFolder);
  return files;
}

function splitFrontmatter(content) {
  const normalized = String(content ?? "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { frontmatter: "", body: normalized };
  return { frontmatter: match[1], body: normalized.slice(match[0].length) };
}

function setFrontmatterValue(frontmatter, key, value) {
  const line = `${key}: ${value}`;
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*.*$`, "m");
  if (re.test(frontmatter)) return frontmatter.replace(re, line);
  return `${frontmatter.trimEnd()}\n${line}`;
}

function sectionBody(body, heading) {
  const re = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
  const match = body.match(re);
  if (!match) return "";
  const start = match.index + match[0].length;
  const rest = body.slice(start);
  const next = rest.match(/\n##\s+/);
  const end = next ? start + next.index : body.length;
  return body.slice(start, end).trim();
}

function migratedMvpContent(original, { project, linkRoot, date }) {
  const split = splitFrontmatter(original);
  let fm = split.frontmatter;
  fm = setFrontmatterValue(fm, "title", "mvp");
  fm = setFrontmatterValue(fm, "aliases", "[mvp, mvp-priorities]");
  fm = setFrontmatterValue(fm, "updated", date);
  fm = setFrontmatterValue(fm, "last_reviewed", date);
  fm = setFrontmatterValue(fm, "pageType", "roadmap");
  fm = setFrontmatterValue(fm, "status", "active");
  fm = setFrontmatterValue(fm, "owner", "PM");

  const goal = sectionBody(split.body, "Alpha Goal") || "Migrated from the legacy `roadmap/mvp-priorities.md` note.";
  const priorities = sectionBody(split.body, "MVP Priorities") || "*(no priorities captured from the legacy note)*";
  const deferred = sectionBody(split.body, "Not Yet MVP") || "*(no deferred scope captured from the legacy note)*";

  const body = `# mvp

> Migrated from legacy \`roadmap/mvp-priorities.md\` by migration \`1.13.0-roadmap-milestones\`.

## Goal

${goal}

## Priorities

${priorities}

## Major Steps

- [ ] **PENDING:** Convert any still-active priority above into a concrete \`roadmap/plans/YYYY-MM-DD_slug.md\` note when it becomes actionable.
- [ ] **PENDING:** Mirror active plan checklists in [[${linkRoot}/roadmap/done-pending|done-pending]].

## Exit Criteria

- [ ] MVP priorities above are shipped, intentionally deferred, or replaced by a newer milestone note.
- [ ] Durable current-state docs and feature pages reflect shipped behavior.

## Deferred

${deferred}

## Navigation

- [[${linkRoot}/roadmap/milestones/milestones|Back to milestones]]
- [[${linkRoot}/roadmap/roadmap|Back to roadmap]]
- [[${linkRoot}/${project}|Back to ${project}]]
`;

  return `---\n${fm.trimEnd()}\n---\n${body}`;
}

function milestonesIndex({ project, linkRoot, date }) {
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

Phase-level roadmap notes. Milestones frame goals, priorities, major steps, exit criteria, and deferred scope; concrete execution lives in \`roadmap/plans/\` and \`roadmap/done-pending.md\`. Specific supporting plans, decisions, features, issues, and docs are linked inline inside the relevant milestone section.

<!-- vault-maintain:index:start -->
## Subfolders

*(no items)*

## Notes

- [[${linkRoot}/roadmap/milestones/mvp|mvp]] - Migrated MVP milestone.
<!-- vault-maintain:index:end -->

## Navigation

- [[${linkRoot}/roadmap/roadmap|Back to roadmap]]
- [[${linkRoot}/${project}|Back to ${project}]]
`;
}

function ensureMilestoneSubfolderLink(content, linkRoot) {
  let updated = content
    .replace(/MVP priorities/g, "Milestones")
    .replace(/MVP priority tracker/g, "Phase-level milestone strategy and priorities");
  updated = updated
    .split(/\r?\n/)
    .filter((line) => !line.includes("roadmap/mvp-priorities"))
    .join("\n");
  if (updated.includes("roadmap/milestones/milestones")) return updated;

  const subfolderLine = `- [[${linkRoot}/roadmap/milestones/milestones|milestones/]] - Phase-level milestone strategy and priorities`;
  const subfolders = updated.match(/^## Subfolders\s*$/m);
  if (!subfolders) return `${updated.trimEnd()}\n\n## Subfolders\n\n${subfolderLine}\n`;
  const start = subfolders.index + subfolders[0].length;
  const rest = updated.slice(start);
  const next = rest.match(/\n##\s+/);
  const end = next ? start + next.index : updated.length;
  const body = updated.slice(start, end);
  const cleaned = body.replace(/^\s*[-*]\s*\*\(no items\)\*\s*$/m, "").trim();
  const replacement = `## Subfolders\n\n${cleaned ? `${cleaned}\n` : ""}${subfolderLine}`;
  return `${updated.slice(0, subfolders.index)}${replacement}${updated.slice(end)}`;
}

function rewriteMvpPriorityWikiLinks(content) {
  return String(content ?? "").replace(/(!?)\[\[([^\]\n]+)\]\]/g, (match, bang, body) => {
    const parsed = parseWikiLinkBody(body);
    if (parsed.target !== "roadmap/mvp-priorities" && !parsed.target.endsWith("/roadmap/mvp-priorities")) {
      return match;
    }
    const target = parsed.target.replace(/(^|\/)roadmap\/mvp-priorities$/, "$1roadmap/milestones/mvp");
    return `${bang}[[${renderWikiLinkBody({ ...parsed, target })}]]`;
  });
}

function rewriteLiveLinks(pmFolder, linkRoot, ctx) {
  let changedFiles = 0;
  for (const file of collectLiveMarkdownFiles(pmFolder)) {
    if (file.rel === "roadmap/milestones/mvp.md") continue;
    let original = readFileSync(file.abs, "utf8");
    let updated = original;
    if (file.rel === "roadmap/roadmap.md") {
      updated = ensureMilestoneSubfolderLink(updated, linkRoot);
    }
    updated = rewriteMvpPriorityWikiLinks(updated);
    if (updated !== original) {
      changedFiles++;
      if (!ctx.dryRun) writeFileSync(file.abs, updated);
      ctx.log("info", `${file.rel}: updated live milestone routing`);
    }
  }
  return changedFiles;
}

function detect({ pmFolder }) {
  return existsSync(join(pmFolder, "roadmap", "mvp-priorities.md"));
}

function plan() {
  return [
    "Create `roadmap/milestones/` and `roadmap/milestones/milestones.md`.",
    "Move legacy `roadmap/mvp-priorities.md` to `roadmap/milestones/mvp.md` and reshape it as a milestone note while preserving its goal, priorities, and deferred scope.",
    "Rewrite live links and the roadmap folder index. `history/` and `archive/` are not rewritten.",
  ];
}

function apply({ pmFolder, ctx }) {
  const date = today();
  const project = basename(pmFolder);
  const linkRoot = projectPathFromVault(findVaultRoot(pmFolder, ctx.configPath), pmFolder);
  const source = join(pmFolder, "roadmap", "mvp-priorities.md");
  const milestonesDir = join(pmFolder, "roadmap", "milestones");
  const indexPath = join(milestonesDir, "milestones.md");
  const target = join(milestonesDir, "mvp.md");

  if (!existsSync(source)) {
    ctx.log("skip", "legacy roadmap/mvp-priorities.md not found");
    return { suggestedHistory: [], manualReview: [] };
  }
  if (existsSync(target)) {
    throw new Error("roadmap/milestones/mvp.md already exists; resolve it before running the migration.");
  }

  const sourceContent = readFileSync(source, "utf8");
  const nextContent = migratedMvpContent(sourceContent, { project, linkRoot, date });

  if (!ctx.dryRun) {
    mkdirSync(milestonesDir, { recursive: true });
    writeFileSync(target, nextContent);
    if (!existsSync(indexPath)) writeFileSync(indexPath, milestonesIndex({ project, linkRoot, date }));
    else {
      const originalIndex = readFileSync(indexPath, "utf8");
      if (!originalIndex.includes("roadmap/milestones/mvp")) {
        writeFileSync(indexPath, originalIndex.replace("## Notes\n", `## Notes\n\n- [[${linkRoot}/roadmap/milestones/mvp|mvp]] - Migrated MVP milestone.\n`));
      }
    }
    rmSync(source);
  }

  ctx.log("done", "roadmap/mvp-priorities.md transformed into roadmap/milestones/mvp.md");
  const changedFiles = rewriteLiveLinks(pmFolder, linkRoot, ctx);

  return {
    suggestedHistory: [
      `- **Roadmap priorities now live in milestone notes.** chore(pm): apply migration \`1.13.0-roadmap-milestones\` to move legacy \`roadmap/mvp-priorities.md\` into \`roadmap/milestones/mvp.md\`, add the milestones index, and rewrite ${changedFiles} live routing file(s).`,
    ],
    manualReview: [],
  };
}

export default {
  id: "1.13.0-roadmap-milestones",
  from: "<1.13.0",
  to: "1.13.0",
  describe:
    "Replace the legacy MVP-priorities roadmap note with the milestone roadmap lane. Moves `roadmap/mvp-priorities.md` to `roadmap/milestones/mvp.md`, creates the milestones folder note, and repairs live links while leaving history and archive records unchanged.",
  detect,
  plan,
  apply,
};
