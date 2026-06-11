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
| `roadmap/` | Future and active PM state | MVP priorities, known issues, planning-note mirrored done/pending status, lightweight general done/pending, ideas, and scoped plans under `roadmap/plans/` |
| `roadmap/plans/` | Concrete plans | Implementation plans and design strategies not fully shipped yet. Mirrored into `roadmap/done-pending.md` when in flight |
| `decisions/` | Decision log (first-class PM lane at the project root) | Typed records of decisions *made* across architecture, product, market, vendor, policy, rejection, and experiment types |
| `features/` | Curated per-feature pages | "Tell me everything about feature X" — points into system/, decisions/, and roadmap/plans/ |
| `history/` | Completed work | Chronological daily logs of shipped changes, fixes, decisions, archive events |
| `archive/` | Superseded material | Old docs and plans replaced by current product, system, roadmap, or `roadmap/plans/` and `decisions/` docs |
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
├── decisions/
│   ├── decisions.md
│   └── D-NNN_<type>_slug.md
├── roadmap/
│   ├── roadmap.md
│   ├── mvp-priorities.md
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
| New concrete plan or decision not fully implemented | `roadmap/plans/YYYY-MM-DD_slug.md`, then add/update a matching `## YYYY-MM-DD_slug` section in `roadmap/done-pending.md` |
| Significant decision made (architecture, product, market, vendor, policy, rejection, experiment) | New `D-NNN_<type>_<slug>.md` in `decisions/` (see `templates/decision.md`) |
| New feature enters design phase (coherent user-facing capability) | Create `features/<feature>.md` (from `templates/feature.md`); link to relevant `system/`, `roadmap/plans/`, and `decisions/` docs |
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

**Always safe (no ask needed):**

- Editing existing notes in any lane (system/, docs/, features/, history/, decisions/, roadmap/).
- Adding notes to existing folders that already have a folder note (e.g., creating a new `system/<topic>.md` if `system/system.md` exists).
- Adding `history/YYYY-MM/history-YYYY-MM-DD.md` entries when `history/YYYY-MM/YYYY-MM.md` already exists.
- Adding notes to optional lanes that already exist (`meetings/`, custom docs categories, etc.).
- Creating migration ledger entries in `.pm/` via the migration runner.

**Ask before:**

- Creating root notes (`<Project>.md`, new entries to root).
- Creating new roadmap notes (`roadmap/mvp-priorities.md`, `roadmap/known-issues.md`, `roadmap/ideas.md`, `roadmap/done-pending.md`).
- Creating a new top-level folder under the project root.
- Creating a new docs guide category (`docs/<NewGuide>/`).
- Creating new root files beyond the standard set.

For the full permission policy matrix, see `REFERENCE.md` → "Permission Policy".

## Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Top-level PM lanes | lowercase, no spaces | `archive/`, `history/`, `system/` |
| Docs guide folders | Title Case category labels | `Admin Guide/`, `Quick Commands/` |
| Folder notes | exactly match the folder name | `Admin Guide/Admin Guide.md`, `history/history.md` |
| Content notes | neutral lowercase kebab-case slug, no numeric prefix | `architecture.md`, `background-jobs.md` |
| Root canonical docs | uppercase special files | `README.md`, `PRODUCT.md`, `CURRENT_STATUS.md` |
| Docs guide notes | neutral lowercase kebab-case slug, no numeric prefix | `user-manual.md`, `cloudflare-tunnel.md` |
| Date-stamped logs | `YYYY-MM/history-YYYY-MM-DD.md` (organized by year-month) | `2026-06/history-2026-06-04.md` |
| Planning notes | `YYYY-MM-DD_slug.md` (date prefix) | `2026-05-24_<planning-slug>.md` |
| Decisions | `D-NNN_<type>_<slug>.md` (numbered globally, typed) | `D-001_ADR_tauri-opencode.md` |
| Meeting records | `YYYY-MM-DD_<topic-slug>.md` (optional lane) | `2026-06-10_openclaw-pm-onboarding.md` |
| Archived files | `<slug>-archived.md` (date prefix and number dropped) | `m3-return-path-archived.md` |

## Update Frequency

- `system/`: update immediately when current architecture, data flow, runtime behavior, database, auth, integrations, or deployment changes.
- `docs/`: update in the same session as user/admin/developer workflow changes. `docs/Developer Guide/known-bugs.md` is required and tracks engineering bug knowledge, active or fixed.
- `roadmap/`: update when pending/done/known issue status changes or a new idea enters the backlog.
- `roadmap/plans/`: update when a plan or implementation strategy is created or revised before fully shipped.
- `decisions/`: add a new typed decision (`ADR / PRD / MKT / VND / POL / NEG / EXP`) when a significant decision is made. Update existing decisions only via `supersedes:` chains — do not edit an `accepted` decision's body to re-litigate it.
- `features/`: update when a feature's current behavior, known issues, or roadmap changes.
- `history/`: update last with brief chronological bullets after meaningful work is finished. New month folders must include `YYYY-MM/YYYY-MM.md` and be linked from `history/history.md`.
- `CURRENT_STATUS.md` (at root): update weekly with the current snapshot — top priorities, blocked, recent wins, major risks, stale docs. PM agent maintains.
- `README.md`: update when folder structure or logging rules change.

## Conventions by Page Type

Quick reference for how each page type is written. Detailed body shape lives in the per-type page template (see `templates/`). Folder notes (e.g., `roadmap/plans/plans.md`, `decisions/decisions.md`, `features/features.md`, `history/2026-06/2026-06.md`) follow the universal shape in `templates/folder-note.md` and may include a `## Conventions` block stating the rules that apply to that lane inline.

### Docs guide notes (`docs/<Guide>/<slug>.md`)

- **Folder notes:** `Admin Guide.md`, `Developer Guide.md`, `Quick Commands.md`, and `User Guide.md` are indexes only. Do not put manual, runbook, FAQ, command, or reference content in guide folder notes.
- **User Guide:** use independent notes such as `user-manual.md`, `faq.md`, and `reference.md` when the project has shipped user-facing behavior.
- **Admin Guide:** live product operations for admins/operators: support and feedback triage, admin panel workflows, monitoring, statistics, background job runs, access, incident response, production verification, and data repair. Operational commands are fine; source-code modification workflows are not.
- **Developer Guide:** coding-engineer workflows: local setup, codebase structure, testing, APIs, schemas, migrations, prompts, implementation notes, adding/changing jobs, release mechanics, contribution workflow, and `known-bugs.md`.
- **Known bugs:** `docs/Developer Guide/known-bugs.md` is the required engineering bug knowledge base. Keep active tracking in `roadmap/known-issues.md`, but record symptoms, root cause, solution, verification, recurrence patterns, and history links in `known-bugs.md`.
- **Quick Commands:** copy-pasteable commands only; link to Admin or Developer Guide when explanation is needed.
- **Renames:** legacy numbered filenames like `01_USER_MANUAL.md` are deprecated. Rename to lowercase slugs and update all wiki links.
- **Personal prefixes:** collaborator-name prefixes such as `haoyou_` are discouraged in canonical PM folders. They may be useful during handoff, but validators report them as warnings so they can be renamed to neutral lowercase kebab-case slugs later.

### Roadmap notes (`roadmap/*.md`)

- **Ideas:** follow `templates/ideas.md`: `## Contents`, `## Status Key` (with the color-coded status scheme — see "Status color scheme" below), `## Idea Register` (4-column table with colored status in the Status column), five status buckets (`## Brainstorming` / `## Scoping` / `## Approved` / `## Implemented` / `## Declined`), `## Idea Details` (one section per idea with a colored Status line), and `## Navigation`. Use stable IDs such as `IDEA-001`; do not rely on list position for identity. The color scheme is adopted in `decisions/D-008_POL_ideas-status-colors.md`.
- **Known issues:** follow `templates/known-issues.md` (OpenManager format). Three top-level sections: `## Active` (lead paragraph describing the domain-grouped convention), `## Fixed` (lead paragraph noting that fixed entries are retained in their original domain context until they no longer need it), `## Deferred`. Each section is grouped by `### <Domain>` H3 subsections (e.g., `### Migrations`, `### Validators`, `### AGENTS.md integration`, `### CLI surface`, `### Documentation`). Each item uses one of the OpenManager checkbox formats:
  - `- [ ] **PENDING (YYYY-MM-DD):** <description>.` — active items.
  - `- [ ] **PENDING:** <description>.` — active items without a date.
  - `- [x] **FIXED (YYYY-MM-DD):** <description>.` — fixed items.
  - `- [x] **FIXED (YYYY-MM-DD, in commit \`<hash>\`):** <description>.` — fixed items with commit reference.
  - `- [ ] **DEFERRED:** <description>.` — deferred items.

  The active `### <Domain>` subsections can be named with a `(YYYY-MM-DD_slug)` suffix when the items belong to a specific planning note (e.g., `### Sidebar Nav Card (2026-06-03_chat-as-continuous-tab Task 1.2)`). Active items are mirrored to `docs/Developer Guide/known-bugs.md` with engineering root-cause/solution/verification shape. The convention is adopted in `decisions/D-009_POL_known-issues-format.md`.
- **MVP priorities:** follow `templates/mvp-priorities.md` (OpenManager format). `## Alpha Goal` (one-line summary of the current validation goal); `## MVP Priorities` grouped by `### <Lane>` H3 subsections (e.g., `### Bootstrap`, `### Validations`, `### Migrations`, `### AGENTS.md integration`, `### CLI surface`, `### Documentation`, `### OpenClaw PM-agent integration`); `## Not Yet MVP` (bare `- [ ]` bullets, no status prefix). Each MVP item uses the OpenManager checkbox format:
  - `- [x] **DONE:** <description>.` — shipped items.
  - `- [x] **DONE (YYYY-MM-DD):** <description>.` — shipped items with a date.
  - `- [ ] **PENDING:** <description>.` — in-flight items.

  The lane breakdown is project-specific; the bootstrap writes a worked example with the project-management skill's natural lanes (Bootstrap / Validations / Migrations / AGENTS.md integration / CLI surface / Documentation / OpenClaw PM-agent integration). Users replace the example lanes with their own project's lanes. The convention is adopted in `decisions/D-010_POL_mvp-priorities-format.md`.
- **Done/pending:** follow `templates/done-pending.md`. The file holds two kinds of entries: (a) **planning-note mirrors** — one H2 per active or proposed planning note from `roadmap/plans/`, with a `Planning note:` line, a DONE/PENDING checklist, and `Relevant decisions:` / `Relevant features:` bullets; (b) **general done/pending items** without a dedicated planning note, organized by date. Planning-note mirrors always take priority in the file's order. The H2 for a planning-note mirror is the slug only (e.g., `## v1.5.0 backlog from post-v1.4.1 audit`), not the date-prefixed stem — the validator at `scripts/check-pm-consistency.mjs` accepts both date-prefixed and slug-only H2. The convention is adopted in `decisions/D-007_POL_done-pending-format.md`.
- **Routing:** rough ideas stay in `ideas.md`; approved concrete work gets a planning note and a `done-pending.md` mirror section; active bugs and risks stay in `known-issues.md`; engineering bug root causes and fixes are mirrored in `docs/Developer Guide/known-bugs.md`.

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
- **H1:** slug only, no number, no date prefix — `# initial-decisions`, not `# 01_initial-decisions` or `# 2026-05-22_initial-decisions`.
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
- **Cross-link:** when a planning note is approved, add a `## <slug>` section (slug only, not the date-prefixed stem) to `roadmap/done-pending.md` with the planning note link. When it ships, distill durable current truth into `system/` and archive the file. The validator accepts both slug-only and date-prefixed H2 (F8 fix).
- **Decisions cited, not duplicated:** if the plan records a significant decision, write a typed `decisions/D-NNN_<type>_<slug>.md` and link it from the plan's Related section. Do not restate the decision's reasoning in the plan.

### Feature pages (`features/<feature>.md`)

- **When to add:** a coherent user-facing capability (chat, memory, email) or a coherent technical pillar (runtime, isolation) that has accumulated enough cross-cutting context to need a "tell me everything about X" entry point. Not for every system/ doc — only for things with cross-cutting context. Most system/ docs are best surfaced via the `system/` index alone.
- **Body sections:** Status (alpha/beta/stable/deprecated), Current Behavior, Known Issues, Roadmap, Relevant Decisions, Source of Truth.
- **Frontmatter fields:** `pageType: feature`, `status`, `owner`, `source_of_truth` (path to the system/ doc that is canonical for this feature), `roadmap_source` (path to the relevant roadmap section).
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
| Project root | `[[Projects/<Project>/<Project>\|<Project>]]` |
| Parent collection | `[[Projects/Projects\|Back to Projects]]` |
| Vault home | `[[Home\|Back to Home]]` |

<!-- Adapt the vault-anchor links (Projects/Projects, Home) to your vault's structure. If your project lives in a different folder hierarchy, replace these with the appropriate anchors for your setup. -->

## Navigation

- [[Projects/<Project>/<Project>|Back to <Project>]]
- [[Projects/Projects|Back to Projects]]
- [[Home|Back to Home]]
