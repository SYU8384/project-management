import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  repairLiveRoutingDrift,
  findLiveRoutingDrift,
} from "../scripts/lib/live-routing-fixers.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const LIVE_ROUTING_SCRIPT = join(SKILL_DIR, "scripts", "check-live-routing.mjs");

const TARGETS = [
  "roadmap/plans/2026-06-04_lcm-command-surface",
  "decisions/D-011_ADR_email-connector-auth-path",
  "decisions/D-012_POL_human-readable-pm-notes",
];

test("repairLiveRoutingDrift fixes live planning paths, relevant labels, and unique ADR links", () => {
  const input = `# README

See planning/2026-06-04_lcm-command-surface.md and planning/decisions/ADR-011_email-connector-auth-path.

- **Relevant ADRs:** ADR-011
`;
  const result = repairLiveRoutingDrift(input, "README.md", TARGETS);

  assert.match(result.updated, /roadmap\/plans\/2026-06-04_lcm-command-surface\.md/);
  assert.match(result.updated, /decisions\/D-011_ADR_email-connector-auth-path/);
  assert.match(result.updated, /\*\*Relevant decisions:\*\* \[\[decisions\/D-011_ADR_email-connector-auth-path\|ADR-011\]\]/);
  assert.equal(result.manualReview.length, 0);
  assert.equal(findLiveRoutingDrift(result.updated, "README.md").length, 0);
});

test("repairLiveRoutingDrift ignores history and archive records", () => {
  const input = "See planning/2026-06-04_lcm-command-surface and Relevant ADRs: ADR-011\n";
  assert.equal(repairLiveRoutingDrift(input, "history/2026-06/history-2026-06-04.md", TARGETS).updated, input);
  assert.equal(repairLiveRoutingDrift(input, "archive/old-plan-archived.md", TARGETS).updated, input);
  assert.equal(findLiveRoutingDrift(input, "history/2026-06/history-2026-06-04.md").length, 0);
});

test("repairLiveRoutingDrift links unique ADR and D references to root decisions", () => {
  const input = "Relevant decisions include ADR-011 and D-012.\n";
  const result = repairLiveRoutingDrift(input, "features/email-connectors.md", TARGETS);

  assert.match(result.updated, /\[\[decisions\/D-011_ADR_email-connector-auth-path\|ADR-011\]\]/);
  assert.match(result.updated, /\[\[decisions\/D-012_POL_human-readable-pm-notes\|D-012\]\]/);
});

test("repairLiveRoutingDrift does not link decision ids in headings", () => {
  const input = "# D-012 — PM notes optimize for human scanning first\n\nSee D-012 for details.\n";
  const result = repairLiveRoutingDrift(input, "decisions/D-012_POL_human-readable-pm-notes.md", TARGETS);

  assert.match(result.updated, /^# D-012 — PM notes optimize for human scanning first/m);
  assert.match(result.updated, /See \[\[decisions\/D-012_POL_human-readable-pm-notes\|D-012\]\] for details\./);
});

test("repairLiveRoutingDrift reports ambiguous targets without inventing a link", () => {
  const input = "Relevant decisions: ADR-011\n";
  const result = repairLiveRoutingDrift(input, "features/email-connectors.md", [
    "decisions/D-011_ADR_email-connector-auth-path",
    "decisions/D-011_ADR_email-connector-auth-alt",
  ]);

  assert.equal(result.updated, input);
  assert.match(result.manualReview.join("\n"), /matched multiple decision targets/);
});

test("repairLiveRoutingDrift reports missing targets without inventing prose or decisions", () => {
  const input = "Relevant decisions: ADR-099\n";
  const result = repairLiveRoutingDrift(input, "features/email-connectors.md", TARGETS);

  assert.equal(result.updated, input);
  assert.match(result.manualReview.join("\n"), /has no matching decision target/);
  assert.equal(result.updated.includes("decisions/D-099"), false);
});

test("check-live-routing --fix repairs live files and ignores history fixture", () => {
  const pm = mkdtempSync(join(tmpdir(), "pm-live-routing-"));
  try {
    mkdirSync(join(pm, "roadmap", "plans"), { recursive: true });
    mkdirSync(join(pm, "decisions"), { recursive: true });
    mkdirSync(join(pm, "history", "2026-06"), { recursive: true });
    writeFileSync(join(pm, "roadmap", "plans", "2026-06-04_lcm-command-surface.md"), "# lcm-command-surface\n");
    writeFileSync(join(pm, "decisions", "D-011_ADR_email-connector-auth-path.md"), "# D-011\n");
    writeFileSync(join(pm, "README.md"), `# PM

See planning/2026-06-04_lcm-command-surface and planning/decisions/ADR-011_email-connector-auth-path.

- Relevant ADRs: ADR-011
`);
    writeFileSync(join(pm, "history", "2026-06", "history-2026-06-04.md"), "See planning/2026-06-04_lcm-command-surface\n");

    const before = spawnSync(process.execPath, [LIVE_ROUTING_SCRIPT, pm], { encoding: "utf8" });
    assert.equal(before.status, 1, before.stdout + before.stderr);
    assert.match(before.stdout, /README\.md/);
    assert.equal(before.stdout.includes("history-2026-06-04.md"), false);

    const fixed = spawnSync(process.execPath, [LIVE_ROUTING_SCRIPT, pm, "--fix"], { encoding: "utf8" });
    assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);

    const readme = readFileSync(join(pm, "README.md"), "utf8");
    assert.match(readme, /roadmap\/plans\/2026-06-04_lcm-command-surface/);
    assert.match(readme, /decisions\/D-011_ADR_email-connector-auth-path/);
    assert.match(readme, /Relevant decisions: \[\[decisions\/D-011_ADR_email-connector-auth-path\|ADR-011\]\]/);

    const history = readFileSync(join(pm, "history", "2026-06", "history-2026-06-04.md"), "utf8");
    assert.match(history, /planning\/2026-06-04_lcm-command-surface/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});
