---
title: <Project Name> — Project Docs
aliases: [<Project README>, <Project> project docs]
tags:
  - <project>
  - docs
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
last_reviewed: <YYYY-MM-DD>
pageType: index
status: active
owner: PM
---
# <Project Name> — Project Docs

**Start here.** This README is the source of truth for where <Project> project notes, PM logs, system docs, and product docs should be written.

## Contents

- [[#What Goes Where]]
- [[#Folder Structure]]
- [[#Quick Rules]]
- [[#Live PM Folder Rule]]
- [[#Planning Convention]]
- [[#Naming Conventions]]
- [[#Update Frequency]]
- [[#Navigation Context]]

## What Goes Where

| File / Folder | Scope | What to write there |
|---|---|---|
| `PRODUCT.md` | Product | Product vision, target users, core loop, current product shape, principles, boundaries, future goals |
| `system/` | Current state | Current architecture, auth, database, runtime, integrations, deployment, behavior |
| `docs/` | User/admin/dev docs | User manual, admin guide, developer guide, quick commands |
| `roadmap/` | Future and active PM state | MVP priorities, known issues, planning-note mirrored done/pending status, lightweight general done/pending, ideas |
| `planning/` | Concrete plans and decisions | Implementation plans, architecture decisions, design strategies not fully shipped yet |
| `planning/decisions/` | Architecture Decision Records | ADRs — short records of why a decision was made |
| `features/` | Curated per-feature pages | "Tell me everything about feature X" — points into system/ and planning/ |
| `history/` | Completed work | Chronological daily logs of shipped changes, fixes, decisions, archive events |
| `archive/` | Superseded material | Old docs and plans replaced by current product, system, roadmap, or planning docs |
| `CURRENT_STATUS.md` | Weekly snapshot | Top priorities, blocked, recent wins, major risks, stale docs |

## Folder Structure

```text
<Project>/
├── CURRENT_STATUS.md
├── <Project>.md (or <ProjectName>.md)
├── PRODUCT.md
├── README.md
├── archive/
│   └── archive.md
├── docs/
│   ├── docs.md
│   ├── Admin Guide/
│   ├── Developer Guide/
│   ├── Quick Commands/
│   └── User Guide/
├── features/
│   ├── features.md
│   └── <feature>.md
├── history/
│   ├── history.md
│   └── HISTORY-YYYY-MM-DD.md
├── planning/
│   ├── planning.md
│   ├── decisions/
│   │   ├── decisions.md
│   │   └── ADR-NNN_slug.md
│   └── YYYY-MM-DD_slug.md
├── roadmap/
│   ├── roadmap.md
│   ├── mvp-priorities.md
│   ├── known-issues.md
│   ├── done-pending.md
│   └── ideas.md
├── scripts/
│   ├── check-stale-docs.mjs
│   └── check-vault-structure.mjs
└── system/
    ├── system.md
    └── <topic>.md
```

## Quick Rules

| What happened | Where to log |
|---|---|
| Current behavior, architecture, data flow, runtime, auth, database, integration, or deployment changed | Relevant `system/` doc first, then `history/HISTORY-YYYY-MM-DD.md` |
| User-facing behavior changed | Relevant `docs/User Guide/`, relevant `system/` doc, roadmap status if applicable, then `history/` |
| Admin or developer workflow changed | Relevant `docs/Admin Guide/`, `docs/Developer Guide/`, or `docs/Quick Commands/`, then `history/` |
| New concrete plan or decision not fully implemented | `planning/YYYY-MM-DD_slug.md`, then add/update a matching `## YYYY-MM-DD_slug` section in `roadmap/done-pending.md` |
| Significant architecture decision made | New `ADR-NNN` in `planning/decisions/` (see `templates/ADR.md`) |
| New feature enters design phase (coherent user-facing capability) | Create `features/<feature>.md` (from `templates/feature.md`); link to relevant `system/` and `planning/` docs |
| Feature's scope, availability, or known issues changed | Update the matching `features/<feature>.md` (not just the system/ doc it points to) |
| Bug or risk found | `roadmap/known-issues.md` |
| New idea or declined proposal | `roadmap/ideas.md` |
| Roadmap item completed | Mark the relevant roadmap item done and add a brief `history/` entry |
| Entire `roadmap/done-pending.md` section completed | Distill durable behavior into `system/`, `docs/`, or `PRODUCT.md`, then archive the completed section; if it mirrors a completed planning file, archive that planning file too |
| Product positioning or target user changed | `PRODUCT.md`, then `history/` |

**When to write a feature page** (vs only a `system/` doc): if it's a coherent user-facing capability an agent could ask "tell me about X" end-to-end, write a `features/<feature>.md`. If it's a technical component (auth, runtime, multi-tenancy) that informs multiple features, keep it in `system/` only and let feature pages link to it. See `templates/feature.md` for the page shape and `templates/features.md` "When to add a feature page" for the full decision rule.

## Live PM Folder Rule

The management folders are live. Agents may create notes in existing folders when needed, but must use the right lane and update folder indexes in the same session.

Ask before creating root notes, new roadmap notes, new top-level folders, or new docs guide categories.

## Planning Convention

Planning notes use **date-prefixed filenames** at creation time: `planning/YYYY-MM-DD_slug.md` (the date is the file's `created:` frontmatter date). The numbered `NN_slug.md` convention is deprecated.

- H1 of each planning note is the slug only (no number, no date prefix): `# initial-decisions` (not `# 01_initial-decisions` or `# 2026-05-22_initial-decisions`).
- When archiving: `mv planning/YYYY-MM-DD_slug.md archive/<slug>-archived.md` (drop the date prefix; preserve the slug; append `-archived`). Add an `archived: <date>` field to the frontmatter; keep the original `created:` field.
- Update `planning/planning.md`, `archive/archive.md`, `roadmap/done-pending.md`, the moved note's `## Navigation`, and every wiki link that points to the old planning filename.
- No renumbering. Active planning notes keep their original date-prefixed filenames; archive numbers are historical and do not need to be consecutive.

## Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Folders | lowercase or clear title-case guide folders | `history/`, `User Guide/` |
| Key root docs | uppercase or title-case | `README.md`, `PRODUCT.md`, `CURRENT_STATUS.md` |
| Section docs (system/) | slug (no prefix; `created:` frontmatter carries the date) | `architecture.md` |
| Date-stamped logs | `HISTORY-YYYY-MM-DD.md` | `HISTORY-2026-06-04.md` |
| Planning notes | `YYYY-MM-DD_slug.md` (date prefix) | `2026-05-24_<planning-slug>.md` |
| ADRs | `ADR-NNN_slug.md` (numbered within decisions/) | `ADR-001_<decision-slug>.md` |
| Archived files | `<slug>-archived.md` (date prefix and number dropped) | `m3-return-path-archived.md` |

## Update Frequency

- `system/`: update immediately when current architecture, data flow, runtime behavior, database, auth, integrations, or deployment changes.
- `docs/`: update in the same session as user/admin/developer workflow changes.
- `roadmap/`: update when pending/done/known issue status changes or a new idea enters the backlog.
- `planning/`: update when a plan, architecture decision, or implementation strategy is created or revised before fully shipped.
- `planning/decisions/`: add a new ADR when a significant architecture decision is made. Update existing ADRs if their assumptions change.
- `features/`: update when a feature's current behavior, known issues, or roadmap changes.
- `history/`: update last with brief chronological bullets after meaningful work is finished.
- `CURRENT_STATUS.md` (at root): update weekly with the current snapshot — top priorities, blocked, recent wins, major risks, stale docs. PM agent maintains.
- `README.md`: update when folder structure or logging rules change.

## Navigation Context

| Anchor | Link |
|---|---|
| Project root | `[[Projects/<Project>/<Project>\|<Project>]]` |
| Parent collection | `[[Projects/Projects\|Back to Projects]]` |
| Vault home | `[[Home\|Back to Home]]` |

<!-- Adapt the vault-anchor links (Projects/Projects, Home) to your vault's structure. If your project lives in a different folder hierarchy, replace these with the appropriate anchors for your setup. -->

## Navigation

- [[Projects/<Project>/<Project>|Back to <Project>]]
- [[Projects/Projects|Back to Projects]]
- [[Home|Back to Home]]
