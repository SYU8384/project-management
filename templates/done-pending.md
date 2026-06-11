---
title: done-pending
aliases: [done-pending]
icon: "LiTrendingUp"
iconColor: "#16a34a"
tags:
  - <project>
  - roadmap
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
last_reviewed: <YYYY-MM-DD>
pageType: roadmap
status: active
owner: PM
---
# done-pending

<!-- vault-maintain:toc:start -->
## Contents

- [[#v1.5.0 example planning note]]
- [[#General Done/Pending Without Dedicated Planning Note]]
- [[#Navigation]]
<!-- vault-maintain:toc:end -->

This file holds two kinds of entries: (a) **planning-note mirrors** — one H2 per active or proposed planning note from `roadmap/plans/`, with a DONE/PENDING checklist and relevant decisions/features links; (b) **general done/pending items** without a dedicated planning note, organized by date. The two coexist; planning-note mirrors always take priority in the file's order.

Planning-note mirror H2 format: `## <slug>` (slug only, not the date-prefixed stem). Each mirror section starts with a `Planning note:` line linking to the plan, then a DONE/PENDING checklist, then `Relevant decisions:` and `Relevant features:` bullet lines. The H2 is slug-only (per the convention adopted in `decisions/D-007_POL_done-pending-format.md`); the validator at `scripts/check-pm-consistency.mjs` accepts both date-prefixed and slug-only H2.

Sections that are fully done should be archived to `history/YYYY-MM/history-YYYY-MM-DD-archived-sections.md`.

## v1.5.0 example planning note

Planning note: [[YYYY-MM-DD example-plan-slug|YYYY-MM-DD example-plan-slug]]

- [x] DONE: <one-line description of what shipped>.
- [ ] PENDING: <one-line description of what's still open>.
- [ ] PENDING: <another pending item>.

- Relevant decisions: [[decisions/D-NNN_<type>_<slug>]] *(or list multiple, or `*(none)*` if there are no related decisions yet)*
- Relevant features: [[features/<feature-slug>]] *(or list multiple, or `*(none)*` if there are no related features yet)*

## General Done/Pending Without Dedicated Planning Note

### Pending

*(no items)*

### Done — YYYY-MM-DD

*(no items)*

## Navigation

- [[Projects/<Project>/roadmap/roadmap|Back to roadmap]]
- [[Projects/<Project>/<Project>|Back to <Project>]]
- [[Projects/Projects|Back to Projects]]
- [[Home|Back to Home]]
