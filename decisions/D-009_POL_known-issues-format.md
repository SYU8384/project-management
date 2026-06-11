---
title: "D-009 Known-issues format"
aliases: [D-009, Known-issues format]
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
# D-009 — `known-issues.md` uses the OpenManager domain-grouped format

## Status

`accepted` (effective 2026-06-12, retroactive to the v1.4.1 conventions surfaced during the post-v1.4.1 audit).

## Context

Pre-v1.4.1, the skill's `roadmap/known-issues.md` was a flat three-section file (`## Active` / `## Fixed` / `## Deferred`) with plain bullets. A real user of the skill (the OpenManager project) uses a more structured format: `## Active` is grouped by `### <Domain>` H3 subsections (e.g., `### Runtime / OpenClaw`, `### Tenant Isolation`, `### Connectors`, `### Product UX`), with each item a checkbox line `- [x] **FIXED (YYYY-MM-DD):**` or `- [ ] **PENDING:**` (with optional date). The `## Fixed` lead paragraph documents that fixed entries are retained in their original domain context for history.

The post-v1.4.1 audit surfaced the gap: the format was undocumented, and the user's own PM folder (the project-management skill itself) had been using the OpenManager convention by hand without the skill supporting it formally.

## Options Considered

- **A. Keep the old flat format.** Plain bullets, no domain grouping. **Rejected**: the format loses the structure that's most useful for tracking bugs (which domain, which planner, which state). The skill's stated convention from `templates/README.md` (in effect since v1.0.0) said "Domain-specific grouping belongs under those sections as labels or `###` subsections" but the bootstrap never scaffolded that grouping.
- **B. Adopt the OpenManager domain-grouped format (chosen).** Three top-level sections (`## Active` / `## Fixed` / `## Deferred`), each grouped by `### <Domain>` H3 subsections. Item format: `- [x] **FIXED (YYYY-MM-DD, in commit \`<hash>\`):** <description>` or `- [ ] **PENDING (YYYY-MM-DD):** <description>` or `- [ ] **DEFERRED:** <description>`. Lead paragraphs document the convention. The convention is documented in `templates/README.md` and the bootstrap-pm.mjs scaffold writes the format with worked examples.
- **C. Use a single flat checklist per top-level section.** One bullet list per section, no domain grouping. **Rejected**: the OpenManager format's value is the domain grouping; flattening loses that.

## Decision

Option B. `known-issues.md` uses the OpenManager format. The convention is:

- **Three top-level sections**: `## Active`, `## Fixed`, `## Deferred`.
- **`### <Domain>` H3 subsections** within each top-level section. Domains are project-specific; the bootstrap writes the project-management skill's natural domains as worked examples (Migrations, Validators, AGENTS.md integration, CLI surface, Documentation).
- **Lead paragraphs** in `## Active` and `## Fixed` documenting the convention. `## Active` says "Active items are grouped by domain below. Checked fixed entries are preserved in their original domain context for now so links and historical references remain stable." `## Fixed` says "Fixed entries are currently retained in their original domain context under `## Active` to preserve nearby bug history. Move newly fixed standalone issues here when they no longer need domain context."
- **Item format** (with optional date, commit reference, or low-risk monitoring tag):
  - `- [ ] **PENDING (YYYY-MM-DD):** <description>.` — active items.
  - `- [ ] **PENDING:** <description>.` — active items without a date.
  - `- [x] **FIXED (YYYY-MM-DD):** <description>.` — fixed items.
  - `- [x] **FIXED (YYYY-MM-DD, in commit \`<hash>\`):** <description>.` — fixed items with commit reference.
  - `- [ ] **DEFERRED:** <description>.` — deferred items.
- **Active items mirrored to `docs/Developer Guide/known-bugs.md`** with engineering root-cause/solution/verification shape. The known-issues file is the PM-level tracker; the known-bugs file is the engineering knowledge base.

The convention is documented in `templates/README.md` "Conventions by Page Type → Roadmap notes → Known issues".

## Consequences

- **Positive**: the convention is documented. A new user reading the skill's `templates/README.md` knows exactly what `known-issues.md` should look like.
- **Positive**: the OpenManager project's format is now the skill's canonical format. Existing OpenManager users get the convention formalized; new users get it from the start.
- **Positive**: domain grouping makes it easy to find bugs by area (Migrations / Validators / etc.) without scanning a long flat list.
- **Positive**: the lead paragraphs in `## Active` and `## Fixed` document the convention inline; a reader doesn't have to consult the conventions doc to understand the layout.
- **Negative**: the format is more complex than the pre-v1.4.1 flat format. A user with no existing bug tracking has more sections to fill. The worked examples in the bootstrap show the format; the user replaces with their own content.
- **Negative**: the convention is not enforced by the validator. A future validator could check that `### <Domain>` subsections exist and that each item has a `**STATUS (DATE):**` prefix; not yet built.

## Realization Notes

- The `templates/known-issues.md` and the `bootstrap-pm.mjs` inline content are updated to match the new format.
- The `templates/README.md` "Conventions by Page Type → Roadmap notes → Known issues" section documents the format.
- The user's PM folder (the project-management skill itself) was the first to use the new format. The convention was captured same-day.

## Related

- `templates/known-issues.md` — the reference template
- `templates/README.md` "Conventions by Page Type → Roadmap notes → Known issues" — the convention doc
- `scripts/bootstrap-pm.mjs` — the bootstrap that writes the worked examples
- `templates/known-bugs.md` — the engineering mirror (already in the OpenManager format from earlier skill development)
- `decisions/D-007_POL_done-pending-format.md` — sibling decision for the `done-pending.md` format
- `decisions/D-008_POL_ideas-status-colors.md` — sibling decision for the `ideas.md` color scheme
- `decisions/D-010_POL_mvp-priorities-format.md` — sibling decision for the `mvp-priorities.md` format

## Navigation

- [[decisions/decisions|Back to decisions]]
- [[Project Management|Back to Project Management]]
