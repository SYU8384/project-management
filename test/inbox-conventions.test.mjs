import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const INBOX_SCRIPT = fileURLToPath(new URL("../scripts/check-inbox-conventions.mjs", import.meta.url));
const MIGRATE_SCRIPT = fileURLToPath(new URL("../scripts/migrate.mjs", import.meta.url));

function tempProject(name = "Project") {
  const root = mkdtempSync(join(tmpdir(), "pm-inbox-"));
  const pm = join(root, name);
  mkdirSync(join(pm, "inbox"), { recursive: true });
  return { root, pm };
}

function runNode(args, cwd = process.cwd()) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
  });
}

function writeInboxNote(pm, filename, frontmatter, body = "# note\n\nRaw body.\n") {
  writeFileSync(join(pm, "inbox", filename), `---\n${frontmatter.trim()}\n---\n${body}`);
}

test("valid placeholder inbox note passes", () => {
  const { pm } = tempProject();
  writeInboxNote(
    pm,
    "2026-06-23_NAME_PLACEHOLDER_raw-idea.md",
    `
title: "2026-06-23 NAME_PLACEHOLDER raw-idea"
created: 2026-06-23
updated: 2026-06-23
last_reviewed: 2026-06-23
pageType: note
status: unprocessed
author: NAME_PLACEHOLDER
resolution: pending
destination: none
`,
    "# 2026-06-23 NAME_PLACEHOLDER raw-idea\n\nRaw body.\n",
  );

  const result = runNode([INBOX_SCRIPT, pm]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("invalid status and resolution combinations fail", () => {
  const { pm } = tempProject();
  writeInboxNote(
    pm,
    "2026-06-23_Haoyou_email-routing.md",
    `
title: "2026-06-23 Haoyou email-routing"
created: 2026-06-23
updated: 2026-06-23
last_reviewed: 2026-06-23
pageType: note
status: processed
author: Haoyou
resolution: pending
destination: none
`,
  );

  const result = runNode([INBOX_SCRIPT, pm]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /processed notes require a non-pending resolution/);
});

test("folder note is skipped", () => {
  const { pm } = tempProject();
  writeFileSync(join(pm, "inbox", "inbox.md"), "# inbox\n");
  const result = runNode([INBOX_SCRIPT, pm]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("--fix adds deterministic metadata without replacing body", () => {
  const { pm } = tempProject();
  const filename = "2026-06-23_Haoyou_email-routing.md";
  writeFileSync(
    join(pm, "inbox", filename),
    `---\ncreated: 2026-06-23\n---\n\n## Navigation\n\n- [[Projects/OpenManager/OpenManager|Back to OpenManager]]\n`,
  );

  const result = runNode([INBOX_SCRIPT, pm, "--fix"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);

  const after = readFileSync(join(pm, "inbox", filename), "utf8");
  assert.match(after, /^title: "2026-06-23 Haoyou email-routing"$/m);
  assert.match(after, /^author: Haoyou$/m);
  assert.match(after, /^resolution: pending$/m);
  assert.match(after, /^destination: none$/m);
  assert.match(after, /^# 2026-06-23 Haoyou email-routing$/m);
  assert.match(after, /## Navigation/);
});

test("1.14.0 inbox migration creates lane and normalizes existing raw note", () => {
  const vault = mkdtempSync(join(tmpdir(), "pm-inbox-vault-"));
  mkdirSync(join(vault, ".obsidian"), { recursive: true });
  const pm = join(vault, "Projects", "OpenManager");
  mkdirSync(join(pm, "inbox"), { recursive: true });
  const filename = "2026-06-23_Haoyou_email-routing.md";
  writeFileSync(
    join(pm, "inbox", filename),
    `---\ncreated: 2026-06-23\n---\n\n## Navigation\n\n- [[Projects/OpenManager/OpenManager|Back to OpenManager]]\n`,
  );

  const config = join(vault, "projects.json");
  writeFileSync(config, JSON.stringify({
    vault_root: vault,
    skill_dir: process.cwd(),
    projects: {
      OpenManager: {
        code_repo: null,
        pm_folder: pm,
        phase: "alpha",
        notes: "test",
        access: "authoritative",
      },
    },
  }, null, 2));

  const result = runNode([
    MIGRATE_SCRIPT,
    "--pm-folder",
    pm,
    "--config",
    config,
    "--migration",
    "1.14.0-inbox-lane",
    "--yes",
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);

  const index = readFileSync(join(pm, "inbox", "inbox.md"), "utf8");
  assert.match(index, /# inbox/);
  assert.match(index, /Raw owner\/collaborator intake notes/);

  const after = readFileSync(join(pm, "inbox", filename), "utf8");
  assert.match(after, /^title: "2026-06-23 Haoyou email-routing"$/m);
  assert.match(after, /^pageType: note$/m);
  assert.match(after, /^status: unprocessed$/m);
  assert.match(after, /## Navigation/);
});
