import test from "node:test";
import assert from "node:assert/strict";

import { finding, renderFindings } from "../scripts/lib/findings.mjs";

test("finding requires code and message", () => {
  assert.throws(() => finding({ message: "missing code" }), /code/);
  assert.throws(() => finding({ code: "x" }), /message/);
});

test("renderFindings prints PASS and FAIL reports", () => {
  assert.match(renderFindings("Report", []), /\*\*Status:\*\* PASS/);
  const report = renderFindings("Report", [
    finding({ code: "x.y", path: "a.md", message: "broken", remedy: "fix it", fixable: true }),
  ]);
  assert.match(report, /\*\*Status:\*\* FAIL/);
  assert.match(report, /x\.y `a\.md`: broken/);
  assert.match(report, /Remedy: fix it/);
});
