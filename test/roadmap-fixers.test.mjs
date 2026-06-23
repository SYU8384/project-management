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
  findArchiveReadyDonePendingSections,
  findPlanningMirrorsMissingHumanArchiveConfirmation,
  ensureHumanArchiveConfirmation,
  HUMAN_ARCHIVE_CONFIRMATION_LINE,
  HUMAN_ARCHIVE_CONFIRMATION_TEXT,
  planArchiveReadyDonePendingSections,
  ensurePlanRelatedLinks,
  planMirrorHeadingFromRel,
} from "../scripts/lib/roadmap-fixers.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const ROADMAP_SCRIPT = join(SKILL_DIR, "scripts", "check-roadmap-conventions.mjs");
const MIGRATE_SCRIPT = join(SKILL_DIR, "scripts", "migrate.mjs");

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

test("planMirrorHeadingFromRel derives slug-only done-pending headings", () => {
  assert.equal(
    planMirrorHeadingFromRel("roadmap/plans/2026-06-23_inbox-intake-lane"),
    "inbox-intake-lane"
  );
  assert.equal(
    planMirrorHeadingFromRel("roadmap/plans/2026-06-23_email_connector_architecture"),
    "email-connector-architecture"
  );
});

test("ensurePlanRelatedLinks adds done-pending mirror and relevant links", () => {
  const plan = `---
title: plan
created: 2026-06-23
updated: 2026-06-23
last_reviewed: 2026-06-23
pageType: planning
status: active
owner: PM
---
# traceability-plan

## Goal

Ship the traceability rule.

## Navigation
`;
  const donePending = `# done-pending

## traceability-plan

Planning note: [[Projects/Example/roadmap/plans/2026-06-23_traceability-plan|2026-06-23_traceability-plan]]

- [ ] PENDING: Implement.

Relevant decisions: [[Projects/Example/decisions/D-018_POL_bidirectional-plan-traceability|D-018]]
Relevant features: [[Projects/Example/features/validation-and-repair|validation-and-repair]]
Relevant system: [[Projects/Example/system/overview|overview]]

## Navigation
`;
  const result = ensurePlanRelatedLinks(plan, {
    planRel: "roadmap/plans/2026-06-23_traceability-plan",
    donePendingContent: donePending,
    linkOptions: { linkRoot: "Projects/Example" },
  });

  assert.equal(result.manualReview.length, 0);
  assert.match(result.updated, /## Related\n\nDone-pending mirror: \[\[Projects\/Example\/roadmap\/done-pending#traceability-plan\|done-pending#traceability-plan\]\]/);
  assert.match(result.updated, /Relevant decisions: \[\[Projects\/Example\/decisions\/D-018_POL_bidirectional-plan-traceability\|D-018\]\]/);
  assert.match(result.updated, /Relevant features: \[\[Projects\/Example\/features\/validation-and-repair\|validation-and-repair\]\]/);
  assert.match(result.updated, /Relevant system: \[\[Projects\/Example\/system\/overview\|overview\]\]/);
  assert.match(result.updated, /## Related[\s\S]+## Navigation/);

  const again = ensurePlanRelatedLinks(result.updated, {
    planRel: "roadmap/plans/2026-06-23_traceability-plan",
    donePendingContent: donePending,
    linkOptions: { linkRoot: "Projects/Example" },
  });
  assert.equal(again.changes.length, 0);
  assert.equal(again.updated, result.updated);
});

test("ensurePlanRelatedLinks preserves existing related prose and appends missing links", () => {
  const plan = `# traceability-plan

## Related

Context note stays here.
Relevant decisions: [[Projects/Example/decisions/D-001_ADR_existing|D-001]]

## Navigation
`;
  const donePending = `# done-pending

## traceability-plan

Planning note: [[Projects/Example/roadmap/plans/2026-06-23_traceability-plan|2026-06-23_traceability-plan]]

Relevant decisions: [[Projects/Example/decisions/D-018_POL_bidirectional-plan-traceability|D-018]]
Relevant docs: [[Projects/Example/docs/Developer Guide/traceability|traceability]]

## Navigation
`;
  const result = ensurePlanRelatedLinks(plan, {
    planRel: "roadmap/plans/2026-06-23_traceability-plan",
    donePendingContent: donePending,
    linkOptions: { linkRoot: "Projects/Example" },
  });

  assert.match(result.updated, /Context note stays here\./);
  assert.match(result.updated, /D-001.*D-018/);
  assert.match(result.updated, /Relevant docs: \[\[Projects\/Example\/docs\/Developer Guide\/traceability\|traceability\]\]/);
});

test("ensurePlanRelatedLinks reports missing done-pending mirror without inventing content", () => {
  const plan = "# missing-mirror\n\n## Navigation\n";
  const donePending = "# done-pending\n\n## other-plan\n";
  const result = ensurePlanRelatedLinks(plan, {
    planRel: "roadmap/plans/2026-06-23_missing-mirror",
    donePendingContent: donePending,
  });
  assert.equal(result.updated, plan);
  assert.match(result.manualReview.join("\n"), /missing matching `roadmap\/done-pending.md#missing-mirror`/);
});

test("findArchiveReadyDonePendingSections only flags completed planning mirrors", () => {
  const input = `# done-pending

## completed-plan

Planning note: [[Projects/Example/roadmap/plans/2026-06-01_completed-plan|2026-06-01_completed-plan]]

- [x] DONE: First item.
- [X] DONE: Second item.
- [x] DONE: ${HUMAN_ARCHIVE_CONFIRMATION_TEXT}

## still-active-plan

Planning note: [[Projects/Example/roadmap/plans/2026-06-01_still-active-plan|2026-06-01_still-active-plan]]

- [x] DONE: First item.
- [ ] PENDING: Remaining item.
- [ ] PENDING: ${HUMAN_ARCHIVE_CONFIRMATION_TEXT}

## General Done/Pending Without Dedicated Planning Note

- [x] DONE: General item stays active until a human decides otherwise.

## Navigation
`;

  assert.deepEqual(findArchiveReadyDonePendingSections(input), ["completed-plan"]);
});

test("ensureHumanArchiveConfirmation inserts a pending confirmation once", () => {
  const input = `# done-pending

## needs-confirmation

Planning note: [[roadmap/plans/2026-06-01_needs-confirmation|2026-06-01_needs-confirmation]]

- [x] DONE: First item.

- Relevant decisions: *(none)*

## already-confirmed

Planning note: [[roadmap/plans/2026-06-01_already-confirmed|2026-06-01_already-confirmed]]

- [x] DONE: First item.
- [x] DONE: ${HUMAN_ARCHIVE_CONFIRMATION_TEXT}

## General Done/Pending Without Dedicated Planning Note

- [x] DONE: General item should not get archive confirmation.

## Navigation
`;

  const result = ensureHumanArchiveConfirmation(input);
  assert.deepEqual(result.changes, [
    "planning mirror `## needs-confirmation` missing human archive confirmation checkbox",
  ]);
  assert.match(result.updated, new RegExp(`- \\[x\\] DONE: First item\\.\\n${escapeRegExp(HUMAN_ARCHIVE_CONFIRMATION_LINE)}\\n\\n- Relevant decisions`));
  assert.equal((result.updated.match(new RegExp(escapeRegExp(HUMAN_ARCHIVE_CONFIRMATION_TEXT), "g")) ?? []).length, 2);
  assert.deepEqual(findPlanningMirrorsMissingHumanArchiveConfirmation(result.updated), []);

  const again = ensureHumanArchiveConfirmation(result.updated);
  assert.equal(again.changes.length, 0);
});

test("planArchiveReadyDonePendingSections resolves only deterministic archive candidates", () => {
  const input = `# done-pending

## completed-plan

Planning note: [[Projects/Example/roadmap/plans/2026-06-01_completed-plan|2026-06-01_completed-plan]]

- [x] DONE: First item.
- [x] DONE: ${HUMAN_ARCHIVE_CONFIRMATION_TEXT}

## still-active-plan

Planning note: [[roadmap/plans/2026-06-01_still-active-plan|2026-06-01_still-active-plan]]

- [x] DONE: First item.
- [ ] PENDING: Remaining item.
- [ ] PENDING: ${HUMAN_ARCHIVE_CONFIRMATION_TEXT}

## no-planning-note

- [x] DONE: General item stays active.

## missing-plan

Planning note: [[roadmap/plans/2026-06-01_missing-plan|2026-06-01_missing-plan]]

- [x] DONE: Missing target.
- [x] DONE: ${HUMAN_ARCHIVE_CONFIRMATION_TEXT}

## ambiguous-plan

Planning note: [[duplicate-plan]]

- [x] DONE: Ambiguous short target.
- [x] DONE: ${HUMAN_ARCHIVE_CONFIRMATION_TEXT}

## collision-plan

Planning note: [[roadmap/plans/2026-06-01_collision-plan|2026-06-01_collision-plan]]

- [x] DONE: Archive target already exists.
- [x] DONE: ${HUMAN_ARCHIVE_CONFIRMATION_TEXT}

## Navigation
`;

  const result = planArchiveReadyDonePendingSections(input, [
    "roadmap/plans/2026-06-01_completed-plan",
    "roadmap/plans/2026-06-01_still-active-plan",
    "roadmap/plans/duplicate-plan",
    "roadmap/plans/nested/duplicate-plan",
    "roadmap/plans/2026-06-01_collision-plan",
    "archive/collision-plan-archived",
  ]);

  assert.deepEqual(result.archives.map((item) => [item.heading, item.planRel, item.archiveRel]), [
    ["completed-plan", "roadmap/plans/2026-06-01_completed-plan", "archive/completed-plan-archived"],
  ]);
  assert.match(result.manualReview.join("\n"), /missing-plan.*no existing roadmap\/plans target/);
  assert.match(result.manualReview.join("\n"), /ambiguous-plan.*ambiguous/);
  assert.match(result.manualReview.join("\n"), /collision-plan.*archive target already exists/);
});

function writeIndex(file, title, link = null) {
  writeFileSync(file, `---
title: "${title}"
created: 2026-06-01
updated: 2026-06-01
last_reviewed: 2026-06-01
pageType: index
status: active
owner: PM
---
# ${title}

<!-- vault-maintain:index:start -->
## Subfolders

*(no items)*

## Notes

${link ? `- ${link}` : "*(no items)*"}
<!-- vault-maintain:index:end -->

## Navigation
`);
}

test("check-roadmap-conventions --fix adds human confirmation and does not archive yet", () => {
  const pm = mkdtempSync(join(tmpdir(), "pm-confirmation-gate-"));
  try {
    mkdirSync(join(pm, "roadmap", "plans"), { recursive: true });
    writeFileSync(join(pm, "roadmap", "plans", "2026-06-01_completed-plan.md"), `---
title: completed-plan
created: 2026-06-01
updated: 2026-06-01
last_reviewed: 2026-06-01
pageType: planning
status: active
owner: PM
---
# completed-plan
`);
    writeFileSync(join(pm, "roadmap", "done-pending.md"), `# done-pending

## completed-plan

Planning note: [[roadmap/plans/2026-06-01_completed-plan|2026-06-01_completed-plan]]

- [x] DONE: Implementation finished.

## Navigation
`);

    const normal = spawnSync(process.execPath, [ROADMAP_SCRIPT, pm], { encoding: "utf8" });
    assert.equal(normal.status, 1, normal.stdout + normal.stderr);
    assert.match(normal.stdout, /missing human archive confirmation checkbox/);
    assert.doesNotMatch(normal.stdout, /should be archived/);

    const fixed = spawnSync(process.execPath, [ROADMAP_SCRIPT, pm, "--fix"], { encoding: "utf8" });
    assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);

    const donePending = readFileSync(join(pm, "roadmap", "done-pending.md"), "utf8");
    assert.match(donePending, new RegExp(escapeRegExp(HUMAN_ARCHIVE_CONFIRMATION_LINE)));
    assert.match(donePending, /## completed-plan/);
    assert.equal(readFileSync(join(pm, "roadmap", "plans", "2026-06-01_completed-plan.md"), "utf8").includes("# completed-plan"), true);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("check-roadmap-conventions --fix adds plan related traceability", () => {
  const pm = mkdtempSync(join(tmpdir(), "pm-plan-traceability-"));
  try {
    mkdirSync(join(pm, "roadmap", "plans"), { recursive: true });
    writeFileSync(join(pm, "roadmap", "plans", "2026-06-23_traceability-plan.md"), `---
title: traceability-plan
created: 2026-06-23
updated: 2026-06-23
last_reviewed: 2026-06-23
pageType: planning
status: active
owner: PM
---
# traceability-plan

## Goal

Ship traceability.

## Navigation
`);
    writeFileSync(join(pm, "roadmap", "done-pending.md"), `# done-pending

## traceability-plan

Planning note: [[roadmap/plans/2026-06-23_traceability-plan|2026-06-23_traceability-plan]]

- [ ] PENDING: Implement.
- [ ] PENDING: ${HUMAN_ARCHIVE_CONFIRMATION_TEXT}

Relevant decisions: [[decisions/D-018_POL_bidirectional-plan-traceability|D-018]]

## Navigation
`);

    const before = spawnSync(process.execPath, [ROADMAP_SCRIPT, pm], { encoding: "utf8" });
    assert.equal(before.status, 1, before.stdout + before.stderr);
    assert.match(before.stdout, /D-018/);

    const fixed = spawnSync(process.execPath, [ROADMAP_SCRIPT, pm, "--fix"], { encoding: "utf8" });
    assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);

    const plan = readFileSync(join(pm, "roadmap", "plans", "2026-06-23_traceability-plan.md"), "utf8");
    assert.match(plan, /## Related/);
    assert.match(plan, /Done-pending mirror: \[\[roadmap\/done-pending#traceability-plan\|done-pending#traceability-plan\]\]/);
    assert.match(plan, /Relevant decisions: \[\[decisions\/D-018_POL_bidirectional-plan-traceability\|D-018\]\]/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("check-roadmap-conventions ignores shipped planning notes for traceability", () => {
  const pm = mkdtempSync(join(tmpdir(), "pm-plan-traceability-shipped-"));
  try {
    mkdirSync(join(pm, "roadmap", "plans"), { recursive: true });
    writeFileSync(join(pm, "roadmap", "plans", "2026-06-23_shipped-plan.md"), `---
title: shipped-plan
created: 2026-06-23
updated: 2026-06-23
last_reviewed: 2026-06-23
pageType: planning
status: shipped
owner: PM
---
# shipped-plan
`);
    writeFileSync(join(pm, "roadmap", "done-pending.md"), `# done-pending

<!-- vault-maintain:toc:start -->
## Contents

- [[#Navigation]]
<!-- vault-maintain:toc:end -->

## Navigation
`);

    const result = spawnSync(process.execPath, [ROADMAP_SCRIPT, pm], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.doesNotMatch(result.stdout, /missing matching `roadmap\/done-pending/);
    assert.doesNotMatch(result.stdout, /with done-pending mirror traceability/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("check-roadmap-conventions reports active planning notes with missing mirrors", () => {
  const pm = mkdtempSync(join(tmpdir(), "pm-plan-traceability-missing-"));
  try {
    mkdirSync(join(pm, "roadmap", "plans"), { recursive: true });
    writeFileSync(join(pm, "roadmap", "plans", "2026-06-23_missing-mirror.md"), `---
title: missing-mirror
created: 2026-06-23
updated: 2026-06-23
last_reviewed: 2026-06-23
pageType: planning
status: proposed
owner: PM
---
# missing-mirror
`);
    writeFileSync(join(pm, "roadmap", "done-pending.md"), `# done-pending

## Navigation
`);

    const result = spawnSync(process.execPath, [ROADMAP_SCRIPT, pm, "--fix"], { encoding: "utf8" });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /missing matching `roadmap\/done-pending.md#missing-mirror`/);
    const plan = readFileSync(join(pm, "roadmap", "plans", "2026-06-23_missing-mirror.md"), "utf8");
    assert.doesNotMatch(plan, /## Related/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("1.15.0 migration repairs active plan related links without rewriting body", () => {
  const vault = mkdtempSync(join(tmpdir(), "pm-plan-traceability-vault-"));
  const pm = join(vault, "Projects", "Example");
  try {
    mkdirSync(join(vault, ".obsidian"), { recursive: true });
    mkdirSync(join(pm, "roadmap", "plans"), { recursive: true });
    writeFileSync(join(pm, "roadmap", "plans", "2026-06-23_traceability-plan.md"), `---
title: traceability-plan
created: 2026-06-23
updated: 2026-06-23
last_reviewed: 2026-06-23
pageType: planning
status: active
owner: PM
---
# traceability-plan

## Goal

Original body stays here.

## Navigation
`);
    writeFileSync(join(pm, "roadmap", "done-pending.md"), `# done-pending

## traceability-plan

Planning note: [[Projects/Example/roadmap/plans/2026-06-23_traceability-plan|2026-06-23_traceability-plan]]

- [ ] PENDING: Implement.
- [ ] PENDING: ${HUMAN_ARCHIVE_CONFIRMATION_TEXT}

Relevant decisions: [[Projects/Example/decisions/D-018_POL_bidirectional-plan-traceability|D-018]]
Relevant docs: [[Projects/Example/docs/Developer Guide/traceability|traceability]]

## Navigation
`);
    const config = join(vault, "projects.json");
    writeFileSync(config, JSON.stringify({
      vault_root: vault,
      skill_dir: SKILL_DIR,
      projects: {
        Example: {
          code_repo: null,
          pm_folder: pm,
          phase: "beta",
          notes: "test",
          access: "authoritative",
        },
      },
    }, null, 2));

    const result = spawnSync(process.execPath, [
      MIGRATE_SCRIPT,
      "--pm-folder",
      pm,
      "--config",
      config,
      "--migration",
      "1.15.0-plan-related-links",
      "--yes",
    ], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stdout + result.stderr);

    const plan = readFileSync(join(pm, "roadmap", "plans", "2026-06-23_traceability-plan.md"), "utf8");
    assert.match(plan, /Original body stays here\./);
    assert.match(plan, /Done-pending mirror: \[\[Projects\/Example\/roadmap\/done-pending#traceability-plan\|done-pending#traceability-plan\]\]/);
    assert.match(plan, /Relevant decisions: \[\[Projects\/Example\/decisions\/D-018_POL_bidirectional-plan-traceability\|D-018\]\]/);
    assert.match(plan, /Relevant docs: \[\[Projects\/Example\/docs\/Developer Guide\/traceability\|traceability\]\]/);

    const second = spawnSync(process.execPath, [
      MIGRATE_SCRIPT,
      "--pm-folder",
      pm,
      "--config",
      config,
      "--migration",
      "1.15.0-plan-related-links",
      "--yes",
    ], { encoding: "utf8" });
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.match(second.stdout, /No applicable migrations/);
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
});

test("check-roadmap-conventions --fix archives deterministic completed planning mirrors", () => {
  const pm = mkdtempSync(join(tmpdir(), "pm-archive-ready-"));
  try {
    mkdirSync(join(pm, "roadmap", "plans"), { recursive: true });
    mkdirSync(join(pm, "archive"), { recursive: true });
    mkdirSync(join(pm, "history", "2026-06"), { recursive: true });
    mkdirSync(join(pm, "features"), { recursive: true });
    writeIndex(
      join(pm, "roadmap", "plans", "plans.md"),
      "plans",
      "[[roadmap/plans/2026-06-01_completed-plan|2026-06-01_completed-plan]]"
    );
    writeIndex(join(pm, "archive", "archive.md"), "archive");
    writeIndex(join(pm, "history", "2026-06", "2026-06.md"), "2026-06");
    writeFileSync(join(pm, "features", "feature.md"), "See [[roadmap/plans/2026-06-01_completed-plan|the plan]].\n");
    writeFileSync(join(pm, "roadmap", "plans", "2026-06-01_completed-plan.md"), `---
title: completed-plan
created: 2026-06-01
updated: 2026-06-01
last_reviewed: 2026-06-01
pageType: planning
status: active
owner: PM
---
# completed-plan

## Summary

Ship the thing.

## Navigation

- [[roadmap/plans/plans|Back to plans]]
`);
    writeFileSync(join(pm, "roadmap", "done-pending.md"), `# done-pending

<!-- vault-maintain:toc:start -->
## Contents

- [[#completed-plan]]
- [[#Navigation]]
<!-- vault-maintain:toc:end -->

## completed-plan

Planning note: [[roadmap/plans/2026-06-01_completed-plan|2026-06-01_completed-plan]]

- [x] DONE: Shipped.
- [x] DONE: ${HUMAN_ARCHIVE_CONFIRMATION_TEXT}

## Navigation
`);

    const normal = spawnSync(process.execPath, [ROADMAP_SCRIPT, pm], { encoding: "utf8" });
    assert.equal(normal.status, 1, normal.stdout + normal.stderr);
    assert.match(normal.stdout, /completed planning mirror `## completed-plan` should be archived/);

    const fixed = spawnSync(process.execPath, [ROADMAP_SCRIPT, pm, "--fix"], { encoding: "utf8" });
    assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);

    const today = new Date().toISOString().slice(0, 10);
    const archivePath = join(pm, "archive", "completed-plan-archived.md");
    assert.equal(readFileSync(join(pm, "roadmap", "done-pending.md"), "utf8").includes("## completed-plan"), false);
    assert.throws(() => readFileSync(join(pm, "roadmap", "plans", "2026-06-01_completed-plan.md"), "utf8"));
    const archived = readFileSync(archivePath, "utf8");
    assert.match(archived, new RegExp(`archived: ${today}`));
    assert.match(archived, /status: shipped/);
    assert.match(archived, /icon: "LiArchive"/);
    assert.match(archived, /\[\[archive\/archive\|Back to archive\]\]/);

    const plansIndex = readFileSync(join(pm, "roadmap", "plans", "plans.md"), "utf8");
    assert.equal(plansIndex.includes("2026-06-01_completed-plan"), false);
    const archiveIndex = readFileSync(join(pm, "archive", "archive.md"), "utf8");
    assert.match(archiveIndex, /\[\[archive\/completed-plan-archived\|completed-plan-archived\]\]/);
    const archivedSections = readFileSync(join(pm, "history", "2026-06", `history-${today}-archived-sections.md`), "utf8");
    assert.match(archivedSections, /## completed-plan/);
    assert.match(archivedSections, /Archived roadmap checklist:/);
    const monthIndex = readFileSync(join(pm, "history", "2026-06", "2026-06.md"), "utf8");
    assert.match(monthIndex, new RegExp(`history-${today}-archived-sections`));
    const feature = readFileSync(join(pm, "features", "feature.md"), "utf8");
    assert.match(feature, /\[\[archive\/completed-plan-archived\|the plan\]\]/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("check-roadmap-conventions --fix refuses unsafe completed mirrors", () => {
  const pm = mkdtempSync(join(tmpdir(), "pm-archive-unsafe-"));
  try {
    mkdirSync(join(pm, "roadmap", "plans"), { recursive: true });
    writeFileSync(join(pm, "roadmap", "plans", "2026-06-01_completed-plan.md"), "# completed-plan\n");
    writeFileSync(join(pm, "roadmap", "done-pending.md"), `# done-pending

## completed-plan

Planning note: [[roadmap/plans/2026-06-01_completed-plan|2026-06-01_completed-plan]]

- [x] DONE: Shipped.
- [x] DONE: ${HUMAN_ARCHIVE_CONFIRMATION_TEXT}

## Navigation
`);

    const fixed = spawnSync(process.execPath, [ROADMAP_SCRIPT, pm, "--fix"], { encoding: "utf8" });
    assert.equal(fixed.status, 1, fixed.stdout + fixed.stderr);
    assert.match(fixed.stdout, /unparseable frontmatter/);
    assert.equal(readFileSync(join(pm, "roadmap", "plans", "2026-06-01_completed-plan.md"), "utf8"), "# completed-plan\n");
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
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
