---
title: "D-015 milestone roadmap shape"
aliases: [D-015, milestone roadmap shape]
tags:
  - project-management
  - decision
  - POL
created: 2026-06-20
updated: 2026-06-20
last_reviewed: 2026-06-20
pageType: decision
decision_type: POL
status: accepted
date: 2026-06-20
supersedes: D-010
amended_by: D-016
owner: PM
---
# D-015 — roadmap milestones replace the MVP-priorities note

## Status

`accepted` (effective 2026-06-20). Supersedes D-010. Amended by D-016 for inline milestone evidence links.

## Context

`roadmap/mvp-priorities.md` worked for projects still proving an MVP, but it aged poorly once a project moved into alpha, beta, launch, or stable operation. The current roadmap needs a phase-level lane that can record priorities for each big step while still linking to concrete plans, decisions, and feature notes.

## Options Considered

- **A. Keep `roadmap/mvp-priorities.md`.** Rejected because the filename and headings stay MVP-specific after a project moves past MVP.
- **B. Rename it to one `roadmap/milestones.md` file.** Rejected because multiple phases would crowd one note and become hard to archive or review independently.
- **C. Add `roadmap/milestones/` with one note per phase or milestone.** Chosen because each milestone stays focused and can link to the relevant plans, decisions, features, known issues, and done/pending mirrors.

## Decision

Use `roadmap/milestones/` as the phase-level roadmap lane. The folder contains `milestones.md` as its folder-note index and agent-maintained milestone notes such as `mvp.md`, `alpha.md`, `beta.md`, `launch.md`, `stable.md`, or project-specific milestone slugs.

Agents derive the active milestone from `CURRENT_STATUS.md` `## Current Phase`, falling back to the registered `projects.json` phase. Phase mapping is `pre-alpha`/`prealpha` -> `mvp`, `alpha` -> `alpha`, `beta` -> `beta`, `stable` -> `stable`, `deprecated` -> `deprecated`; any other phase becomes a slug such as `launch`.

Each milestone note has this required scan shape:

- `## Goal`
- `## Priorities`
- `## Major Steps`
- `## Exit Criteria`
- `## Deferred`
- `## Update Triggers`
- `## Navigation`

Concrete execution remains in `roadmap/plans/`, active checklist mirrors remain in `roadmap/done-pending.md`, and current top priorities remain summarized in `CURRENT_STATUS.md`. Per D-016, specific supporting plans, decisions, feature notes, known issues, and docs are linked inline inside the milestone priority, major step, exit criterion, or deferred item they support; generic folder/index link dumps are not a milestone section. When milestone direction, priority, plan, decision, feature state, known issue, blocker, risk, or phase changes, agents update the relevant milestone note before history. If review finds no prose change, agents still refresh `updated` and `last_reviewed`.

## Consequences

- New bootstraps create `roadmap/milestones/` and one initial milestone note based on the registered project phase, including `## Update Triggers`.
- Existing PM folders migrate legacy `roadmap/mvp-priorities.md` to `roadmap/milestones/mvp.md` with migration `1.13.0-roadmap-milestones`.
- Migration `1.13.1-agent-maintained-milestones` inserts `## Update Triggers`, creates the active milestone when missing, and updates the milestones index.
- Migration `1.13.2-inline-milestone-evidence-links` removes generic `## Related Notes` link dumps and reports specific related-note content for manual inline integration.
- Validators check milestone-note sections, active milestone existence, and milestone freshness instead of the old D-010 lane-grouped MVP-priorities shape.
- Agents must refresh both `CURRENT_STATUS.md` and the active or explicitly linked milestone when priorities, plans, decisions, features, known issues, blockers, risks, wins, or phase state change.

## Related

- `templates/milestone.md`
- `scripts/migrations/1.13.0-roadmap-milestones.mjs`
- `scripts/migrations/1.13.1-agent-maintained-milestones.mjs`
- `scripts/migrations/1.13.2-inline-milestone-evidence-links.mjs`
- `scripts/check-roadmap-conventions.mjs`
- `decisions/D-016_POL_inline-milestone-evidence-links.md`
- `decisions/D-010_POL_mvp-priorities-format.md`

## Navigation

- [[decisions/decisions|Back to decisions]]
- [[Project Management|Back to Project Management]]
