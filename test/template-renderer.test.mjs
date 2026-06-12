import test from "node:test";
import assert from "node:assert/strict";

import { renderTemplate, unresolvedPlaceholders } from "../scripts/lib/template-renderer.mjs";

test("template renderer replaces all provided placeholders", () => {
  assert.equal(renderTemplate("A <one> B <two>", { "<one>": "1", "<two>": "2" }), "A 1 B 2");
});

test("unresolved placeholder detector deduplicates placeholders", () => {
  assert.deepEqual(unresolvedPlaceholders("<one> <two> <one>"), ["<one>", "<two>"]);
});
