#!/usr/bin/env node
/**
 * check-stale-docs.mjs
 *
 * Walks a project-management PM folder, parses frontmatter from every .md
 * file, computes `today - last_reviewed` for each, and emits a markdown report
 * grouped by folder. Flags files as:
 *
 *   never-reviewed  — no last_reviewed field at all
 *   stale (30d)     — last_reviewed is more than 30 days old
 *   very-stale (90d)— last_reviewed is more than 90 days old
 *
 * Exits 0 if all files are under 30 days, exits 1 if any file is over.
 *
 * Usage:
 *   node scripts/check-stale-docs.mjs                                  # scan CWD
 *   node scripts/check-stale-docs.mjs /path/to/vault/root              # scan explicit root
 *   node scripts/check-stale-docs.mjs                                  # auto-discover ~/.config/project-management/projects.json
 *   node scripts/check-stale-docs.mjs --config <path>                  # read projects from config; iterates
 *   node scripts/check-stale-docs.mjs --project <name> --config <p>   # scan a single project from config
 *
 * Configuration via env (or edit DEFAULT_* below):
 *   STALE_DAYS    default 30
 *   VERY_STALE_DAYS default 90
 *
 * The `--config` flag expects a path to `projects.json` from the
 * project-management skill (at the skill root, alongside SKILL.md). The script
 * reads `vault_root` and the project's `pm_folder` from the config. When
 * `--config` is set without `--project`, the script iterates over all
 * projects in the config and prints one report per project.
 *
 * If a <vault> path is provided, that folder is scanned directly. If no
 * <vault> path or `--config` is given, the script walks up from its own
 * location looking for a sibling SKILL.md; the projects.json next to that
 * SKILL.md is used as the default config. Explicit `--config` always wins.
 */

import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveProjectsConfigPath } from "./lib/paths.mjs";
import { loadPmSkip, isSkipped } from "./lib/skip.mjs";

const DEFAULT_STALE_DAYS = Number(process.env.STALE_DAYS ?? 30);
const DEFAULT_VERY_STALE_DAYS = Number(process.env.VERY_STALE_DAYS ?? 90);

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { vault: null, config: null, project: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" || args[i] === "-c") {
      out.config = args[++i];
    } else if (args[i] === "--project" || args[i] === "-p") {
      out.project = args[++i];
    } else if (!args[i].startsWith("-")) {
      out.vault = args[i];
    }
  }
  return out;
}

const CLI = parseArgs(process.argv);

async function loadConfig() {
  const configPath = CLI.vault
    ? null
    : resolveProjectsConfigPath(CLI.config ? resolve(CLI.config) : null);
  if (!configPath) return null;
  const raw = await readFile(configPath, "utf8");
  return { config: JSON.parse(raw), source: configPath };
}

function isTemplateConfig(config) {
  const projects = config.projects ?? {};
  return Object.keys(projects).length === 0 || Object.prototype.hasOwnProperty.call(projects, "<ProjectName>");
}

function configSetupError(project, source, config, reason) {
  const setupHint = isTemplateConfig(config)
    ? "This looks like the default empty projects.json template. "
    : "";
  return (
    `ERROR: ${reason} in ${source}\n` +
    `${setupHint}Run the project-management skill and say "setup as collaborator" or "setup this repo", ` +
    `or add a real projects.${project} entry with access and pm_folder.`
  );
}

async function resolveTargets() {
  const loaded = await loadConfig();
  if (!loaded) {
    if (!CLI.vault) {
      console.error(
        `NOTE: no projects.json auto-discovered and no <vault> argument given.\n` +
        `      projects.json lives at ~/.config/project-management/projects.json (v1.3.0+).\n` +
        `      or pass an explicit <vault> path to scan a single directory.\n` +
        `      Falling back to CWD scan (${process.cwd()}).\n`
      );
    }
    return [{ vault: resolve(CLI.vault ?? process.cwd()), label: resolve(CLI.vault ?? process.cwd()) }];
  }
  const { config, source } = loaded;
  if (CLI.project) {
    const proj = config.projects?.[CLI.project];
    if (!proj) {
      console.error(configSetupError(CLI.project, source, config, `project '${CLI.project}' not found`));
      process.exit(2);
    }
    if (!proj.pm_folder) {
      console.error(configSetupError(CLI.project, source, config, `project '${CLI.project}' has no pm_folder`));
      process.exit(2);
    }
    return [{ vault: resolve(proj.pm_folder), label: `${CLI.project} (${proj.pm_folder})` }];
  }
  const projects = config.projects ?? {};
  const targets = [];
  for (const [name, proj] of Object.entries(projects)) {
    if (!proj.pm_folder) continue;
    targets.push({ vault: resolve(proj.pm_folder), label: `${name} (${proj.pm_folder})` });
  }
  if (targets.length === 0) {
    console.log(`\nNo projects with available pm_folder entries in ${source}.`);
  }
  return targets;
}

const today = new Date().toISOString().slice(0, 10);

// Per-target state (mutated by walk/scan/emit before each runFor call)
let vaultRoot = null;
let skipSet = new Set();

const SKIP_DIRS = new Set([
  ".obsidian",
  ".git",
  "node_modules",
  "scripts",
  ".workspace",
]);

const SKIP_FILES = new Set([
  "README.md",
  "PRODUCT.md",
  "CURRENT_STATUS.md",
]);

const findings = {
  missingFrontmatter: [],
  missingLastReviewed: [],
  unparseableLastReviewed: [],
  veryStale: [],
  stale: [],
  ok: 0,
};

/** Walk the vault recursively. */
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
      await walk(full);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const rel = relative(vaultRoot, full);
      if (isSkipped(skipSet, rel)) continue;
      await scan(full);
    }
  }
}

/** Scan one file. */
async function scan(filePath) {
  const rel = relative(vaultRoot, filePath);
  const top = rel.split(/[\\/]/, 1)[0];
  if (SKIP_FILES.has(rel.split(/[\\/]/).pop())) {
    return;
  }
  // skip index-like folder notes
  const filename = rel.split(/[\\/]/).pop();
  if (filename === `${top}.md` || filename === "planning.md" || filename === "features.md" || filename === "decisions.md") {
    return;
  }

  const content = await readFile(filePath, "utf8");
  const fm = parseFrontmatter(content);
  if (!fm) {
    findings.missingFrontmatter.push({ path: rel, top });
    return;
  }
  const lastReviewed = fm.last_reviewed;
  if (!lastReviewed) {
    findings.missingLastReviewed.push({ path: rel, top });
    return;
  }
  const age = daysBetween(lastReviewed, today);
  if (age == null) {
    findings.unparseableLastReviewed.push({ path: rel, top, lastReviewed });
    return;
  }
  if (age > DEFAULT_VERY_STALE_DAYS) {
    findings.veryStale.push({ path: rel, top, age, lastReviewed });
  } else if (age > DEFAULT_STALE_DAYS) {
    findings.stale.push({ path: rel, top, age, lastReviewed });
  } else {
    findings.ok += 1;
  }
}

/** Tiny YAML-ish frontmatter parser. Handles simple `key: value` lines. */
function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const block = m[1];
  const out = {};
  for (const line of block.split("\n")) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!kv) continue;
    out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

/** Days between two YYYY-MM-DD strings, inclusive of the second date. */
function daysBetween(a, b) {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round((db - da) / 86_400_000);
}

/** Emit the markdown report. */
function emit() {
  const lines = [];
  lines.push(`# Stale Docs Report`);
  lines.push("");
  lines.push(`Generated: ${today}`);
  lines.push(`Vault root: \`${vaultRoot}\``);
  lines.push(`Thresholds: stale > ${DEFAULT_STALE_DAYS} days, very-stale > ${DEFAULT_VERY_STALE_DAYS} days`);
  lines.push("");
  const neverTotal = findings.missingFrontmatter.length + findings.missingLastReviewed.length + findings.unparseableLastReviewed.length;
  lines.push(`**Summary:** ${findings.ok} OK, ${findings.stale.length} stale, ${findings.veryStale.length} very-stale, ${neverTotal} with no parseable last_reviewed.`);
  lines.push("");

  for (const [label, items, format] of [
    ["Very Stale (>90 days)", findings.veryStale, "stale"],
    ["Stale (30-90 days)", findings.stale, "stale"],
    ["Missing frontmatter", findings.missingFrontmatter, "missing-fm"],
    ["Missing last_reviewed", findings.missingLastReviewed, "missing-lr"],
    ["Unparseable last_reviewed", findings.unparseableLastReviewed, "unparseable-lr"],
  ]) {
    if (items.length === 0) continue;
    lines.push(`## ${label} (${items.length})`);
    lines.push("");
    for (const item of items) {
      if (format === "stale") {
        lines.push(`- \`${item.path}\` — ${item.age} days (last_reviewed ${item.lastReviewed})`);
      } else if (format === "unparseable-lr") {
        lines.push(`- \`${item.path}\` — last_reviewed value \`${item.lastReviewed}\` is not a YYYY-MM-DD date; fix the frontmatter.`);
      } else {
        lines.push(`- \`${item.path}\` — ${label.toLowerCase()}.`);
      }
    }
    lines.push("");
  }

  const totalIssues = findings.veryStale.length + findings.stale.length + neverTotal;
  if (totalIssues === 0) {
    lines.push("All scanned files have a fresh `last_reviewed` field. Nothing to flag.");
  }
  console.log(lines.join("\n"));
}

async function resetFindings() {
  findings.ok = 0;
  findings.missingFrontmatter = [];
  findings.missingLastReviewed = [];
  findings.unparseableLastReviewed = [];
  findings.veryStale = [];
  findings.stale = [];
}

async function runFor(target) {
  resetFindings();
  vaultRoot = target.vault;
  skipSet = loadPmSkip(target.vault);
  console.log(`\n# Stale Docs Report — ${target.label}\n`);
  if (skipSet.size > 0) {
    console.log(`(Honoring .pm/skip: ${[...skipSet].join(", ")})\n`);
  }
  await walk(target.vault);
  emit();
  return findings.veryStale.length + findings.stale.length + findings.missingFrontmatter.length + findings.missingLastReviewed.length + findings.unparseableLastReviewed.length;
}

const targets = await resolveTargets();
let totalIssues = 0;
for (const target of targets) {
  const issues = await runFor(target);
  totalIssues += issues;
}

// Exit code: 0 if all OK across all targets, 1 if anything is stale or never-reviewed.
process.exit(totalIssues > 0 ? 1 : 0);
