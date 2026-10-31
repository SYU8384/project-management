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

Concrete plans, implementation strategies, and design approaches for <Project> features and initiatives. Open plans are mirrored in `roadmap/done-pending.md`, and proposed/active/verifying/blocked/deferred plans link back to their exact mirror section from a near-top `## Related`. Implemented plans move to `archive/` after the user verifies the work and approves archival. Significant decisions made in the course of a plan live in `decisions/` as typed records (e.g. `D-NNN_ADR_…`) and are cited from the plan's Related section, not duplicated here.

<!-- vault-maintain:index:start -->
## Notes

<!-- Add planning notes here, one per line:
- [[<ProjectPath>/roadmap/plans/YYYY-MM-DD_slug|YYYY-MM-DD_slug]]
-->
<!-- vault-maintain:index:end -->

## Conventions

- **Filename:** `YYYY-MM-DD_slug.md` (date prefix from `created:` frontmatter). See `templates/decision.md` for decision filenames.
- **Opening shape:** do not repeat the filename, slug, or frontmatter title as a body H1. Obsidian/file title is the note title. Start with useful content such as `## Summary`, then put `## Related` near the top for quick access.
- **Status:** open plans use `proposed` (not yet approved), `active` (implementation underway), `verifying` (implementation exists; acceptance/release verification incomplete), `blocked` (cannot progress), or `deferred` (intentionally paused). Terminal plans use `shipped` (fully done), `rejected` (declined), or `superseded` (replaced). All open states retain mirror traceability; `verifying` is not shipped.
- **Archived field:** when a planning file moves to `archive/`, set `archived: <date>` in the frontmatter (the date of the move). The `status` field is **not** changed: a shipped-then-archived plan keeps `status: shipped`; a rejected-then-archived plan keeps `status: rejected`; a superseded-then-archived plan keeps `status: superseded`. `archived:` is the file-location marker; `status:` is the lifecycle marker. They are orthogonal.
- **Archive rename:** when retiring, rename to `archive/<slug>-archived.md` — drop the date prefix, preserve the slug, append `-archived`. This rename is mandatory.
- **Owner:** typically `PM`. Use `Platform team` or `Operator` for plans owned by another team.
- **Cross-link:** when a planning note is approved, add a slug-only `## <slug>` section to `roadmap/done-pending.md` with the date-prefixed planning note link and required human archive-confirmation checkbox. Open planning notes also keep a near-top `## Related` linked back to `Done-pending mirror: [[<ProjectPath>/roadmap/done-pending#<slug>|done-pending#<slug>]]` and repeat relevant decision/feature/system/docs links already present in that mirror. When it ships and the user approves archival, mark the confirmation checkbox done, distill durable current truth into `system/`, and archive the file.
- **Decisions cited, not duplicated:** if the plan records a significant decision, write a typed `decisions/D-NNN_<type>_<slug>.md` and link it from the plan's Related section. Do not restate the decision's reasoning in the plan.
- **Supersession review:** before filing a new planning note, search active/proposed `roadmap/plans/`, `roadmap/done-pending.md`, accepted/active `decisions/`, relevant `features/`, and relevant `system/` docs. Add `## Supersession Review` near the top with `supersedes`, `related-not-superseded`, or `none found`.
- **Superseded-by pattern (D-020).** A newer planning note that absorbs an older planning note's scope is a *parent workstream*. When filed:
  - Add the older plan to the parent's `## Related` with the annotation `(superseded-by: this plan; covered by <OMR-id>)`.
  - In the older mirror in `roadmap/done-pending.md`, prepend a body line: `**Superseded by [[<ProjectPath>/roadmap/plans/YYYY-MM-DD_<parent-slug>|<parent-slug>]]** for new work. This section is kept on disk for history; PENDING bullets roll up to <OMR-id>.`
  - Set the older plan's frontmatter `status: superseded`. Touch `updated` and `last_reviewed`.
  - Do **not** move the older file to `archive/` at supersede time. Archive is the close-out event (parent ships + human verification); see "Archive cascade" below.
  - **Archive cascade.** When the parent workstream ships and the parent's done-pending mirror is archive-ready, `check-roadmap-conventions.mjs --fix` cascades: the parent and all its superseded dependents whose rolled-up PENDING bullets are closed move to `archive/<slug>-archived.md` together, share a single `history/YYYY/<Month>/history-YYYY-MM-DD-archived-sections.md` entry, and carry `archived: <date>` with their original `status: superseded` preserved.

## Related

<!-- Add the done-pending mirror plus related decisions, system docs, and feature pages here, one per line:
- Supersession review outcome: <supersedes / related-not-superseded / none found>
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
