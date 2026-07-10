import assert from "node:assert/strict";
import test from "node:test";

import { __test } from "../scripts/migrations/1.19.0-supersession-review-guidance.mjs";

test("supersession guidance preserves the four-section folder-note limit", () => {
  const input = `# decisions

## Active

*(no items)*

## Subfolders

*(no items)*

## Notes

*(no items)*

## Navigation

- [[Home|Back to Home]]
`;

  const updated = __test.updateDecisions(input);
  assert.match(updated, /^### Conventions$/m);
  assert.equal((updated.match(/^##\s+\S+/gm) ?? []).length, 4);
});
