#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  renameDatePrefixedH2s,
  syncDonePendingContents,
  linkDonePendingPlanningNotes,
  normalizeDonePendingRelevantLinks,
  ensureIdeaDetailSummaries,
} from "../lib/roadmap-fixers.mjs";
import { findVaultRoot } from "../lib/paths.mjs";

function readIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function collectMarkdownTargets(pmFolder) {
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

function runDonePendingFixers(content, targets, linkOptions = {}) {
  const manualReview = [];
  const changes = [];
  let working = content;

  for (const fixer of [
    (value) => renameDatePrefixedH2s(value),
    (value) => linkDonePendingPlanningNotes(value, targets, linkOptions),
    (value) => normalizeDonePendingRelevantLinks(value, targets, linkOptions),
    (value) => syncDonePendingContents(value),
  ]) {
    const result = fixer(working);
    working = result.updated;
    changes.push(...(result.changes ?? []));
    manualReview.push(...(result.manualReview ?? []));
  }

  return { updated: working, changes, manualReview };
}

function detect({ pmFolder, ctx = {} }) {
  const targets = collectMarkdownTargets(pmFolder);
  const linkOptions = { pmFolder, vaultRoot: findVaultRoot(pmFolder, ctx.configPath) };
  const donePending = readIfExists(join(pmFolder, "roadmap/done-pending.md"));
  if (donePending !== null && runDonePendingFixers(donePending, targets, linkOptions).changes.length > 0) {
    return true;
  }

  const ideas = readIfExists(join(pmFolder, "roadmap/ideas.md"));
  if (ideas !== null && ensureIdeaDetailSummaries(ideas).changes.length > 0) {
    return true;
  }

  return false;
}

function plan() {
  return [
    "Apply the human-readable PM note conventions (D-012).",
    "Auto-fixed: regenerate `roadmap/done-pending.md` Contents from actual H2s, link plain planning-note stems when the target exists, normalize relevant decision/feature/system/docs links when unique, and add missing `**Summary:** TBD` fields to idea details.",
    "Manual review: ambiguous/missing relevant links and `TBD` idea summaries need maintainer judgment. Existing history prose is not rewritten.",
  ];
}

function apply({ pmFolder, ctx }) {
  const targets = collectMarkdownTargets(pmFolder);
  const linkOptions = { pmFolder, vaultRoot: findVaultRoot(pmFolder, ctx.configPath) };
  const manualReview = [];
  const log = [];

  const donePendingRel = "roadmap/done-pending.md";
  const donePendingPath = join(pmFolder, donePendingRel);
  const donePending = readIfExists(donePendingPath);
  if (donePending !== null) {
    const result = runDonePendingFixers(donePending, targets, linkOptions);
    if (result.updated !== donePending) {
      if (!ctx.dryRun) writeFileSync(donePendingPath, result.updated);
      log.push(`${donePendingRel}: ${result.changes.length} deterministic change(s) applied`);
    }
    for (const item of result.manualReview) manualReview.push(`${donePendingRel}: ${item}`);
  }

  const ideasRel = "roadmap/ideas.md";
  const ideasPath = join(pmFolder, ideasRel);
  const ideas = readIfExists(ideasPath);
  if (ideas !== null) {
    const result = ensureIdeaDetailSummaries(ideas);
    if (result.updated !== ideas) {
      if (!ctx.dryRun) writeFileSync(ideasPath, result.updated);
      log.push(`${ideasRel}: ${result.changes.length} missing Summary field(s) added as TBD`);
    }
    for (const item of result.manualReview) manualReview.push(`${ideasRel}: ${item}`);
  }

  for (const item of log) ctx.log("info", item);
  if (manualReview.length > 0) {
    ctx.log("manual-review", `${manualReview.length} item(s) need human judgment`);
  } else {
    ctx.log("done", "human-readable PM note conventions applied");
  }

  return {
    suggestedHistory: [
      `- **PM notes now use human-readable roadmap shapes.** chore(pm): apply migration \`1.10.0-human-readable-pm-notes\` to align done-pending Contents/links and idea detail summaries. Auto-fixed: ${log.length} file(s). Manual review: ${manualReview.length} item(s).`,
    ],
    manualReview,
  };
}

export default {
  id: "1.10.0-human-readable-pm-notes",
  from: "<1.10.0",
  to: "1.10.0",
  describe:
    "Apply the human-readable PM note conventions (D-012): regenerate done-pending Contents from actual H2 headings, link planning-note stems and relevant decision/feature/system/docs tokens only when a unique target exists, and insert `**Summary:** TBD` in idea detail sections that lack a summary. Existing history prose is not rewritten.",
  detect,
  plan,
  apply,
};
