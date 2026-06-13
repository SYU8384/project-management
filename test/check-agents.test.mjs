import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const SCRIPT = join(SKILL_DIR, "scripts", "check-agents.mjs");

function freshDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function writeProjectsJson(folder, projects) {
  const cfg = { vault_root: folder, skill_dir: SKILL_DIR, projects };
  const path = join(folder, "projects.json");
  writeFileSync(path, JSON.stringify(cfg, null, 2));
  return path;
}

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
}

test("check-agents --fix rewrites stale PM section and preserves other content", () => {
  const dir = freshDir("pm-check-agents-");
  try {
    const codeRepo = join(dir, "code");
    const pmFolder = join(dir, "pm");
    mkdirSync(codeRepo, { recursive: true });
    mkdirSync(pmFolder, { recursive: true });
    writeFileSync(join(codeRepo, "AGENTS.md"), "# Repo\n\n## PM folder\n\nStale.\n\n## Commands\n\nRun tests.\n");
    const cfgPath = writeProjectsJson(dir, {
      Stale: { code_repo: codeRepo, pm_folder: pmFolder, access: "authoritative" },
    });

    const before = run(["--config", cfgPath, "--project", "Stale"]);
    assert.equal(before.status, 1);
    assert.match(before.stdout, /does not match AGENTS_PM_SECTION\.md/);

    const fixed = run(["--config", cfgPath, "--project", "Stale", "--fix"]);
    assert.equal(fixed.status, 0, fixed.stderr + fixed.stdout);
    assert.match(fixed.stdout, /fixed:/);

    const content = readFileSync(join(codeRepo, "AGENTS.md"), "utf8");
    assert.match(content, /resolve local access/);
    assert.match(content, /## Commands/);
    assert.match(content, /Run tests\./);
    assert.equal(content.includes("Stale."), false);

    const after = run(["--config", cfgPath, "--project", "Stale"]);
    assert.equal(after.status, 0, after.stderr + after.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check-agents --fix appends missing PM section", () => {
  const dir = freshDir("pm-check-agents-");
  try {
    const codeRepo = join(dir, "code");
    const pmFolder = join(dir, "pm");
    mkdirSync(codeRepo, { recursive: true });
    mkdirSync(pmFolder, { recursive: true });
    writeFileSync(join(codeRepo, "AGENTS.md"), "# Repo\n\n## Commands\n\nRun tests.\n");
    const cfgPath = writeProjectsJson(dir, {
      MissingSection: { code_repo: codeRepo, pm_folder: pmFolder, access: "read-only" },
    });

    const fixed = run(["--config", cfgPath, "--project", "MissingSection", "--fix"]);
    assert.equal(fixed.status, 0, fixed.stderr + fixed.stdout);
    const content = readFileSync(join(codeRepo, "AGENTS.md"), "utf8");
    assert.match(content, /## Commands/);
    assert.match(content, /## PM folder/);
    assert.match(content, /No PM access/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check-agents --fix creates missing AGENTS.md", () => {
  const dir = freshDir("pm-check-agents-");
  try {
    const codeRepo = join(dir, "code");
    const pmFolder = join(dir, "pm");
    mkdirSync(codeRepo, { recursive: true });
    mkdirSync(pmFolder, { recursive: true });
    const cfgPath = writeProjectsJson(dir, {
      MissingFile: { code_repo: codeRepo, pm_folder: pmFolder, access: "authoritative" },
    });

    const fixed = run(["--config", cfgPath, "--project", "MissingFile", "--fix"]);
    assert.equal(fixed.status, 0, fixed.stderr + fixed.stdout);
    assert.equal(existsSync(join(codeRepo, "AGENTS.md")), true);
    const content = readFileSync(join(codeRepo, "AGENTS.md"), "utf8");
    assert.match(content, /## PM folder/);
    assert.match(content, /projects\.json/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check-agents --fix does not mutate invalid access projects", () => {
  const dir = freshDir("pm-check-agents-");
  try {
    const codeRepo = join(dir, "code");
    const pmFolder = join(dir, "pm");
    mkdirSync(codeRepo, { recursive: true });
    mkdirSync(pmFolder, { recursive: true });
    const agentsPath = join(codeRepo, "AGENTS.md");
    const original = "# Repo\n";
    writeFileSync(agentsPath, original);
    const cfgPath = writeProjectsJson(dir, {
      Bad: { code_repo: codeRepo, pm_folder: pmFolder, access: "unavailable" },
    });

    const fixed = run(["--config", cfgPath, "--project", "Bad", "--fix"]);
    assert.equal(fixed.status, 1);
    assert.match(fixed.stdout, /invalid access 'unavailable'/);
    assert.equal(readFileSync(agentsPath, "utf8"), original);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
