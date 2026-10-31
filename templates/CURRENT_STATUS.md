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

> **First thing a new agent should read.** This is a bounded snapshot, not an activity feed. Refresh it before history only when phase, top priorities, or current blockers change; declare that event with `check-pm-closeout.mjs --priority-change`. Keep full implementation evidence and commit references in history and, when useful, the owning plan. Do not add dated implementation H2s. The active milestone is derived from `## Current Phase` and changes only for milestone scope/priority/step/exit-criteria events. For completed work, see `history/`; for open execution, see `roadmap/done-pending.md`; for durable behavior, see `system/` and `features/`.

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

- **<Win 1>** (<Project>/history/YYYY/<Month>/history-YYYY-MM-DD). <one-sentence description>.
- **<Win 2>** (<Project>/history/YYYY/<Month>/history-YYYY-MM-DD). <one-sentence description>.
- **<Win 3>** (<Project>/history/YYYY/<Month>/history-YYYY-MM-DD). <one-sentence description>.

## Major Risks

- **<Risk 1>** — <one-sentence description and current mitigation>.
- **<Risk 2>** — <one-sentence description and current mitigation>.

## Stale Docs

> Run `node <skill_dir>/scripts/check-pm.mjs --project <ProjectName>` and record only the current live-doc summary. Historical history/archive records, terminal plans/decisions, and planning evidence are excluded. Live roadmap/inbox notes default to 30-day review, docs/features/system to 60 days, and decisions to 90 days.

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
