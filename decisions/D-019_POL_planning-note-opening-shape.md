---
title: "D-019 planning note opening shape"
aliases: [D-019, planning note opening shape]
tags:
  - project-management
  - decision
  - POL
created: 2026-06-24
updated: 2026-06-24
last_reviewed: 2026-06-24
pageType: decision
decision_type: POL
status: accepted
date: 2026-06-24
amends: D-012, D-018
owner: PM
---
# D-019 - planning notes open with useful content

## Status

`accepted` (effective 2026-06-24). Amends D-012 and D-018.

## Context

Many planning notes repeated their filename, date-prefixed stem, slug, or frontmatter title as a body H1. In Obsidian this produced two titles in a row: the rendered file title above Properties, then a redundant body title near `## Summary`.

The D-018 `## Related` traceability section was also often inserted near `## Navigation`, which made the most useful navigation links hard to reach in long plans.

## Decision

Planning notes do not repeat their title as a body H1. The Obsidian/file title and frontmatter identify the note; the body should start with useful plan content such as `## Summary`.

`## Related` belongs near the top of the planning note:

- Immediately after `## Summary` when a Summary section exists.
- Otherwise before the first H2 implementation/status section.

The fixer may remove deterministic duplicate H1 lines only when the H1 matches the planning filename stem, the date-stripped slug, or the frontmatter `title` after normalization.

Non-matching H1s are preserved because they may be imported report titles or accidental markdown in prose/code. Early non-matching H1s are surfaced for manual review instead of being deleted.

## Consequences

- `check-roadmap-conventions.mjs` enforces D-019 for `roadmap/plans/*.md` notes except the `plans.md` folder note.
- `check-roadmap-conventions.mjs --fix` removes deterministic duplicate title H1s and moves existing `## Related` sections near the top while preserving their content.
- Migration `1.16.0-planning-note-opening-shape` repairs existing planning notes without inventing summaries or rewriting plan prose.
- Templates, bootstrap output, README/reference guidance, PR impact templates, and OpenClaw guidance describe the opening shape.

## Related

- `roadmap/plans/plans.md`
- `templates/planning.md`
- `templates/README.md`
- `scripts/check-roadmap-conventions.mjs`
- `scripts/migrations/1.16.0-planning-note-opening-shape.mjs`
- `decisions/D-012_POL_human-readable-pm-notes.md`
- `decisions/D-018_POL_bidirectional-plan-traceability.md`

## Navigation

- [[decisions/decisions|Back to decisions]]
- [[Project Management|Back to Project Management]]
