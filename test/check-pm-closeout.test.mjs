import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, utimesSync } from "node:fs";
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

test("check-pm-closeout: priority-bearing PM changes require CURRENT_STATUS refresh", () => {
  const dir = freshDir("pm-closeout-");
  try {
    const repo = join(dir, "code");
    const pmFolder = join(dir, "pm");
    initRepo(repo);
    mkdirSync(join(pmFolder, "roadmap"), { recursive: true });
    mkdirSync(pmFolder, { recursive: true });
    const currentStatus = join(pmFolder, "CURRENT_STATUS.md");
    const donePending = join(pmFolder, "roadmap", "done-pending.md");
    writeFileSync(currentStatus, "# current\n");
    writeFileSync(donePending, "# done-pending\n\n## Active\n\n- [ ] PENDING: work\n");
    const historyPath = todayHistoryPath(pmFolder);
    mkdirSync(dirname(historyPath), { recursive: true });
    writeFileSync(historyPath, "# Today\n\n- Updated PM history.\n");
    writeFileSync(join(repo, "src.txt"), "changed\n");

    const oldTime = new Date("2026-06-20T00:00:00.000Z");
    const newTime = new Date("2026-06-20T02:00:00.000Z");
    utimesSync(currentStatus, oldTime, oldTime);
    utimesSync(donePending, newTime, newTime);
    utimesSync(historyPath, newTime, newTime);

    const cfgPath = writeProjectsJson(dir, {
      NeedsStatus: { code_repo: repo, pm_folder: pmFolder, access: "authoritative" },
    });

    const result = run(["--config", cfgPath, "--since", "2026-06-20T01:00:00.000Z"], repo);
    assert.equal(result.status, 1, result.stderr + result.stdout);
    assert.match(result.stdout, /Priority-bearing PM files updated/);
    assert.match(result.stdout, /CURRENT_STATUS\.md freshness: not updated since baseline/);
    assert.match(result.stdout, /Priority-bearing PM files changed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check-pm-closeout: priority-bearing PM changes require active milestone refresh", () => {
  const dir = freshDir("pm-closeout-");
  try {
    const repo = join(dir, "code");
    const pmFolder = join(dir, "pm");
    initRepo(repo);
    mkdirSync(join(pmFolder, "roadmap", "milestones"), { recursive: true });
    const currentStatus = join(pmFolder, "CURRENT_STATUS.md");
    const donePending = join(pmFolder, "roadmap", "done-pending.md");
    const milestone = join(pmFolder, "roadmap", "milestones", "beta.md");
    writeFileSync(currentStatus, `# current

## Current Phase

beta
`);
    writeFileSync(donePending, "# done-pending\n\n## Active\n\n- [ ] PENDING: work\n");
    writeFileSync(milestone, "# beta\n\n## Goal\n\nShip beta.\n");
    const historyPath = todayHistoryPath(pmFolder);
    mkdirSync(dirname(historyPath), { recursive: true });
    writeFileSync(historyPath, "# Today\n\n- Updated PM history.\n");
    writeFileSync(join(repo, "src.txt"), "changed\n");

    const oldTime = new Date("2026-06-20T00:00:00.000Z");
    const newTime = new Date("2026-06-20T02:00:00.000Z");
    utimesSync(milestone, oldTime, oldTime);
    utimesSync(currentStatus, newTime, newTime);
    utimesSync(donePending, newTime, newTime);
    utimesSync(historyPath, newTime, newTime);

    const cfgPath = writeProjectsJson(dir, {
      NeedsMilestone: { code_repo: repo, pm_folder: pmFolder, access: "authoritative", phase: "beta" },
    });

    const failing = run(["--config", cfgPath, "--since", "2026-06-20T01:00:00.000Z"], repo);
    assert.equal(failing.status, 1, failing.stderr + failing.stdout);
    assert.match(failing.stdout, /Active milestone freshness: roadmap\/milestones\/beta\.md not updated since baseline/);
    assert.match(failing.stdout, /refresh the active or explicitly linked `roadmap\/milestones\/\*\.md` note/);

    utimesSync(milestone, newTime, newTime);
    const passing = run(["--config", cfgPath, "--since", "2026-06-20T01:00:00.000Z"], repo);
    assert.equal(passing.status, 0, passing.stderr + passing.stdout);
    assert.match(passing.stdout, /Priority-bearing PM changes also refreshed the active or explicitly linked milestone/);
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
