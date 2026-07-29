---
title: <Project>
tags:
  - project
  - folder-note
  - <project-slug>
pageType: index
created: <YYYY-MM-DD>
owner: <owner>
icon: "<LiIconName>"
iconColor: "#<hex>"
updated: <YYYY-MM-DD>
last_reviewed: <YYYY-MM-DD>
status: active
---
# <Project>

> <One-line project description.>

<!-- vault-maintain:index:start -->
## Subfolders

- [[<ProjectPath>/archive/archive|archive]]
- [[<ProjectPath>/decisions/decisions|decisions]]
- [[<ProjectPath>/docs/docs|docs]]
- [[<ProjectPath>/features/features|features]]
- [[<ProjectPath>/history/history|history]]
- [[<ProjectPath>/inbox/inbox|inbox]]
- [[<ProjectPath>/roadmap/roadmap|roadmap]]
- [[<ProjectPath>/system/system|system]]

## Notes

- [[<ProjectPath>/CURRENT_STATUS|CURRENT_STATUS]]
- [[<ProjectPath>/PRODUCT|PRODUCT]]
- [[<ProjectPath>/README|README]]
<!-- vault-maintain:index:end -->

## Features

- <feature-slug> — <one-line description>

## Navigation

- [[<ProjectPath>/README|README]]
- [[<parent-index-link|Back to <Parent>]]  (only when the PM folder's parent has a matching folder note; see bootstrap)
- [[Home|Back to Home]]                     (only when <vault>/Home.md exists; see bootstrap)

<!--
Optional frontmatter fields (project may add as needed):
  - aliases: [<short name>]
  - status: paused | archived                  (default active)

Body section rules (root note):
  - Blockquote (`> `) after `# Title` is the project's one-line
    description. It must exist; do not remove it.
  - The `vault-maintain:index` markers must bracket the
    Subfolders / Notes sections so vault-maintain can regenerate
    them.
  - `## Features` is the +1 extra section allowed for root notes
    (mirrors `## Conventions` allowed for lane folder notes). Add
    it once feature notes exist; omit otherwise. Keep each
    feature line under the same body-bloat limit documented in
    `templates/folder-note.md`.
  - `## Navigation` always includes the README link to the
    project itself. `Back to <Parent>` and `Back to Home` are
    emitted only when the corresponding file exists in the
    vault (checked at bootstrap time), so this template may
    carry them as comments for documentation but bootstrap
    decides what to write.

The root note body is an index. Substantive content belongs in a
separate note under the PM folder (e.g. `system/<topic>.md`,
`features/<feature>.md`, `docs/<Guide>/<topic>.md`). The
check-vault-structure.mjs body-bloat guard enforces this.

This template is the canonical exemplar for the project root
folder note. It mirrors what `scripts/bootstrap-pm.mjs` generates.
Update both together if the canonical format changes.
-->