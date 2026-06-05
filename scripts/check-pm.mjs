#!/usr/bin/env node
/**
 * check-pm.mjs
 *
 * Primary validation entry point for project-management PM folders.
 * Runs the focused validators in sequence and returns a nonzero exit code
 * if any check fails.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ARGS = process.argv.slice(2);

const CHECKS = [
  {
    file: "check-vault-structure.mjs",
    label: "Vault structure",
  },
  {
    file: "check-stale-docs.mjs",
    label: "Stale docs",
  },
  {
    file: "check-pm-consistency.mjs",
    label: "PM consistency",
  },
];

const failures = [];

for (const check of CHECKS) {
  console.log(`\n# Running ${check.label} (${check.file})\n`);
  const result = spawnSync(process.execPath, [join(SCRIPT_DIR, check.file), ...ARGS], {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`\nERROR: failed to run ${check.file}: ${result.error.message}`);
    failures.push(`${check.file}: ${result.error.message}`);
    continue;
  }

  if (result.status !== 0) {
    failures.push(`${check.file}: exit ${result.status ?? "unknown"}`);
  }
}

if (failures.length > 0) {
  console.error("\n# PM validation failed\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("\n# PM validation passed\n");
