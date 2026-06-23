---
title: "D-018 bidirectional plan traceability"
aliases: [D-018, bidirectional plan traceability]
tags:
  - project-management
  - decision
  - POL
created: 2026-06-23
updated: 2026-06-23
last_reviewed: 2026-06-23
pageType: decision
decision_type: POL
status: accepted
date: 2026-06-23
amends: D-007
owner: PM
---
# D-018 - active plans link back to their done-pending mirrors

## Status

`accepted` (effective 2026-06-23). Amends D-007 and D-012.

## Context

`roadmap/done-pending.md` is the active checklist mirror for concrete planning notes, but the traceability was one-way: mirror sections linked to plans, while plans did not reliably link back to the exact mirror section. That made it harder for agents and owners to move between design context and current checklist state.

The mirror already carries the relevant decision, feature, system, and docs links needed to explain the work. Repeating those links in the planning note's `## Related` section improves navigation without duplicating checklist content or inventing new decisions.

## Decision

Active and proposed `roadmap/plans/YYYY-MM-DD_slug.md` notes must include `## Related` traceability back to their matching slug-only `roadmap/done-pending.md` H2 section.

The required plan-side related entry is:

- `Done-pending mirror: [[<ProjectPath>/roadmap/done-pending#<slug>|done-pending#<slug>]]`

The plan-side `## Related` section also repeats relevant decision, feature, system, and docs links when those links already exist in the matching done-pending mirror.

Rules:

- The matching mirror heading is the plan filename slug without the date prefix, with underscores normalized to hyphens.
- The done-pending mirror remains the source of active checklist state.
- The fixer preserves existing related prose and links.
- The fixer may add deterministic backlinks and copied relevant links, but it must not invent missing mirrors, decisions, destinations, features, system notes, or docs.
- Shipped, rejected, superseded, and archived plans are not forced into active traceability.

## Consequences

- `check-roadmap-conventions.mjs` enforces D-018 for active/proposed planning notes.
- `check-roadmap-conventions.mjs --fix` adds or updates deterministic plan-side `## Related` entries when the matching done-pending mirror exists.
- Missing mirrors remain hard failures or manual review; the validator does not create planning state from nothing.
- Migration `1.15.0-plan-related-links` repairs existing active/proposed planning notes using only links already present in `roadmap/done-pending.md`.
- Templates, bootstrap output, README/reference guidance, PR impact templates, and OpenClaw guidance describe the bidirectional convention.

## Related

- `roadmap/done-pending.md`
- `roadmap/plans/plans.md`
- `templates/planning.md`
- `templates/done-pending.md`
- `scripts/check-roadmap-conventions.mjs`
- `scripts/migrations/1.15.0-plan-related-links.mjs`
- `decisions/D-007_POL_done-pending-format.md`
- `decisions/D-012_POL_human-readable-pm-notes.md`

## Navigation

- [[decisions/decisions|Back to decisions]]
- [[Project Management|Back to Project Management]]
