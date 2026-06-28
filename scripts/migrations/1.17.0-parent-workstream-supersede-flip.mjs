#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { ensureSupersedeByMirrorSync } from "../lib/roadmap-fixers.mjs";

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

function collectTargets(pmFolder) {
  const targets = [];
  function walk(abs) {
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const child = join(abs, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        targets.push(relative(pmFolder, child).split("\\").join("/").replace(/\.md$/, ""));
      }
    }
  }
  walk(pmFolder);
  return targets;
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

function supersedeFlipChanges(pmFolder) {
  const donePendingPath = join(pmFolder, "roadmap", "done-pending.md");
  const donePending = readIfExists(donePendingPath);
  if (donePending === null) return { changes: [], manualReview: [] };

  const targets = collectTargets(pmFolder);
  const planContentsByRel = {};
  for (const rel of listPlanRels(pmFolder)) {
    const abs = join(pmFolder, `${rel}.md`);
    const content = readIfExists(abs);
    if (content !== null) planContentsByRel[rel] = content;
  }

  const result = ensureSupersedeByMirrorSync(
    donePending,
    planContentsByRel,
    targets,
    { today: today() }
  );

  const changes = [];
  for (const [rel, updated] of Object.entries(result.updated)) {
    if (updated === planContentsByRel[rel]) continue;
    changes.push({
      rel,
      abs: join(pmFolder, `${rel}.md`),
      original: planContentsByRel[rel],
      updated,
    });
  }
  return { changes, manualReview: result.manualReview };
}

function detect({ pmFolder }) {
  return supersedeFlipChanges(pmFolder).changes.length > 0;
}

function plan() {
  return [
    "Repair the parent-workstream supersede lifecycle (D-020): for every planning-note mirror in `roadmap/done-pending.md` whose body declares `**Superseded by [[…]]**`, ensure the older plan's frontmatter `status` is `superseded`.",
    "Touch `updated` and `last_reviewed` to today on every flipped plan.",
    "Skip plans already at `status: superseded` (idempotent), plans with terminal `status: shipped` / `rejected` (manual review), and plans whose mirror target is unresolvable (manual review).",
  ];
}

function apply({ pmFolder, ctx }) {
  const { changes, manualReview } = supersedeFlipChanges(pmFolder);
  for (const item of changes) {
    if (!ctx.dryRun) writeFileSync(item.abs, item.updated);
    ctx.log("done", `${item.rel}.md`, `status -> superseded (mirror declares "Superseded by")`);
  }
  if (changes.length === 0) ctx.log("skip", "no planning notes needed D-020 supersede-status repair");

  return {
    suggestedHistory: [
      `- **Planning notes now reflect their done-pending mirror supersede state.** chore(pm): apply migration \`1.17.0-parent-workstream-supersede-flip\` to flip \`status: active\` → \`status: superseded\` on ${changes.length} planning note(s) whose done-pending mirrors declare \`**Superseded by [[…]]**\` (D-020).`,
    ],
    manualReview,
  };
}

export default {
  id: "1.17.0-parent-workstream-supersede-flip",
  from: "<1.17.0",
  to: "1.17.0",
  describe:
    "Repair parent-workstream supersede lifecycle (D-020): for each planning-note mirror in roadmap/done-pending.md that declares 'Superseded by [[…]]', ensure the older plan's frontmatter status is 'superseded'.",
  detect,
  plan,
  apply,
};

export const __test = {
  listPlanRels,
  collectTargets,
  supersedeFlipChanges,
};