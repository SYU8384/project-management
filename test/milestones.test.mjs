import test from "node:test";
import assert from "node:assert/strict";

import {
  ensureMilestoneUpdateTriggers,
  milestoneRelatedNotesState,
  milestoneSlugForPhase,
  phaseFromCurrentStatusContent,
  removeDeprecatedMilestoneRelatedNotes,
} from "../scripts/lib/milestones.mjs";

test("phase-to-active-milestone mapping supports standard and custom phases", () => {
  assert.equal(milestoneSlugForPhase("pre-alpha"), "mvp");
  assert.equal(milestoneSlugForPhase("prealpha"), "mvp");
  assert.equal(milestoneSlugForPhase("alpha"), "alpha");
  assert.equal(milestoneSlugForPhase("beta"), "beta");
  assert.equal(milestoneSlugForPhase("stable"), "stable");
  assert.equal(milestoneSlugForPhase("deprecated"), "deprecated");
  assert.equal(milestoneSlugForPhase("launch"), "launch");
  assert.equal(milestoneSlugForPhase("Design Preview"), "design-preview");
});

test("active phase resolves from CURRENT_STATUS Current Phase body", () => {
  const content = `# current

## Current Phase

launch

## Top Priorities

- Ship.
`;
  assert.equal(phaseFromCurrentStatusContent(content), "launch");
});

test("milestone update triggers insert before navigation deterministically", () => {
  const content = `# beta

## Goal

Ship beta.

## Navigation

- Back.
`;
  const first = ensureMilestoneUpdateTriggers(content);
  assert.match(first.updated, /## Update Triggers[\s\S]*## Navigation/);
  assert.deepEqual(first.changes, ["inserted `## Update Triggers`"]);
  const second = ensureMilestoneUpdateTriggers(first.updated);
  assert.equal(second.updated, first.updated);
  assert.deepEqual(second.changes, []);
});

test("milestone Related Notes removal distinguishes generic index links from specific evidence", () => {
  const generic = `# alpha

## Goal

Ship alpha.

## Related Notes

- Plans: [[Project/roadmap/plans/plans|plans]]
- Done/pending: [[Project/roadmap/done-pending|done-pending]]
- Known issues: [[Project/roadmap/known-issues|known-issues]]
- Decisions: [[Project/decisions/decisions|decisions]]
- Features: [[Project/features/features|features]]

## Navigation

- Back.
`;
  const genericState = milestoneRelatedNotesState(generic, "roadmap/milestones/alpha.md");
  assert.equal(genericState.hasSection, true);
  assert.equal(genericState.removable, true);
  const removed = removeDeprecatedMilestoneRelatedNotes(generic, "roadmap/milestones/alpha.md");
  assert.doesNotMatch(removed.updated, /## Related Notes/);
  assert.deepEqual(removed.changes, ["removed deprecated generic `## Related Notes`"]);

  const specific = generic.replace(
    "- Plans: [[Project/roadmap/plans/plans|plans]]",
    "- Launch plan: [[Project/roadmap/plans/2026-06-20_launch-plan|launch plan]]"
  );
  const specificState = milestoneRelatedNotesState(specific, "roadmap/milestones/alpha.md");
  assert.equal(specificState.hasSection, true);
  assert.equal(specificState.removable, false);
  assert.match(specificState.manualReview[0], /specific links or prose/);
  const preserved = removeDeprecatedMilestoneRelatedNotes(specific, "roadmap/milestones/alpha.md");
  assert.equal(preserved.updated, specific);
  assert.match(preserved.manualReview[0], /specific links or prose/);
});
