#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { findVaultRoot } from "../lib/paths.mjs";
import { repairLiveRoutingDrift } from "../lib/live-routing-fixers.mjs";

function collectMarkdownFiles(pmFolder) {
  const files = [];
  function walk(abs) {
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const child = join(abs, entry.name);
      const rel = relative(pmFolder, child).split("\\").join("/");
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push({ abs: child, rel });
    }
  }
  walk(pmFolder);
  return files;
}

function collectTargets(files) {
  return files.map((file) => file.rel.replace(/\.md$/i, ""));
}

function detect({ pmFolder, ctx = {} }) {
  const files = collectMarkdownFiles(pmFolder);
  const targets = collectTargets(files);
  const linkOptions = { pmFolder, vaultRoot: findVaultRoot(pmFolder, ctx.configPath) };
  for (const file of files) {
    const original = readFileSync(file.abs, "utf8");
    const result = repairLiveRoutingDrift(original, file.rel, targets, linkOptions);
    if (result.updated !== original) return true;
  }
  return false;
}

function plan() {
  return [
    "Apply live-routing and feature-link hygiene (D-013).",
    "Auto-fixed: retired live references to `planning/`, `planning/decisions/`, and dead `roadmap/plans/decisions/...` paths are rewritten to current `roadmap/plans/` or root `decisions/` targets when deterministic; `Relevant ADRs:` is normalized to `Relevant decisions:`; bare `ADR-NNN` / `D-NNN` references are linked when a unique decision note exists.",
    "Skipped: `history/` and `archive/` records are not rewritten. Manual review: ambiguous or missing decision targets.",
  ];
}

function apply({ pmFolder, ctx }) {
  const files = collectMarkdownFiles(pmFolder);
  const targets = collectTargets(files);
  const linkOptions = { pmFolder, vaultRoot: findVaultRoot(pmFolder, ctx.configPath) };
  const log = [];
  const manualReview = [];

  for (const file of files) {
    const original = readFileSync(file.abs, "utf8");
    const result = repairLiveRoutingDrift(original, file.rel, targets, linkOptions);
    if (result.updated !== original) {
      if (!ctx.dryRun) writeFileSync(file.abs, result.updated);
      log.push(`${file.rel}: ${result.changes.length} deterministic live-routing change(s)`);
    }
    for (const item of result.manualReview) manualReview.push(`${file.rel}: ${item}`);
  }

  for (const item of log) ctx.log("info", item);
  if (manualReview.length > 0) ctx.log("manual-review", `${manualReview.length} item(s) need live-routing judgment`);
  else ctx.log("done", "live-routing and feature-link hygiene applied");

  return {
    suggestedHistory: [
      `- **Live PM navigation now points at current lanes.** chore(pm): apply migration \`1.11.0-live-routing-and-feature-link-hygiene\` to repair retired planning/decision paths and link unique decision references. Auto-fixed: ${log.length} file(s). Manual review: ${manualReview.length} item(s).`,
    ],
    manualReview,
  };
}

export default {
  id: "1.11.0-live-routing-and-feature-link-hygiene",
  from: "<1.11.0",
  to: "1.11.0",
  describe:
    "Repair deterministic live-doc routing drift: replace retired `planning/` and `planning/decisions/` references with current `roadmap/plans/` and root `decisions/` lanes, normalize `Relevant ADRs:` to `Relevant decisions:`, and link bare decision IDs only when a unique target exists. History and archive records are left intact.",
  detect,
  plan,
  apply,
};
