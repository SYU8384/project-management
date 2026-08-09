import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const SCRIPT = join(SKILL_DIR, "scripts", "check-vault-structure.mjs");

function makePmFolder() {
  const tmp = mkdtempSync(join(tmpdir(), "pm-index-test-"));
  mkdirSync(join(tmp, "roadmap", "plans"), { recursive: true });
  return tmp;
}

function writePlansIndex(folder, notesBody) {
  writeFileSync(
    join(folder, "roadmap", "plans", "plans.md"),
    `---\ntitle: plans\n---\n# plans\n\n<!-- vault-maintain:index:start -->\n## Subfolders\n\n*(no items)*\n\n## Notes\n\n${notesBody}\n<!-- vault-maintain:index:end -->\n\n## Navigation\n`
  );
}

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
}

test("missing child note in folder index is reported", () => {
  const pm = makePmFolder();
  try {
    writePlansIndex(pm, "- [[roadmap/plans/alpha|alpha]]");
    writeFileSync(join(pm, "roadmap", "plans", "alpha.md"), "# alpha\n");
    writeFileSync(join(pm, "roadmap", "plans", "beta.md"), "# beta\n");
    const result = run([pm]);
    assert.match(result.stdout, /Folder Index Completeness Violations/);
    assert.match(result.stdout, /add a Notes link to `roadmap\/plans\/beta\.md`/);
    assert.doesNotMatch(result.stdout, /add a Notes link to `roadmap\/plans\/alpha\.md`/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("stale link in folder index is reported", () => {
  const pm = makePmFolder();
  try {
    writePlansIndex(pm, "- [[roadmap/plans/alpha|alpha]]\n- [[roadmap/plans/gone|gone]]");
    writeFileSync(join(pm, "roadmap", "plans", "alpha.md"), "# alpha\n");
    const result = run([pm]);
    assert.match(result.stdout, /remove stale Notes link `\[\[roadmap\/plans\/gone\]\]`/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("--fix appends missing notes, drops stale links, preserves descriptions", () => {
  const pm = makePmFolder();
  try {
    writePlansIndex(pm, "- [[roadmap/plans/alpha|alpha]] - hand-written description\n- [[roadmap/plans/gone|gone]]");
    writeFileSync(join(pm, "roadmap", "plans", "alpha.md"), "# alpha\n");
    writeFileSync(join(pm, "roadmap", "plans", "beta.md"), "# beta\n");
    const result = run([pm, "--fix"]);
    assert.match(result.stdout + result.stderr, /regenerated index block in roadmap\/plans\/plans\.md/);
    const content = readFileSync(join(pm, "roadmap", "plans", "plans.md"), "utf8");
    assert.match(content, /\[\[roadmap\/plans\/alpha\|alpha\]\] - hand-written description/);
    assert.match(content, /\[\[roadmap\/plans\/beta\|beta\]\]/);
    assert.doesNotMatch(content, /roadmap\/plans\/gone/);
    const after = run([pm]);
    assert.doesNotMatch(after.stdout, /Folder Index Completeness Violations/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("index without vault-maintain markers is reported but not auto-fixed", () => {
  const pm = makePmFolder();
  try {
    writeFileSync(
      join(pm, "roadmap", "plans", "plans.md"),
      "# plans\n\n## Notes\n\n*(no items)*\n"
    );
    writeFileSync(join(pm, "roadmap", "plans", "alpha.md"), "# alpha\n");
    const result = run([pm, "--fix"]);
    assert.match(result.stdout, /add a Notes link to `roadmap\/plans\/alpha\.md` \(manual: no index markers\)/);
    const content = readFileSync(join(pm, "roadmap", "plans", "plans.md"), "utf8");
    assert.doesNotMatch(content, /\[\[roadmap\/plans\/alpha/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("*(no items)* placeholder is replaced when --fix adds entries", () => {
  const pm = makePmFolder();
  try {
    writePlansIndex(pm, "*(no items)*");
    writeFileSync(join(pm, "roadmap", "plans", "alpha.md"), "# alpha\n");
    run([pm, "--fix"]);
    const content = readFileSync(join(pm, "roadmap", "plans", "plans.md"), "utf8");
    assert.match(content, /\[\[roadmap\/plans\/alpha\|alpha\]\]/);
    const notesSection = content.match(/## Notes\n([\s\S]*?)<!--/)[1];
    assert.doesNotMatch(notesSection, /\(no items\)/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});
