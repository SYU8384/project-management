---
title: "D-016 inline milestone evidence links"
aliases: [D-016, inline milestone evidence links]
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
amends: D-015
owner: PM
---
# D-016 — milestone evidence links are inline

## Status

`accepted` (effective 2026-06-20). Amends D-015.

## Context

D-015 introduced `roadmap/milestones/` as phase-level live PM state. Its initial milestone shape included `## Related Notes`, but that section tended to become a generic index-link dump to plans, decisions, done-pending, known issues, and features. That does not help a project manager understand why a priority exists, what evidence supports a step, or which concrete decision or issue controls an exit criterion.

Milestone notes should remain strategy records, not task dumps. The useful links are the specific evidence links attached to the priority, step, exit criterion, or deferred item they justify.

## Decision

Milestone notes no longer require or use `## Related Notes`.

The required milestone scan shape is:

- `## Goal`
- `## Priorities`
- `## Major Steps`
- `## Exit Criteria`
- `## Deferred`
- `## Update Triggers`
- `## Navigation`

Agents place supporting links inline in the relevant milestone section:

- `## Priorities` links to the specific plan, decision, feature, known issue, or docs note explaining why the priority exists.
- `## Major Steps` links to the specific plan or `roadmap/done-pending.md` section when the step has concrete execution tracking.
- `## Exit Criteria` links to the feature, system note, known issue, decision, or docs note that defines the acceptance standard.
- `## Deferred` links to the idea, rejected decision, plan NOT-in-scope section, or later milestone when a concrete source exists.

Generic folder/index links belong in `## Navigation` or the folder-note index, not in milestone strategy sections.

## Consequences

- `templates/milestone.md` and bootstrap-created milestone notes omit `## Related Notes`.
- `check-roadmap-conventions.mjs` no longer fails missing `## Related Notes`, but flags live milestone notes that still contain the deprecated section.
- `check-roadmap-conventions.mjs --fix` removes empty or generic-index `## Related Notes` sections.
- Migration `1.13.2-inline-milestone-evidence-links` removes empty or generic-index related-note sections from live milestone notes and reports specific related-note content for manual inline integration.
- Validators do not require every milestone bullet to contain a link, because early milestone notes can be sparse; agents add inline links when the supporting source exists.

## Related

- `decisions/D-015_POL_milestone-roadmap-shape.md`
- `templates/milestone.md`
- `scripts/lib/milestones.mjs`
- `scripts/migrations/1.13.2-inline-milestone-evidence-links.mjs`
- `scripts/check-roadmap-conventions.mjs`

## Navigation

- [[decisions/decisions|Back to decisions]]
- [[Project Management|Back to Project Management]]
