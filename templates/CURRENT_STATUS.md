---
title: <Project Name> Current Status
aliases: [<Project> status, current status]
tags:
  - <project>
  - status
  - index
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
last_reviewed: <YYYY-MM-DD>
pageType: index
status: active
owner: PM
---
# <Project Name> Current Status

> **First thing a new agent should read.** This is the current snapshot of where <Project> is now. Refresh it before history whenever priorities, blockers, risks, wins, plans, decisions, features, known issues, or milestone state change. The active milestone is derived from `## Current Phase`; create or update the matching `roadmap/milestones/<phase>.md` note before history when phase, priority, plan, decision, feature, issue, blocker, or risk state changes. For raw intake, see `inbox/`. For durable architecture, see `system/`. For user-facing capabilities, see `features/`. For milestone framing, see `roadmap/milestones/`. For concrete plans in flight, see `roadmap/plans/`. For pending work, see `roadmap/done-pending.md`. For decisions, see `decisions/`. For user/admin/dev docs, see `docs/`. For completed work, see `history/`. For superseded material, see `archive/`.

## Current Phase

**Alpha / Beta / Stable (private).** <one-paragraph description of where the project is today and who's using it>

Active milestone: [[<ProjectPath>/roadmap/milestones/<milestone>|<milestone>]]

## Top Priorities

1. **<Priority 1>** (`roadmap/plans/YYYY-MM-DD_slug`, <DRAFT/APPROVED>) — <one-sentence description>
2. **<Priority 2>** (`roadmap/plans/YYYY-MM-DD_slug`, <DRAFT/APPROVED>) — <one-sentence description>
3. **<Priority 3>** (`roadmap/plans/YYYY-MM-DD_slug`, <DRAFT/APPROVED>) — <one-sentence description>

## Blocked

- **<Blocked item 1>** — Blocked on `<reason or upstream>`.
- **<Blocked item 2>** — Blocked on `<reason or upstream>`.

## Recent Wins

- **<Win 1>** (<Project>/history/<YYYY-MM>/history-YYYY-MM-DD). <one-sentence description>.
- **<Win 2>** (<Project>/history/<YYYY-MM>/history-YYYY-MM-DD). <one-sentence description>.
- **<Win 3>** (<Project>/history/<YYYY-MM>/history-YYYY-MM-DD). <one-sentence description>.

## Major Risks

- **<Risk 1>** — <one-sentence description and current mitigation>.
- **<Risk 2>** — <one-sentence description and current mitigation>.

## Stale Docs

> Run `node <skill_dir>/scripts/check-pm.mjs --project <ProjectName>` and paste the stale-doc summary here, or replace this section with the latest run. (v1.3.0+ resolves `projects.json` from `~/.config/project-management/projects.json` by default.) Notes with `last_reviewed` more than 30 days old are flagged as stale; more than 90 days as very-stale.

## Relevant Decisions

- `[[<ProjectPath>/decisions/D-NNN_<type>_slug|D-NNN <title>]]`
- `[[<ProjectPath>/decisions/D-NNN_<type>_slug|D-NNN <title>]]`

## Relevant Features

- `[[<ProjectPath>/features/<feature>|<feature>]]`
- `[[<ProjectPath>/features/<feature>|<feature>]]`

## Navigation

- [[<ProjectPath>/<Project>|Back to <Project>]]
- [[<ProjectPath>/README|README]]
- [[<ProjectPath>/roadmap/done-pending|roadmap/done-pending]]
- [[Projects/Projects|Back to Projects]]
- [[Home|Back to Home]]
