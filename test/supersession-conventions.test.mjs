import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const SCRIPT = join(SKILL_DIR, "scripts", "check-supersession-conventions.mjs");

function freshDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function run(pmFolder, args = []) {
  return spawnSync(process.execPath, [SCRIPT, pmFolder, ...args], { encoding: "utf8" });
}

function writeNote(pmFolder, rel, { pageType, status, extraFrontmatter = "", body = "" }) {
  const abs = join(pmFolder, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `---
title: ${rel.replace(/\.md$/, "")}
created: 2026-07-05
updated: 2026-07-05
last_reviewed: 2026-07-05
pageType: ${pageType}
status: ${status}
owner: PM
${extraFrontmatter}---
# ${rel.replace(/\.md$/, "")}

${body}
`);
}

test("decision supersedes requires prior decision to be superseded", () => {
  const pm = freshDir("pm-supersession-decision-");
  try {
    writeNote(pm, "decisions/D-001_ADR_old-path.md", {
      pageType: "decision",
      status: "accepted",
      extraFrontmatter: "decision_type: ADR\ndecision_date: 2026-07-01\n",
    });
    writeNote(pm, "decisions/D-002_ADR_new-path.md", {
      pageType: "decision",
      status: "accepted",
      extraFrontmatter: "decision_type: ADR\ndecision_date: 2026-07-05\nsupersedes: D-001\n",
    });

    const before = run(pm);
    assert.equal(before.status, 1, before.stdout + before.stderr);
    assert.match(before.stdout, /D-001_ADR_old-path\.md: status must be superseded/);

    const fixed = run(pm, ["--fix"]);
    assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);
    assert.match(fixed.stdout, /fixed: decisions\/D-001_ADR_old-path\.md: status -> superseded/);
    assert.match(readFileSync(join(pm, "decisions", "D-001_ADR_old-path.md"), "utf8"), /status: superseded/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("decision supersedes fails when target decision is missing", () => {
  const pm = freshDir("pm-supersession-missing-decision-");
  try {
    writeNote(pm, "decisions/D-002_ADR_new-path.md", {
      pageType: "decision",
      status: "accepted",
      extraFrontmatter: "decision_type: ADR\ndecision_date: 2026-07-05\nsupersedes: D-001\n",
    });

    const result = run(pm);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /supersedes D-001, but no matching decisions\/D-001_\*\.md exists/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("declared supersession links must resolve but legacy notes without declarations pass", () => {
  const pm = freshDir("pm-supersession-links-");
  try {
    writeNote(pm, "roadmap/plans/2026-07-05_new-plan.md", {
      pageType: "planning",
      status: "active",
      body: "## Supersession Review\n\n- Supersedes: [[roadmap/plans/2026-07-01_missing-plan]]\n",
    });
    writeNote(pm, "roadmap/plans/2026-07-04_legacy-plan.md", {
      pageType: "planning",
      status: "active",
      body: "## Summary\n\nNo supersession review yet.\n",
    });

    const result = run(pm);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /declared supersession target \[\[roadmap\/plans\/2026-07-01_missing-plan\]\] does not resolve/);
    assert.equal(result.stdout.includes("2026-07-04_legacy-plan"), false);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("feature replacement declarations require deprecated status", () => {
  const pm = freshDir("pm-supersession-feature-");
  try {
    writeNote(pm, "features/old-inbox.md", {
      pageType: "feature",
      status: "stable",
      body: "## Supersession Review\n\n- Replaced by: [[features/new-inbox]]\n",
    });
    writeNote(pm, "features/new-inbox.md", {
      pageType: "feature",
      status: "alpha",
      body: "## Supersession Review\n\n- Supersedes: [[features/old-inbox]]\n",
    });

    const result = run(pm);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /features\/old-inbox\.md: feature declares a replacement; set status: deprecated/);
    assert.match(result.stdout, /features\/old-inbox\.md: status must be deprecated because features\/new-inbox\.md declares Supersedes/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});
