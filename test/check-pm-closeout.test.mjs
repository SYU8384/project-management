import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const SCRIPT = join(SKILL_DIR, "scripts", "check-pm-closeout.mjs");

function freshDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function git(repo, args) {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, `git ${args.join(" ")}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
}

function initRepo(repo) {
  mkdirSync(repo, { recursive: true });
  git(repo, ["init", "-q"]);
}

function writeProjectsJson(folder, projects) {
  const cfg = { vault_root: folder, skill_dir: SKILL_DIR, projects };
  const path = join(folder, "projects.json");
  writeFileSync(path, JSON.stringify(cfg, null, 2));
  return path;
}

function run(args, cwd) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", cwd });
}

function todayHistoryPath(pmFolder) {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return join(pmFolder, "history", `${yyyy}-${mm}`, `history-${yyyy}-${mm}-${dd}.md`);
}

test("check-pm-closeout: no matching code_repo means no local PM access", () => {
  const dir = freshDir("pm-closeout-");
  try {
    const repo = join(dir, "code");
    const otherRepo = join(dir, "other");
    const pmFolder = join(dir, "pm");
    initRepo(repo);
    mkdirSync(otherRepo, { recursive: true });
    mkdirSync(pmFolder, { recursive: true });
    writeFileSync(join(repo, "README.md"), "changed\n");
    const cfgPath = writeProjectsJson(dir, {
      Other: { code_repo: otherRepo, pm_folder: pmFolder, access: "authoritative" },
    });

    const result = run(["--config", cfgPath], repo);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /No PM access resolved/);
    assert.match(result.stdout, /inactive locally/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check-pm-closeout: read-only projects pass with PR-body reminder", () => {
  const dir = freshDir("pm-closeout-");
  try {
    const repo = join(dir, "code");
    const pmFolder = join(dir, "pm");
    initRepo(repo);
    mkdirSync(pmFolder, { recursive: true });
    writeFileSync(join(repo, "feature.txt"), "changed\n");
    const cfgPath = writeProjectsJson(dir, {
      ReadOnly: { code_repo: repo, pm_folder: pmFolder, access: "read-only" },
    });

    const result = run(["--config", cfgPath], repo);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /Read-only PM access/);
    assert.match(result.stdout, /PM folder impact/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check-pm-closeout: authoritative project with no changes passes", () => {
  const dir = freshDir("pm-closeout-");
  try {
    const repo = join(dir, "code");
    const pmFolder = join(dir, "pm");
    initRepo(repo);
    mkdirSync(pmFolder, { recursive: true });
    const cfgPath = writeProjectsJson(dir, {
      Clean: { code_repo: repo, pm_folder: pmFolder, access: "authoritative" },
    });

    const result = run(["--config", cfgPath], repo);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /No meaningful worktree changes found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check-pm-closeout: authoritative project with changed files fails without PM evidence", () => {
  const dir = freshDir("pm-closeout-");
  try {
    const repo = join(dir, "code");
    const pmFolder = join(dir, "pm");
    initRepo(repo);
    mkdirSync(pmFolder, { recursive: true });
    writeFileSync(join(repo, "src.txt"), "changed\n");
    const cfgPath = writeProjectsJson(dir, {
      MissingPM: { code_repo: repo, pm_folder: pmFolder, access: "authoritative" },
    });

    const result = run(["--config", cfgPath, "--since", "2000-01-01T00:00:00.000Z"], repo);
    assert.equal(result.status, 1, result.stderr + result.stdout);
    assert.match(result.stdout, /Project: MissingPM \(code_repo\)/);
    assert.match(result.stdout, /PM close-out required/);
    assert.match(result.stdout, /Current-state PM files updated: none found/);
    assert.match(result.stdout, /history\/YYYY-MM\/history-YYYY-MM-DD\.md/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check-pm-closeout: current-state PM update plus current-day history passes", () => {
  const dir = freshDir("pm-closeout-");
  try {
    const repo = join(dir, "code");
    const pmFolder = join(dir, "pm");
    initRepo(repo);
    mkdirSync(join(pmFolder, "system"), { recursive: true });
    writeFileSync(join(pmFolder, "system", "overview.md"), "# overview\n\nUpdated.\n");
    const historyPath = todayHistoryPath(pmFolder);
    mkdirSync(dirname(historyPath), { recursive: true });
    writeFileSync(historyPath, "# Today\n\n- Updated PM history.\n");
    writeFileSync(join(repo, "src.txt"), "changed\n");
    const cfgPath = writeProjectsJson(dir, {
      Done: { code_repo: repo, pm_folder: pmFolder, access: "authoritative" },
    });

    const result = run(["--config", cfgPath, "--since", "2000-01-01T00:00:00.000Z"], repo);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /PM close-out evidence found/);
    assert.match(result.stdout, /system\/overview\.md/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check-pm-closeout: --allow-no-impact passes with an explicit reason", () => {
  const dir = freshDir("pm-closeout-");
  try {
    const repo = join(dir, "code");
    const pmFolder = join(dir, "pm");
    initRepo(repo);
    mkdirSync(pmFolder, { recursive: true });
    writeFileSync(join(repo, "snapshot.tmp"), "generated\n");
    const cfgPath = writeProjectsJson(dir, {
      NoImpact: { code_repo: repo, pm_folder: pmFolder, access: "authoritative" },
    });

    const result = run(["--config", cfgPath, "--allow-no-impact", "generated snapshot only"], repo);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /No PM impact asserted: generated snapshot only/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check-pm-closeout: changed skill files produce useful PM lane suggestions", () => {
  const dir = freshDir("pm-closeout-");
  try {
    const repo = join(dir, "code");
    const pmFolder = join(dir, "pm");
    initRepo(repo);
    mkdirSync(join(repo, "scripts"), { recursive: true });
    mkdirSync(pmFolder, { recursive: true });
    writeFileSync(join(repo, "scripts", "check-agents.mjs"), "changed\n");
    const cfgPath = writeProjectsJson(dir, {
      Suggestions: { code_repo: repo, pm_folder: pmFolder, access: "authoritative" },
    });

    const result = run(["--config", cfgPath, "--since", "2000-01-01T00:00:00.000Z"], repo);
    assert.equal(result.status, 1, result.stderr + result.stdout);
    assert.match(result.stdout, /features\/code-repo-integration\.md/);
    assert.match(result.stdout, /features\/validation-and-repair\.md/);
    assert.match(result.stdout, /docs\/Developer Guide\/adding-a-validator\.md/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
