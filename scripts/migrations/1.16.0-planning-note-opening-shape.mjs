#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { ensurePlanningNoteOpeningShape } from "../lib/roadmap-fixers.mjs";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function listPlanRels(pmFolder) {
  const root = join(pmFolder, "roadmap", "plans");
  const rels = [];
  function walk(abs) {
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const child = join(abs, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "plans.md") {
        rels.push(relative(pmFolder, child).split("\\").join("/").replace(/\.md$/, ""));
      }
    }
  }
  walk(root);
  return rels.sort();
}

function setScalarLine(raw, key, value) {
  const line = `${key}: ${value}`;
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*.*$`, "m");
  if (re.test(raw)) return raw.replace(re, line);
  return `${raw.trimEnd()}\n${line}`;
}

function touchFrontmatter(content, date = today()) {
  const normalized = String(content ?? "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return content;
  let fm = match[1];
  fm = setScalarLine(fm, "updated", date);
  fm = setScalarLine(fm, "last_reviewed", date);
  return `---\n${fm.trimEnd()}\n---\n${normalized.slice(match[0].length).replace(/^\n+/, "")}`;
}

function openingShapeChanges(pmFolder) {
  const changes = [];
  const manualReview = [];
  for (const rel of listPlanRels(pmFolder)) {
    const abs = join(pmFolder, `${rel}.md`);
    const original = readIfExists(abs);
    if (original === null) continue;
    const result = ensurePlanningNoteOpeningShape(original, { planRel: rel });
    manualReview.push(...result.manualReview);
    if (result.updated !== original) {
      changes.push({
        rel,
        abs,
        original,
        updated: touchFrontmatter(result.updated),
        changes: result.changes,
      });
    }
  }
  return { changes, manualReview };
}

function detect({ pmFolder }) {
  return openingShapeChanges(pmFolder).changes.length > 0;
}

function plan() {
  return [
    "Remove deterministic duplicate planning-note H1s that repeat the filename stem, date-stripped slug, or frontmatter title.",
    "Move existing `## Related` sections near the top of planning notes while preserving their content.",
    "Preserve non-matching H1s and report early ones for manual review instead of guessing whether they are meaningful report headings.",
  ];
}

function apply({ pmFolder, ctx }) {
  const { changes, manualReview } = openingShapeChanges(pmFolder);
  for (const item of changes) {
    if (!ctx.dryRun) writeFileSync(item.abs, item.updated);
    ctx.log("done", `${item.rel}.md`, item.changes.join("; "));
  }
  if (changes.length === 0) ctx.log("skip", "no planning notes needed opening-shape repair");

  return {
    suggestedHistory: [
      `- **Planning notes now open with useful content.** chore(pm): apply migration \`1.16.0-planning-note-opening-shape\` to remove deterministic duplicate planning-note H1s and move existing \`## Related\` sections near the top in ${changes.length} planning note(s), preserving non-title content.`,
    ],
    manualReview,
  };
}

export default {
  id: "1.16.0-planning-note-opening-shape",
  from: "<1.16.0",
  to: "1.16.0",
  describe:
    "Normalize planning-note openings: remove redundant title H1s and move existing Related sections near the top while preserving non-title content.",
  detect,
  plan,
  apply,
};

export const __test = {
  listPlanRels,
  openingShapeChanges,
};
