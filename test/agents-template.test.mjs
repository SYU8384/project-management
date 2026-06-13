import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const TEMPLATE = join(SKILL_DIR, "templates", "AGENTS_PM_SECTION.md");

test("portable AGENTS PM section exists and has no local path placeholders", () => {
  assert.equal(existsSync(TEMPLATE), true);
  const content = readFileSync(TEMPLATE, "utf8");
  assert.equal(content.includes("<pm_folder>"), false);
  assert.equal(content.includes("<skill_dir>"), false);
  assert.equal(content.includes("/home/"), false);
  assert.equal(content.includes("/mnt/"), false);
  assert.equal(content.includes("C:\\"), false);
});

test("portable AGENTS PM section documents all resolved access outcomes", () => {
  const content = readFileSync(TEMPLATE, "utf8");
  assert.match(content, /authoritative/);
  assert.match(content, /read-only/);
  assert.match(content, /No PM access/);
  assert.match(content, /projects\.json/);
});
