---
title: <folder>
tags: [folder-note]
pageType: index
created: <YYYY-MM-DD>
owner: <owner>
icon: "<LiIconName>"
iconColor: "#<hex>"
updated: <YYYY-MM-DD>
last_reviewed: <YYYY-MM-DD>
status: active
---
# <folder>

> <One sentence: what this folder is for.>

<!-- vault-maintain:index:start -->
## Subfolders

*(no items)*

## Notes

<!-- Add folder entries here, one per line:
- [[<ProjectPath>/<folder>/<entry>|<entry>]] - <one-line description>
-->
<!-- vault-maintain:index:end -->

## Navigation

- [[<ProjectPath>/<Project>|Back to <Project>]]
- [[Projects/Projects|Back to Projects]]
- [[Home|Back to Home]]

<!--
Optional frontmatter fields (project may add as needed):
  - aliases: [<short name>]

Optional body additions (max 1 extra `##` section beyond the 3 standard
ones — Subfolders, Notes, Navigation — before the
check-vault-structure guard fails):
  - `## Conventions` — only for lanes with lane-specific rules
    (e.g. `roadmap/plans/`, `features/`, `decisions/`, `inbox/`). Use it to state
    lane-local rules inline; keep it short (≤ 50 meaningful lines per
    the body-bloat guard).
    Include link-hygiene and secret-hygiene rules when the lane needs
    them: live links must point to existing current-lane notes, and PM
    notes must not store plaintext credentials or tokens.
  - Nested folder notes should also add a `Back to <parent folder>`
    link in the Navigation section above (e.g., `roadmap/plans/plans.md`
    adds `Back to roadmap`).
  - For the **project root folder note** (`<Project>/<Project>.md`),
    the +1 extra section is `## Features` (not `## Conventions`),
    matching the canonical root note shape in `templates/root-note.md`
    and what `scripts/bootstrap-pm.mjs` generates.

Do NOT extend this folder note with substantive content. If the
content you want to add needs more than a short index entry, create a
new note under this folder (e.g. `system/<topic>.md`,
`features/<feature>.md`, `docs/<Guide>/<topic>.md`,
`inbox/YYYY-MM-DD_<name>_<title>.md`) and link it from the `## Notes`
list. The folder-note body-bloat guard in
`check-vault-structure.mjs` enforces this.

The "Back to Projects" / "Back to Home" navigation lines in the
body above are written into the template for documentation. Generated
folder notes may omit either link when the corresponding target note
does not exist in the vault (e.g. some vaults have no `Home.md` or no
parent index under `Projects/Projects.md`). `bootstrap-pm.mjs` uses
this same adaptive pattern for the root note; see
`adaptiveNavLinks()` there.

Conventions by page type live in `templates/README.md` under
"Conventions by Page Type".
-->