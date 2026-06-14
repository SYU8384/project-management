---
title: "D-013 Live routing and link hygiene"
aliases: [D-013, Live routing hygiene, Feature link hygiene]
tags:
  - project-management
  - decision
  - POL
created: 2026-06-14
updated: 2026-06-14
last_reviewed: 2026-06-14
pageType: decision
decision_type: POL
status: accepted
date: 2026-06-14
supersedes: null
owner: PM
---
# D-013 — Live PM navigation must point at current lanes

## Status

`accepted` (effective 2026-06-14).

## Context

Real PM folders can pass structural checks while still teaching agents stale routes. The most damaging examples are live README, current-status, feature, and guide notes that still point to retired `planning/` or `planning/decisions/` lanes after the project has moved to `roadmap/plans/` and root `decisions/`.

This is worse than an ordinary broken link because it changes where future agents write new PM state. Live routing docs must be treated as operational instructions, not just documentation.

## Decision

Live PM notes outside `history/` and `archive/` must use the current lane names and resolvable links:

- Plans live under `roadmap/plans/`.
- Decisions live under root `decisions/` as `D-NNN_<type>_<slug>.md`.
- Live notes use `Relevant decisions:`, not `Relevant ADRs:`.
- Feature pages point to existing `system/`, `roadmap/plans/`, `decisions/`, and docs notes; body references use wikilinks when a target exists.
- Tooling may rewrite only deterministic routing drift. If a target is missing or ambiguous, it reports manual review rather than inventing a note or a link.
- `history/` and `archive/` records are not rewritten by the migration because historical wording is part of the record.

## Consequences

- Positive: agents reading a PM folder's live instructions are routed to current lanes instead of resurrecting old conventions.
- Positive: feature pages become more reliable entry points because their related decisions and sources are existing links.
- Positive: the validator catches operational drift that schema-only checks cannot see.
- Negative: some old text remains in history/archive unless a maintainer chooses to edit it manually.

## Realization Notes

- Added `scripts/lib/live-routing-fixers.mjs` for deterministic path and decision-link repairs.
- Added `scripts/check-live-routing.mjs` and registered it in `check-pm.mjs` through `scripts/validators/_index.mjs`.
- Added migration `scripts/migrations/1.11.0-live-routing-and-feature-link-hygiene.mjs`.
- Added test coverage for live-path drift, history/archive skipping, unique decision linking, and ambiguous/missing manual review.

## Related

- `scripts/check-live-routing.mjs`
- `scripts/lib/live-routing-fixers.mjs`
- `scripts/migrations/1.11.0-live-routing-and-feature-link-hygiene.mjs`
- `templates/README.md`
- `templates/feature.md`

## Navigation

- [[decisions/decisions|Back to decisions]]
- [[Project Management|Back to Project Management]]
