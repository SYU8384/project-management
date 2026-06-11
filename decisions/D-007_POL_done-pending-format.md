---
title: "D-007 Done-pending format"
aliases: [D-007, done-pending format]
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
# D-007 — `done-pending.md` holds planning-note mirrors and general done/pending items in two lanes

## Status

`accepted` (effective 2026-06-12, retroactive to v1.4.1 conventions surfaced during the post-v1.4.1 audit).

## Context

Pre-v1.4.1, the skill's `roadmap/done-pending.md` was a general done/pending tracker only. The convention from `templates/README.md` (in effect since v1.0.0) said: "Approved planning work is mirrored into `roadmap/done-pending.md`." In practice, the mirror was a free-form H2 with a date-prefixed stem, and the general lane was an afterthought.

A real user of the skill (the OpenManager project) uses a more structured format: planning-note mirrors with slug-only H2, a `Planning note:` line linking to the plan, a DONE/PENDING checklist, and `Relevant decisions:` / `Relevant features:` bullet lines. The general done/pending lane coexists as a separate section.

The post-v1.4.1 audit of the project-management skill's own PM folder surfaced the gap: the planning-note-mirror format was undocumented, and the user's own PM folder (the project-management skill itself) had been using the OpenManager convention by hand without the skill supporting it formally.

## Options Considered

- **A. Keep the old general-only format.** Planning-note mirrors continue as free-form H2s. **Rejected**: the format was undocumented, inconsistent across users, and the validator's check (`check-pm-consistency.mjs:195`) was tight to the date-prefixed H2 with no other documented variant.
- **B. Adopt the OpenManager format with two lanes (chosen).** Planning-note mirrors use slug-only H2, `Planning note:` line, DONE/PENDING checklist, and relevant decisions/features links. General done/pending items continue in a separate `## General Done/Pending Without Dedicated Planning Note` section, organized by date. The convention is documented in `templates/README.md` and the validator at `check-pm-consistency.mjs:195` is updated to accept both date-prefixed and slug-only H2.
- **C. Split into two separate files.** One for planning-note mirrors, one for general done/pending. **Rejected**: the user explicitly stated that `done-pending` can also have items that are not in plans, so the file is a general done/pending tracker that *also* includes planning-note mirrors; splitting would force users to remember which file to update for which kind of item.

## Decision

Option B. `done-pending.md` holds two kinds of entries in two lanes:

1. **Planning-note mirrors** (priority in the file's order) — one H2 per active or proposed planning note from `roadmap/plans/`, with the OpenManager format: `Planning note:` line, DONE/PENDING checklist, `Relevant decisions:` and `Relevant features:` bullet lines. H2 is slug-only (e.g., `## v1.5.0 backlog from post-v1.4.1 audit`), not date-prefixed.
2. **General done/pending items** without a dedicated planning note, organized by date in the `## General Done/Pending Without Dedicated Planning Note` section.

The convention is documented in `templates/README.md` "Conventions by Page Type → Roadmap notes → Done/pending". The validator at `scripts/check-pm-consistency.mjs:195` accepts both `## YYYY-MM-DD_slug` and `## slug`-only H2 (F8 fix).

## Consequences

- **Positive**: the convention is documented. A new user reading the skill's `templates/README.md` knows exactly what `done-pending.md` should look like, in both lanes.
- **Positive**: the OpenManager project's format is now the skill's canonical format. Existing OpenManager users get the convention formalized; new users get it from the start.
- **Positive**: the validator accepts both formats. Existing PM folders with the date-prefixed H2 continue to work; new PM folders can use the OpenManager slug-only format.
- **Negative**: the existing `roadmap/done-pending.md` files in pre-v1.4.1 PM folders don't have the planning-note-mirror lane. A migration is the right long-term fix; not yet written (it would be a v1.5.0 item).
- **Negative**: the file is more complex than the pre-v1.4.1 general-only format. A user who has no planning notes will only use the general lane; a user with planning notes will have both. The complexity is justified by the value of the mirror lane for tracking planning progress.

## Realization Notes

- The `templates/done-pending.md` and `templates/ideas.md` reference templates are updated to the new format. The `bootstrap-pm.mjs` inline content (which writes the skeleton to new PM folders) is updated to match.
- The `templates/README.md` "Conventions by Page Type → Roadmap notes → Done/pending" section documents the two-lane structure and the slug-only H2.
- The `check-pm-consistency.mjs:195` check now accepts `## YYYY-MM-DD_slug` (date-prefixed), `## slug-with-dashes`, and `## slug with spaces` (slug-only per OpenManager).
- The user's PM folder (the project-management skill itself) was the first to use the new format. The convention was captured same-day.

## Related

- `templates/done-pending.md` — the reference template
- `templates/README.md` "Conventions by Page Type → Roadmap notes → Done/pending" — the convention doc
- `scripts/check-pm-consistency.mjs:195` — the validator check
- `decisions/D-008_POL_ideas-status-colors.md` — sibling decision for the `ideas.md` color scheme
- `roadmap/plans/2026-06-12_v1.5.0-backlog-from-audit.md` F8 — the audit item that captured the convention-vs-validator mismatch; resolved by this decision + the F8 fix.

## Navigation

- [[decisions/decisions|Back to decisions]]
- [[Project Management|Back to Project Management]]
