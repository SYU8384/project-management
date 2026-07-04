import test from "node:test";
import assert from "node:assert/strict";

import {
  countH2Sections,
  hasH2,
  parseFrontmatter,
  replaceSectionBody,
  stripFrontmatter,
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

test("frontmatter parser reads CRLF scalar fields", () => {
  const crlfDoc = doc.replace(/\n/g, "\r\n");
  assert.deepEqual(parseFrontmatter(crlfDoc), {
    title: "Example",
    pageType: "note",
    status: "active",
  });
});

test("frontmatter parser reads files with a leading BOM", () => {
  assert.deepEqual(parseFrontmatter(`\ufeff${doc}`), {
    title: "Example",
    pageType: "note",
    status: "active",
  });
});

test("stripFrontmatter removes CRLF frontmatter", () => {
  const crlfDoc = doc.replace(/\n/g, "\r\n");
  assert.equal(stripFrontmatter(crlfDoc).startsWith("# Example"), true);
});

test("stripFrontmatter removes a leading BOM with frontmatter", () => {
  assert.equal(stripFrontmatter(`\ufeff${doc}`).startsWith("# Example"), true);
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
