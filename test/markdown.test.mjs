import test from "node:test";
import assert from "node:assert/strict";

import {
  countH2Sections,
  hasH2,
  parseFrontmatter,
  replaceSectionBody,
  wikiLinks,
} from "../scripts/lib/markdown.mjs";

const doc = `---
title: "Example"
pageType: note
status: active
---
# Example

## Alpha

Body

## Beta

See [[Projects/Example/system/overview|overview]] and [[roadmap/plans/plan#Scope]].
`;

test("frontmatter parser reads scalar fields", () => {
  assert.deepEqual(parseFrontmatter(doc), {
    title: "Example",
    pageType: "note",
    status: "active",
  });
});

test("heading helpers ignore frontmatter", () => {
  assert.equal(countH2Sections(doc), 2);
  assert.equal(hasH2(doc, "Alpha"), true);
  assert.equal(hasH2(doc, "Missing"), false);
});

test("section replacement preserves surrounding document", () => {
  const updated = replaceSectionBody(doc, "Alpha", "New body");
  assert.match(updated, /## Alpha\n\nNew body\n\n## Beta/);
});

test("wiki link extraction returns normalized raw targets", () => {
  assert.deepEqual(wikiLinks(doc), [
    "Projects/Example/system/overview",
    "roadmap/plans/plan",
  ]);
});
