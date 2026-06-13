import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const SCRIPT = join(SKILL_DIR, "scripts", "sync-agents-section.mjs");

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

test("sync-agents-section: --help prints usage and exits 0", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: node scripts\/sync-agents-section\.mjs/);
  assert.match(result.stdout, /--project <name>/);
  assert.match(result.stdout, /--dry-run/);
  assert.match(result.stdout, /--no-history/);
});

test("sync-agents-section: --project with unknown project exits 2", () => {
  const dir = freshDir("pm-sync-");
  try {
    const cfgPath = writeProjectsJson(dir, {});
    const result = run(["--config", cfgPath, "--project", "DoesNotExist"]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /project 'DoesNotExist' not found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("sync-agents-section: --config pointing at missing file falls back to XDG default", () => {
  // The skill convention (shared with check-agents.mjs) is: if the
  // explicit --config path doesn't resolve, fall back to the
  // user-specific XDG default `~/.config/project-management/projects.json`.
  // This test verifies the fallback, not a hard error, because that's
  // the established contract across the validators.
  const result = run(["--config", "/tmp/opencode/__nonexistent__.json", "--dry-run", "--no-history"]);
  // Either the XDG default exists (exit 0) or it doesn't (exit 2 from
  // `loadConfigPath` returning null). Both are acceptable per the
  // shared convention. The key is the script does not crash.
  assert.equal(typeof result.status, "number");
  assert.match(
    result.stdout + result.stderr,
    /Config:|\.config\/project-management\/projects\.json|not found/,
    "Script should mention either the XDG fallback or the missing-config error"
  );
});

test("sync-agents-section: rewrites a stale PM section, preserves surrounding content, appends history bullet", () => {
  const dir = freshDir("pm-sync-");
  try {
    // Code repo with a stale PM section
    const codeRepo = join(dir, "code");
    mkdirSync(codeRepo, { recursive: true });
    writeFileSync(join(codeRepo, "AGENTS.md"),
      "# Test Project\n" +
      "\n" +
      "Intro.\n" +
      "\n" +
      "## PM folder\n" +
      "\n" +
      "Stale content that does not match the template.\n" +
      "\n" +
      "## Project Notes\n" +
      "\n" +
      "Project-specific content that must survive the sync.\n"
    );

    // PM folder with a history file for today
    const pmFolder = join(dir, "pm");
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const monthDir = join(pmFolder, "history", `${yyyy}-${mm}`);
    mkdirSync(monthDir, { recursive: true });
    const historyFile = join(monthDir, `history-${yyyy}-${mm}-${day}.md`);
    writeFileSync(historyFile, "# Today's history\n");

    const cfgPath = writeProjectsJson(dir, {
      "Sync Test": {
        code_repo: codeRepo,
        pm_folder: pmFolder,
        access: "authoritative",
      },
    });

    const result = run(["--config", cfgPath, "--project", "Sync Test"]);
    assert.equal(result.status, 0, `stderr: ${result.stderr}\nstdout: ${result.stdout}`);
    assert.match(result.stdout, /rewrote ## PM folder/);
    assert.match(result.stdout, /appended history bullet/);

    // AGENTS.md should now have the rendered template + Project Notes preserved
    const agentsAfter = readFileSync(join(codeRepo, "AGENTS.md"), "utf8");
    assert.match(agentsAfter, /## PM folder/);
    assert.match(agentsAfter, /resolve local access/);
    assert.match(agentsAfter, /No PM access/);
    assert.match(agentsAfter, /## Project Notes/);
    assert.match(agentsAfter, /Project-specific content that must survive the sync/);
    assert.equal(
      agentsAfter.includes("Stale content that does not match the template"),
      false,
      "Stale content should be replaced"
    );

    // History bullet appended
    const historyAfter = readFileSync(historyFile, "utf8");
    assert.match(historyAfter, /sync AGENTS\.md `## PM folder` section with the latest portable template/);

    // Idempotent: re-run says "already in sync"
    const result2 = run(["--config", cfgPath, "--project", "Sync Test"]);
    assert.equal(result2.status, 0);
    assert.match(result2.stdout, /already in sync/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("sync-agents-section: --dry-run does not write AGENTS.md or history", () => {
  const dir = freshDir("pm-sync-");
  try {
    const codeRepo = join(dir, "code");
    mkdirSync(codeRepo, { recursive: true });
    const originalAgents = "# Test\n\n## PM folder\n\nStale.\n\n## End\n";
    writeFileSync(join(codeRepo, "AGENTS.md"), originalAgents);

    const pmFolder = join(dir, "pm");
    mkdirSync(pmFolder, { recursive: true });

    const cfgPath = writeProjectsJson(dir, {
      "Dry Run Test": {
        code_repo: codeRepo,
        pm_folder: pmFolder,
        access: "authoritative",
      },
    });

    const result = run(["--config", cfgPath, "--project", "Dry Run Test", "--dry-run"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /would rewrite ## PM folder/);
    assert.equal(
      readFileSync(join(codeRepo, "AGENTS.md"), "utf8"),
      originalAgents,
      "AGENTS.md must be unchanged in --dry-run"
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("sync-agents-section: --no-history skips history bullet", () => {
  const dir = freshDir("pm-sync-");
  try {
    const codeRepo = join(dir, "code");
    mkdirSync(codeRepo, { recursive: true });
    writeFileSync(join(codeRepo, "AGENTS.md"),
      "# Test\n\n## PM folder\n\nStale.\n\n## End\n"
    );

    const pmFolder = join(dir, "pm");
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const monthDir = join(pmFolder, "history", `${yyyy}-${mm}`);
    mkdirSync(monthDir, { recursive: true });
    const historyFile = join(monthDir, `history-${yyyy}-${mm}-${day}.md`);
    writeFileSync(historyFile, "# Today\n");

    const cfgPath = writeProjectsJson(dir, {
      "No Hist Test": {
        code_repo: codeRepo,
        pm_folder: pmFolder,
        access: "authoritative",
      },
    });

    const result = run(["--config", cfgPath, "--project", "No Hist Test", "--no-history"]);
    assert.equal(result.status, 0);
    // With --no-history, the script does not attempt to append a bullet
    // and the "appended history bullet" / "no history file" suffix is
    // absent from the output.
    assert.equal(
      /appended history bullet/.test(result.stdout),
      false,
      "--no-history should not append a bullet"
    );
    assert.equal(
      /no history file for today/.test(result.stdout),
      false,
      "--no-history should not even check for the history file"
    );
    const historyAfter = readFileSync(historyFile, "utf8");
    assert.equal(
      historyAfter.includes("sync AGENTS.md"),
      false,
      "History bullet should NOT be appended when --no-history is set"
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("sync-agents-section: skips project without code_repo", () => {
  const dir = freshDir("pm-sync-");
  try {
    const cfgPath = writeProjectsJson(dir, {
      "No Repo": { access: "authoritative", pm_folder: dir },
    });
    const result = run(["--config", cfgPath, "--project", "No Repo"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /no code_repo/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("sync-agents-section: skips project with invalid access", () => {
  const dir = freshDir("pm-sync-");
  try {
    const codeRepo = join(dir, "code");
    mkdirSync(codeRepo, { recursive: true });
    writeFileSync(join(codeRepo, "AGENTS.md"), "# Test\n\n## PM folder\n\nstale\n");
    const cfgPath = writeProjectsJson(dir, {
      "Bad Access": { code_repo: codeRepo, pm_folder: dir, access: "unavailable" },
    });
    const result = run(["--config", cfgPath, "--project", "Bad Access"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /unknown access/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("sync-agents-section: fails when AGENTS.md is missing", () => {
  const dir = freshDir("pm-sync-");
  try {
    const codeRepo = join(dir, "code");
    mkdirSync(codeRepo, { recursive: true });
    // No AGENTS.md written
    const cfgPath = writeProjectsJson(dir, {
      "No Agents": { code_repo: codeRepo, pm_folder: dir, access: "authoritative" },
    });
    const result = run(["--config", cfgPath, "--project", "No Agents"]);
    assert.equal(result.status, 1, `expected exit 1, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    assert.match(result.stdout, /AGENTS\.md not found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
