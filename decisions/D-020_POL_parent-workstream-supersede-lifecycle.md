---
title: "D-020 parent-workstream supersede lifecycle"
aliases: [D-020, parent-workstream supersede lifecycle]
tags:
  - project-management
  - decision
  - POL
created: 2026-06-27
updated: 2026-06-27
last_reviewed: 2026-06-27
pageType: decision
decision_type: POL
status: accepted
date: 2026-06-27
amends: D-007
supersedes: null
owner: PM
---
# D-020 — parent-workstream supersede lifecycle

## Status

`accepted` (effective 2026-06-27). Amends D-007.

## Context

The skill's planning lifecycle defines `superseded` as a terminal planning-note status (`scripts/lib/convention.mjs:28-34`), and the planning template and reference docs note that `status:` and `archived:` are orthogonal (`templates/planning.md:36`, `REFERENCE.md:626-639`). The archive-rename and archive-close-out conventions are explicit (`roadmap/plans/plans.md:53-54`, `check-roadmap-conventions.mjs:264-297`).

What was missing: a defined lifecycle for the moment when a *newer* planning note absorbs an *older* planning note's scope. The OpenManager project invented a "parent workstream" pattern locally — annotate the older mirror in `roadmap/done-pending.md` with `**Superseded by [[<newer-plan>]]**` and roll up the older PENDING bullets to the parent's OMR-* workstreams — but the skill had no validator, fixer, migration, or template guidance for it. The pattern drifted: the older plan's `status` stayed `active` while its done-pending mirror already declared it superseded.

A second gap surfaced from this: when the parent workstream ships and is archived via `check-roadmap-conventions.mjs --fix`, the validator moves only the parent to `archive/`. Superseded dependents have their own mirrors but their PENDING bullets are stated as rolled up to the parent — they do not have their own archive-confirmation checkbox flipped by the parent action. Without a cascade, the dependents would stay in `roadmap/plans/` forever with `status: superseded`.

## Options Considered

- **A. Archive superseded plans immediately at supersede time (rejected).** Move the older plan to `archive/<slug>-archived.md` when the newer plan is filed. **Rejected**: the older plan is design rationale that implementers read alongside the parent during execution; pulling it out mid-implementation breaks navigation. The mirror still has rolled-up PENDING bullets that close when the parent ships — splitting the audit trail.
- **B. Status flip at supersede time; archive cascade at parent close-out (chosen).** Two distinct lifecycle events for a superseded plan:
  1. **Supersede moment** (when the parent plan is filed): the older plan's frontmatter `status` flips to `superseded`; the file stays in `roadmap/plans/`; the older mirror in `roadmap/done-pending.md` is annotated `**Superseded by [[<parent>]]**` and its PENDING bullets are stated as rolled up to the parent's OMR-* workstreams.
  2. **Archive moment** (when the parent workstream ships and the user verifies): the parent's `--fix` close-out cascades. The parent and all its superseded dependents move to `archive/<slug>-archived.md` together, share a single `history/YYYY-MM/history-YYYY-MM-DD-archived-sections.md` entry, and carry `archived: <date>` with their original `status: superseded` preserved.

  **Chosen**: keeps design context visible during implementation and centralizes archival at one human-verified moment. The cascade complexity is contained in the validator, not the user workflow.

## Decision

Option B.

### Lifecycle rules

1. **Supersede moment.** When filing a parent planning note that absorbs an older planning note's scope:
   - Add the older plan to the parent's `## Related` with the annotation `(superseded-by: this plan; covered by <OMR-id>)`.
   - In the older mirror section of `roadmap/done-pending.md`, prepend a body line: `**Superseded by [[<ProjectPath>/roadmap/plans/YYYY-MM-DD_<parent-slug>|<parent-slug>]]** for new work. This section is kept on disk for history; PENDING bullets roll up to <OMR-id>.`
   - Rewrite the older mirror's PENDING bullets to state they roll up to the parent's OMR-* workstreams.
   - Set the older plan's frontmatter `status: superseded`. Touch `updated` and `last_reviewed`.
   - Do **not** move the older file to `archive/`. The archive move is the close-out event, not the supersede event.

2. **Mid-workstream.** No further changes to the superseded plan's file location or status. The parent plan's done-pending mirror is the live checklist. Readers land on the older plan for design context.

3. **Archive moment.** When the parent's done-pending mirror is archive-ready (human archive-confirmation checkbox checked, all DONE/PENDING items closed):
   - `check-roadmap-conventions.mjs --fix` archives the parent (existing behavior at `scripts/check-roadmap-conventions.mjs:264-297`).
   - The validator additionally walks every other planning-note mirror whose body declares `**Superseded by [[…<parent>…]]**`. For each such dependent whose rolled-up PENDING bullets are now closed in the parent:
     - Move the planning file to `archive/<dependent-slug>-archived.md`. Set `archived: <date>`. Preserve `status: superseded`.
     - Rewrite wikilinks that pointed to the old planning filename.
     - Append the dependent's mirror section to the same `history/YYYY-MM/history-YYYY-MM-DD-archived-sections.md` entry as the parent.
   - Superseded dependents whose bullets are *not* closed in the parent remain in `roadmap/plans/` with `status: superseded` and are NOT moved. They will cascade when their own bullets close.

### Validator and migration

- A new "D-020" check in `check-roadmap-conventions.mjs` enforces that a plan whose done-pending mirror declares `Superseded by` carries `status: superseded` in its own frontmatter. `--fix` flips the status. Manual review for unresolved wikilinks, archived files, and non-active/proposed plans.
- A migration `1.17.0-parent-workstream-supersede-flip.mjs` brings existing projects into compliance. Idempotent.

### Out of scope

- No `superseded_by:` frontmatter field on planning notes. The mirror annotation is the canonical link. A frontmatter field can be added later if a use case appears.
- No automatic back-link from the older plan's `## Related` to the parent. D-018 explicitly excludes shipped/rejected/superseded/archived plans from forced active-traceability.

## Consequences

- The convention is explicit and documented in `templates/planning.md`, `templates/done-pending.md`, `templates/README.md` "Planning notes", and `REFERENCE.md` "Big Tasks Must Be Planned".
- `scripts/check-roadmap-conventions.mjs` reports `D-020` mismatches between done-pending "Superseded by" annotations and the older plan's frontmatter status. `--fix` repairs them.
- `scripts/migrations/1.17.0-parent-workstream-supersede-flip.mjs` deterministically brings existing PM folders into compliance.
- Existing conformant projects are unaffected. Existing non-conformant projects (mirror says superseded but plan status says active) are repaired by the migration.
- `roadmap/done-pending.md` becomes the source of truth for supersede relationships; planning-note frontmatter is the mirror.

## Realization Notes

- The cascade is bounded by the parent's archive-ready state. If the parent is never archived (e.g., the work is rejected or indefinitely deferred), the superseded dependents stay in `roadmap/plans/` with `status: superseded`. This is intentional — the design content remains relevant while the parent is alive.
- The validator uses `(?i)Superseded\s+by\s+\[\[` to detect the annotation in mirror bodies. Variants like "Superseded by:" or "Superseded by" without wikilinks are flagged as MANUAL REVIEW for the user to clarify.
- The cascade runs only when `CLI.fix` is set, and only for dependents whose rolled-up PENDING bullets are closed in the parent. Report-only mode emits an `issues` line listing the cascade targets but does not move files.

## Related

- `templates/planning.md` — superseded-by pattern convention
- `templates/done-pending.md` — mirror annotation format
- `templates/README.md` "Planning notes" — convention doc
- `REFERENCE.md` "Big Tasks Must Be Planned" — flow integration
- `scripts/check-roadmap-conventions.mjs` — D-020 check + cascade
- `scripts/lib/roadmap-fixers.mjs` — `ensureSupersedeByMirrorSync` and cascade helpers
- `scripts/migrations/1.17.0-parent-workstream-supersede-flip.mjs` — bring-up migration
- `decisions/D-007_POL_done-pending-format.md` — amended by this decision
- `decisions/D-018_POL_bidirectional-plan-traceability.md` — superseded plans excluded from forced active-traceability

## Navigation

- [[decisions/decisions|Back to decisions]]
- [[Project Management|Back to Project Management]]