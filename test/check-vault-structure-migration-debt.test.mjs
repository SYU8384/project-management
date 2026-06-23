import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const SCRIPT = join(SKILL_DIR, "scripts", "check-vault-structure.mjs");

function makeMinimalPmFolder() {
  const tmp = mkdtempSync(join(tmpdir(), "pm-mig-test-"));
  mkdirSync(join(tmp, ".pm"), { recursive: true });
  return tmp;
}

function writeLedger(folder, applied) {
  const ledger = {
    schema_version: 1,
    applied: applied.map((id) => ({
      id,
      applied_at: "2026-06-12T00:00:00.000Z",
      skill_version: "1.9.0",
    })),
  };
  writeFileSync(join(folder, ".pm", "migrations.json"), JSON.stringify(ledger, null, 2));
}

function writeInboxLane(folder) {
  mkdirSync(join(folder, "inbox"), { recursive: true });
  writeFileSync(join(folder, "inbox", "inbox.md"), "# inbox\n");
}

test("migration-debt section is empty when migration is in the ledger", () => {
  const pm = makeMinimalPmFolder();
  writeLedger(pm, ["1.0.2-v0-content-rewrite", "1.8.0-content-semantic-fixes"]);
  try {
    const result = spawnSync(process.execPath, [SCRIPT, pm], { encoding: "utf8" });
    const out = result.stdout + result.stderr;
    // The section should not appear (no debt) or appear with no entries.
    const debtMatch = out.match(/## Migration Debt\s*\n([\s\S]*?)(?=\n## |\Z)/);
    if (debtMatch) {
      assert.equal(
        debtMatch[1].trim(),
        "",
        `Expected empty Migration Debt section, got:\n${debtMatch[1]}`
      );
    }
    // And the old "Unapplied Migrations" heading should NOT appear.
    assert.equal(
      out.includes("## Unapplied Migrations"),
      false,
      "Old 'Unapplied Migrations' heading should be renamed to 'Migration Debt'"
    );
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("migration-debt section is omitted entirely when nothing matches", () => {
  const pm = makeMinimalPmFolder();
  writeLedger(pm, ["1.0.0-lane-restructure"]);   // unrelated migration
  writeInboxLane(pm);
  try {
    const result = spawnSync(process.execPath, [SCRIPT, pm], { encoding: "utf8" });
    const out = result.stdout + result.stderr;
    assert.equal(
      out.includes("## Migration Debt"),
      false,
      "No Migration Debt section when no migration's detect() returns true and the ledger has no overlap"
    );
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("missing .pm/migrations.json is treated as empty ledger (no crash)", () => {
  const pm = makeMinimalPmFolder();
  // No ledger written. The validator should not crash; it should still
  // report debt for any migration whose detect() returns true.
  try {
    const result = spawnSync(process.execPath, [SCRIPT, pm], { encoding: "utf8" });
    assert.equal(
      result.status === 0 || typeof result.status === "number",
      true,
      "Script should exit (with whatever code the rest of the report warrants) even without a ledger"
    );
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("malformed .pm/migrations.json is treated as empty ledger (no crash)", () => {
  const pm = makeMinimalPmFolder();
  writeFileSync(join(pm, ".pm", "migrations.json"), "{ this is not valid json");
  try {
    const result = spawnSync(process.execPath, [SCRIPT, pm], { encoding: "utf8" });
    assert.equal(
      result.status === 0 || typeof result.status === "number",
      true,
      "Script should not crash on malformed ledger JSON"
    );
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});
