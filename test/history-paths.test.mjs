import test from "node:test";
import assert from "node:assert/strict";

import {
  historyArchivedSectionsRel,
  historyDayRel,
  historyMonthIndexRel,
  historyYearIndexRel,
  isCanonicalHistoryLogRel,
  isCanonicalHistoryMonthRel,
  isLegacyHistoryLogRel,
  isLegacyHistoryMonthRel,
  legacyHistoryDayRel,
} from "../scripts/lib/history-paths.mjs";

test("history path helpers resolve daily logs under year/month folders", () => {
  assert.equal(historyYearIndexRel("2026-07-02"), "history/2026/2026");
  assert.equal(historyMonthIndexRel("2026-07-02"), "history/2026/July/July");
  assert.equal(historyDayRel("2026-07-02"), "history/2026/July/history-2026-07-02");
  assert.equal(
    historyArchivedSectionsRel("2026-07-02"),
    "history/2026/July/history-2026-07-02-archived-sections"
  );
});

test("legacy history path helpers preserve YYYY-MM compatibility", () => {
  assert.equal(legacyHistoryDayRel("2026-07-02"), "history/2026-07/history-2026-07-02");
});

test("history layout predicates distinguish canonical and migration-only legacy paths", () => {
  assert.equal(isCanonicalHistoryMonthRel("history/2026/July/history-2026-07-02.md"), true);
  assert.equal(isCanonicalHistoryLogRel("history/2026/July/history-2026-07-02.md"), true);
  assert.equal(isCanonicalHistoryLogRel("history/2026/July/history-2026-07-02-archived-sections.md"), true);
  assert.equal(isCanonicalHistoryMonthRel("history/2026-07/history-2026-07-02.md"), false);

  assert.equal(isLegacyHistoryMonthRel("history/2026-07/history-2026-07-02.md"), true);
  assert.equal(isLegacyHistoryLogRel("history/2026-07/history-2026-07-02.md"), true);
  assert.equal(isLegacyHistoryLogRel("history/2026-07/history-2026-07-02-archived-sections.md"), true);
  assert.equal(isLegacyHistoryMonthRel("history/2026/July/history-2026-07-02.md"), false);
});
