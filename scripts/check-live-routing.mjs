#!/usr/bin/env node
/**
 * check-live-routing.mjs
 *
 * Validator for live PM navigation hygiene. It flags deprecated live-doc
 * references to retired lanes (`planning/`, `planning/decisions/`,
 * `roadmap/plans/decisions/...`) and stale `Relevant ADRs:` labels outside
 * history/archive. With `--fix`, deterministic drift is repaired; ambiguous
 * or missing decision targets are reported for manual review.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { resolveProjectsConfigPath } from "./lib/paths.mjs";
import { loadPmSkip, isSkipped } from "./lib/skip.mjs";
import { repairLiveRoutingDrift, findLiveRoutingDrift } from "./lib/live-routing-fixers.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { vault: null, config: null, project: null, fix: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" || args[i] === "-c") out.config = args[++i];
    else if (args[i] === "--project" || args[i] === "-p") out.project = args[++i];
    else if (args[i] === "--fix") out.fix = true;
    else if (["--dry-run", "--force", "--strict", "--fix-strict"].includes(args[i])) {
      // Accepted for check-pm.mjs pass-through compatibility. No effect here.
    } else if (!args[i].startsWith("-")) out.vault = args[i];
  }
  return out;
}

const CLI = parseArgs(process.argv);

function configSetupError(project, configPath, reason) {
  return (
    `ERROR: ${reason} in ${configPath}\n` +
    `Run the project-management skill and say "setup as collaborator" or "setup this repo", ` +
    `or add a real projects.${project} entry with access and pm_folder.`
  );
}

function resolveTargets() {
  if (CLI.vault) return [{ vault: resolve(CLI.vault), label: resolve(CLI.vault) }];
  const configPath = resolveProjectsConfigPath(CLI.config ? resolve(CLI.config) : null);
  if (!configPath) {
    console.error("ERROR: no projects.json found. Pass a PM folder path or --config <path>.");
    process.exit(2);
  }
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

function collectMarkdownFiles(root, skipSet) {
  const files = [];
  function walk(abs) {
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const child = join(abs, entry.name);
      const rel = relative(root, child).split("\\").join("/");
      if (isSkipped(skipSet, rel)) continue;
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push({ abs: child, rel });
    }
  }
  walk(root);
  return files;
}

function collectMarkdownTargets(files) {
  return files.map((file) => file.rel.replace(/\.md$/i, ""));
}

function runFor(target) {
  const issues = [];
  const manualReview = [];
  const fixed = [];
  const skipSet = loadPmSkip(target.vault);
  const files = collectMarkdownFiles(target.vault, skipSet);
  const targets = collectMarkdownTargets(files);

  console.log(`\n# Live routing hygiene: ${target.label}\n`);

  for (const file of files) {
    const original = readFileSync(file.abs, "utf8");
    const result = repairLiveRoutingDrift(original, file.rel, targets);
    const drift = findLiveRoutingDrift(original, file.rel);

    if (result.updated !== original) {
      if (CLI.fix) {
        writeFileSync(file.abs, result.updated);
        fixed.push(`${file.rel}: ${result.changes.length} deterministic change(s)`);
      } else {
        const details = drift.length > 0 ? drift.join("; ") : result.changes.join("; ");
        issues.push(`${file.rel}: ${details}`);
      }
    } else if (drift.length > 0) {
      issues.push(`${file.rel}: ${drift.join("; ")}`);
    }

    for (const item of result.manualReview) manualReview.push(`${file.rel}: ${item}`);
  }

  if (fixed.length > 0) {
    console.log("## Fixed\n");
    for (const item of fixed) console.log(`- ${item}`);
    console.log("");
  }

  if (issues.length === 0) {
    console.log("Live docs use current roadmap/decision lanes and deterministic links.");
  } else {
    console.log("## Findings\n");
    for (const issue of issues) console.log(`- ${issue}`);
  }

  if (manualReview.length > 0) {
    console.log("\n## Manual Review\n");
    for (const item of manualReview) console.log(`- ${item}`);
  }

  return { fail: issues.length, manualReview };
}

let totalFail = 0;
const manual = [];
for (const target of resolveTargets()) {
  const result = runFor(target);
  totalFail += result.fail;
  manual.push(...result.manualReview);
}

if (manual.length > 0) {
  console.log("\n# Manual Review Summary\n");
  console.log("These live-routing references need a maintainer because no unique existing decision target was found:\n");
  for (const item of manual) console.log(`- ${item}`);
}

process.exit(totalFail > 0 ? 1 : 0);
