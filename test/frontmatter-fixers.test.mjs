import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { normalizePmFrontmatter } from "../scripts/lib/frontmatter-fixers.mjs";

const CONSISTENCY_SCRIPT = fileURLToPath(new URL("../scripts/check-pm-consistency.mjs", import.meta.url));
const STALE_SCRIPT = fileURLToPath(new URL("../scripts/check-stale-docs.mjs", import.meta.url));

test("normalizePmFrontmatter collapses duplicate leading frontmatter and fills deterministic fields", () => {
  const input = `---\ncreated: 2026-06-19\ntags:\n  - stale\n---\n---\naliases: [done-pending]\ncreated: 2026-05-24\npageType: roadmap\ntitle: done-pending\n---\n# done-pending\n`;
  const result = normalizePmFrontmatter(input, {
    rel: "roadmap/done-pending.md",
    project: "OpenManager",
    date: "2026-06-20",
  });
  assert.match(result.updated, /^---\naliases: \[done-pending\]/);
  assert.match(result.updated, /^updated: 2026-06-20$/m);
  assert.match(result.updated, /^last_reviewed: 2026-06-20$/m);
  assert.match(result.updated, /^status: active$/m);
  assert.doesNotMatch(result.updated, /^---\ncreated: 2026-06-19[\s\S]*?---\n---/);
});

test("normalizePmFrontmatter collapses duplicate leading frontmatter separated by a BOM", () => {
  const input = `---\ncreated: 2026-06-21\ntags:\n  - synapse\n---\n\ufeff---\naliases: [done-pending]\ncreated: 2026-05-22\npageType: roadmap\ntitle: done-pending\nowner: PM\n---\n# done-pending\n`;
  const result = normalizePmFrontmatter(input, {
    rel: "roadmap/done-pending.md",
    project: "Synapse",
    date: "2026-06-21",
  });
  assert.match(result.updated, /^---\naliases: \[done-pending\]/);
  assert.match(result.updated, /^owner: PM$/m);
  assert.match(result.updated, /^status: active$/m);
  assert.equal(result.updated.match(/^---$/gm)?.length, 2);
  assert.doesNotMatch(result.updated, /\n\ufeff---\n/);
});

test("normalizePmFrontmatter repairs history metadata shape", () => {
  const input = `---\ntitle: history-2026-06-17\ncreated: 2026-06-17\nupdated: 2026-06-17\nlast_reviewed: 2026-06-17\npageType: history\nstatus: active\n---\n# history\n`;
  const result = normalizePmFrontmatter(input, {
    rel: "history/2026-06/history-2026-06-17.md",
    project: "Synapse",
    date: "2026-06-20",
  });
  assert.match(result.updated, /^kind: mixed$/m);
  assert.doesNotMatch(result.updated, /^status:/m);
});

test("normalizePmFrontmatter applies history metadata after correcting a duplicate note pageType", () => {
  const input = `---\ncreated: 2026-06-21\npageType: history\nkind: mixed\n---\n\ufeff---\ntitle: history-2026-06-21\ncreated: 2026-06-21\npageType: note\nstatus: active\nowner: PM\n---\n# history-2026-06-21\n`;
  const result = normalizePmFrontmatter(input, {
    rel: "history/2026-06/history-2026-06-21.md",
    project: "Synapse",
    date: "2026-06-21",
  });
  assert.match(result.updated, /^pageType: history$/m);
  assert.match(result.updated, /^kind: mixed$/m);
  assert.doesNotMatch(result.updated, /^status:/m);
  assert.doesNotMatch(result.updated, /\n\ufeff---\n/);
});

test("check-pm-consistency --fix clears deterministic missing frontmatter fields", () => {
  const dir = mkdtempSync(join(tmpdir(), "pm-frontmatter-"));
  try {
    mkdirSync(join(dir, "system"), { recursive: true });
    writeFileSync(join(dir, "system/architecture.md"), `---\ncreated: 2026-06-01\n---\n# architecture\n`);
    const fixed = spawnSync(process.execPath, [CONSISTENCY_SCRIPT, dir, "--fix"], { encoding: "utf8" });
    assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);
    const updated = readFileSync(join(dir, "system/architecture.md"), "utf8");
    assert.match(updated, /^title: "architecture"$/m);
    assert.match(updated, /^pageType: system$/m);
    assert.match(updated, /^status: active$/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check-stale-docs --fix touches stale reviewed files with frontmatter", () => {
  const dir = mkdtempSync(join(tmpdir(), "pm-stale-"));
  try {
    mkdirSync(join(dir, "system"), { recursive: true });
    writeFileSync(join(dir, "system/architecture.md"), `---\ntitle: architecture\ncreated: 2026-01-01\nupdated: 2026-01-01\nlast_reviewed: 2026-01-01\npageType: system\nstatus: active\n---\n# architecture\n`);
    const fixed = spawnSync(process.execPath, [STALE_SCRIPT, dir, "--fix"], { encoding: "utf8" });
    assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);
    const updated = readFileSync(join(dir, "system/architecture.md"), "utf8");
    assert.match(updated, /^last_reviewed: \d{4}-\d{2}-\d{2}$/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
