import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const SCRIPT = join(SKILL_DIR, "scripts", "check-reorg-candidates.mjs");

function freshDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function run(pmFolder, args = [], env = {}) {
  return spawnSync(process.execPath, [SCRIPT, pmFolder, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
}

function writeNote(pmFolder, rel, { body = "", extraFrontmatter = "" } = {}) {
  const abs = join(pmFolder, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `---
title: ${rel.replace(/\.md$/, "")}
created: 2026-07-01
updated: 2026-07-01
last_reviewed: 2026-07-01
status: active
owner: PM
${extraFrontmatter}---

${body}
`);
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

test("tiny feature pages and orphan manuals are reported, exit stays 0", () => {
  const pm = freshDir("pm-reorg-tiny-");
  try {
    writeNote(pm, "features/small-thing.md", { body: "One line of prose." });
    writeNote(pm, "docs/User Guide/lonely-manual.md", { body: "A manual nothing links to.\n".repeat(3) });
    const result = run(pm);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Tiny Feature Pages \(1\)/);
    assert.match(result.stdout, /features\/small-thing\.md/);
    assert.match(result.stdout, /## Orphaned Manuals \(no live inbound links\) \(1\)/);
    assert.match(result.stdout, /docs\/User Guide\/lonely-manual\.md/);
  } finally {
    cleanup(pm);
  }
});

test("links from history do not count as live inbound links", () => {
  const pm = freshDir("pm-reorg-history-link-");
  try {
    const body = "Enough prose to avoid the tiny signal.\n".repeat(45);
    writeNote(pm, "features/old-feature.md", { body });
    writeNote(pm, "history/2026/July/history-2026-07-01.md", {
      body: "- did work on [[features/old-feature|old feature]]",
    });
    const result = run(pm);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /## Orphaned Feature Pages \(no live inbound links\) \(1\)/);
  } finally {
    cleanup(pm);
  }
});

test("similar pairs require a shared slug token; template noise is ignored", () => {
  const pm = freshDir("pm-reorg-pairs-");
  try {
    const templateBody = "## Overview\n\n## Status\n\n## Related\n\nSome shared template prose about the project.\n";
    writeNote(pm, "features/alpha.md", { body: templateBody });
    writeNote(pm, "features/beta.md", { body: templateBody });
    writeNote(pm, "features/email-connectors.md", { body: "Handles inbound email sync.\n" });
    writeNote(pm, "features/email-work-queue.md", { body: "Queues email work items.\n" });
    const result = run(pm, ["--json"], { REORG_SIMILARITY: "0.2" });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.features.similarPairs.length, 1);
    const pair = report.features.similarPairs[0];
    assert.deepEqual([pair.a, pair.b].sort(), ["features/email-connectors.md", "features/email-work-queue.md"]);
  } finally {
    cleanup(pm);
  }
});

test("supersession hints skip pairs that already declare a relationship", () => {
  const pm = freshDir("pm-reorg-supersede-");
  try {
    writeNote(pm, "decisions/D-001_ADR_memory-store.md", { body: "Chose the memory store backend.\n" });
    writeNote(pm, "decisions/D-002_ADR_memory-store-v2.md", {
      body: "Supersedes: [[decisions/D-001_ADR_memory-store|D-001]]\n",
      extraFrontmatter: "supersedes: D-001\n",
    });
    writeNote(pm, "decisions/D-003_ADR_memory-retention.md", { body: "How long memory persists.\n" });
    const result = run(pm, ["--json"]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    for (const hint of report.supersessionHints) {
      const pair = [hint.a, hint.b];
      assert.ok(!(pair.includes("decisions/D-001_ADR_memory-store.md") && pair.includes("decisions/D-002_ADR_memory-store-v2.md")));
    }
  } finally {
    cleanup(pm);
  }
});

test("stale inbox notes with status new are reported", () => {
  const pm = freshDir("pm-reorg-inbox-");
  try {
    writeNote(pm, "inbox/2026-01-01_old-idea.md", {
      extraFrontmatter: "status: new\ncreated: 2026-01-01\nauthor: NAME_PLACEHOLDER\n",
      body: "Raw intake note.\n",
    });
    writeNote(pm, "inbox/2026-01-02_processed.md", {
      extraFrontmatter: "status: processed\ncreated: 2026-01-02\nauthor: NAME_PLACEHOLDER\n",
      body: "Already triaged.\n",
    });
    const result = run(pm, ["--json"]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.backlog.staleInbox.length, 1);
    assert.equal(report.backlog.staleInbox[0].path, "inbox/2026-01-01_old-idea.md");
  } finally {
    cleanup(pm);
  }
});
