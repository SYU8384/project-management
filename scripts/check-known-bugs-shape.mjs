#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { resolveProjectsConfigPath } from "./lib/paths.mjs";
import {
  removeH3LinksFromContents,
  normalizePlaceholders,
  ensureRequiredFields,
  checkKnownBugsShape,
} from "./lib/known-bugs-fixers.mjs";

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
  const relPath = "docs/Developer Guide/known-bugs.md";
  const filePath = join(target.vault, relPath);
  const original = readIfExists(filePath);
  if (original === null) {
    console.log(`\n# Known-Bugs Shape Report — ${target.label}\n`);
    console.log(`**Status:** PASS`);
    console.log(`\n${relPath} not found; no check performed.`);
    return { fail: 0, manualReview: [] };
  }

  let content = original;

  if (CLI.fix) {
    const h3 = removeH3LinksFromContents(content);
    content = h3.updated;
    for (const c of h3.changes) process.stdout.write(`fixed: ${relPath}: ${c}\n`);

    const ph = normalizePlaceholders(content);
    content = ph.updated;
    for (const c of ph.changes) process.stdout.write(`fixed: ${relPath}: ${c}\n`);

    const req = ensureRequiredFields(content);
    content = req.updated;
    for (const c of req.changes) process.stdout.write(`fixed: ${relPath}: ${c}\n`);

    writeIfChanged(filePath, original, content, relPath);
  }

  const { issues, manualReview } = checkKnownBugsShape(content);

  console.log(`\n# Known-Bugs Shape Report — ${target.label}\n`);
  console.log(`**Status:** ${issues.length === 0 ? "PASS" : "FAIL"}`);
  console.log("");
  if (issues.length === 0) {
    console.log("Known-bugs entry shape follows the D-011 convention.");
  } else {
    for (const issue of issues) console.log(`- ${relPath}: ${issue}`);
  }
  if (manualReview.length > 0) {
    console.log("\n## Manual Review\n");
    for (const r of manualReview) console.log(`- ${relPath}: ${r}`);
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
  console.log("The following items need maintainer-supplied details. Address them by hand, then re-run the validator to clear the review items:\n");
  for (const r of allManualReview) console.log(`- ${r}`);
}
process.exit(totalFail > 0 ? 1 : 0);
