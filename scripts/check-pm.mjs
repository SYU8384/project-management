#!/usr/bin/env node
/**
 * check-pm.mjs
 *
 * Primary validation entry point for project-management PM folders.
 * Runs the focused validators in sequence and returns a nonzero exit code
 * if any check fails.
 *
 * With `--fix`, runs the full reconcile workflow:
 *   Phase 1: validators (report-only baseline)
 *   Phase 2: validator --fix (auto-create missing folder notes, rewrite pageType)
 *   Phase 3: pending migrations (from registry, idempotent, reads ledger)
 *   Phase 4: validators (final report; residual issues surface as warnings)
 *
 * The orchestrator passes through all `--project`, `--config`, and `--vault`
 * args to the focused validators. `--dry-run` is honored at Phase 3 (migrations
 * report what they'd do, don't apply). `--force` is passed to migrations so
 * ledger-blocked re-applies work (e.g., v1.0.2 re-run after v1.2.0 detection-pattern
 * extension).
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ARGS = process.argv.slice(2);

const fixRequested = ARGS.includes("--fix");
const dryRunRequested = ARGS.includes("--dry-run");
const forceRequested = ARGS.includes("--force");

const CHECKS = [
  { file: "check-vault-structure.mjs", label: "Vault structure" },
  { file: "check-stale-docs.mjs", label: "Stale docs" },
  { file: "check-pm-consistency.mjs", label: "PM consistency" },
  { file: "check-agents.mjs", label: "AGENTS.md integration" },
];

function runChild(scriptPath, extraArgs = [], opts = {}) {
  return spawnSync(process.execPath, [scriptPath, ...extraArgs], {
    stdio: "inherit",
    ...opts,
  });
}

function runChecks(phaseLabel, checks, extraArgs = []) {
  const failures = [];
  console.log(`\n# ${phaseLabel}\n`);
  for (const check of checks) {
    console.log(`\n## ${check.label} (${check.file})\n`);
    const result = runChild(join(SCRIPT_DIR, check.file), [...ARGS, ...extraArgs]);
    if (result.error) {
      console.error(`\nERROR: failed to run ${check.file}: ${result.error.message}`);
      failures.push(`${check.file}: ${result.error.message}`);
      continue;
    }
    if (result.status !== 0) failures.push(`${check.file}: exit ${result.status ?? "unknown"}`);
  }
  return failures;
}

function findUnappliedMigrations() {
  const listResult = spawnSync(
    process.execPath,
    [join(SCRIPT_DIR, "migrate.mjs"), "--list", "--json"],
    { encoding: "utf8" },
  );
  if (listResult.error || listResult.status !== 0) return [];
  let registry;
  try {
    registry = JSON.parse(listResult.stdout);
  } catch {
    return [];
  }
  if (!Array.isArray(registry)) return [];

  // For each migration, try to get the matching pm_folder(s) by running the validator
  // once and parsing the Unapplied Migrations block. Simpler: just return all IDs.
  // The orchestrator then runs `migrate.mjs --migration <id> --yes` per project.
  return registry.map((m) => m.id);
}

function runMigrations() {
  const migrationIds = findUnappliedMigrations();
  if (migrationIds.length === 0) {
    console.log("\n## Migrations\n\nNo unapplied migrations found.\n");
    return [];
  }
  console.log(`\n## Migrations (${migrationIds.length} registered; checking each project)\n`);
  const failures = [];

  // Determine which projects to run migrations for.
  // If --project was specified, run for that project only. Otherwise, run for
  // every project registered in projects.json. To keep this simple, we just
  // call `migrate.mjs --list --json` and then call `migrate.mjs --yes` once per
  // migration id; the runner's per-project logic handles each pm_folder.

  for (const id of migrationIds) {
    console.log(`\n## Migration ${id}\n`);
    // Strip flags that are orchestrator-level (--fix) but unknown to migrate.mjs.
    const safeArgs = ARGS.filter((a) => a !== "--fix");
    const args = ["--migration", id, "--yes", ...safeArgs];
    if (dryRunRequested) args.push("--dry-run");
    if (forceRequested) args.push("--force");
    const result = runChild(join(SCRIPT_DIR, "migrate.mjs"), args);
    if (result.error) {
      failures.push(`${id}: ${result.error.message}`);
      continue;
    }
    if (result.status !== 0) failures.push(`${id}: exit ${result.status ?? "unknown"}`);
  }
  return failures;
}

const allFailures = [];

// Phase 1: baseline validators
if (fixRequested) {
  console.log("\n========================================");
  console.log("# Phase 1: Validators (baseline)");
  console.log("========================================");
  allFailures.push(...runChecks("Phase 1: Validators (baseline report)", CHECKS));

  // Phase 2: validators with --fix
  console.log("\n========================================");
  console.log("# Phase 2: Validator auto-fix");
  console.log("========================================");
  allFailures.push(...runChecks("Phase 2: Validator auto-fix", CHECKS, ["--fix"]));

  // Phase 3: pending migrations
  console.log("\n========================================");
  console.log("# Phase 3: Pending migrations");
  console.log("========================================");
  allFailures.push(...runMigrations());

  // Phase 4: re-validate
  console.log("\n========================================");
  console.log("# Phase 4: Re-validate (final report)");
  console.log("========================================");
  allFailures.push(...runChecks("Phase 4: Re-validate (final report)", CHECKS));
} else {
  console.log("\n# PM validation");
  allFailures.push(...runChecks("PM validation", CHECKS));
}

if (allFailures.length > 0) {
  console.error("\n# PM validation failed\n");
  for (const failure of allFailures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\n# PM validation passed\n");