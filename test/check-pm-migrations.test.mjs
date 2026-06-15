import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildMigrationArgs, expandMigrationTargetArgs } from "../scripts/lib/check-pm-migrations.mjs";

function freshDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function writeProjectsJson(folder, projects) {
  const cfg = { vault_root: folder, projects };
  const path = join(folder, "projects.json");
  writeFileSync(path, JSON.stringify(cfg, null, 2));
  return path;
}

test("expandMigrationTargetArgs expands all registered projects when no project filter is present", () => {
  const dir = freshDir("pm-check-pm-migrations-");
  try {
    const onePm = join(dir, "one-pm");
    const twoPm = join(dir, "two-pm");
    mkdirSync(onePm, { recursive: true });
    mkdirSync(twoPm, { recursive: true });
    const cfgPath = writeProjectsJson(dir, {
      One: { pm_folder: onePm, access: "authoritative" },
      Two: { pm_folder: twoPm, access: "authoritative" },
    });

    const targets = expandMigrationTargetArgs(["--config", cfgPath, "--fix"]);
    assert.deepEqual(targets, [
      { label: "One", args: ["--project", "One", "--config", cfgPath] },
      { label: "Two", args: ["--project", "Two", "--config", cfgPath] },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("expandMigrationTargetArgs preserves a single explicit project target", () => {
  const dir = freshDir("pm-check-pm-migrations-");
  try {
    const pmFolder = join(dir, "pm");
    mkdirSync(pmFolder, { recursive: true });
    const cfgPath = writeProjectsJson(dir, {
      Single: { pm_folder: pmFolder, access: "authoritative" },
      Other: { pm_folder: join(dir, "other"), access: "authoritative" },
    });

    const targets = expandMigrationTargetArgs(["--config", cfgPath, "--project", "Single", "--fix"]);
    assert.deepEqual(targets, [
      { label: "Single", args: ["--project", "Single", "--config", cfgPath] },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("expandMigrationTargetArgs converts a positional PM folder to migrate.mjs --pm-folder args", () => {
  const dir = freshDir("pm-check-pm-migrations-");
  try {
    const pmFolder = join(dir, "pm");
    mkdirSync(pmFolder, { recursive: true });

    const targets = expandMigrationTargetArgs([pmFolder, "--fix"]);
    assert.deepEqual(targets, [
      { label: pmFolder, args: ["--pm-folder", pmFolder] },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buildMigrationArgs adds orchestrator flags once", () => {
  assert.deepEqual(
    buildMigrationArgs("1.12.0-vault-relative-obsidian-links", ["--project", "One"], {
      dryRun: true,
      force: true,
    }),
    [
      "--migration",
      "1.12.0-vault-relative-obsidian-links",
      "--yes",
      "--project",
      "One",
      "--dry-run",
      "--force",
    ]
  );
});
