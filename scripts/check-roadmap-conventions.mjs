#!/usr/bin/env node
/**
 * check-roadmap-conventions.mjs
 *
 * Content-level convention check for the four roadmap files:
 *   - D-007: `roadmap/done-pending.md` planning-note mirror H2s use
 *     slug-only text (not the date-prefixed stem). Soft warning.
 *   - D-008: `roadmap/ideas.md` carries the 🟣/🟡/🔵/🟢/🔴 status-color
 *     scheme in the Status Key, the Idea Register Status column, and
 *     the Idea Details `**Status:**` lines.
 *   - D-009: `roadmap/known-issues.md` has no top-level `## Fixed`
 *     section (fixed items live in `docs/Developer Guide/known-bugs.md`
 *     per the D-009 lifecycle). When `## Active` has multiple items, it
 *     uses `### <Domain>` H3 subsections.
 *   - D-010: `roadmap/mvp-priorities.md` `## MVP Priorities` uses
 *     `### <Lane>` H3 subsections when it has items.
 *
 * Run with `--fix` to auto-apply the deterministic fixes (D-008
 * emoji insertion, D-009 empty-`## Fixed` removal, D-007 H2 rename).
 * The auto-fixer cannot pick project-specific domain or lane names
 * (D-009 grouping, D-010 grouping), so those checks surface as
 * MANUAL REVIEW findings rather than auto-fixing.
 *
 * Exits 1 on FAIL, 0 on PASS. Hidden directories are skipped (same
 * convention as `check-pm-consistency.mjs`).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { resolveProjectsConfigPath } from "./lib/paths.mjs";
import {
  insertStatusEmojisInIdeas,
  insertIdeasStatusColorsLeadNote,
  dropEmptyFixedSection,
  checkDomainGroupingInActive,
  checkLaneGroupingInMvpPriorities,
  renameDatePrefixedH2s,
} from "./lib/roadmap-fixers.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { vault: null, config: null, project: null, fix: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" || args[i] === "-c") out.config = args[++i];
    else if (args[i] === "--project" || args[i] === "-p") out.project = args[++i];
    else if (args[i] === "--fix") out.fix = true;
    else if (!args[i].startsWith("-")) out.vault = args[i];
  }
  return out;
}

const CLI = parseArgs(process.argv);

function loadConfigPath() {
  if (CLI.vault) return null;
  return resolveProjectsConfigPath(CLI.config ? resolve(CLI.config) : null);
}

function isTemplateConfig(cfg) {
  const projects = cfg.projects ?? {};
  return Object.keys(projects).length === 0 || Object.prototype.hasOwnProperty.call(projects, "<ProjectName>");
}

function configSetupError(project, configPath, reason) {
  const setupHint = isTemplateConfig(JSON.parse(readFileSync(configPath, "utf8")))
    ? "This looks like the default empty projects.json template. "
    : "";
  return (
    `ERROR: ${reason} in ${configPath}\n` +
    `${setupHint}Run the project-management skill and say "setup as collaborator" or "setup this repo", ` +
    `or add a real projects.${project} entry with access and pm_folder.`
  );
}

function resolveTargets() {
  const configPath = loadConfigPath();
  if (!configPath) return [{ vault: resolve(CLI.vault ?? process.cwd()), label: resolve(CLI.vault ?? process.cwd()) }];
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  if (CLI.project) {
    const proj = cfg.projects?.[CLI.project];
    if (!proj?.pm_folder) {
      const reason = proj
        ? `project '${CLI.project}' has no pm_folder`
        : `project '${CLI.project}' not found`;
      console.error(configSetupError(CLI.project, configPath, reason));
      process.exit(2);
    }
    return [{ vault: resolve(proj.pm_folder), label: `${CLI.project} (${proj.pm_folder})`, project: CLI.project }];
  }
  return Object.entries(cfg.projects ?? {})
    .filter(([, proj]) => Boolean(proj.pm_folder))
    .map(([project, proj]) => ({ vault: resolve(proj.pm_folder), label: `${project} (${proj.pm_folder})`, project }));
}

function readIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function writeIfChanged(path, original, updated, rel) {
  if (updated === original) return 0;
  if (CLI.fix) {
    try {
      writeFileSync(path, updated);
      process.stdout.write(`fixed: ${rel}\n`);
      return 1;
    } catch (err) {
      process.stderr.write(`--fix failed for ${rel}: ${err.message}\n`);
      return 0;
    }
  }
  return 0;
}

function runFor(target) {
  const project = target.project ?? basename(target.vault);
  const issues = [];
  const manualReview = [];

  const ideasPath = join(target.vault, "roadmap/ideas.md");
  const knownIssuesPath = join(target.vault, "roadmap/known-issues.md");
  const mvpPath = join(target.vault, "roadmap/mvp-priorities.md");
  const donePendingPath = join(target.vault, "roadmap/done-pending.md");

  // ---- D-008: ideas.md status colors ----
  const ideasContent = readIfExists(ideasPath);
  if (ideasContent !== null) {
    const lead = insertIdeasStatusColorsLeadNote(ideasContent);
    if (CLI.fix) writeIfChanged(ideasPath, ideasContent, lead.updated, "roadmap/ideas.md (lead note)");
    const withLead = lead.updated;
    const emoji = insertStatusEmojisInIdeas(withLead);
    if (CLI.fix) writeIfChanged(ideasPath, withLead, emoji.updated, "roadmap/ideas.md (emojis)");
    if (lead.changes.length > 0 || emoji.changes.length > 0) {
      // The fix is about to be applied; we won't re-report the same
      // items as FAIL when --fix is on, but we will still note them.
      if (!CLI.fix) {
        for (const c of lead.changes) issues.push(`roadmap/ideas.md: D-008 ${c}`);
        for (const c of emoji.changes) issues.push(`roadmap/ideas.md: D-008 ${c}`);
      }
    }
    // If the Status Key has a status name that is NOT in the canonical
    // list, flag it.
    const statusKeyMatch = withLead.match(/^## Status Key[\s\S]*?\n([\s\S]*?)\n## /m);
    if (statusKeyMatch) {
      const statusKeyBody = statusKeyMatch[1];
      const hasBrainstorming = /Brainstorming/.test(statusKeyBody);
      if (!hasBrainstorming) {
        issues.push(`roadmap/ideas.md: D-008 ## Status Key has no "Brainstorming" row; convention may be diverged.`);
      }
    }
    for (const r of lead.manualReview) manualReview.push(r);
    for (const r of emoji.manualReview) manualReview.push(r);
  }

  // ---- D-009: known-issues.md (no `## Fixed`, domain grouping) ----
  const knownIssuesContent = readIfExists(knownIssuesPath);
  if (knownIssuesContent !== null) {
    const drop = dropEmptyFixedSection(knownIssuesContent);
    if (CLI.fix) writeIfChanged(knownIssuesPath, knownIssuesContent, drop.updated, "roadmap/known-issues.md (drop `## Fixed`)");
    if (drop.changes.length > 0 && !CLI.fix) {
      for (const c of drop.changes) issues.push(`roadmap/known-issues.md: D-009 ${c}`);
    }
    const domain = checkDomainGroupingInActive(drop.updated);
    for (const r of domain.manualReview) manualReview.push(r);
    if (drop.manualReview.length > 0) {
      for (const r of drop.manualReview) manualReview.push(r);
      if (!CLI.fix) {
        for (const r of drop.manualReview) issues.push(`roadmap/known-issues.md: D-009 ${r}`);
      }
    }
  }

  // ---- D-010: mvp-priorities.md lane grouping ----
  const mvpContent = readIfExists(mvpPath);
  if (mvpContent !== null) {
    const lane = checkLaneGroupingInMvpPriorities(mvpContent);
    for (const r of lane.manualReview) manualReview.push(r);
    if (lane.manualReview.length > 0 && !CLI.fix) {
      for (const r of lane.manualReview) issues.push(`roadmap/mvp-priorities.md: D-010 ${r}`);
    }
  }

  // ---- D-007: done-pending.md slug-only H2 ----
  const donePendingContent = readIfExists(donePendingPath);
  if (donePendingContent !== null) {
    const rename = renameDatePrefixedH2s(donePendingContent);
    if (CLI.fix) writeIfChanged(donePendingPath, donePendingContent, rename.updated, "roadmap/done-pending.md (slug-only H2)");
    if (rename.changes.length > 0 && !CLI.fix) {
      for (const c of rename.changes) issues.push(`roadmap/done-pending.md: D-007 ${c}`);
    }
  }

  // Report
  console.log(`\n# Roadmap Conventions Report — ${target.label}\n`);
  console.log(`**Status:** ${issues.length === 0 ? "PASS" : "FAIL"}`);
  console.log("");
  if (issues.length === 0) {
    console.log("All 4 content-level conventions (D-007 / D-008 / D-009 / D-010) hold for the project's roadmap files.");
  } else {
    for (const issue of issues) console.log(`- ${issue}`);
  }
  if (manualReview.length > 0) {
    console.log("\n## Manual Review\n");
    for (const r of manualReview) console.log(`- ${r}`);
  }
  return { fail: issues.length, manualReview };
}

let totalFail = 0;
const allManualReview = [];
for (const target of resolveTargets()) {
  const r = runFor(target);
  totalFail += r.fail;
  allManualReview.push(...r.manualReview);
}
if (allManualReview.length > 0) {
  console.log("\n# Manual Review Summary\n");
  console.log("The following items need human judgment (the auto-fixer cannot pick project-specific names). Address them by hand, then re-run the validator to confirm PASS:\n");
  for (const r of allManualReview) console.log(`- ${r}`);
}
process.exit(totalFail > 0 ? 1 : 0);
