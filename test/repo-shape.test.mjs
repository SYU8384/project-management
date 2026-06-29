import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const DECISIONS_DIR = join(SKILL_DIR, "decisions");

test("skill repo does not ship live PM decision records at root", () => {
  let decisionFiles = [];
  try {
    decisionFiles = readdirSync(DECISIONS_DIR)
      .filter((name) => /^D-\d{3}_.+\.md$/.test(name));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  assert.deepEqual(
    decisionFiles,
    [],
    "Root decisions/D-*.md files are live PM-folder records; keep them in the PM folder, not the skill repo.",
  );
});
