import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(TEST_DIR);
const BOOTSTRAP = join(SKILL_DIR, "scripts", "bootstrap-pm.mjs");
const MIGRATE = join(SKILL_DIR, "scripts", "migrate.mjs");

function run(script, args) { return spawnSync(process.execPath, [script, ...args], { encoding: "utf8" }); }

test("bootstrap stores selected scoped commit policy and rejects invalid values", () => {
  const dir = mkdtempSync(join(tmpdir(), "pm-commit-policy-"));
  try {
    const pm = join(dir, "pm"), config = join(dir, "projects.json");
    const ok = run(BOOTSTRAP, ["--project", "Policy", "--pm-folder", pm, "--code-repo", "null", "--phase", "alpha", "--notes", "test", "--config", config, "--vault-root", dir, "--commit-policy", "scoped-by-default", "--yes"]);
    assert.equal(ok.status, 0, ok.stderr + ok.stdout);
    assert.equal(JSON.parse(readFileSync(config, "utf8")).projects.Policy.commit_policy, "scoped-by-default");
    const bad = run(BOOTSTRAP, ["--project", "Bad", "--pm-folder", join(dir, "bad"), "--code-repo", "null", "--phase", "alpha", "--notes", "test", "--config", config, "--vault-root", dir, "--commit-policy", "unsafe", "--yes"]);
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /Invalid --commit-policy/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("commit-policy migration backfills conservative legacy value idempotently", () => {
  const dir = mkdtempSync(join(tmpdir(), "pm-commit-policy-migrate-"));
  try {
    const pm = join(dir, "pm"), config = join(dir, "projects.json");
    mkdirSync(pm, { recursive: true });
    writeFileSync(config, JSON.stringify({ vault_root: dir, projects: { Legacy: { code_repo: null, pm_folder: pm, phase: "alpha", access: "authoritative" } } }, null, 2));
    const first = run(MIGRATE, ["--project", "Legacy", "--config", config, "--migration", "1.21.0-commit-policy", "--yes"]);
    assert.equal(first.status, 0, first.stderr + first.stdout);
    assert.equal(JSON.parse(readFileSync(config, "utf8")).projects.Legacy.commit_policy, "requires-explicit");
    const second = run(MIGRATE, ["--project", "Legacy", "--config", config, "--migration", "1.21.0-commit-policy", "--yes"]);
    assert.equal(second.status, 0, second.stderr + second.stdout);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
