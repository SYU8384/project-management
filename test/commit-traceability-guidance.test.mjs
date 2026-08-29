import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);

function read(rel) {
  return readFileSync(join(SKILL_DIR, rel), "utf8");
}

test("commit traceability guidance covers authority, scope, and honest fallbacks", () => {
  const skill = read("SKILL.md");
  const reference = read("REFERENCE.md");

  assert.match(skill, /commit_policy/);
  assert.match(skill, /auto-scoped/);
  assert.match(skill, /No commit was requested is never/);
  assert.match(skill, /Never push, merge, deploy/);
  assert.match(skill, /uncommitted \/ commit pending/);
  assert.match(reference, /Implementation commits/);
  assert.match(reference, /GitHub or GitLab remote/);
  assert.match(reference, /Commit PM documentation separately/);
  assert.match(reference, /Authority granted later/);
  assert.match(reference, /User says already committed/);
});

test("commit traceability reference documents each close-out scenario", () => {
  const reference = read("REFERENCE.md");

  for (const scenario of [
    "Auto-scoped or explicit authority",
    "Dirty worktree with unrelated changes",
    "Multiple implementation commits",
    "Non-GitHub/GitLab remote",
    "No commit authority",
    "Authority granted later",
    "User says already committed",
  ]) {
    assert.match(reference, new RegExp(scenario.replace(/[+]/g, "\\+")));
  }
});
