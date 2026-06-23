import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  ensureKnownBugSections,
  moveEntriesToStatusSections,
  syncKnownBugsContents,
  checkKnownBugsShape,
} from "../scripts/lib/known-bugs-fixers.mjs";

const KNOWN_BUGS_SCRIPT = fileURLToPath(new URL("../scripts/check-known-bugs-shape.mjs", import.meta.url));

function fixture() {
  return `---\ntitle: known-bugs\ncreated: 2026-06-01\nupdated: 2026-06-01\nlast_reviewed: 2026-06-01\npageType: note\nstatus: active\n---\n# known-bugs\n\n## Contents\n\n- [[#Active Bugs]]\n- [[#Desktop runtime config failure fell back to hosted API]]\n- [[#Navigation]]\n\n## Recurring Root-Cause Patterns\n\n*(no entries)*\n\n## Active Bugs\n\n### Desktop runtime config failure fell back to hosted API\n**Status:** fixed\n**Symptoms:** Startup used the hosted API fallback.\n**Root cause:** Runtime config load failed before desktop repair surfaces initialized.\n**Solution:** Initialize repair surfaces first.\n**Verification:** Focused desktop tests passed.\n**References:** roadmap/known-issues.md\n\n## Navigation\n\n- [[Home]]\n`;
}

test("known-bugs fixers add missing sections, move fixed entries, and repair Contents", () => {
  let content = fixture();
  content = ensureKnownBugSections(content).updated;
  content = moveEntriesToStatusSections(content).updated;
  content = syncKnownBugsContents(content).updated;

  assert.match(content, /^## Fixed Bugs$/m);
  assert.match(content, /^## Deferred \/ Monitoring$/m);
  assert.match(content, /^## Fixed Bugs[\s\S]*^### Desktop runtime config failure/m);
  assert.doesNotMatch(content.match(/^## Contents[\s\S]*?^## /m)?.[0] ?? "", /Desktop runtime config/);
});

test("check-known-bugs-shape --fix clears section and status-placement issues but reports TBD review", () => {
  const dir = mkdtempSync(join(tmpdir(), "pm-known-bugs-"));
  try {
    mkdirSync(join(dir, "docs/Developer Guide"), { recursive: true });
    writeFileSync(join(dir, "docs/Developer Guide/known-bugs.md"), fixture());

    const fixed = spawnSync(process.execPath, [KNOWN_BUGS_SCRIPT, dir, "--fix"], { encoding: "utf8" });
    assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);
    assert.match(fixed.stdout, /Known-bugs entry shape follows/);

    const updated = readFileSync(join(dir, "docs/Developer Guide/known-bugs.md"), "utf8");
    const report = checkKnownBugsShape(updated);
    assert.deepEqual(report.issues, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
