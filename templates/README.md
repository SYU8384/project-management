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
- [[#Link and Secret Hygiene]]
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
| `roadmap/` | Future and active PM state | Milestones, known issues, planning-note mirrored done/pending status, lightweight general done/pending, ideas, and scoped plans under `roadmap/plans/` |
| `roadmap/milestones/` | Milestones | Agent-maintained phase-level strategy, priorities, major steps, exit criteria, update triggers, inline evidence links, and deferred scope |
| `roadmap/plans/` | Concrete plans | Implementation plans and design strategies not fully shipped yet. Mirrored into `roadmap/done-pending.md` when in flight, with near-top plan-side `## Related` links back to the mirror |
| `decisions/` | Decision log (first-class PM lane at the project root) | Typed records of decisions *made* across architecture, product, market, vendor, policy, rejection, and experiment types |
| `features/` | Curated per-feature pages | "Tell me everything about feature X" — points into system/, decisions/, and roadmap/plans/ |
| `inbox/` | Raw intake | Owner/collaborator raw notes before triage. Not a backlog; digested items move to canonical lanes |
| `history/` | Completed work | Chronological daily logs of shipped changes, fixes, decisions, archive events |
| `archive/` | Superseded material | Old docs and plans replaced by current product, system, roadmap, or `roadmap/plans/` and `decisions/` docs |
| `CURRENT_STATUS.md` | Current snapshot | Top priorities, blocked, recent wins, major risks, stale docs. Refresh whenever priority-bearing roadmap, decision, feature, issue, or milestone state changes |

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
├── inbox/
│   ├── inbox.md
│   └── YYYY-MM-DD_<name>_<title>.md
├── decisions/
│   ├── decisions.md
│   └── D-NNN_<type>_slug.md
├── roadmap/
│   ├── roadmap.md
│   ├── milestones/
│   │   ├── milestones.md
│   │   └── mvp.md / alpha.md / beta.md / launch.md
│   ├── known-issues.md
│   ├── done-pending.md
│   ├── ideas.md
│   └── plans/
│       ├── plans.md
│       └── YYYY-MM-DD_slug.md
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
| New concrete plan or decision not fully implemented | `roadmap/plans/YYYY-MM-DD_slug.md`, then add/update a matching slug-only section in `roadmap/done-pending.md` and keep the plan's near-top `## Related` linked back to that section |
| Significant decision made (architecture, product, market, vendor, policy, rejection, experiment) | New `D-NNN_<type>_<slug>.md` in `decisions/` (see `templates/decision.md`) |
| New feature enters design phase (coherent user-facing capability) | Create `features/<feature>.md` (from `templates/feature.md`); link to relevant `system/`, `roadmap/plans/`, and `decisions/` docs |
| Feature's scope, availability, or known issues changed | Update the matching `features/<feature>.md` (not just the system/ doc it points to) |
| Raw owner/collaborator idea, request, or discussion note needs capture before triage | `inbox/YYYY-MM-DD_<name>_<title>.md`; use `NAME_PLACEHOLDER` when no creator name is provided |
| Bug, risk, or blocker found or changed status | `roadmap/known-issues.md` |
| New idea or declined proposal | `roadmap/ideas.md` |
| Roadmap item completed | Mark the relevant roadmap item done and add a brief `history/` entry |
| Entire `roadmap/done-pending.md` planning mirror implemented and user-approved for archival | Mark the human archive-confirmation checkbox done, distill durable behavior into `system/`, `docs/`, or `PRODUCT.md`, then archive the completed section and linked planning file |
| Meaningful code work finished in an authoritative repo | Run `check-pm-closeout.mjs` if available; otherwise inspect the diff and confirm current-state docs plus history were updated, or record a no-impact reason |
| Product positioning or target user changed | `PRODUCT.md`, then `history/` |
| Credential, token, API key, recovery code, or private connection detail appears in notes | Redact it from PM notes. Keep only account purpose/status and where credentials live outside the PM folder |

**When to write a feature page** (vs only a `system/` doc): if it's a coherent user-facing capability an agent could ask "tell me about X" end-to-end, write a `features/<feature>.md`. If it's a technical component (auth, runtime, multi-tenancy) that informs multiple features, keep it in `system/` only and let feature pages link to it. Full decision rule, body shape, and frontmatter fields in [Conventions by Page Type → Feature pages](#feature-pages-featuresfeaturemd).

## Live PM Folder Rule

The management folders are live. Agents may create notes in existing folders when needed, but must use the right lane and update folder indexes in the same session. Every visible PM folder has a matching folder note; hidden dot-folders used by sync/tooling are ignored.

Ask before creating root notes, new roadmap notes, new top-level folders, or new docs guide categories.

**Always safe (no ask needed):**

- Editing existing notes in any lane (system/, docs/, features/, history/, decisions/, roadmap/).
- Adding notes to existing folders that already have a folder note (e.g., creating a new `system/<topic>.md` if `system/system.md` exists).
- Adding raw intake notes to `inbox/` using the inbox filename/frontmatter convention.
- Adding `history/YYYY-MM/history-YYYY-MM-DD.md` entries when `history/YYYY-MM/YYYY-MM.md` already exists.
- Adding notes to optional lanes that already exist (`meetings/`, custom docs categories, etc.).
- Creating or refreshing the active `roadmap/milestones/<phase>.md` note derived from `CURRENT_STATUS.md` or `projects.json`.
- Creating migration ledger entries in `.pm/` via the migration runner.

**Ask before:**

- Creating root notes (`<Project>.md`, new entries to root).
- Creating new roadmap notes outside the standard set (`roadmap/known-issues.md`, `roadmap/ideas.md`, `roadmap/done-pending.md`, and the active milestone note under `roadmap/milestones/`), or inventing future milestone notes from ambiguous prose.
- Creating a new top-level folder under the project root.
- Creating a new docs guide category (`docs/<NewGuide>/`).
- Creating new root files beyond the standard set.

For the full permission policy matrix, see `REFERENCE.md` → "Permission Policy".

## Link and Secret Hygiene

- Live notes outside `history/` and `archive/` use current lanes: `roadmap/plans/`, root `decisions/`, and `Relevant decisions:`.
- Do not write live instructions that point agents to retired lanes. Run `check-live-routing.mjs --fix` after PM cleanup or migration work.
- Feature frontmatter (`source_of_truth`, `roadmap_source`, `related`) and feature body references should point to existing notes. Prefer wikilinks in the body so Obsidian and validators can catch drift.
- PM notes do not store plaintext passwords, tokens, API keys, private keys, recovery codes, or credential-bearing URLs. Document the account purpose/status and the external credential location instead.

## Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Top-level PM lanes | lowercase, no spaces | `archive/`, `history/`, `inbox/`, `system/` |
| Docs guide folders | Title Case category labels | `Admin Guide/`, `Quick Commands/` |
| Folder notes | exactly match the folder name | `Admin Guide/Admin Guide.md`, `history/history.md` |
| Content notes | neutral lowercase kebab-case slug, no numeric prefix | `architecture.md`, `background-jobs.md` |
| Root canonical docs | uppercase special files | `README.md`, `PRODUCT.md`, `CURRENT_STATUS.md` |
| Docs guide notes | neutral lowercase kebab-case slug, no numeric prefix | `user-manual.md`, `cloudflare-tunnel.md` |
| Date-stamped logs | `YYYY-MM/history-YYYY-MM-DD.md` (organized by year-month) | `2026-06/history-2026-06-04.md` |
| Planning notes | `YYYY-MM-DD_slug.md` (date prefix) | `2026-05-24_<planning-slug>.md` |
| Decisions | `D-NNN_<type>_<slug>.md` (numbered globally, typed) | `D-001_ADR_tauri-opencode.md` |
| Meeting records | `YYYY-MM-DD_<topic-slug>.md` (optional lane) | `2026-06-10_openclaw-pm-onboarding.md` |
| Inbox notes | `YYYY-MM-DD_<name>_<title>.md` | `2026-06-23_NAME_PLACEHOLDER_raw-idea.md` |
| Archived files | `<slug>-archived.md` (date prefix and number dropped) | `m3-return-path-archived.md` |

## Update Frequency

- `system/`: update immediately when current architecture, data flow, runtime behavior, database, auth, integrations, or deployment changes.
- `docs/`: update in the same session as user/admin/developer workflow changes. `docs/Developer Guide/known-bugs.md` is required and tracks engineering bug knowledge, active or fixed.
- `roadmap/`: update when pending/done/known issue status changes or a new idea enters the backlog.
- `inbox/`: create raw notes on request before triage; update note frontmatter when the owner processes or rejects the note.
- `roadmap/milestones/`: agents create and refresh the active milestone note before history whenever phase, priority, plan, done-pending mirror, decision, feature, known issue, blocker, or risk state changes. If no prose changes after review, refresh `updated` and `last_reviewed`.
- `roadmap/plans/`: update when a plan or implementation strategy is created or revised before fully shipped.
- `decisions/`: add a new typed decision (`ADR / PRD / MKT / VND / POL / NEG / EXP`) when a significant decision is made. Update existing decisions only via `supersedes:` chains — do not edit an `accepted` decision's body to re-litigate it.
- `features/`: update when a feature's current behavior, known issues, or roadmap changes.
- `history/`: update last with outcome-first bullets after meaningful work is finished. Each bullet starts with a bold human-readable sentence, then includes a concise conventional type/scope token and implementation detail. New month folders must include `YYYY-MM/YYYY-MM.md` and be linked from `history/history.md`.
- `CURRENT_STATUS.md` (at root): update with the current snapshot — top priorities, blocked, recent wins, major risks, stale docs. PM agent maintains it and refreshes it before history whenever priorities, blockers, risks, wins, plans, decisions, features, known issues, phase, or milestone state change.
- `README.md`: update when folder structure, live routing, link hygiene, secret-handling rules, or logging rules change.

## Conventions by Page Type

Quick reference for how each page type is written. Detailed body shape lives in the per-type page template (see `templates/`). Folder notes (e.g., `roadmap/plans/plans.md`, `decisions/decisions.md`, `features/features.md`, `history/2026-06/2026-06.md`) follow the universal shape in `templates/folder-note.md` and may include a `## Conventions` block stating the rules that apply to that lane inline.

### Docs guide notes (`docs/<Guide>/<slug>.md`)

- **Folder notes:** `Admin Guide.md`, `Developer Guide.md`, `Quick Commands.md`, and `User Guide.md` are indexes only. Do not put manual, runbook, FAQ, command, or reference content in guide folder notes.
- **User Guide:** use independent notes such as `user-manual.md`, `faq.md`, and `reference.md` when the project has shipped user-facing behavior.
- **Admin Guide:** live product operations for admins/operators: support and feedback triage, admin panel workflows, monitoring, statistics, background job runs, access, incident response, production verification, and data repair. Operational commands are fine; source-code modification workflows are not.
- **Developer Guide:** coding-engineer workflows: local setup, codebase structure, testing, APIs, schemas, migrations, prompts, implementation notes, adding/changing jobs, release mechanics, contribution workflow, and `known-bugs.md`.
- **Known bugs:** `docs/Developer Guide/known-bugs.md` is the required engineering bug knowledge base. Keep active tracking in `roadmap/known-issues.md`, but record symptoms, root cause, solution, verification, recurrence patterns, and history links in `known-bugs.md`. Entries must follow the D-011 per-section field shape; `--fix` can add missing sections, move entries by explicit status, and add missing field labels as `TBD`. TBD/placeholder fields are MANUAL REVIEW.
- **Quick Commands:** copy-pasteable commands only; link to Admin or Developer Guide when explanation is needed.
- **Renames:** legacy numbered filenames like `01_USER_MANUAL.md` are deprecated. Rename to lowercase slugs and update all wiki links.
- **Personal prefixes:** collaborator-name prefixes such as `haoyou_` are discouraged in canonical PM folders. They may be useful during handoff, but validators report them as warnings so they can be renamed to neutral lowercase kebab-case slugs later.

### Roadmap notes (`roadmap/*.md`)

- **Ideas:** follow `templates/ideas.md`: `## Contents`, `## Status Key` (with the color-coded status scheme — see "Status color scheme" below), `## Idea Register` (4-column table with colored status in the Status column), five status buckets (`## Brainstorming` / `## Scoping` / `## Approved` / `## Implemented` / `## Declined`), `## Idea Details` (one section per idea with `**Summary:**`, a colored Status line, owner/next step, value, open questions, and links), and `## Navigation`. Use stable IDs such as `IDEA-001`; do not rely on list position for identity. Summary is a 2-4 sentence human-readable description; auto-fix inserts `TBD` and the maintainer supplies the prose.
- **Known issues:** follow `templates/known-issues.md` (OpenManager format). Two top-level sections: `## Active` (with the lead paragraph describing the domain-grouped convention and the migration rule), `## Deferred`. **There is no `## Fixed` section** — fixed items are migrated to `docs/Developer Guide/known-bugs.md` and removed from this file. A `### <Domain>` section that becomes fully fixed (no remaining active items) is archived to `archive/known-issues-<domain>-archived.md` per the planning-note archive convention (drop the date prefix, preserve the domain slug, append `-archived`). Each section is grouped by `### <Domain>` H3 subsections (e.g., `### Migrations`, `### Validators`, `### AGENTS.md integration`, `### CLI surface`, `### Documentation`). Each item uses one of the OpenManager checkbox formats:
  - `- [ ] **PENDING (YYYY-MM-DD):** <description>.` — active items.
  - `- [ ] **PENDING:** <description>.` — active items without a date.
  - `- [ ] **DEFERRED:** <description>.` — deferred items.

  The active `### <Domain>` subsections can be named with a `(YYYY-MM-DD_slug)` suffix when the items belong to a specific planning note (e.g., `### Sidebar Nav Card (2026-06-03_chat-as-continuous-tab Task 1.2)`). Active items are mirrored to `docs/Developer Guide/known-bugs.md` with engineering root-cause/solution/verification shape. The format convention is adopted in `decisions/D-009_POL_known-issues-format.md` (which also records the lifecycle rule). The engineering mirror shape is adopted in `decisions/D-011_POL_known-bugs-shape.md`.
- **Milestones:** follow `templates/milestone.md` for each phase or launch checkpoint under `roadmap/milestones/`. Required sections are `## Goal`, `## Priorities`, `## Major Steps`, `## Exit Criteria`, `## Deferred`, `## Update Triggers`, and `## Navigation`. Milestone notes are agent-maintained phase-level strategy and priority records; concrete implementation checklists belong in `roadmap/plans/` and `roadmap/done-pending.md`. Specific supporting plans, done-pending sections, decisions, feature notes, known issues, and docs are linked inline inside the priority, major step, exit criterion, or deferred item they support; generic folder/index links belong in `## Navigation` or folder-note indexes, not a `## Related Notes` section. The active milestone comes from `CURRENT_STATUS.md` `## Current Phase` (fallback: `projects.json` phase), and agents create it automatically if missing.
- **Done/pending:** follow `templates/done-pending.md`. The file holds two kinds of entries: (a) **planning-note mirrors** — one H2 per active or proposed planning note from `roadmap/plans/`, with a linked `Planning note:` line, a DONE/PENDING checklist, the required human archive-confirmation checkbox, and `Relevant decisions:` / `Relevant features:` / optional `Relevant system:` / `Relevant docs:` lines; (b) **general done/pending items** without a dedicated planning note, organized by date. Planning-note mirrors always take priority in the file's order. The H2 for a planning-note mirror is the slug only (e.g., `## v1.5.0 backlog from post-v1.4.1 audit`), not the date-prefixed stem. Contents links are generated from actual H2 headings in this note; they do not point directly to plan files. Active/proposed planning notes link back to the exact mirror section from a near-top `## Related` and repeat the relevant decision/feature/system/docs links already present in the mirror. Use `Relevant decisions:`, not `Relevant ADRs:`.
- **Routing:** milestone priorities stay in `roadmap/milestones/`; rough ideas stay in `ideas.md`; approved concrete work gets a planning note and a `done-pending.md` mirror section; active bugs and risks stay in `known-issues.md`; engineering bug root causes and fixes are mirrored in `docs/Developer Guide/known-bugs.md`.

### Inbox notes (`inbox/YYYY-MM-DD_<name>_<title>.md`)

- **Purpose:** raw owner/collaborator intake before triage. `inbox/` is not a backlog; durable content moves to `roadmap/ideas.md`, `roadmap/plans/`, `roadmap/done-pending.md`, `decisions/`, `system/`, `features/`, docs, or known issues.
- **Frontmatter:** `pageType: note`, `status: unprocessed | processed | rejected`, `author`, `resolution`, and `destination`.
- **Status rules:** `unprocessed` requires `resolution: pending` and `destination: none`; `processed` requires a non-`pending` resolution; `rejected` uses `resolution: no-action` and `destination: none`.
- **Placeholder rule:** when no creator name is provided, agents must use `NAME_PLACEHOLDER` in the filename, title/H1, and `author`, then ask the user what name should replace it.

#### Status color scheme (`ideas.md`)

Each status carries a colored round icon, in three places: the Status Key table, the Idea Register's Status column, and the Idea Details `**Status:**` line. Cross-platform implementation uses the Unicode colored circle emojis (🟣/🟡/🔵/🟢/🔴) which render in any markdown viewer.

| Status | Color | Emoji |
|---|---|---|
| Brainstorming | purple | 🟣 |
| Scoping | yellow | 🟡 |
| Approved | blue | 🔵 |
| Implemented | green | 🟢 |
| Declined | red | 🔴 |

The section headers (`## Brainstorming` / `## Scoping` / etc.) and the per-idea wikilinks in those sections are plain text without emojis; only the Status Key, Register, and Details use the color.

### Planning notes (`roadmap/plans/YYYY-MM-DD_slug.md`)

- **Filename:** `YYYY-MM-DD_slug.md` (date prefix from `created:` frontmatter). The numbered `NN_slug.md` convention is deprecated; do not renumber active notes when adopting this scheme.
- **Opening shape:** do not repeat the filename, slug, or frontmatter title as a body H1. Obsidian/file title is the note title; start with useful content such as `## Summary`, then put `## Related` near the top for quick access.
- **Status values:** five values, all from the planning lifecycle:
  - `proposed` — under discussion, not yet approved
  - `active` — in flight
  - `shipped` — work done, file kept for historical reference
  - `rejected` — proposal declined
  - `superseded` — replaced by a newer plan or decision
- **`archived:` field:** when a planning file moves to `archive/`, set `archived: <date>` (the move date) in the frontmatter; keep the original `created:` field. `status:` and `archived:` are **orthogonal** — a shipped-then-archived plan keeps `status: shipped`; a rejected-then-archived plan keeps `status: rejected`; a superseded-then-archived plan keeps `status: superseded`.
- **Archive indexes:** `archive/archive.md` is a folder index created in place, not moved into archive. It must not have `archived:`.
- **Archive rename:** when retiring, `mv roadmap/plans/YYYY-MM-DD_slug.md archive/<slug>-archived.md` (drop the date prefix, preserve the slug, append `-archived`). This rename is mandatory. Then update `roadmap/plans/plans.md`, `archive/archive.md`, `roadmap/done-pending.md`, the moved note's `## Navigation`, and every wiki link that points to the old planning filename.
- **Owner:** typically `PM`. Use `Platform team` or `Operator` for plans owned by another team.
- **Cross-link:** when a planning note is approved, add a `## <slug>` section (slug only, not the date-prefixed stem) to `roadmap/done-pending.md` with `Planning note: [[<ProjectPath>/roadmap/plans/YYYY-MM-DD_<slug>|YYYY-MM-DD_<slug>]]`, linked relevant notes, the required human archive-confirmation checkbox, and a Contents TOC regenerated from actual H2 headings. Active/proposed planning notes also keep a near-top `## Related` with `Done-pending mirror: [[<ProjectPath>/roadmap/done-pending#<slug>|done-pending#<slug>]]` plus relevant decision/feature/system/docs links copied from the mirror when present. When it ships and the user approves archival, mark the confirmation checkbox done, distill durable current truth into `system/`, and archive the file. The validator accepts both slug-only and date-prefixed H2s for compatibility, and `check-roadmap-conventions.mjs --fix` repairs deterministic TOC/link/plan-side related/opening-shape drift.
- **Decisions cited, not duplicated:** if the plan records a significant decision, write a typed `decisions/D-NNN_<type>_<slug>.md` and link it from the plan's Related section. Do not restate the decision's reasoning in the plan.
- **Superseded-by pattern (D-020).** A newer planning note that absorbs an older planning note's scope is a *parent workstream*. When filed, the parent lists the older plan in `## Related` with the annotation `(superseded-by: this plan; covered by <OMR-id>)`. The older mirror in `roadmap/done-pending.md` is annotated `**Superseded by [[<newer-plan>]]** for new work. This section is kept on disk for history; PENDING bullets roll up to <OMR-id>.`, the older plan's frontmatter `status` flips to `superseded`, and `updated`/`last_reviewed` are touched. The older file stays in `roadmap/plans/` until the parent workstream ships and is human-verified; the archive move (with `archived: <date>`, `status: superseded` preserved) is the close-out event and is **cascaded** by `check-roadmap-conventions.mjs --fix` to all superseded dependents whose rolled-up PENDING bullets are closed. See `templates/planning.md` "Superseded-by pattern" and `decisions/D-020_POL_parent-workstream-supersede-lifecycle.md`.

### Feature pages (`features/<feature>.md`)

- **When to add:** a coherent user-facing capability (chat, memory, email) or a coherent technical pillar (runtime, isolation) that has accumulated enough cross-cutting context to need a "tell me everything about X" entry point. Not for every system/ doc — only for things with cross-cutting context. Most system/ docs are best surfaced via the `system/` index alone.
- **Body sections:** Status (alpha/beta/stable/deprecated), Current Behavior, Known Issues, Roadmap, Relevant Decisions, Source of Truth.
- **Frontmatter fields:** `pageType: feature`, `status`, `owner`, `source_of_truth` (path to the system/ doc that is canonical for this feature), `roadmap_source` (path to the relevant roadmap section).
- **Link hygiene:** `source_of_truth`, `roadmap_source`, `related`, and body references must resolve to existing notes. Body references use wikilinks; frontmatter may use either wikilinks or PM-relative paths, but do not leave stale paths.
- **Don't duplicate content:** feature pages *point* to system/, `roadmap/plans/`, and `decisions/`; they don't *replace* them. If a system/ doc changes, the feature page's `source_of_truth` link is still valid; no edit needed unless the feature itself changes.

### Decisions (`decisions/D-NNN_<type>_<slug>.md`)

- **Typed, not ADR-monoculture.** `ADR` is one `decision_type` among seven: `ADR` (architecture), `PRD` (product), `MKT` (market/positioning), `VND` (vendor pick), `POL` (policy/operating rule), `NEG` (explicit rejection), `EXP` (time-boxed experiment). Use the type that matches the decision; prefer an existing type over a new one.
- **Filename:** `D-NNN_<type>_<slug>.md`, numbered globally across the project.
- **Status values:** `proposed`, `accepted`, `active`, `superseded`, `deprecated`. `accepted` is the default for a decision in force. `active` is allowed but temporary (accepted and being rolled out). When this decision supersedes another, set `supersedes: <D-id>` in this file's frontmatter; the prior decision's `status` moves to `superseded` and the date is recorded in its body. Cross-type supersedes is allowed.
- **Append-mostly.** Do not edit an `accepted` decision's body to re-litigate it. To change a decision, write a new one that `supersedes:` it. Decisions are a record of decisions *made*, not a place to track open questions.
- **When to write:** a significant decision affecting multiple parts of the system, a non-obvious choice, or a "why" that won't be obvious six months later. Architecture → `ADR`; product positioning/pricing → `PRD`; market/segment/GTM → `MKT`; vendor pick → `VND`; operating rule → `POL`; explicit "we are not doing X" → `NEG`; time-boxed bet → `EXP`.
- **Body shape:** detailed sections in `templates/decision.md` (single-page template; decision is not a folder note, so its body shape is documented in the page template, not in this README).

### Meeting records (`meetings/YYYY-MM-DD_<topic-slug>.md`) — optional

This is an *optional* lane for projects that have a meeting-recording agent or a habit of documenting meetings. It is not auto-scaffolded by `bootstrap-pm.mjs`; the lane is created on demand by the user (folder + folder-note + content files).

- **Filename:** `YYYY-MM-DD_<topic-slug>.md` (date prefix from the meeting date).
- **H1:** the topic slug, no date prefix.
- **Body shape:** see `templates/meeting-record.md`. At minimum: Attendees, Agenda, Discussion, Decisions Made, Action Items, Notes.
- **Decisions and plans are not duplicated here.** A decision made in a meeting gets its own `decisions/D-NNN_<type>_<slug>.md`; the meeting record cites it. Same for plans: a meeting that produces a plan gets a `roadmap/plans/YYYY-MM-DD_<slug>.md`; the meeting record cites it. The meeting record is the *source*; the decision and plan are the *formalized outputs*.
- **Append-mostly.** Don't rewrite a past meeting record to reflect later developments; cite the new artifact instead.
- **Cross-link:** from `CURRENT_STATUS.md`'s Recent Wins or Major Risks section, if a meeting was the trigger.
- **Status:** `active` while the meeting is in progress (an agent producing the record in real time); `closed` once the meeting ends (the default for a finished record).
- **Personal prefixes:** collaborator-name prefixes (e.g. `haoyou_`) are discouraged in this folder's filenames; the validator reports them as warnings.

## Navigation Context

| Anchor | Link |
|---|---|
| Project root | `[[<ProjectPath>/<Project>\|<Project>]]` |
| Parent collection | `[[Projects/Projects\|Back to Projects]]` |
| Vault home | `[[Home\|Back to Home]]` |

<!-- Adapt the vault-anchor links (Projects/Projects, Home) to your vault's structure. If your project lives in a different folder hierarchy, replace these with the appropriate anchors for your setup. -->

## Navigation

- [[<ProjectPath>/<Project>|Back to <Project>]]
- [[Projects/Projects|Back to Projects]]
- [[Home|Back to Home]]
