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

- [[#example-plan-slug]]
- [[#General Done/Pending Without Dedicated Planning Note]]
- [[#Navigation]]
<!-- vault-maintain:toc:end -->

This file holds two kinds of entries: (a) **planning-note mirrors** — one H2 per active or proposed planning note from `roadmap/plans/`, with a DONE/PENDING checklist and relevant decisions/features/system/docs links; (b) **general done/pending items** without a dedicated planning note, organized by date. The two coexist; planning-note mirrors always take priority in the file's order.

Planning-note mirror H2 format: `## <slug>` (slug only, not the date-prefixed stem). Contents links must match the actual H2 headings in this note. Each mirror section starts with a `Planning note:` line linking to the plan, then a DONE/PENDING checklist, then the required human archive-confirmation checkbox, then `Relevant decisions:`, `Relevant features:`, and optional `Relevant system:` / `Relevant docs:` lines. The matching active/proposed plan's near-top `## Related` links back to this exact section and repeats the relevant decision/feature/system/docs links already present here. Do not use `Relevant ADRs:`; decisions are the first-class lane.

Sections that are fully done should be archived to `history/YYYY-MM/history-YYYY-MM-DD-archived-sections.md` only after the user has tested the implemented plan and explicitly approved archiving.

If a newer planning note absorbs this mirror's scope, the mirror body should be annotated. As the **first body line** after the `Planning note:` line, write:

```
**Superseded by [[<ProjectPath>/roadmap/plans/YYYY-MM-DD_<parent-slug>|<parent-slug>]]** for new work. This section is kept on disk for history; PENDING bullets roll up to <OMR-id>.
```

The matching older planning note's frontmatter `status` must move to `superseded` at this point (D-020). The mirror's PENDING bullets are then stated as rolled up to the parent's OMR-* workstreams; they close when the parent ships. The archive move is the close-out event — see the planning-note lifecycle in `templates/planning.md` "Superseded-by pattern" (D-020).

## example-plan-slug

Planning note: [[<ProjectPath>/roadmap/plans/YYYY-MM-DD_example-plan-slug|YYYY-MM-DD_example-plan-slug]]

- [x] DONE: <one-line description of what shipped>.
- [ ] PENDING: <one-line description of what's still open>.
- [ ] PENDING: <another pending item>.
- [ ] PENDING: Human verification for archival: user has tested the implemented plan and explicitly approved archiving this section and linked plan.

- Relevant decisions: [[<ProjectPath>/decisions/D-NNN_<type>_<slug>]] *(or `*(none)*` if there are no related decisions yet)*
- Relevant features: [[<ProjectPath>/features/<feature-slug>]] *(or `*(none)*` if there are no related features yet)*
- Relevant system: [[<ProjectPath>/system/<topic>]] *(optional; use `*(none)*` if not applicable)*
- Relevant docs: [[<ProjectPath>/docs/<Guide>/<topic>]] *(optional; use `*(none)*` if not applicable)*

## General Done/Pending Without Dedicated Planning Note

### Pending

*(no items)*

### Done — YYYY-MM-DD

*(no items)*

## Navigation

- [[<ProjectPath>/roadmap/roadmap|Back to roadmap]]
- [[<ProjectPath>/<Project>|Back to <Project>]]
- [[Projects/Projects|Back to Projects]]
- [[Home|Back to Home]]
