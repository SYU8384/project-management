import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const SCRIPT = join(SKILL_DIR, "scripts", "check-pm-consistency.mjs");

function freshDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function writeHistoryLog(pmFolder, relPath) {
  const abs = join(pmFolder, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `---
title: history-2026-07-03
created: 2026-07-03
updated: 2026-07-03
last_reviewed: 2026-07-03
pageType: history
kind: changelog
---
# history-2026-07-03

- **History layout checked.** test(pm): fixture entry.
`);
}

function runConsistency(pmFolder) {
  return spawnSync(process.execPath, [SCRIPT, pmFolder], { encoding: "utf8" });
}

test("check-pm-consistency fails legacy history/YYYY-MM folders with migration guidance", () => {
  const pm = freshDir("pm-history-legacy-");
  try {
    writeHistoryLog(pm, "history/2026-07/history-2026-07-03.md");

    const result = runConsistency(pm);
    assert.equal(result.status, 1, result.stderr + result.stdout);
    assert.match(result.stdout, /legacy history month folders `history\/YYYY-MM\/`/);
    assert.match(result.stdout, /1\.18\.0-history-year-month-layout/);
    assert.match(result.stdout, /history\/YYYY\/<Month>\//);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("check-pm-consistency resolves existing non-Markdown evidence targets", () => {
  const pm = freshDir("pm-consistency-evidence-");
  try {
    mkdirSync(join(pm, "roadmap", "plans", "assets", "case"), { recursive: true });
    writeFileSync(join(pm, "roadmap", "plans", "assets", "case", "report.json"), "{}\n");
    writeFileSync(join(pm, "README.md"), `---
title: evidence-test
created: 2026-11-01
updated: 2026-11-01
last_reviewed: 2026-11-01
pageType: index
status: active
owner: PM
---
# evidence-test

[[roadmap/plans/assets/case/report.json|evidence]]
`);

    const result = runConsistency(pm);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.doesNotMatch(result.stdout, /unresolved link/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("check-pm-consistency does not require mirrors for terminal plans", () => {
  const pm = freshDir("pm-consistency-terminal-plan-");
  try {
    mkdirSync(join(pm, "roadmap", "plans"), { recursive: true });
    writeFileSync(join(pm, "roadmap", "done-pending.md"), `---
title: done-pending
created: 2026-11-01
updated: 2026-11-01
last_reviewed: 2026-11-01
pageType: roadmap
status: active
owner: PM
---
# done-pending
`);
    writeFileSync(join(pm, "roadmap", "plans", "2026-10-03_retired.md"), `---
title: retired
created: 2026-10-03
updated: 2026-11-01
last_reviewed: 2026-11-01
pageType: planning
status: superseded
owner: PM
---
## Summary

Terminal plan retained for history.
`);

    const result = runConsistency(pm);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.doesNotMatch(result.stdout, /missing roadmap\/done-pending mirror/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("check-pm-consistency accepts canonical history/YYYY/<Month> history logs", () => {
  const pm = freshDir("pm-history-canonical-");
  try {
    writeHistoryLog(pm, "history/2026/July/history-2026-07-03.md");

    const result = runConsistency(pm);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /\*\*Status:\*\* PASS/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});
