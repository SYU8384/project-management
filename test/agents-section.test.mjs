import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  findPortablePmSection,
  portablePmSectionMatches,
  portablePmSectionTemplate,
  renderPortablePmSection,
  replacePortablePmSection,
} from "../scripts/lib/agents-section.mjs";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const TEMPLATE_DIR = join(SKILL_DIR, "templates");

test("portable section rendering is access-valid and visibility-aware", () => {
  assert.equal(portablePmSectionTemplate("authoritative"), "AGENTS_PM_SECTION.md");
  assert.equal(portablePmSectionTemplate("read-only"), "AGENTS_PM_SECTION.md");
  assert.equal(portablePmSectionTemplate("unavailable"), null);

  const publicSection = renderPortablePmSection(TEMPLATE_DIR, { access: "authoritative", visibility: "public" });
  const privateSection = renderPortablePmSection(TEMPLATE_DIR, { access: "read-only", visibility: "private" });
  assert.match(publicSection, /Repo-canonical docs/);
  assert.doesNotMatch(privateSection, /Repo-canonical docs/);
});

test("portable section discovery handles CRLF and a final section", () => {
  const content = "# Repo\r\n\r\n## PM folder  \r\n\r\nManaged.\r\n";
  const section = findPortablePmSection(content);
  assert.ok(section);
  assert.equal(section.text, "## PM folder  \r\n\r\nManaged.\r\n");
});

test("portable section replacement preserves surrounding user-authored content", () => {
  const content = "# Repo\n\n## PM folder\n\nOld.\n\n## Commands\n\nRun tests.\n";
  const section = findPortablePmSection(content);
  assert.ok(section);
  const replacement = "## PM folder\n\nNew.\n";
  const updated = replacePortablePmSection(content, section, replacement);
  assert.equal(updated, "# Repo\n\n## PM folder\n\nNew.\n\n## Commands\n\nRun tests.\n");
  assert.equal(portablePmSectionMatches(findPortablePmSection(updated), replacement), true);
});

test("portable section discovery returns null when the managed heading is absent", () => {
  assert.equal(findPortablePmSection("# Repo\n\n## Commands\n"), null);
});


test("bootstrap replaces only the portable section on a re-run", () => {
  const vault = mkdtempSync(join(tmpdir(), "pm-agents-bootstrap-"));
  const pmFolder = join(vault, "Projects", "Agent Project");
  const codeRepo = join(vault, "code-repo");
  const config = join(vault, "projects.json");
  mkdirSync(codeRepo, { recursive: true });
  writeFileSync(
    join(codeRepo, "AGENTS.md"),
    "# Repo\n\n## PM folder\n\nStale.\n\n## Commands\n\nRun tests.\n"
  );

  try {
    const result = spawnSync(process.execPath, [
      join(SKILL_DIR, "scripts", "bootstrap-pm.mjs"),
      "--project", "Agent Project",
      "--pm-folder", pmFolder,
      "--code-repo", codeRepo,
      "--phase", "alpha",
      "--notes", "Bootstrap regression fixture.",
      "--config", config,
      "--vault-root", vault,
      "--date", "2026-08-29",
    ], { encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const agents = readFileSync(join(codeRepo, "AGENTS.md"), "utf8");
    assert.match(agents, /## PM folder/);
    assert.match(agents, /## Commands\n\nRun tests\./);
    assert.doesNotMatch(agents, /Stale\./);
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
});
