---
title: "D-010 MVP-priorities format"
aliases: [D-010, MVP-priorities format]
tags:
  - project-management
  - decision
  - POL
created: 2026-06-12
updated: 2026-06-12
last_reviewed: 2026-06-12
pageType: decision
decision_type: POL
status: accepted
date: 2026-06-12
supersedes: null
owner: PM
---
# D-010 — `mvp-priorities.md` uses the OpenManager lane-grouped format

## Status

`accepted` (effective 2026-06-12, retroactive to the v1.4.1 conventions surfaced during the post-v1.4.1 audit).

## Context

Pre-v1.4.1, the skill's `roadmap/mvp-priorities.md` was a flat two-section file (`## Alpha Goal` / `## MVP Priorities` / `## Not Yet MVP`) with plain numbered items. A real user of the skill (the OpenManager project) uses a more structured format: `## MVP Priorities` is grouped by `### <Lane>` H3 subsections (e.g., `### Product Surface`, `### Connectors`, `### Runtime`), with each item a checkbox line `- [x] **DONE:**` or `- [ ] **PENDING:**` (with optional date). The `## Not Yet MVP` section uses bare bullets (no status prefix).

The post-v1.4.1 audit surfaced the gap: the format was undocumented, and the user's own PM folder (the project-management skill itself) had been using the OpenManager convention by hand without the skill supporting it formally.

## Options Considered

- **A. Keep the old flat numbered format.** Single numbered list, no domain grouping. **Rejected**: the format loses the structure that's most useful for tracking scope (which lane, which state). The OpenManager format's lane grouping is a real signal of scope boundaries.
- **B. Adopt the OpenManager lane-grouped format (chosen).** `## MVP Priorities` grouped by `### <Lane>` H3 subsections. Item format: `- [x] **DONE:**` or `- [x] **DONE (YYYY-MM-DD):**` or `- [ ] **PENDING:**`. `## Not Yet MVP` uses bare `- [ ]` bullets. Lead paragraph in `## Alpha Goal` documents the current validation goal. The convention is documented in `templates/README.md` and the bootstrap-pm.mjs scaffold writes the format with worked examples.
- **C. Use a single flat checkbox list per top-level section.** One bullet list per section, no lane grouping. **Rejected**: same as D-009 Option C — the OpenManager format's value is the lane grouping; flattening loses that.

## Decision

Option B. `mvp-priorities.md` uses the OpenManager format. The convention is:

- **Three top-level sections**: `## Alpha Goal`, `## MVP Priorities`, `## Not Yet MVP`.
- **`### <Lane>` H3 subsections** within `## MVP Priorities`. Lanes are project-specific; the bootstrap writes the project-management skill's natural lanes as worked examples (Bootstrap / Validations / Migrations / AGENTS.md integration / CLI surface / Documentation / OpenClaw PM-agent integration).
- **`## Alpha Goal`** is a one-paragraph description of the current validation goal (what the project is *currently* trying to prove). Single source of truth for the "why are we doing this now" framing.
- **Item format** in `## MVP Priorities`:
  - `- [x] **DONE:** <description>.` — shipped items.
  - `- [x] **DONE (YYYY-MM-DD):** <description>.` — shipped items with a date.
  - `- [ ] **PENDING:** <description>.` — in-flight items.
- **Item format in `## Not Yet MVP`**: bare `- [ ] <description>` (no status prefix). Not Yet MVP items are "future scope" items that haven't yet been claimed for the MVP.

The convention is documented in `templates/README.md` "Conventions by Page Type → Roadmap notes → MVP priorities".

## Consequences

- **Positive**: the convention is documented. A new user reading the skill's `templates/README.md` knows exactly what `mvp-priorities.md` should look like.
- **Positive**: the OpenManager project's format is now the skill's canonical format. Existing OpenManager users get the convention formalized; new users get it from the start.
- **Positive**: lane grouping makes it easy to see scope boundaries (Bootstrap / Validations / Migrations / etc.). A reader can see at a glance "we have shipped the bootstrap, we're still working on migrations" without reading every item.
- **Positive**: the `## Alpha Goal` keeps the "why now" framing visible. The skill is at a phase, and the goal states what we're trying to prove in this phase.
- **Positive**: the `## Not Yet MVP` section uses bare bullets (no status prefix), which is honest — these items are aspirational, not committed.
- **Negative**: the format is more complex than the pre-v1.4.1 flat format. A user with no existing MVP scope has more sections to fill. The worked examples in the bootstrap show the format; the user replaces with their own content.
- **Negative**: the convention is not enforced by the validator. A future validator could check that `### <Lane>` subsections exist and that each item has a `**DONE:**` or `**PENDING:**` prefix; not yet built.

## Realization Notes

- The `templates/mvp-priorities.md` and the `bootstrap-pm.mjs` inline content are updated to match the new format.
- The `templates/README.md` "Conventions by Page Type → Roadmap notes → MVP priorities" section documents the format.
- The user's PM folder (the project-management skill itself) was the first to use the new format. The convention was captured same-day.

## Related

- `templates/mvp-priorities.md` — the reference template
- `templates/README.md` "Conventions by Page Type → Roadmap notes → MVP priorities" — the convention doc
- `scripts/bootstrap-pm.mjs` — the bootstrap that writes the worked examples
- `decisions/D-007_POL_done-pending-format.md` — sibling decision for the `done-pending.md` format
- `decisions/D-008_POL_ideas-status-colors.md` — sibling decision for the `ideas.md` color scheme
- `decisions/D-009_POL_known-issues-format.md` — sibling decision for the `known-issues.md` format

## Navigation

- [[decisions/decisions|Back to decisions]]
- [[Project Management|Back to Project Management]]
