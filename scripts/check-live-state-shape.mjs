#!/usr/bin/env node
/**
 * Validate bounded live-state notes and cross-lane duplication.
 * Report-only: semantic cleanup requires the human-approved reorganization flow.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { parseProjectTargetArgs, resolveTargets } from "./lib/targets.mjs";
import { activeMilestoneInfo, listMilestoneNoteRels } from "./lib/milestones.mjs";
import {
  STATUS_MILESTONE_SHARED_SCAFFOLD,
  checkLiveNoteShape,
  duplicateLiveSections,
} from "./lib/live-state-shape.mjs";

const CLI = parseProjectTargetArgs(process.argv);
const TARGETS = resolveTargets(CLI, { fallbackToCwd: false });
const DETAIL_LIMIT = 25;
let totalIssues = 0;

function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function printFindings(findings) {
  for (const finding of findings.slice(0, DETAIL_LIMIT)) console.log(`- ${finding}`);
  if (findings.length > DETAIL_LIMIT) console.log(`- … ${findings.length - DETAIL_LIMIT} more finding(s)`);
}

for (const target of TARGETS) {
  const pmFolder = resolve(target.vault);
  const issues = [];
  const warnings = [];
  const statusPath = join(pmFolder, "CURRENT_STATUS.md");
  const status = readIfExists(statusPath);

  if (status !== null) {
    const result = checkLiveNoteShape(status, { kind: "status" });
    for (const item of result.issues) issues.push(`CURRENT_STATUS.md: ${item.message}`);
    for (const item of result.warnings) warnings.push(`CURRENT_STATUS.md: ${item.message}`);
  } else {
    issues.push("CURRENT_STATUS.md: missing");
  }

  const milestoneRels = listMilestoneNoteRels(pmFolder);
  for (const rel of milestoneRels) {
    const content = readIfExists(join(pmFolder, rel));
    if (content === null) continue;
    const result = checkLiveNoteShape(content, { kind: "milestone" });
    for (const item of result.issues) issues.push(`${rel}: ${item.message}`);
    for (const item of result.warnings) warnings.push(`${rel}: ${item.message}`);
  }

  const active = activeMilestoneInfo({ pmFolder, project: target.project, configPath: target.configPath });
  if (status !== null && active?.abs) {
    const milestone = readIfExists(active.abs);
    if (milestone !== null) {
      const duplicates = duplicateLiveSections(status, milestone, {
        ignoredHeadings: STATUS_MILESTONE_SHARED_SCAFFOLD,
      });
      for (const heading of duplicates) {
        issues.push(`CURRENT_STATUS.md ↔ ${active.rel}: identical live section \`## ${heading}\`; keep implementation evidence in history/plan`);
      }
    }
  }

  const featuresDir = join(pmFolder, "features");
  if (existsSync(featuresDir)) {
    for (const entry of readdirSync(featuresDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "features.md") continue;
      const systemPath = join(pmFolder, "system", entry.name);
      const featurePath = join(featuresDir, entry.name);
      const feature = readIfExists(featurePath);
      const system = readIfExists(systemPath);
      if (feature === null || system === null) continue;
      const duplicates = duplicateLiveSections(feature, system, { ignoredHeadings: ["Navigation"] });
      for (const heading of duplicates) {
        issues.push(`features/${entry.name} ↔ system/${entry.name}: identical section \`## ${heading}\`; feature pages link rather than copy system truth`);
      }
    }
  }

  totalIssues += issues.length;
  console.log(`\n# Live-state shape report: ${target.label ?? basename(pmFolder)}\n`);
  console.log(`**Status:** ${issues.length === 0 ? "PASS" : "FAIL"}\n`);
  console.log(`Summary: ${issues.length} structural issue(s), ${warnings.length} size review warning(s).\n`);
  if (issues.length > 0) {
    console.log("## Structural Findings\n");
    printFindings(issues);
    console.log("");
  } else {
    console.log("Live status, milestones, and same-topic feature/system notes have no prohibited journal/duplication findings.\n");
  }
  if (warnings.length > 0) {
    console.log("## Manual Review — Size Budgets\n");
    printFindings(warnings);
    console.log("");
  }
}

process.exit(totalIssues > 0 ? 1 : 0);
