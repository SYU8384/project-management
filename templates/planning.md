---
title: planning
aliases: [planning]
tags: [folder-note]
pageType: index
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
last_reviewed: <YYYY-MM-DD>
status: active
owner: PM
---
# planning

Concrete plans, architecture decisions, and implementation strategies for <Project> features and initiatives. Active plans are mirrored in `roadmap/done-pending.md`; completed plans move to `archive/`. Significant decisions also live in `decisions/` as ADRs.

<!-- vault-maintain:index:start -->
## Subfolders

- [[Projects/<Project>/planning/decisions/decisions|decisions/]] - Architecture Decision Records (ADRs)

## Notes

<!-- Add planning notes here, one per line:
- [[Projects/<Project>/planning/YYYY-MM-DD_slug|YYYY-MM-DD_slug]]
-->
<!-- vault-maintain:index:end -->

## Conventions

- **Filename:** `YYYY-MM-DD_slug.md` (date prefix from `created:` frontmatter). See `templates/ADR.md` for ADR filenames.
- **H1:** the slug only (no number, no date prefix).
- **Status:** `proposed` for plans not yet approved; `active` for in-flight plans; `shipped` for plans where all work is done and the file is kept for historical reference; `rejected` for proposals that were declined; `superseded` for plans replaced by a newer plan or ADR. These five values are planning-specific; the global schema documents them in `SKILL.md` "Frontmatter Schema → Planning".
- **Archived field:** when a planning file moves to `archive/`, set `archived: <date>` in the frontmatter (the date of the move). The `status` field is **not** changed: a shipped-then-archived plan keeps `status: shipped`; a rejected-then-archived plan keeps `status: rejected`; a superseded-then-archived plan keeps `status: superseded`. `archived:` is the file-location marker; `status:` is the lifecycle marker. They are orthogonal.
- **Archive rename:** when retiring, rename to `archive/<slug>-archived.md` (drop the date prefix, preserve the slug, append `-archived`) — this rename rule is mandatory and is documented in `SKILL.md` "Planning To Roadmap Sync".
- **Owner:** typically `PM`. Use `Platform team` or `Operator` for plans owned by another team.
- **Cross-link:** when a planning note is approved, add a `## YYYY-MM-DD_slug` section to `roadmap/done-pending.md` with the planning note link. When it ships, distill durable current truth into `system/` and archive the file.

## Navigation

- [[Projects/<Project>/<Project>|Back to <Project>]]
- [[Projects/<Project>/README|README]]
- [[Projects/Projects|Back to Projects]]
- [[Home|Back to Home]]
