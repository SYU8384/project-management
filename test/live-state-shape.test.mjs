import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { checkLiveNoteShape, duplicateLiveSections } from "../scripts/lib/live-state-shape.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(dirname(SCRIPT_DIR), "scripts", "check-live-state-shape.mjs");

const validStatus = `# current

## Current Phase

beta

## Top Priorities

1. Keep current priorities concise.

## Blocked

- None.

## Recent Wins

- See the daily history note.

## Major Risks

- None.

## Stale Docs

- None.

## Navigation
`;

const validMilestone = `# beta

## Goal

Prove the milestone.

## Priorities

- [ ] PENDING: Link the owning plan.

## Major Steps

- [ ] PENDING: Complete acceptance.

## Exit Criteria

- [ ] Owner accepts.

## Deferred

- Later work.

## Update Triggers

- Phase-level scope changes only.

## Navigation
`;

function fixture() {
  const pm = mkdtempSync(join(tmpdir(), "pm-live-state-"));
  mkdirSync(join(pm, "roadmap", "milestones"), { recursive: true });
  mkdirSync(join(pm, "features"), { recursive: true });
  mkdirSync(join(pm, "system"), { recursive: true });
  writeFileSync(join(pm, "CURRENT_STATUS.md"), validStatus);
  writeFileSync(join(pm, "roadmap", "milestones", "beta.md"), validMilestone);
  writeFileSync(join(pm, "features", "notes.md"), "# feature\n\n## Current Behavior\n\nCurated feature links.\n");
  writeFileSync(join(pm, "system", "notes.md"), "# system\n\n## Current Behavior\n\nTechnical storage contracts and implementation details that belong only to the system note.\n");
  return pm;
}

function run(pm) {
  return spawnSync(process.execPath, [SCRIPT, pm], { encoding: "utf8" });
}

test("live-state shape accepts bounded snapshot and milestone notes", () => {
  const pm = fixture();
  try {
    const result = run(pm);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Status:\*\* PASS/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("live-state shape rejects journals, commit ledgers, and duplicated live sections", () => {
  const pm = fixture();
  try {
    const journal = "## Implemented Notes sync — 2026-11-01\n\nImplementation evidence and verification details are duplicated across status and milestone so this section is long enough to detect.\n";
    writeFileSync(join(pm, "CURRENT_STATUS.md"), `${validStatus}\nImplementation commits: abc123 — implement sync\n\n${journal}\n`);
    writeFileSync(join(pm, "roadmap", "milestones", "beta.md"), `${validMilestone}\n${journal}\n`);
    const result = run(pm);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /unexpected implementation\/journal section/);
    assert.match(result.stdout, /implementation-commit ledger/);
    assert.match(result.stdout, /identical live section/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("feature/system duplication is detected but oversized snapshots are review warnings", () => {
  const pm = fixture();
  try {
    const duplicate = "## Current Behavior\n\nTechnical storage contracts and implementation details that belong only to the system note but were copied into the feature page.\n";
    writeFileSync(join(pm, "features", "notes.md"), `# feature\n\n${duplicate}\n`);
    writeFileSync(join(pm, "system", "notes.md"), `# system\n\n${duplicate}\n`);
    const duplicated = run(pm);
    assert.equal(duplicated.status, 1, duplicated.stdout + duplicated.stderr);
    assert.match(duplicated.stdout, /features\/notes\.md ↔ system\/notes\.md: identical section/);

    writeFileSync(join(pm, "features", "notes.md"), "# feature\n\n## Current Behavior\n\nCurated links only.\n");
    writeFileSync(join(pm, "system", "notes.md"), "# system\n\n## Current Behavior\n\nDifferent technical truth.\n");
    writeFileSync(join(pm, "CURRENT_STATUS.md"), `${validStatus}\n${"Review context line.\n".repeat(170)}`);
    const oversized = run(pm);
    assert.equal(oversized.status, 0, oversized.stdout + oversized.stderr);
    assert.match(oversized.stdout, /Manual Review — Size Budgets/);
    assert.match(oversized.stdout, /exceeds the 160-line review budget/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("duplicate detector ignores short scaffolding and shape helper classifies issues", () => {
  assert.deepEqual(duplicateLiveSections("## Navigation\n\n- [[Home]]", "## Navigation\n\n- [[Home]]"), []);
  const result = checkLiveNoteShape("# current\n\n## Random journal\n\nImplementation commits: abc\n", { kind: "status" });
  assert.deepEqual(result.issues.map((issue) => issue.code), ["unexpected-section", "commit-ledger"]);
});
