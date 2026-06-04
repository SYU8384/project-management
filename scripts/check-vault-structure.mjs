#!/usr/bin/env node
/**
 * check-vault-structure.mjs
 *
 * Walks an OpenManager-style project vault and verifies the required
 * folder + file structure is in place. Emits a pass/fail report.
 *
 * Required:
 *   - Folders: planning/, roadmap/, system/, history/, archive/, docs/, features/
 *   - Root files: README.md, PRODUCT.md, <Project>.md, CURRENT_STATUS.md
 *   - Planning index: planning/planning.md
 *   - Roadmap standard notes: mvp-priorities.md, known-issues.md,
 *     done-pending.md, ideas.md
 *   - System index: system/system.md (or at least one system/*.md)
 *   - Archive index: archive/archive.md
 *   - History index: history/history.md
 *
 * Optional but recommended:
 *   - features/ folder (required)
 *   - planning/decisions/ subfolder
 *   - scripts/check-stale-docs.mjs
 *   - scripts/check-vault-structure.mjs
 *
 * Usage:
 *   node scripts/check-vault-structure.mjs                                # scan CWD
 *   node scripts/check-vault-structure.mjs /path/to/vault/root            # scan explicit root
 *   node scripts/check-vault-structure.mjs                                # auto-discover <skill_dir>/projects.json
 *   node scripts/check-vault-structure.mjs --config <path>                # read projects from config; iterates
 *   node scripts/check-vault-structure.mjs --project <name> --config <p> # scan a single project from config
 *
 * The `--config` flag expects a path to `projects.json` from the
 * project-logging skill (at the skill root, alongside SKILL.md). The script
 * reads `vault_root` and the project's `pm_folder` from the config. When
 * `--config` is set without `--project`, the script iterates over all
 * projects in the config and prints one report per project.
 *
 * If `--config` is not given, the script walks up from its own location
 * looking for a sibling SKILL.md; the projects.json next to that SKILL.md
 * is used as the default config. Explicit `--config` always wins.
 *
 * Exit codes:
 *   0 = all required present
 *   1 = at least one required missing
 */

import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function findSkillDir() {
  let current = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(current, "SKILL.md"))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

const SKILL_DIR = findSkillDir();
const DEFAULT_CONFIG = SKILL_DIR ? join(SKILL_DIR, "projects.json") : null;

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

function loadConfigPath() {
  if (CLI.config) return resolve(CLI.config);
  if (DEFAULT_CONFIG && existsSync(DEFAULT_CONFIG)) return DEFAULT_CONFIG;
  return null;
}

function resolveTargets() {
  const configPath = loadConfigPath();
  if (!configPath) {
    if (!CLI.vault) {
      console.error(
        `NOTE: no projects.json auto-discovered and no <vault> argument given.\n` +
        `      Pass --config <skill_dir>/projects.json to iterate known projects,\n` +
        `      or pass an explicit <vault> path to scan a single directory.\n` +
        `      Falling back to CWD scan (${process.cwd()}).\n`
      );
    }
    return [{ vault: resolve(CLI.vault ?? process.cwd()), label: resolve(CLI.vault ?? process.cwd()) }];
  }
  const cfgRaw = readFileSync(configPath, "utf8");
  const cfg = JSON.parse(cfgRaw);
  if (CLI.project) {
    const proj = cfg.projects?.[CLI.project];
    if (!proj) {
      console.error(`ERROR: project '${CLI.project}' not found in ${configPath}`);
      process.exit(2);
    }
    if (!proj.pm_folder) {
      console.error(`ERROR: project '${CLI.project}' has no pm_folder in ${configPath}`);
      process.exit(2);
    }
    return [{ vault: resolve(proj.pm_folder), label: `${CLI.project} (${proj.pm_folder})` }];
  }
  const projects = cfg.projects ?? {};
  const targets = [];
  for (const [name, proj] of Object.entries(projects)) {
    if (!proj.pm_folder) continue;
    targets.push({ vault: resolve(proj.pm_folder), label: `${name} (${proj.pm_folder})` });
  }
  if (targets.length === 0) {
    console.error(`ERROR: no projects with pm_folder in ${configPath}`);
    process.exit(2);
  }
  return targets;
}

// Per-target state (mutated by check()/emit() before each runFor call)
let vaultRoot = null;

const REQUIRED_DIRS = [
  "planning",
  "roadmap",
  "system",
  "history",
  "archive",
  "docs",
  "features",
];

const REQUIRED_ROOT_FILES = [
  "README.md",
  "PRODUCT.md",
  "CURRENT_STATUS.md",
  // <Project>.md is checked separately: any single additional .md at root
];

const REQUIRED_PLANNING_FILES = [
  "planning/planning.md",
];

const REQUIRED_ROADMAP_FILES = [
  "roadmap/mvp-priorities.md",
  "roadmap/known-issues.md",
  "roadmap/done-pending.md",
  "roadmap/ideas.md",
];

const REQUIRED_INDEX_FILES = [
  "system/system.md",
  "archive/archive.md",
  "history/history.md",
];

const OPTIONAL_DIRS = [
  "planning/decisions",
];

const OPTIONAL_SCRIPTS = [
  "scripts/check-stale-docs.mjs",
  "scripts/check-vault-structure.mjs",
];

const findings = {
  required: { missing: [], present: [] },
  project: { found: null, present: false },
  system: { hasSystemMd: false, hasAnySystemDoc: false },
  optional: { missing: [], present: [] },
};

function exists(rel) {
  return existsSync(join(vaultRoot, rel));
}

function isDir(rel) {
  if (!exists(rel)) return false;
  return statSync(join(vaultRoot, rel)).isDirectory();
}

function isFile(rel) {
  if (!exists(rel)) return false;
  return statSync(join(vaultRoot, rel)).isFile();
}

function listRootMds() {
  if (!existsSync(vaultRoot)) return [];
  return readdirSync(vaultRoot).filter((f) => f.endsWith(".md"));
}

function listSystemDocs() {
  const dir = join(vaultRoot, "system");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md"));
}

function checkRequired() {
  for (const dir of REQUIRED_DIRS) {
    if (isDir(dir)) {
      findings.required.present.push(`dir: ${dir}/`);
    } else {
      findings.required.missing.push(`dir: ${dir}/`);
    }
  }

  for (const file of REQUIRED_ROOT_FILES) {
    if (isFile(file)) {
      findings.required.present.push(`file: ${file}`);
    } else {
      findings.required.missing.push(`file: ${file}`);
    }
  }

  // <Project>.md: any single .md at root beyond the four standard ones
  const rootMds = listRootMds();
  const standardRootMds = new Set(["README.md", "PRODUCT.md", "CURRENT_STATUS.md"]);
  const projectFile = rootMds.find((f) => !standardRootMds.has(f));
  if (projectFile) {
    findings.project.found = projectFile;
    findings.project.present = true;
  } else {
    findings.required.missing.push(`file: <Project>.md (one .md at root beyond README/PRODUCT/CURRENT_STATUS)`);
  }

  for (const file of REQUIRED_PLANNING_FILES) {
    if (isFile(file)) {
      findings.required.present.push(`file: ${file}`);
    } else {
      findings.required.missing.push(`file: ${file}`);
    }
  }

  for (const file of REQUIRED_ROADMAP_FILES) {
    if (isFile(file)) {
      findings.required.present.push(`file: ${file}`);
    } else {
      findings.required.missing.push(`file: ${file}`);
    }
  }

  for (const file of REQUIRED_INDEX_FILES) {
    if (isFile(file)) {
      findings.required.present.push(`file: ${file}`);
    } else {
      findings.required.missing.push(`file: ${file}`);
    }
  }

  if (isFile("system/system.md")) {
    findings.system.hasSystemMd = true;
  }
  if (listSystemDocs().length > 0) {
    findings.system.hasAnySystemDoc = true;
  }
  if (!findings.system.hasSystemMd && !findings.system.hasAnySystemDoc) {
    findings.required.missing.push("file: system/system.md (or at least one system/*.md)");
  }
}

function checkOptional() {
  for (const dir of OPTIONAL_DIRS) {
    if (isDir(dir)) {
      findings.optional.present.push(`dir: ${dir}/`);
    } else {
      findings.optional.missing.push(`dir: ${dir}/`);
    }
  }
  for (const file of OPTIONAL_SCRIPTS) {
    if (isFile(file)) {
      findings.optional.present.push(`file: ${file}`);
    } else {
      findings.optional.missing.push(`file: ${file}`);
    }
  }
}

function emit() {
  const lines = [];
  lines.push(`# Vault Structure Report`);
  lines.push("");
  lines.push(`Vault root: \`${vaultRoot}\``);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  lines.push(`**Status:** ${findings.required.missing.length === 0 ? "PASS" : "FAIL"}`);
  lines.push("");
  lines.push(`**Summary:** ${findings.required.present.length} required present, ${findings.required.missing.length} required missing, ${findings.optional.present.length} optional present, ${findings.optional.missing.length} optional missing.`);
  lines.push("");

  if (findings.project.present) {
    lines.push(`**Project file:** \`${findings.project.found}\``);
  }
  lines.push("");

  if (findings.required.missing.length > 0) {
    lines.push("## Missing Required");
    lines.push("");
    for (const m of findings.required.missing) {
      lines.push(`- ${m}`);
    }
    lines.push("");
  }

  if (findings.required.present.length > 0) {
    lines.push("## Present Required");
    lines.push("");
    for (const p of findings.required.present) {
      lines.push(`- ${p}`);
    }
    lines.push("");
  }

  if (findings.optional.missing.length > 0) {
    lines.push("## Missing Optional (recommended)");
    lines.push("");
    for (const m of findings.optional.missing) {
      lines.push(`- ${m}`);
    }
    lines.push("");
  }

  if (findings.optional.present.length > 0) {
    lines.push("## Present Optional");
    lines.push("");
    for (const p of findings.optional.present) {
      lines.push(`- ${p}`);
    }
    lines.push("");
  }

  if (findings.required.missing.length === 0 && findings.optional.missing.length === 0) {
    lines.push("All required and optional files are in place.");
  }

  console.log(lines.join("\n"));
}

const findingsRef = findings;

function runFor(target) {
  vaultRoot = target.vault;
  findings.required = { missing: [], present: [] };
  findings.project = { found: null, present: false };
  findings.system = { hasSystemMd: false, hasAnySystemDoc: false };
  findings.optional = { missing: [], present: [] };

  checkRequired();
  checkOptional();
  emit();

  return findingsRef.required.missing.length;
}

const targets = resolveTargets();
let totalIssues = 0;
for (const target of targets) {
  console.log(`\n# Vault Structure Report — ${target.label}\n`);
  totalIssues += runFor(target);
}

process.exit(totalIssues > 0 ? 1 : 0);
