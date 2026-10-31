import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(dirname(SCRIPT_DIR), "scripts", "check-stale-docs.mjs");

function daysAgo(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function note({ pageType = "note", status = "active", days = 100 } = {}) {
  return `---\ntitle: fixture\ncreated: 2020-01-01\nupdated: 2020-01-01\nlast_reviewed: ${daysAgo(days)}\npageType: ${pageType}\nstatus: ${status}\nowner: PM\n---\n# fixture\n`;
}

test("stale review excludes historical, terminal, and evidence records and uses live-lane thresholds", () => {
  const pm = mkdtempSync(join(tmpdir(), "pm-stale-lanes-"));
  try {
    const files = {
      "history/2020/January/history-2020-01-01.md": note({ pageType: "history", days: 400 }),
      "archive/old-archived.md": note({ pageType: "planning", status: "shipped", days: 400 }),
      "roadmap/plans/old.md": note({ pageType: "planning", status: "shipped", days: 400 }),
      "roadmap/plans/assets/case/evidence.md": note({ days: 400 }),
      "decisions/old.md": note({ pageType: "decision", status: "superseded", days: 400 }),
      "roadmap/ideas.md": note({ pageType: "roadmap", days: 45 }),
      "docs/User Guide/45-days.md": note({ days: 45 }),
      "docs/User Guide/75-days.md": note({ days: 75 }),
      "decisions/75-days.md": note({ pageType: "decision", status: "accepted", days: 75 }),
      "decisions/100-days.md": note({ pageType: "decision", status: "accepted", days: 100 }),
    };
    for (const [rel, content] of Object.entries(files)) {
      const abs = join(pm, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content);
    }

    const result = spawnSync(process.execPath, [SCRIPT, pm], { encoding: "utf8" });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /roadmap\/ideas\.md/);
    assert.match(result.stdout, /docs\/User Guide\/75-days\.md/);
    assert.match(result.stdout, /decisions\/100-days\.md/);
    for (const kept of [
      "docs/User Guide/45-days.md",
      "decisions/75-days.md",
      "history/2020/January/history-2020-01-01.md",
      "archive/old-archived.md",
      "roadmap/plans/old.md",
      "roadmap/plans/assets/case/evidence.md",
      "decisions/old.md",
    ]) {
      assert.doesNotMatch(result.stdout, new RegExp(kept.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), kept);
    }
    assert.match(result.stdout, /Historical history\/, archive\/, terminal plans\/decisions, and roadmap\/plans\/assets\/ evidence are excluded/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});
