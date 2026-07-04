import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const BOOTSTRAP = join(SKILL_DIR, "scripts", "bootstrap-pm.mjs");
const VAULT_STRUCTURE = join(SKILL_DIR, "scripts", "check-vault-structure.mjs");

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function runBootstrap({ vault, pmFolder, config, teamNote }) {
  const args = [
    BOOTSTRAP,
    "--project", "Team Project",
    "--pm-folder", pmFolder,
    "--code-repo", "null",
    "--phase", "alpha",
    "--notes", "A project for team note tests.",
    "--config", config,
    "--vault-root", vault,
    "--date", "2026-07-02",
  ];
  if (teamNote) args.push("--team-note", teamNote);
  return spawnSync(process.execPath, args, { encoding: "utf8" });
}

test("TEAM.md does not satisfy the required project root index", () => {
  const pm = tempDir("pm-team-structure-");
  try {
    writeFileSync(join(pm, "README.md"), "# README\n");
    writeFileSync(join(pm, "PRODUCT.md"), "# PRODUCT\n");
    writeFileSync(join(pm, "CURRENT_STATUS.md"), "# CURRENT_STATUS\n");
    writeFileSync(join(pm, "TEAM.md"), "# Team\n");

    const result = spawnSync(process.execPath, [VAULT_STRUCTURE, pm], { encoding: "utf8" });

    assert.equal(result.status, 1);
    assert.match(result.stdout, /file: <Project>\.md/);
    assert.doesNotMatch(result.stdout, /Project file: `TEAM\.md`/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("bootstrap skips TEAM.md by default", () => {
  const vault = tempDir("pm-team-bootstrap-default-");
  try {
    const pmFolder = join(vault, "Team Project");
    const config = join(vault, "projects.json");
    const result = runBootstrap({ vault, pmFolder, config });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(join(pmFolder, "TEAM.md")), false);
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
});

test("bootstrap can create placeholder TEAM.md", () => {
  const vault = tempDir("pm-team-bootstrap-placeholder-");
  try {
    const pmFolder = join(vault, "Team Project");
    const config = join(vault, "projects.json");
    const result = runBootstrap({ vault, pmFolder, config, teamNote: "placeholder" });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const team = readFileSync(join(pmFolder, "TEAM.md"), "utf8");
    assert.match(team, /# Team Project Team/);
    assert.match(team, /pageType: note/);
    assert.match(team, /PM access/);
    assert.doesNotMatch(team, /<Project>/);
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
});

test("bootstrap placeholder does not overwrite existing TEAM.md", () => {
  const vault = tempDir("pm-team-bootstrap-existing-");
  try {
    const pmFolder = join(vault, "Team Project");
    mkdirSync(pmFolder, { recursive: true });
    const existing = "# Existing Team\n\nKeep this text.\n";
    writeFileSync(join(pmFolder, "TEAM.md"), existing);
    const config = join(vault, "projects.json");
    const result = runBootstrap({ vault, pmFolder, config, teamNote: "placeholder" });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(readFileSync(join(pmFolder, "TEAM.md"), "utf8"), existing);
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
});
