import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(dirname(SCRIPT_DIR), "scripts", "check-vault-structure.mjs");
const ROADMAP_SCRIPT = join(dirname(SCRIPT_DIR), "scripts", "check-roadmap-conventions.mjs");

test("roadmap/plans/assets Markdown evidence is not treated as an active plan", () => {
  const pm = mkdtempSync(join(tmpdir(), "pm-evidence-plan-"));
  try {
    const evidence = join(pm, "roadmap", "plans", "assets", "case");
    mkdirSync(evidence, { recursive: true });
    writeFileSync(join(pm, "roadmap", "done-pending.md"), "# done-pending\n");
    writeFileSync(join(evidence, "evidence.md"), `---
title: evidence
created: 2026-11-01
updated: 2026-11-01
last_reviewed: 2026-11-01
pageType: planning
status: active
owner: PM
---
## Summary

Imported acceptance evidence, not a plan.
`);

    const result = spawnSync(process.execPath, [ROADMAP_SCRIPT, pm], { encoding: "utf8" });
    assert.doesNotMatch(result.stdout, /D-018 roadmap\/plans\/assets/);
    assert.doesNotMatch(result.stdout, /#assets` mirror section/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("roadmap/plans/assets evidence trees do not require folder-note indexes", () => {
  const pm = mkdtempSync(join(tmpdir(), "pm-evidence-tree-"));
  try {
    const caseDir = join(pm, "roadmap", "plans", "assets", "case");
    mkdirSync(caseDir, { recursive: true });
    writeFileSync(join(caseDir, "report.json"), "{}\n");
    writeFileSync(join(pm, "roadmap", "plans", "assets", "assets.md"), "# assets\n\n## One\n\n## Two\n\n## Three\n\n## Four\n\n## Five\n");

    const result = spawnSync(process.execPath, [SCRIPT, pm], { encoding: "utf8" });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.doesNotMatch(result.stdout, /roadmap\/plans\/assets\/case\/case\.md/);
    assert.doesNotMatch(result.stdout, /roadmap\/plans\/assets\/assets\.md.*sections/);
    assert.doesNotMatch(result.stdout, /roadmap\/plans\/assets\/assets\.md.*Notes/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});
