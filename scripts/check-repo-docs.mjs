#!/usr/bin/env node
/**
 * check-repo-docs.mjs
 *
 * Repo-canonical docs validator. Enforces the repository-visibility
 * convention (REFERENCE.md "Repository Visibility And Repo-Canonical Docs"):
 *
 *   - Every registered project must carry `visibility: public | private`
 *     in projects.json (backfilled by migration 1.21.0-project-visibility).
 *   - For `visibility: "public"` projects with a code_repo:
 *       * every PM `decisions/` note with `decision_type: ADR` must declare
 *         a `repo_path` frontmatter field, and that target must exist in
 *         the code repo (the repo ADR body is canonical);
 *       * every `docs/adr/D-*.md` file in the code repo must be referenced
 *         by some PM decision's `repo_path` (the PM folder stays the
 *         complete decision registry).
 *
 * Report-only: stubs need human summaries, so `--fix` prints a notice and
 * changes nothing.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { resolveProjectsConfigPath } from "./lib/paths.mjs";
import { isValidVisibility } from "./lib/convention.mjs";
import { parseFrontmatter } from "./lib/markdown.mjs";

const USAGE = `Usage: node scripts/check-repo-docs.mjs [options]

Options:
  --project <name>   check one project (default: all registered)
  --config <path>    path to projects.json (default: ~/.config/project-management/projects.json)
  --fix              accepted for check-pm.mjs pass-through; report-only validator
  --help, -h         show this help
`;

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { config: null, project: null, fix: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--config" || a === "-c") out.config = args[++i];
    else if (a === "--project" || a === "-p") out.project = args[++i];
    else if (a === "--fix") out.fix = true;
    else if (["--dry-run", "--force", "--strict", "--fix-strict"].includes(a)) {
      // Accepted for check-pm.mjs pass-through compatibility. No effect here.
    } else if (a === "--help" || a === "-h") {
      process.stdout.write(USAGE + "\n");
      process.exit(0);
    } else {
      process.stderr.write(`Unknown arg: ${a}\n${USAGE}\n`);
      process.exit(2);
    }
  }
  return out;
}

const CLI = parseArgs(process.argv);

function listAdrDecisions(pmFolder) {
  const dir = join(pmFolder, "decisions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /^D-\d+.*\.md$/.test(e.name))
    .map((e) => e.name);
}

function listRepoAdrs(codeRepo) {
  const dir = join(codeRepo, "docs", "adr");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /^D-\d+.*\.md$/.test(e.name))
    .map((e) => `docs/adr/${e.name}`);
}

function checkProject(name, project) {
  const issues = [];
  const manualReview = [];

  if (!isValidVisibility(project.visibility)) {
    issues.push(
      `missing or invalid visibility '${project.visibility ?? ""}' in projects.json; ` +
      `run migration 1.21.0-project-visibility (check-pm --fix) to backfill, then set "public" or "private"`
    );
  }

  if (project.visibility !== "public") return { name, issues, manualReview };
  if (!project.code_repo || !existsSync(resolve(project.code_repo))) {
    if (project.code_repo) {
      issues.push(`public project has missing code_repo path: ${project.code_repo}`);
    }
    return { name, issues, manualReview };
  }
  if (!project.pm_folder || !existsSync(resolve(project.pm_folder))) {
    return { name, issues, manualReview };
  }

  const codeRepo = resolve(project.code_repo);
  const pmFolder = resolve(project.pm_folder);

  const referencedRepoPaths = new Set();
  for (const file of listAdrDecisions(pmFolder)) {
    const abs = join(pmFolder, "decisions", file);
    const fm = parseFrontmatter(readFileSync(abs, "utf8"));
    if (!fm || fm.decision_type !== "ADR") continue;
    if (!fm.repo_path) {
      issues.push(
        `decisions/${file}: ADR decision on a public project is missing frontmatter 'repo_path'; ` +
        `the canonical body should live in the repo (docs/adr/D-NNN-slug.md) with a stub here`
      );
      continue;
    }
    const target = join(codeRepo, fm.repo_path);
    if (!existsSync(target)) {
      issues.push(`decisions/${file}: repo_path target not found in code repo: ${fm.repo_path}`);
      continue;
    }
    referencedRepoPaths.add(fm.repo_path.replace(/\\/g, "/"));
  }

  for (const repoRel of listRepoAdrs(codeRepo)) {
    if (!referencedRepoPaths.has(repoRel)) {
      issues.push(
        `${repoRel}: repo ADR has no PM decisions/ stub referencing it via repo_path; ` +
        `add a decisions/D-NNN_ADR_<slug>.md stub so the PM folder stays the complete registry`
      );
    }
  }

  return { name, issues, manualReview };
}

const configPath = resolveProjectsConfigPath(CLI.config ? resolve(CLI.config) : null);
if (!configPath) {
  console.error("ERROR: projects.json not found. Pass --config <path> or set up the skill first.");
  process.exit(2);
}
const cfg = JSON.parse(readFileSync(configPath, "utf8"));
const entries = CLI.project
  ? Object.entries(cfg.projects ?? {}).filter(([n]) => n === CLI.project)
  : Object.entries(cfg.projects ?? {});
if (CLI.project && entries.length === 0) {
  console.error(`ERROR: project '${CLI.project}' not found in ${configPath}`);
  process.exit(2);
}

if (CLI.fix) {
  console.log("# Repo-canonical docs\n");
  console.log("This validator is report-only; --fix changes nothing (ADR stubs need human summaries).\n");
}

let failures = 0;
for (const [name, project] of entries) {
  console.log(`\n# Repo-canonical docs: ${name}\n`);
  const { issues, manualReview } = checkProject(name, project);
  if (issues.length === 0 && manualReview.length === 0) {
    console.log("PASS\n");
    continue;
  }
  for (const issue of issues) console.log(`FAIL ${issue}`);
  for (const item of manualReview) console.log(`MANUAL REVIEW ${item}`);
  if (issues.length > 0) failures++;
}
console.log("");
process.exit(failures > 0 ? 1 : 0);
