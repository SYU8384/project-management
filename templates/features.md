---
title: <Project Name> Features
aliases: [features, feature index]
tags:
  - <project>
  - feature
  - index
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
last_reviewed: <YYYY-MM-DD>
pageType: index
status: active
owner: PM
---
# features

Curated per-feature pages. Each feature page is a single index that points into `system/` (current behavior) and `planning/` (decisions + pending work). **Feature pages are not authoritative** — `system/` is the source of truth for current behavior; `features/` is a "tell me everything about X" entry point for agents.

**`features/` is required for any project past initial planning.** Pre-alpha projects have an empty index; mature projects seed feature pages as features enter the design phase.

<!-- vault-maintain:index:start -->
## Notes

<!-- Add feature pages here as features enter the design phase:
- [[Projects/<Project>/features/<feature>|<feature>]] - <one-line description>
-->
<!-- vault-maintain:index:end -->

## Conventions

- **One feature per page.** A "feature" is a coherent user-facing capability (chat, memory, email) or a coherent technical pillar (runtime, isolation).
- **Body sections:** Status (alpha/beta/stable/deprecated), Current Behavior, Known Issues, Roadmap, Relevant ADRs, Source of Truth.
- **Frontmatter fields:** `pageType: feature`, `status` (alpha/beta/stable/deprecated), `owner`, `source_of_truth` (path to the system/ doc that is canonical for this feature), `roadmap_source` (path to the relevant roadmap section).
- **Don't duplicate content.** Feature pages *point* to system/ and planning/; they don't *replace* them. If a system/ doc changes, the feature page's `source_of_truth` link is still valid; no edit needed unless the feature itself changes.

## When to add a feature page

- A coherent user-facing capability exists in product and is worth surfacing for agents.
- A coherent technical pillar has accumulated enough system/ and planning/ content that a "tell me everything about X" entry point is useful.
- Not for every system/ doc — only for things that have cross-cutting context. Most system/ docs are best surfaced via the `system/` index alone.

## Navigation

- [[Projects/<Project>/<Project>|Back to <Project>]]
- [[Projects/<Project>/README|README]]
- [[Projects/<Project>/CURRENT_STATUS|CURRENT_STATUS]]
- [[Projects/Projects|Back to Projects]]
- [[Home|Back to Home]]
