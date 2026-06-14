---
title: "D-012 Human-readable PM notes"
aliases: [D-012, Human-readable PM notes]
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
# D-012 — PM notes optimize for human scanning first

## Status

`accepted` (effective 2026-06-14).

## Context

Real PM folders showed three readability defects. History logs were drifting toward raw commit-comment bullets, making them hard to scan for product meaning. `roadmap/done-pending.md` Contents links sometimes pointed to planning note stems instead of actual H2 headings inside the note. `roadmap/ideas.md` detail sections could remain a handful of short fields without enough prose to understand the idea later.

These are documentation-quality defects, not schema defects. The skill needs templates and validators that steer agents toward human-readable notes without pretending to know content that only a maintainer can supply.

## Options Considered

- **A. Keep prefix-first history and current roadmap shapes.** Rejected: it preserves machine-friendly history at the cost of human comprehension.
- **B. Require outcome-first notes with conservative auto-fix (chosen).** History uses bold outcome sentences before conventional type/scope details. Done-pending Contents links are regenerated from actual H2s. Idea detail summaries are required, but auto-fix inserts `TBD` instead of inventing prose.
- **C. Auto-rewrite old history prose.** Rejected: historical meaning requires judgment. Existing history files remain historical records.

## Decision

Option B. New PM notes follow these conventions:

- History bullets start with a bold human-readable outcome sentence, then include a concise conventional type/scope token and implementation detail.
- `roadmap/done-pending.md` Contents links point only to actual H2 headings in that note. Planning-note, decision, feature, system, and docs links live inside the relevant section body.
- Done-pending mirror sections use `Relevant decisions:` rather than `Relevant ADRs:`.
- `roadmap/ideas.md` detail sections include `**Summary:**` with a 2-4 sentence human-readable description.
- Auto-fix may insert `TBD` for a missing idea summary and may link only unique existing targets. Ambiguous or missing links remain manual review.

## Consequences

- Positive: PM notes are easier for humans to scan without opening code diffs or planning files.
- Positive: deterministic drift is repairable by `check-roadmap-conventions.mjs --fix` and migration `1.10.0-human-readable-pm-notes`.
- Positive: the convention avoids fabricating content; uncertain prose remains `TBD`.
- Negative: maintainers must fill in summary prose for ideas after auto-fix inserts `TBD`.

## Realization Notes

- Extended `scripts/lib/roadmap-fixers.mjs` with done-pending TOC/link repair and idea-summary insertion.
- Extended `scripts/check-roadmap-conventions.mjs --fix` to enforce the D-012 deterministic parts.
- Added migration `scripts/migrations/1.10.0-human-readable-pm-notes.mjs`.
- Updated skill docs, templates, bootstrap scaffolds, and generated migration/sync history snippets.

## Related

- `templates/done-pending.md`
- `templates/ideas.md`
- `scripts/check-roadmap-conventions.mjs`
- `scripts/lib/roadmap-fixers.mjs`
- `scripts/migrations/1.10.0-human-readable-pm-notes.mjs`

## Navigation

- [[decisions/decisions|Back to decisions]]
- [[Project Management|Back to Project Management]]
