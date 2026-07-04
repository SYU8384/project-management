import test from "node:test";
import assert from "node:assert/strict";

import {
  hasKnownIssueRouting,
  stalePublicHistoryPathLines,
} from "../scripts/check-skill.mjs";

test("skill quality detects public docs that teach retired history/YYYY-MM paths", () => {
  const lines = stalePublicHistoryPathLines(`
New work should write history/YYYY-MM/history-YYYY-MM-DD.md.
Archive output should write history/YYYY-MM/history-YYYY-MM-DD-archived-sections.md.
`);

  assert.deepEqual(lines.map((line) => line.lineNumber), [2, 3]);
});

test("skill quality allows explicitly marked migration compatibility mentions", () => {
  const lines = stalePublicHistoryPathLines(`
Legacy history/YYYY-MM/ folders are migration input only.
Migration 1.18.0-history-year-month-layout moves history/YYYY-MM/history-YYYY-MM-DD.md files.
`);

  assert.deepEqual(lines, []);
});

test("skill quality requires explicit known issue routing", () => {
  assert.equal(hasKnownIssueRouting(`
Known issue logging writes to roadmap/known-issues.md before other lanes.
Use this for each known issue, bug, risk, blocker, limitation, and current gap.
  `), true);

  assert.equal(hasKnownIssueRouting(`
Generic logging updates CURRENT_STATUS.md and history.
  `), false);
});
