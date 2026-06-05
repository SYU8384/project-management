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
- [[#Naming Conventions]]
- [[#Update Frequency]]
- [[#Conventions by Page Type]]
- [[#Navigation Context]]

## What Goes Where

| File / Folder | Scope | What to write there |
|---|---|---|
| `PRODUCT.md` | Product | Product vision, target users, core loop, current product shape, principles, boundaries, future goals |
| `system/` | Current state | Current architecture, auth, database, runtime, integrations, deployment, behavior |
| `docs/User Guide/` | End-user docs | User manual, FAQ, and product reference notes |
| `docs/Admin Guide/` | Admin/operator docs | Live product operations: support, feedback, admin panel workflows, monitoring, statistics, background job runs, access, incident response, production verification, and data repair |
| `docs/Developer Guide/` | Developer docs | Coding-engineer workflows: local setup, codebase structure, testing, APIs, schemas, migrations, prompts, implementation notes, changing jobs, release mechanics, contribution workflow, and `known-bugs.md` |
| `docs/Quick Commands/` | Command recipes | Copy-pasteable commands; longer explanation belongs in Admin or Developer Guide |
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
│   │   └── Admin Guide.md
│   ├── Developer Guide/
│   │   ├── Developer Guide.md
│   │   └── known-bugs.md
│   ├── Quick Commands/
│   │   └── Quick Commands.md
│   └── User Guide/
│       └── User Guide.md
├── features/
│   ├── features.md
│   └── <feature>.md
├── history/
│   ├── history.md
│   └── YYYY-MM/
│       ├── YYYY-MM.md
│       └── history-YYYY-MM-DD.md
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
| Current behavior, architecture, data flow, runtime, auth, database, integration, or deployment changed | Relevant `system/` doc first, then `history/YYYY-MM/history-YYYY-MM-DD.md` |
| User-facing behavior or UX changed | Relevant `docs/User Guide/`, relevant `system/` doc, affected `features/<feature>.md`, roadmap status if applicable, then `history/` |
| Admin/operator workflow changed (support, feedback, admin panel, monitoring, statistics, background job run, access, incident response, data repair) | Relevant `docs/Admin Guide/`, useful commands in `docs/Quick Commands/`, then `history/` |
| Coding-engineer workflow changed (local setup, code structure, API, schema, prompt, test, migration, build, release, job implementation) | Relevant `docs/Developer Guide/`, useful commands in `docs/Quick Commands/`, then `history/` |
| Engineering bug found, fixed, recurring, or debugged | `roadmap/known-issues.md` for active tracking, `docs/Developer Guide/known-bugs.md` for root cause/solution/verification, then `history/` when fixed |
| New concrete plan or decision not fully implemented | `planning/YYYY-MM-DD_slug.md`, then add/update a matching `## YYYY-MM-DD_slug` section in `roadmap/done-pending.md` |
| Significant architecture decision made | New `ADR-NNN` in `planning/decisions/` (see `templates/ADR.md`) |
| New feature enters design phase (coherent user-facing capability) | Create `features/<feature>.md` (from `templates/feature.md`); link to relevant `system/` and `planning/` docs |
| Feature's scope, availability, or known issues changed | Update the matching `features/<feature>.md` (not just the system/ doc it points to) |
| Bug, risk, or blocker found or changed status | `roadmap/known-issues.md` |
| New idea or declined proposal | `roadmap/ideas.md` |
| Roadmap item completed | Mark the relevant roadmap item done and add a brief `history/` entry |
| Entire `roadmap/done-pending.md` section completed | Distill durable behavior into `system/`, `docs/`, or `PRODUCT.md`, then archive the completed section; if it mirrors a completed planning file, archive that planning file too |
| Product positioning or target user changed | `PRODUCT.md`, then `history/` |

**When to write a feature page** (vs only a `system/` doc): if it's a coherent user-facing capability an agent could ask "tell me about X" end-to-end, write a `features/<feature>.md`. If it's a technical component (auth, runtime, multi-tenancy) that informs multiple features, keep it in `system/` only and let feature pages link to it. Full decision rule, body shape, and frontmatter fields in [Conventions by Page Type → Feature pages](#feature-pages-featuresfeaturemd).

## Live PM Folder Rule

The management folders are live. Agents may create notes in existing folders when needed, but must use the right lane and update folder indexes in the same session. Every visible PM folder has a matching folder note; hidden dot-folders used by sync/tooling are ignored.

Ask before creating root notes, new roadmap notes, new top-level folders, or new docs guide categories.

## Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Top-level PM lanes | lowercase, no spaces | `archive/`, `history/`, `system/` |
| Docs guide folders | Title Case category labels | `Admin Guide/`, `Quick Commands/` |
| Folder notes | exactly match the folder name | `Admin Guide/Admin Guide.md`, `history/history.md` |
| Content notes | lowercase slug, no numeric prefix | `architecture.md`, `background-jobs.md` |
| Root canonical docs | uppercase special files | `README.md`, `PRODUCT.md`, `CURRENT_STATUS.md` |
| Docs guide notes | lowercase slug, no numeric prefix | `user-manual.md`, `cloudflare-tunnel.md` |
| Date-stamped logs | `YYYY-MM/history-YYYY-MM-DD.md` (organized by year-month) | `2026-06/history-2026-06-04.md` |
| Planning notes | `YYYY-MM-DD_slug.md` (date prefix) | `2026-05-24_<planning-slug>.md` |
| ADRs | `ADR-NNN_slug.md` (numbered within decisions/) | `ADR-001_<decision-slug>.md` |
| Archived files | `<slug>-archived.md` (date prefix and number dropped) | `m3-return-path-archived.md` |

## Update Frequency

- `system/`: update immediately when current architecture, data flow, runtime behavior, database, auth, integrations, or deployment changes.
- `docs/`: update in the same session as user/admin/developer workflow changes. `docs/Developer Guide/known-bugs.md` is required and tracks engineering bug knowledge, active or fixed.
- `roadmap/`: update when pending/done/known issue status changes or a new idea enters the backlog.
- `planning/`: update when a plan, architecture decision, or implementation strategy is created or revised before fully shipped.
- `planning/decisions/`: add a new ADR when a significant architecture decision is made. Update existing ADRs if their assumptions change.
- `features/`: update when a feature's current behavior, known issues, or roadmap changes.
- `history/`: update last with brief chronological bullets after meaningful work is finished. New month folders must include `YYYY-MM/YYYY-MM.md` and be linked from `history/history.md`.
- `CURRENT_STATUS.md` (at root): update weekly with the current snapshot — top priorities, blocked, recent wins, major risks, stale docs. PM agent maintains.
- `README.md`: update when folder structure or logging rules change.

## Conventions by Page Type

Quick reference for how each page type is written. Detailed body shape lives in the per-type page template (see `templates/`). Folder notes (e.g., `planning/planning.md`, `features/features.md`, `history/2026-06/2026-06.md`) follow the universal shape in `templates/folder-note.md` — they hold the index block, not the conventions.

### Docs guide notes (`docs/<Guide>/<slug>.md`)

- **Folder notes:** `Admin Guide.md`, `Developer Guide.md`, `Quick Commands.md`, and `User Guide.md` are indexes only. Do not put manual, runbook, FAQ, command, or reference content in guide folder notes.
- **User Guide:** use independent notes such as `user-manual.md`, `faq.md`, and `reference.md` when the project has shipped user-facing behavior.
- **Admin Guide:** live product operations for admins/operators: support and feedback triage, admin panel workflows, monitoring, statistics, background job runs, access, incident response, production verification, and data repair. Operational commands are fine; source-code modification workflows are not.
- **Developer Guide:** coding-engineer workflows: local setup, codebase structure, testing, APIs, schemas, migrations, prompts, implementation notes, adding/changing jobs, release mechanics, contribution workflow, and `known-bugs.md`.
- **Known bugs:** `docs/Developer Guide/known-bugs.md` is the required engineering bug knowledge base. Keep active tracking in `roadmap/known-issues.md`, but record symptoms, root cause, solution, verification, recurrence patterns, and history links in `known-bugs.md`.
- **Quick Commands:** copy-pasteable commands only; link to Admin or Developer Guide when explanation is needed.
- **Renames:** legacy numbered filenames like `01_USER_MANUAL.md` are deprecated. Rename to lowercase slugs and update all wiki links.

### Roadmap notes (`roadmap/*.md`)

- **Ideas:** follow `templates/ideas.md`: `## Contents`, `## Status Key`, `## Idea Register`, five status buckets, `## Idea Details`, and `## Navigation`. Use stable IDs such as `IDEA-001`; do not rely on list position for identity.
- **Known issues:** follow `templates/known-issues.md`: `## Contents`, `## Active`, `## Fixed`, `## Deferred`, and `## Navigation`. Domain-specific grouping belongs under those sections as labels or `###` subsections.
- **MVP priorities:** follow `templates/mvp-priorities.md`: `## Contents`, `## Alpha Goal`, `## MVP Priorities`, `## Not Yet MVP`, and `## Navigation`.
- **Done/pending:** follow `templates/done-pending.md`: `## Contents`, planning-note mirrored sections, `## General Done/Pending Without Dedicated Planning Note`, and `## Navigation`.
- **Routing:** rough ideas stay in `ideas.md`; approved concrete work gets a planning note and a `done-pending.md` section; active bugs and risks stay in `known-issues.md`; engineering bug root causes and fixes are mirrored in `docs/Developer Guide/known-bugs.md`.

### Planning notes (`planning/YYYY-MM-DD_slug.md`)

- **Filename:** `YYYY-MM-DD_slug.md` (date prefix from `created:` frontmatter). The numbered `NN_slug.md` convention is deprecated; do not renumber active notes when adopting this scheme.
- **H1:** slug only, no number, no date prefix — `# initial-decisions`, not `# 01_initial-decisions` or `# 2026-05-22_initial-decisions`.
- **Status values:** `proposed` (under discussion, not yet approved), `active` (in flight), `shipped` (work done, file kept for historical reference), `rejected` (proposal declined), `superseded` (replaced by a newer plan or ADR). These are planning-specific; the global schema documents them in `SKILL.md` "Frontmatter Schema → Planning".
- **`archived:` field:** when a planning file moves to `archive/`, set `archived: <date>` (the move date) in the frontmatter; keep the original `created:` field. `status:` and `archived:` are **orthogonal** — a shipped-then-archived plan keeps `status: shipped`; a rejected-then-archived plan keeps `status: rejected`; a superseded-then-archived plan keeps `status: superseded`.
- **Archive rename:** when retiring, `mv planning/YYYY-MM-DD_slug.md archive/<slug>-archived.md` (drop the date prefix, preserve the slug, append `-archived`). Then update `planning/planning.md`, `archive/archive.md`, `roadmap/done-pending.md`, the moved note's `## Navigation`, and every wiki link that points to the old planning filename.
- **Owner:** typically `PM`. Use `Platform team` or `Operator` for plans owned by another team.
- **Cross-link:** when a planning note is approved, add a `## YYYY-MM-DD_slug` section to `roadmap/done-pending.md` with the planning note link. When it ships, distill durable current truth into `system/` and archive the file.

### Feature pages (`features/<feature>.md`)

- **When to add:** a coherent user-facing capability (chat, memory, email) or a coherent technical pillar (runtime, isolation) that has accumulated enough cross-cutting context to need a "tell me everything about X" entry point. Not for every system/ doc — only for things with cross-cutting context. Most system/ docs are best surfaced via the `system/` index alone.
- **Body sections:** Status (alpha/beta/stable/deprecated), Current Behavior, Known Issues, Roadmap, Relevant ADRs, Source of Truth.
- **Frontmatter fields:** `pageType: feature`, `status`, `owner`, `source_of_truth` (path to the system/ doc that is canonical for this feature), `roadmap_source` (path to the relevant roadmap section).
- **Don't duplicate content:** feature pages *point* to system/ and planning/; they don't *replace* them. If a system/ doc changes, the feature page's `source_of_truth` link is still valid; no edit needed unless the feature itself changes.

### ADRs (`planning/decisions/ADR-NNN_slug.md`)

- **Status values:** `proposed`, `accepted`, `deprecated`, `superseded`. When this ADR supersedes another, set the new ADR's `supersedes:` field to the prior ADR id; the prior ADR's status moves to `Superseded by` and the date is recorded in its body. ADRs are not for tactical implementation details (those go in planning notes) or runtime configuration (those go in `system/`).
- **When to write:** a significant architecture decision affecting multiple parts of the system, a non-obvious choice (e.g., why Supabase over Clerk; why LCM over native summarization), or a "why" that won't be obvious six months later.
- **Body shape:** detailed sections in `templates/ADR.md` (single-page template; ADR is not a folder note, so its body shape is documented in the page template, not in this README).

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
