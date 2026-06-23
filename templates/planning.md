---
title: plans
aliases: [roadmap/plans, planning]
tags: [folder-note]
pageType: index
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
last_reviewed: <YYYY-MM-DD>
status: active
owner: PM
---
# plans

Concrete plans, implementation strategies, and design approaches for <Project> features and initiatives. Active plans are mirrored in `roadmap/done-pending.md`, and active/proposed plans link back to their exact mirror section from a near-top `## Related`. Implemented plans move to `archive/` after the user verifies the work and approves archival. Significant decisions made in the course of a plan live in `decisions/` as typed records (e.g. `D-NNN_ADR_…`) and are cited from the plan's Related section, not duplicated here.

<!-- vault-maintain:index:start -->
## Notes

<!-- Add planning notes here, one per line:
- [[<ProjectPath>/roadmap/plans/YYYY-MM-DD_slug|YYYY-MM-DD_slug]]
-->
<!-- vault-maintain:index:end -->

## Conventions

- **Filename:** `YYYY-MM-DD_slug.md` (date prefix from `created:` frontmatter). See `templates/decision.md` for decision filenames.
- **Opening shape:** do not repeat the filename, slug, or frontmatter title as a body H1. Obsidian/file title is the note title. Start with useful content such as `## Summary`, then put `## Related` near the top for quick access.
- **Status:** five values, all from the planning lifecycle:
  - `proposed` — under discussion, not yet approved
  - `active` — in flight
  - `shipped` — work done, file kept for historical reference
  - `rejected` — proposal declined
  - `superseded` — replaced by a newer plan or decision

  These five values are the planning lifecycle.
- **Archived field:** when a planning file moves to `archive/`, set `archived: <date>` in the frontmatter (the date of the move). The `status` field is **not** changed: a shipped-then-archived plan keeps `status: shipped`; a rejected-then-archived plan keeps `status: rejected`; a superseded-then-archived plan keeps `status: superseded`. `archived:` is the file-location marker; `status:` is the lifecycle marker. They are orthogonal.
- **Archive rename:** when retiring, rename to `archive/<slug>-archived.md` — drop the date prefix, preserve the slug, append `-archived`. This rename is mandatory.
- **Owner:** typically `PM`. Use `Platform team` or `Operator` for plans owned by another team.
- **Cross-link:** when a planning note is approved, add a slug-only `## <slug>` section to `roadmap/done-pending.md` with the date-prefixed planning note link and required human archive-confirmation checkbox. Active/proposed planning notes also keep a near-top `## Related` linked back to `Done-pending mirror: [[<ProjectPath>/roadmap/done-pending#<slug>|done-pending#<slug>]]` and repeat relevant decision/feature/system/docs links already present in that mirror. When it ships and the user approves archival, mark the confirmation checkbox done, distill durable current truth into `system/`, and archive the file.
- **Decisions cited, not duplicated:** if the plan records a significant decision, write a typed `decisions/D-NNN_<type>_<slug>.md` and link it from the plan's Related section. Do not restate the decision's reasoning in the plan.

## Related

<!-- Add the done-pending mirror plus related decisions, system docs, and feature pages here, one per line:
- Done-pending mirror: [[<ProjectPath>/roadmap/done-pending#<slug>|done-pending#<slug>]]
- [[<ProjectPath>/decisions/D-NNN_<type>_slug|D-NNN <title>]] — decision made in the course of this plan
- [[<ProjectPath>/system/<topic>|<topic>]] — system doc that implements this plan
- [[<ProjectPath>/features/<feature>|<feature>]] — feature page affected by this plan
-->

## Navigation

- [[<ProjectPath>/roadmap/roadmap|Back to roadmap]]
- [[<ProjectPath>/<Project>|Back to <Project>]]
- [[<ProjectPath>/README|README]]
- [[Projects/Projects|Back to Projects]]
- [[Home|Back to Home]]
