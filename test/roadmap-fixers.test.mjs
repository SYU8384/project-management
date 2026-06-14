import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  syncDonePendingContents,
  linkDonePendingPlanningNotes,
  normalizeDonePendingRelevantLinks,
  ensureIdeaDetailSummaries,
} from "../scripts/lib/roadmap-fixers.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const ROADMAP_SCRIPT = join(SKILL_DIR, "scripts", "check-roadmap-conventions.mjs");

test("syncDonePendingContents regenerates TOC links from actual H2 headings", () => {
  const input = `# done-pending

## Contents

- [[#2026-06-14_inbox-card-cleanup-and-realtime]]
- [[#General Done/Pending Without Dedicated Planning Note]]

This file explains how planning mirrors and general done/pending items coexist.

## inbox-card-cleanup-and-realtime

Planning note: 2026-06-14_inbox-card-cleanup-and-realtime

## General Done/Pending Without Dedicated Planning Note

## Navigation
`;

  const result = syncDonePendingContents(input);
  assert.equal(result.changes.length, 1);
  assert.match(result.updated, /- \[\[#inbox-card-cleanup-and-realtime\]\]/);
  assert.equal(result.updated.includes("[[#2026-06-14_inbox-card-cleanup-and-realtime]]"), false);
  assert.match(result.updated, /This file explains how planning mirrors and general done\/pending items coexist\./);
  assert.match(result.updated, /- \[\[#Navigation\]\]/);
});

test("linkDonePendingPlanningNotes links plain plan stems when the target exists", () => {
  const input = `## inbox-card-cleanup-and-realtime

Planning note: 2026-06-14_inbox-card-cleanup-and-realtime
`;
  const result = linkDonePendingPlanningNotes(input, [
    "roadmap/plans/2026-06-14_inbox-card-cleanup-and-realtime",
  ]);
  assert.equal(result.manualReview.length, 0);
  assert.match(
    result.updated,
    /Planning note: \[\[roadmap\/plans\/2026-06-14_inbox-card-cleanup-and-realtime\|2026-06-14_inbox-card-cleanup-and-realtime\]\]/
  );
});

test("normalizeDonePendingRelevantLinks links unique relevant targets and normalizes labels", () => {
  const input = `- **Relevant ADRs:** ADR-001
- **Relevant feature:** agent-runtime
- Relevant system: openclaw-qmd-runtime
- Relevant docs: inbox
`;
  const result = normalizeDonePendingRelevantLinks(input, [
    "decisions/D-001_ADR_agent-runtime-policy",
    "features/agent-runtime",
    "system/openclaw-qmd-runtime",
    "docs/User Guide/inbox",
  ]);

  assert.equal(result.manualReview.length, 0);
  assert.match(result.updated, /Relevant decisions: \[\[decisions\/D-001_ADR_agent-runtime-policy\|ADR-001\]\]/);
  assert.match(result.updated, /Relevant features: \[\[features\/agent-runtime\|agent-runtime\]\]/);
  assert.match(result.updated, /Relevant system: \[\[system\/openclaw-qmd-runtime\|openclaw-qmd-runtime\]\]/);
  assert.match(result.updated, /Relevant docs: \[\[docs\/User Guide\/inbox\|inbox\]\]/);
});

test("normalizeDonePendingRelevantLinks reports ambiguous targets without inventing a link", () => {
  const input = "- Relevant features: email\n";
  const result = normalizeDonePendingRelevantLinks(input, [
    "features/email",
    "features/email-connectors",
  ]);

  assert.equal(result.updated, input);
  assert.equal(result.changes.length, 0);
  assert.match(result.manualReview.join("\n"), /matched multiple features targets/);
});

test("ensureIdeaDetailSummaries inserts TBD Summary without inventing prose", () => {
  const input = `# ideas

## Idea Details

### IDEA-001 - Human-readable history

- **Status:** Brainstorming
- **Why valuable:** Humans need the idea context.
`;
  const result = ensureIdeaDetailSummaries(input);
  assert.match(result.updated, /### IDEA-001 - Human-readable history\n\n- \*\*Summary:\*\* TBD\n- \*\*Status:\*\*/);
  assert.equal(result.updated.includes("This idea"), false);
  assert.match(result.manualReview.join("\n"), /TBD Summary/);

  const again = ensureIdeaDetailSummaries(result.updated);
  assert.equal(again.changes.length, 0);
});

test("check-roadmap-conventions --fix normalizes OpenManager-style done-pending drift", () => {
  const pm = mkdtempSync(join(tmpdir(), "pm-roadmap-fix-"));
  try {
    mkdirSync(join(pm, "roadmap", "plans"), { recursive: true });
    mkdirSync(join(pm, "decisions"), { recursive: true });
    mkdirSync(join(pm, "features"), { recursive: true });
    writeFileSync(join(pm, "roadmap", "plans", "2026-06-14_inbox-card-cleanup-and-realtime.md"), "# plan\n");
    writeFileSync(join(pm, "decisions", "D-001_ADR_inbox-policy.md"), "# decision\n");
    writeFileSync(join(pm, "features", "inbox.md"), "# inbox\n");
    writeFileSync(join(pm, "roadmap", "done-pending.md"), `# done-pending

## Contents

- [[#2026-06-14_inbox-card-cleanup-and-realtime]]
- [[#General Done/Pending Without Dedicated Planning Note]]

## inbox-card-cleanup-and-realtime

Planning note: 2026-06-14_inbox-card-cleanup-and-realtime

- Relevant ADRs: ADR-001
- Relevant feature: inbox

## General Done/Pending Without Dedicated Planning Note

## Navigation
`);
    writeFileSync(join(pm, "roadmap", "ideas.md"), `# ideas

**Status colors:** 🟣 Brainstorming · 🟡 Scoping · 🔵 Approved · 🟢 Implemented · 🔴 Declined. The colors appear in the Status Key, the Idea Register, and the Idea Details sections.

## Contents

- [[#Status Key]]
- [[#Idea Register]]
- [[#Brainstorming]]
- [[#Scoping]]
- [[#Approved]]
- [[#Implemented]]
- [[#Declined]]
- [[#Idea Details]]
- [[#Navigation]]

## Status Key

| Status | Meaning |
|---|---|
| 🟣 Brainstorming | Rough idea, needs validation |
| 🟡 Scoping | Worth exploring, decisions being made |
| 🔵 Approved | Scoped, ready for implementation |
| 🟢 Implemented | Built and shipped |
| 🔴 Declined | Rejected or intentionally not pursued |

## Idea Register

| ID | Idea | Date | Status | Owner / next step | Differentiation |
|---|---|---|---|---|---|
| IDEA-001 | Better PM notes | 2026-06-14 | 🟣 Brainstorming | Write summary | Human-readable |

## Brainstorming

- [[#IDEA-001 - Better PM notes|IDEA-001 - Better PM notes]]

## Scoping

*(no items)*

## Approved

*(no items)*

## Implemented

*(no items)*

## Declined

*(no items)*

## Idea Details

### IDEA-001 - Better PM notes

- **Status:** 🟣 Brainstorming
- **Date:** 2026-06-14
- **Owner / next step:** Write summary.
- **Differentiation:** Human-readable.
- **Why valuable:** Better scanning.
- **Open questions:** None.
- **References:** None yet.

## Navigation
`);

    const before = spawnSync(process.execPath, [ROADMAP_SCRIPT, pm], { encoding: "utf8" });
    assert.equal(before.status, 1, before.stdout + before.stderr);
    assert.match(before.stdout, /D-012/);

    const fixed = spawnSync(process.execPath, [ROADMAP_SCRIPT, pm, "--fix"], { encoding: "utf8" });
    assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);

    const after = readFileSync(join(pm, "roadmap", "done-pending.md"), "utf8");
    assert.match(after, /- \[\[#inbox-card-cleanup-and-realtime\]\]/);
    assert.equal(after.includes("[[#2026-06-14_inbox-card-cleanup-and-realtime]]"), false);
    assert.match(after, /Planning note: \[\[roadmap\/plans\/2026-06-14_inbox-card-cleanup-and-realtime\|2026-06-14_inbox-card-cleanup-and-realtime\]\]/);
    assert.match(after, /Relevant decisions: \[\[decisions\/D-001_ADR_inbox-policy\|ADR-001\]\]/);
    assert.match(after, /Relevant features: \[\[features\/inbox\|inbox\]\]/);

    const ideasAfter = readFileSync(join(pm, "roadmap", "ideas.md"), "utf8");
    assert.match(ideasAfter, /- \*\*Summary:\*\* TBD/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});
