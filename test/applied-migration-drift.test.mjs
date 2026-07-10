import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import migration, { __test } from "../scripts/migrations/1.18.0-history-year-month-layout.mjs";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(TEST_DIR);
const BOOTSTRAP = join(SKILL_DIR, "scripts", "bootstrap-pm.mjs");
const CHECK_PM = join(SKILL_DIR, "scripts", "check-pm.mjs");
const MIGRATE = join(SKILL_DIR, "scripts", "migrate.mjs");

function historyLog(date, productBullet, verificationTitle, verificationLines) {
  return `---
title: history-${date}
created: ${date}
updated: ${date}
last_reviewed: ${date}
pageType: history
kind: mixed
owner: PM
---
# history-${date}

## Product and PM changes

- **${productBullet}.** fix(pm): fixture outcome.

## Verification

### ${verificationTitle}

${verificationLines.map((line) => `- ${line}`).join("\n")}

## Navigation

- [[Projects/Example/history/history|Back to history]]
`;
}

test("history collision merge adds missing subsections and rejects ambiguous prose", () => {
  const target = historyLog("2026-07-03", "Shared outcome", "Existing check", ["PASS: shared"]);
  const source = historyLog("2026-07-03", "Shared outcome", "Recovered check", [
    "PASS: recovered",
    "BLOCKED: preserved evidence",
  ]);
  const merged = __test.mergeHistoryLogCollision(source, target);
  assert.equal(merged.ok, true, merged.message);
  assert.equal(merged.changed, true);
  assert.match(merged.content, /### Existing check/);
  assert.match(merged.content, /### Recovered check/);
  assert.equal((merged.content.match(/Shared outcome/g) ?? []).length, 1);

  const ambiguousSource = historyLog("2026-07-03", "Shared outcome", "Existing check", ["PASS: placeholder"])
    .replace("- PASS: placeholder", "Human prose that conflicts.");
  const conflictingTarget = target.replace("- PASS: shared", "Different human prose.");
  const ambiguous = __test.mergeHistoryLogCollision(ambiguousSource, conflictingTarget);
  assert.equal(ambiguous.ok, false);
  assert.match(ambiguous.message, /non-list prose differs/);
});

test("migration list exposes reconcileOnDrift metadata", () => {
  const result = spawnSync(process.execPath, [MIGRATE, "--list", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const listed = JSON.parse(result.stdout);
  const historyMigration = listed.find((row) => row.id === migration.id);
  assert.equal(historyMigration.reconcileOnDrift, true);
});

test("explicit legacy compatibility prose is not treated as concrete history drift", () => {
  const root = mkdtempSync(join(tmpdir(), "pm-history-compat-"));
  try {
    writeFileSync(
      join(root, "note.md"),
      "Removed legacy history/2026-07/ after migration 1.18.0.\n"
    );
    assert.deepEqual(__test.listLegacyLinkMonths(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("check-pm --fix repairs applied history drift without duplicating the ledger", () => {
  const root = mkdtempSync(join(tmpdir(), "pm-applied-drift-"));
  try {
    const vault = join(root, "Vault");
    const pm = join(vault, "Projects", "Example");
    const codeRepo = join(root, "example-repo");
    const config = join(root, "projects.json");
    mkdirSync(pm, { recursive: true });
    mkdirSync(codeRepo, { recursive: true });

    const bootstrap = spawnSync(process.execPath, [
      BOOTSTRAP,
      "--project", "Example",
      "--pm-folder", pm,
      "--code-repo", codeRepo,
      "--phase", "beta",
      "--notes", "Applied migration drift fixture.",
      "--config", config,
      "--vault-root", vault,
      "--date", "2026-07-03",
      "--yes",
    ], { encoding: "utf8" });
    assert.equal(bootstrap.status, 0, bootstrap.stdout + bootstrap.stderr);

    const canonical = join(pm, "history", "2026", "July", "history-2026-07-03.md");
    const legacyDir = join(pm, "history", "2026-07");
    const legacy = join(legacyDir, "history-2026-07-03.md");
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(canonical, historyLog("2026-07-03", "Shared outcome", "Existing check", ["PASS: shared"]));
    writeFileSync(legacy, historyLog("2026-07-03", "Shared outcome", "Recovered check", ["PASS: recovered"]));
    writeFileSync(join(legacyDir, "2026-07.md"), `---\npageType: index\n---\n<!-- vault-maintain:index:start -->\n<!-- vault-maintain:index:end -->\n`);

    const readme = join(pm, "README.md");
    writeFileSync(
      readme,
      readFileSync(readme, "utf8")
        + "\nWrite new logs to history/YYYY-MM/history-YYYY-MM-DD.md.\n"
        + "Legacy history/YYYY-MM/ folders are migration input only.\n"
    );
    mkdirSync(join(pm, ".pm"), { recursive: true });
    const registryResult = spawnSync(process.execPath, [MIGRATE, "--list", "--json"], { encoding: "utf8" });
    assert.equal(registryResult.status, 0, registryResult.stderr);
    const registry = JSON.parse(registryResult.stdout);
    writeFileSync(join(pm, ".pm", "migrations.json"), JSON.stringify({
      schema_version: 1,
      applied: registry.map((row) => ({
        id: row.id,
        applied_at: row.id === migration.id ? "2026-07-02T00:00:00.000Z" : "2026-07-01T00:00:00.000Z",
        skill_version: row.to,
      })),
    }, null, 2));

    const first = spawnSync(process.execPath, [
      CHECK_PM,
      "--project", "Example",
      "--config", config,
      "--fix",
    ], { encoding: "utf8", timeout: 30000 });
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.equal(existsSync(legacyDir), false);
    assert.match(readFileSync(canonical, "utf8"), /### Recovered check/);
    const repairedReadme = readFileSync(readme, "utf8");
    assert.match(repairedReadme, /history\/YYYY\/<Month>\/history-YYYY-MM-DD\.md/);
    assert.match(repairedReadme, /Legacy history\/YYYY-MM\/ folders are migration input only\./);
    const firstLedger = readFileSync(join(pm, ".pm", "migrations.json"), "utf8");
    const applied = JSON.parse(firstLedger).applied.filter((row) => row.id === migration.id);
    assert.equal(applied.length, 1);
    assert.equal(applied[0].applied_at, "2026-07-02T00:00:00.000Z");

    const snapshots = {
      canonical: readFileSync(canonical, "utf8"),
      readme: repairedReadme,
      ledger: firstLedger,
    };
    const second = spawnSync(process.execPath, [
      CHECK_PM,
      "--project", "Example",
      "--config", config,
      "--fix",
    ], { encoding: "utf8", timeout: 30000 });
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.equal(readFileSync(canonical, "utf8"), snapshots.canonical);
    assert.equal(readFileSync(readme, "utf8"), snapshots.readme);
    assert.equal(readFileSync(join(pm, ".pm", "migrations.json"), "utf8"), snapshots.ledger);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
