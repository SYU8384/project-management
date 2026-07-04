---
title: <Project> Team
aliases: [<Project> team, <Project> roles]
tags:
  - <project>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
last_reviewed: <YYYY-MM-DD>
pageType: note
status: active
owner: PM
---
# <Project> Team

This optional root note records who is responsible for the project and how authority works. Keep it to roles, access, approval rules, and inbox author aliases. Do not store private contact details, credentials, tokens, recovery codes, or secret-bearing links here.

## Maintainers

| Role | Person / Team | Scope | Notes |
|---|---|---|---|
| Repo owner | TBD | Code repo | Owns source access and merge policy. |
| PM folder owner | TBD | PM folder | Owns authoritative PM updates and archive approvals. |
| Release approver | TBD | Releases | Confirms release readiness when applicable. |

## Collaborators

| Name / Team | Repo access | PM access | Inbox author name | Notes |
|---|---|---|---|---|
| TBD | TBD | authoritative / read-only / no access | TBD | Add only role and workflow notes needed for collaboration. |

## Approval Rules

- Archive approval: TBD
- Release approval: TBD
- PM folder backfill after contributor PRs: TBD
- Decision approval: TBD

## Inbox Author Aliases

| Alias | Person / Team | Use for | Notes |
|---|---|---|---|
| TBD | TBD | inbox filenames and `author` frontmatter | Replace placeholder names after owner review. |

## Notes

- Keep local-machine setup in `projects.json`, not here.
- Keep per-note responsibility in each note's `owner` frontmatter, not only here.

## Navigation

- [[<ProjectPath>/README|README]]
- [[<ProjectPath>/<Project>|Back to <Project>]]
