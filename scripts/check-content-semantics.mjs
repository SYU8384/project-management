#!/usr/bin/env node
/**
 * check-content-semantics.mjs
 *
 * Content-semantic convention check (v1.8.0). Four checks:
 *
 *   A. D-009: `roadmap/known-issues.md` `## Active` has at least one
 *      `### <Domain>` H3 grouping when it has multiple items.
 *      `--fix` introduces a `### Pending Triage` H3 placeholder.
 *   B. Dead wikilinks: `[[X]]` whose target file does not exist. `--fix`
 *      strips the brackets (preserving the display text). `--fix-strict`
 *      is a no-op; the validator surfaces MANUAL REVIEW.
 *   C. Plan `status:` body-marker sync: a planning note's body has a
 *      marker phrase (`SUPERSEDED by …`, `ARCHIVED as …`, etc.) that
 *      disagrees with the frontmatter `status:`. `--fix` updates the
 *      frontmatter for strong markers.
 *   D. `roadmap/known-issues.md` `## Active` theoretical-risk wording.
 *      `--fix` adds a `**possibly theoretical risk — review for migration
 *      to ideas.md**` note after the item; does NOT move the item.
 *
 * Exits 1 on FAIL, 0 on PASS. Hidden directories are skipped.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import { resolveProjectsConfigPath, findVaultRoot } from "./lib/paths.mjs";
import { loadPmSkip, isSkipped } from "./lib/skip.mjs";
import { wikiLinks } from "./lib/markdown.mjs";
import {
  introduceActivePlaceholder,
  stripDeadWikiLinks,
  syncPlanStatusFromBodyMarker,
  flagTheoreticalRiskWording,
} from "./lib/content-semantic-fixers.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { vault: null, config: null, project: null, fix: false, strict: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" || args[i] === "-c") out.config = args[++i];
    else if (args[i] === "--project" || args[i] === "-p") out.project = args[++i];
    else if (args[i] === "--fix") out.fix = true;
    else if (args[i] === "--fix-strict") out.strict = true;
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

function walk(root, skipSet) {
  const out = [];
  function rec(abs) {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const child = join(abs, entry.name);
      if (entry.isDirectory()) rec(child);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        const rel = relative(root, child).split("\\").join("/");
        if (skipSet && isSkipped(skipSet, rel)) continue;
        out.push({ abs: child, rel });
      }
    }
  }
  rec(root);
  return out;
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
  const configPath = loadConfigPath();
  const vaultRoot = findVaultRoot(target.vault, configPath);
  const project = target.project ?? basename(target.vault);
  const skipSet = loadPmSkip(target.vault);
  const files = walk(target.vault, skipSet);
  const vaultFiles = existsSync(vaultRoot) ? walk(vaultRoot, new Set()) : files;
  const targetSet = new Set();
  for (const f of vaultFiles) {
    targetSet.add(relative(vaultRoot, f.abs).split("\\").join("/").replace(/\.md$/, ""));
  }
  for (const f of files) {
    // also add PM-relative stems for fuzzy/relative resolution within the PM folder
    targetSet.add(f.rel.split("\\").join("/").replace(/\.md$/, ""));
  }
  const issues = [];
  const manualReview = [];

  const knownIssuesPath = join(target.vault, "roadmap/known-issues.md");
  // ---- A.1: D-009 `## Active` placeholder ----
  const knownIssues = readIfExists(knownIssuesPath);
  if (knownIssues !== null) {
    const r1 = introduceActivePlaceholder(knownIssues);
    const r2 = flagTheoreticalRiskWording(r1.updated);
    if (CLI.fix) {
      writeIfChanged(knownIssuesPath, knownIssues, r1.updated, "roadmap/known-issues.md (Active placeholder)");
      writeIfChanged(knownIssuesPath, r1.updated, r2.updated, "roadmap/known-issues.md (risk-wording markers)");
    }
    if (r1.changes.length > 0 && !CLI.fix) {
      for (const c of r1.changes) issues.push(`roadmap/known-issues.md: A ${c}`);
    }
    if (r2.changes.length > 0 && !CLI.fix) {
      for (const c of r2.changes) issues.push(`roadmap/known-issues.md: D ${c}`);
    }
  }

  // ---- B + C: walk all .md files for dead wikilinks and plan status drift ----
  for (const { abs, rel } of files) {
    const original = readIfExists(abs);
    if (original === null) continue;
    let working = original;

    // B. Dead wikilinks
    const wb = stripDeadWikiLinks(working, targetSet, CLI.strict);
    working = wb.updated;
    if (wb.changes.length > 0) {
      if (CLI.fix) writeIfChanged(abs, original, working, rel);
      if (!CLI.fix) for (const c of wb.changes) issues.push(`${rel}: B ${c}`);
    }

    // C. Plan status body-marker sync (only for `roadmap/plans/*.md`, not folder note)
    if (rel.startsWith("roadmap/plans/") && rel !== "roadmap/plans/plans.md" && rel.endsWith(".md")) {
      const r = syncPlanStatusFromBodyMarker(working);
      if (r.changes.length > 0) {
        if (CLI.fix) writeIfChanged(abs, working, r.updated, rel);
        if (!CLI.fix) for (const c of r.changes) issues.push(`${rel}: C ${c}`);
      }
      if (r.manualReview.length > 0) {
        for (const mr of r.manualReview) manualReview.push(`${rel}: C ${mr}`);
      }
    }
  }

  // Report
  console.log(`\n# Content Semantics Report — ${target.label}\n`);
  console.log(`**Status:** ${issues.length === 0 ? "PASS" : "FAIL"}`);
  console.log("");
  if (issues.length === 0) {
    console.log("All 4 content-semantic checks (A/B/C/D) hold for the project's notes.");
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
  console.log("These items need human judgment (the auto-fixer cannot pick project-specific values or the marker is too weak). Address by hand, then re-run:\n");
  for (const r of allManualReview) console.log(`- ${r}`);
}
process.exit(totalFail > 0 ? 1 : 0);
