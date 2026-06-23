#!/usr/bin/env node
/**
 * check-pm.mjs
 *
 * Primary validation entry point for project-management PM folders.
 * Reads the validator registry at `validators/_index.mjs` (mirrors the
 * migration registry design) and runs each registered validator in
 * sequence. Returns a nonzero exit code if any check fails.
 *
 * With `--fix`, runs the full reconcile workflow:
 *   Phase 1: validators (report-only baseline; failures do not determine final exit)
 *   Phase 2: validator --fix (auto-create missing folder notes, repair deterministic metadata/content drift, repair AGENTS.md PM sections)
 *   Phase 3: pending migrations (from registry, idempotent, reads ledger)
 *   Phase 4: validators (final report; residual failures determine final exit)
 *
 * The orchestrator passes target args through to focused validators. During
 * Phase 3, a config-only all-project reconcile expands into focused per-project
 * migration invocations. `--dry-run` is honored at Phase 3 (migrations report
 * what they'd do, don't apply). `--force` is passed to migrations so
 * ledger-blocked re-applies work (e.g., v1.0.2 re-run after v1.2.0
 * detection-pattern extension).
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildMigrationArgs, expandMigrationTargetArgs } from "./lib/check-pm-migrations.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ARGS = process.argv.slice(2);

const fixRequested = ARGS.includes("--fix");
const dryRunRequested = ARGS.includes("--dry-run");
const forceRequested = ARGS.includes("--force");

async function loadValidatorRegistry() {
  const indexPath = join(SCRIPT_DIR, "validators", "_index.mjs");
  const mod = await import(pathToFileURL(indexPath).href);
  if (!mod || !Array.isArray(mod.default)) {
    console.error(
      `Validator registry at ${indexPath} must default-export an array of { file, label } entries.`
    );
    process.exit(2);
  }
  for (const entry of mod.default) {
    if (!entry.file || !entry.label) {
      console.error(
        `Validator registry entry is missing 'file' or 'label': ${JSON.stringify(entry)}`
      );
      process.exit(2);
    }
  }
  return mod.default;
}

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

  return registry.map((m) => m.id);
}

function runMigrations() {
  const migrationIds = findUnappliedMigrations();
  if (migrationIds.length === 0) {
    console.log("\n## Migrations\n\nNo unapplied migrations found.\n");
    return [];
  }
  const migrationTargets = expandMigrationTargetArgs(ARGS);
  if (migrationTargets.length === 0) {
    console.log("\n## Migrations\n\nNo PM folders registered for migration.\n");
    return [];
  }
  console.log(
    `\n## Migrations (${migrationIds.length} registered; ${migrationTargets.length} target${migrationTargets.length === 1 ? "" : "s"})\n`
  );
  const failures = [];

  for (const target of migrationTargets) {
    console.log(`\n## Migration target: ${target.label}\n`);
    for (const id of migrationIds) {
      console.log(`\n### Migration ${id}\n`);
      const result = runChild(
        join(SCRIPT_DIR, "migrate.mjs"),
        buildMigrationArgs(id, target.args, {
          dryRun: dryRunRequested,
          force: forceRequested,
        })
      );
      if (result.error) {
        failures.push(`${target.label} ${id}: ${result.error.message}`);
        continue;
      }
      if (result.status !== 0) {
        failures.push(`${target.label} ${id}: exit ${result.status ?? "unknown"}`);
      }
    }
  }
  return failures;
}

const REGISTRY = await loadValidatorRegistry();
const allFailures = [];

if (fixRequested) {
  console.log("\n========================================");
  console.log("# Phase 1: Validators (baseline)");
  console.log("========================================");
  const baselineFailures = runChecks("Phase 1: Validators (baseline report)", REGISTRY);
  if (baselineFailures.length > 0) {
    console.log("\n# Baseline findings detected; continuing because --fix was requested.\n");
  }

  console.log("\n========================================");
  console.log("# Phase 2: Validator auto-fix");
  console.log("========================================");
  allFailures.push(...runChecks("Phase 2: Validator auto-fix", REGISTRY, ["--fix"]));

  console.log("\n========================================");
  console.log("# Phase 3: Pending migrations");
  console.log("========================================");
  allFailures.push(...runMigrations());

  console.log("\n========================================");
  console.log("# Phase 4: Re-validate (final report)");
  console.log("========================================");
  allFailures.push(...runChecks("Phase 4: Re-validate (final report)", REGISTRY));
} else {
  console.log("\n# PM validation");
  allFailures.push(...runChecks("PM validation", REGISTRY));
}

if (allFailures.length > 0) {
  console.error("\n# PM validation failed\n");
  for (const failure of allFailures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\n# PM validation passed\n");
