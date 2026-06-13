import test from "node:test";
import assert from "node:assert/strict";

import {
  countMeaningfulLines,
  isSkippableLine,
  splitByH2Sections,
  stripFrontmatter,
} from "../scripts/lib/markdown.mjs";

const NO_FRONT = `# system

Index for system docs.

<!-- vault-maintain:index:start -->
## Subfolders

*(no items)*

## Notes

- overview
<!-- vault-maintain:index:end -->

## Navigation

- Back to root
`;

test("isSkippableLine recognises blanks, comments, and vault-maintain markers", () => {
  assert.equal(isSkippableLine(""), true);
  assert.equal(isSkippableLine("   "), true);
  assert.equal(isSkippableLine("<!-- a comment -->"), true);
  assert.equal(isSkippableLine("<!-- vault-maintain:index:start -->"), true);
  assert.equal(isSkippableLine("- real list item"), false);
  assert.equal(isSkippableLine("# heading"), false);
});

test("splitByH2Sections groups body lines under the most recent H2", () => {
  const map = splitByH2Sections(NO_FRONT);
  // Implementation reserves a `_preamble` key for lines before the
  // first H2; consumers ignore it via `name === "_preamble"` checks.
  const sectionNames = Object.keys(map).filter((k) => k !== "_preamble");
  assert.deepEqual(sectionNames, ["Subfolders", "Notes", "Navigation"]);
  // Use `countMeaningfulLines` (the validator's contract), not a raw
  // non-blank filter, because the closing `<!-- vault-maintain:index:end -->`
  // marker lands in the last index section but is not "meaningful prose".
  assert.equal(countMeaningfulLines(map["Subfolders"]), 1);
  assert.equal(countMeaningfulLines(map["Notes"]), 1);
  assert.equal(countMeaningfulLines(map["Navigation"]), 1);
});

test("splitByH2Sections does not include the H2 line itself in its section", () => {
  const map = splitByH2Sections("## A\n\nbody\n\n## B\n\nbody2\n");
  assert.equal(map["A"][0], "");
  assert.equal(map["A"][1], "body");
  assert.equal(map["B"][0], "");
  assert.equal(map["B"][1], "body2");
});

test("countMeaningfulLines ignores blank lines, comments, and vault-maintain markers", () => {
  const lines = [
    "- real item",
    "",
    "<!-- comment -->",
    "<!-- vault-maintain:index:start -->",
    "more",
  ];
  assert.equal(countMeaningfulLines(lines), 2);
});

test("stripFrontmatter removes leading YAML frontmatter", () => {
  const doc = "---\ntitle: x\n---\n# body\n";
  assert.equal(stripFrontmatter(doc), "# body\n");
});

// Integration-style: simulate the body-bloat guard's check against a
// stuffed folder note. The shape mirrors what `checkFolderNotes` does
// in check-vault-structure.mjs.
test("body-bloat detection flags a folder note with 60 lines under ## Notes", () => {
  const stuffed = `# system

Test.

<!-- vault-maintain:index:start -->
## Subfolders

*(no items)*

## Notes

${Array.from({ length: 60 }, (_, i) => `- item ${i + 1}`).join("\n")}
<!-- vault-maintain:index:end -->

## Navigation

- Back to root
`;
  const body = stripFrontmatter(stuffed);
  const sections = splitByH2Sections(body);
  const notesLineCount = countMeaningfulLines(sections["Notes"]);
  assert.equal(notesLineCount, 60);
  assert.equal(notesLineCount > 50, true, "60 meaningful lines should exceed the 50-line threshold");
});

test("body-bloat detection does NOT flag a clean folder note with 4 lines under ## Notes", () => {
  const clean = `# system

Test.

<!-- vault-maintain:index:start -->
## Subfolders

*(no items)*

## Notes

- a
- b
- c
- d
<!-- vault-maintain:index:end -->

## Navigation

- Back to root
`;
  const body = stripFrontmatter(clean);
  const sections = splitByH2Sections(body);
  const notesLineCount = countMeaningfulLines(sections["Notes"]);
  assert.equal(notesLineCount, 4);
  assert.equal(notesLineCount > 50, false);
});
