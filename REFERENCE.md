# Project Management — Reference

This is the deep doc for the project-management skill. SKILL.md has the entry point (intents, triggers, quick start, routing map, final response); this file has everything else — repair workflows, schemas, contributor conventions, bootstrap workflow, permission policy, pitfalls.

The split mirrors the "Writing Skills" framework: SKILL.md is lean (~150 lines) and loadable for any matching trigger; REFERENCE.md is the deep doc an agent reads when it needs the details.

---

## Validation and Repair

Use this when the user asks to "verify", "validate", "audit", "check", "repair", or "fix" the PM folder.

- **Verify / validate / check / audit** means run the validation tools and report findings without editing files.
- **Repair / fix** means run validation, fix authoritative PM-folder issues, then rerun validation.

Primary command:

```bash
node <skill_dir>/scripts/check-pm.mjs
node <skill_dir>/scripts/check-pm.mjs --project <ProjectName> --config <skill_dir>/projects.json
```

The wrapper runs all focused validators and returns nonzero if any check fails. The individual scripts remain available for debugging specific failures.

The repair workflow has 3 phases: **audit, plan, fix**.

### Phase 1: Audit

Run the bundled validation wrapper:

```bash
node <skill_dir>/scripts/check-pm.mjs
```

For one registered project, prefer:

```bash
node <skill_dir>/scripts/check-pm.mjs --project <ProjectName> --config <skill_dir>/projects.json
```

The wrapper runs:

- `node <skill_dir>/scripts/check-vault-structure.mjs` — verifies the required folder/file layout
- `node <skill_dir>/scripts/check-stale-docs.mjs` — surfaces never-reviewed and stale docs
- `node <skill_dir>/scripts/check-pm-consistency.mjs` — verifies visible-file frontmatter, page types, history/archive fields, internal wiki links, planning mirrors, and archive/sync-conflict naming

Then check the schema and content dimensions:

1. **Schema compliance** — every note has the right `pageType:`, `status:` (per pageType vocabulary), `archived:` (only on archive files), `kind:` (only on history files), and other recommended fields. The `status: archived` value is **invalid** — `archived` is a separate date field, not a status value.
2. **H1 vs filename** — each note's H1 matches its filename stem (no leftover numbered prefixes, no date prefix in the H1).
3. **Cross-link integrity** — all `[[wiki-link]]` targets resolve to existing files.
4. **CURRENT_STATUS freshness** — the weekly snapshot exists and is not stale.
5. **Planning ↔ roadmap mirror** — each `planning/*.md` has a matching `## YYYY-MM-DD_slug` section in `roadmap/done-pending.md`.
6. **History `kind:`** — every `history/YYYY-MM/history-YYYY-MM-DD.md` has a `kind: changelog | worklog | mixed` field.
7. **Archive `archived:` field** — every moved archive file named `archive/*-archived.md` has both a meaningful `status:` (lifecycle) and an `archived: <date>` field. Folder indexes such as `archive/archive.md` must not carry `archived:`.
8. **Folder structure** — all required folders and root files exist; feature/ADR/roadmap index pages exist where needed.
9. **Feature pages** — coherent features have pages; technical components stay in `system/`.
10. **Docs guide indexes** — `docs/Admin Guide/Admin Guide.md`, `docs/Developer Guide/Developer Guide.md`, `docs/Quick Commands/Quick Commands.md`, and `docs/User Guide/User Guide.md` are folder-note indexes only; durable content lives in independent notes.
11. **Known bugs note** — `docs/Developer Guide/known-bugs.md` exists and records engineering bug knowledge with status, symptoms, root cause, solution, verification, and references.
12. **README sync** — the project's `README.md` "What Goes Where", "Quick Rules", and "Update Frequency" sections match the canonical template.

### Phase 2: Plan

Build a fix list: for each inconsistency found, decide the target state and the right migration. Group related fixes so they can be committed/recorded together. For example:
- Schema drift (all `status: archived` → real lifecycle) is one fix group.
- README sync (all 3 missing rows × all 3 projects) is another.
- Cross-link repair is another.

### Phase 3: Fix

Apply the fixes in this order:

1. **Schema first** (REFERENCE.md + templates) — establishes the new convention.
2. **Verify, then migrate** existing files — each file read first to determine its original lifecycle / kind.
3. **Update history** with brief bullets recording what was fixed.
4. **Validate** with `node <skill_dir>/scripts/check-pm.mjs`.
5. **Re-run the audit** to confirm a clean state.

---

## Existing Project Management

> STOP — read this first when logging project work.
>
> 1. Determine the project from context.
> 2. Read that project's root `README.md`; it is the source of truth for where to log what.
> 3. Read the project-management skill at `<skill_dir>/SKILL.md`.
> 4. Apply the project README before any generic rule in this skill.
> 5. Update current-state docs before history when behavior, architecture, data flow, runtime, auth, database, connectors, deployment, UX, user/admin/developer workflow, quick commands, roadmap status, or documentation structure changes.
> 6. Update `history/` last with brief chronological bullets.
> 7. In the final response, state exactly which project/vault files were updated.

### Project Detection

If your setup has multiple projects, identify which one applies from the context (channel, working directory, recent files, explicit mention). The user's own config (`projects.json` at the skill root) is the canonical place for project paths and metadata.

If no signal is clear, ask which project applies before logging.

---

## Standard App Project Bootstrap

Use this when the user asks to create project docs, bootstrap a project folder, or standardize an app/software project PM folder.

Create this default tree for new app projects:

```text
<Project>/
├── <Project>.md
├── PRODUCT.md
├── README.md
├── archive/
│   └── archive.md
├── docs/
│   ├── docs.md
│   ├── Admin Guide/
│   │   └── Admin Guide.md
│   ├── Developer Guide/
│   │   └── Developer Guide.md
│   ├── Quick Commands/
│   │   └── Quick Commands.md
│   └── User Guide/
│       └── User Guide.md
├── history/
│   ├── history.md
│   └── YYYY-MM/
│       └── history-YYYY-MM-DD.md
├── planning/
│   ├── planning.md
│   └── dated (YYYY-MM-DD_slug) concrete plans
├── roadmap/
│   ├── roadmap.md
│   ├── mvp-priorities.md
│   ├── known-issues.md
│   ├── done-pending.md
│   └── ideas.md
└── system/
    ├── system.md
    └── <topic>.md
```

### Required Root Notes

- `<Project>.md`: root folder note and project landing page.
- `README.md`: canonical routing map for where project information goes.
- `PRODUCT.md`: product vision, users, current product shape, principles, product boundaries, and future goals.

Both `README.md` and `PRODUCT.md` must have accurate TOCs or structured headings. `README.md` is the source of truth for logging routes.

### Required Folder Index Notes

Every folder must have an index note whose filename matches the folder name:

- `<Project>/<Project>.md`
- `archive/archive.md`
- `docs/docs.md`
- `docs/Admin Guide/Admin Guide.md`
- `docs/Developer Guide/Developer Guide.md`
- `docs/Quick Commands/Quick Commands.md`
- `docs/User Guide/User Guide.md`
- `features/features.md`
- `history/history.md`
- `planning/planning.md`
- `roadmap/roadmap.md`
- `system/system.md`

Update folder indexes in the same session when adding, moving, archiving, or deleting notes.

### Index And Navigation Rules

Folder index notes must match the canonical pattern:

1. Frontmatter.
2. `# <folder name>`.
3. One sentence describing the folder.
4. `<!-- vault-maintain:index:start -->`.
5. `## Subfolders` with Obsidian links to direct child folder indexes, or `*(no items)*`.
6. `## Notes` with Obsidian links to direct child notes, or `*(no items)*`.
7. `<!-- vault-maintain:index:end -->`.
8. `## Navigation` with project-internal links up to the project root index. External vault links are optional and must come from the project README navigation context.

Every non-index note must have `## Navigation` links:

- Direct child of project root: project root, plus optional README-defined external anchors.
- Note inside a top-level folder: immediate folder index, project root, plus optional README-defined external anchors.
- Note inside a docs guide folder: guide index, `docs`, project root, plus optional README-defined external anchors.
- Deeper notes: nearest folder index first, then each parent folder index up to project root, plus optional README-defined external anchors.

### Navigation Context

Navigation must be folder-structure agnostic beyond the project folder.

- Existing projects: read `README.md` first and copy its navigation context and external anchor style.
- New projects: ask once whether the user wants links beyond the project folder. If they do not, use only project-internal links.
- Generic templates must not assume a vault root structure such as `Projects/Projects`, `Home`, or `Projects/<Project>/...`.
- For the user's current vault projects, keep using `[[Projects/Projects|Back to Projects]]` and `[[Home|Back to Home]]` only when the project README defines them as external anchors.

When moving or renaming notes/folders:

1. Update the source and destination folder indexes.
2. Update the moved note's own `## Navigation`.
3. Update every Obsidian link pointing to the old path.
4. Search the whole project vault for stale old paths before finishing.
5. Report the files updated in the final response.

### Docs Guide Conventions

The four standard docs guide folders are stable lanes. Their folder notes are indexes only; do not put manual, runbook, FAQ, or command content directly in the folder note.

- `docs/User Guide/` — end-user product behavior. Default notes are `user-manual.md`, `faq.md`, and `reference.md` when the project has enough shipped behavior to justify them.
- `docs/Admin Guide/` — live product operations for admins/operators: support and feedback triage, admin panel workflows, monitoring, statistics, background job runs, access management, incident response, production verification, and data repair. Admin notes may include operational commands, but should not require source-code edits or explain how to change implementation.
- `docs/Developer Guide/` — coding-engineer procedures: local setup, codebase structure, testing, APIs, schemas, migrations, prompt/reference material, implementation notes, adding/changing background jobs, release mechanics, contribution workflow, and required `known-bugs.md`.
- `docs/Quick Commands/` — short command recipes only. If a command needs explanation, troubleshooting, or policy, keep the explanation in Admin or Developer Guide and link to it.

Active docs-guide content notes use neutral lowercase kebab-case filenames with no numeric prefixes (`user-manual.md`, `faq.md`, `cloudflare-tunnel.md`). Legacy numbered names such as `01_USER_MANUAL.md` should be renamed during repair, with all wiki links updated. Personal/collaborator prefixes such as `haoyou_getting-started.md` are discouraged in canonical PM folders and should be surfaced as warnings, not hard validation failures.

Casing is semantic, not uniform. Top-level PM lanes stay lowercase (`archive/`, `docs/`, `history/`, `system/`). The four standard docs guide folders use Title Case (`Admin Guide/`, `Developer Guide/`, `Quick Commands/`, `User Guide/`) because they are user-facing category labels. Folder notes exactly match their folder names, content notes use lowercase slugs, and uppercase filenames are reserved for root artifacts (`README.md`, `PRODUCT.md`, `CURRENT_STATUS.md`) plus the `ADR-NNN_` prefix.

`docs/Developer Guide/known-bugs.md` is required for every PM folder. It is the engineering bug knowledge base: active bugs, fixed bugs, recurring root-cause patterns, solutions, verification, and references to `roadmap/known-issues.md` or `history/`. `roadmap/known-issues.md` remains the active roadmap tracker for bugs, risks, and blockers.

When adding or moving a docs note, update the nearest guide index and `docs/docs.md` if a guide folder changes.

### Roadmap Note Shape

The four standard roadmap notes are active working notes, not folder notes, but they still need a predictable scan shape:

- `roadmap/ideas.md` follows `templates/ideas.md`: `## Contents`, `## Status Key`, `## Idea Register`, status buckets (`## Brainstorming`, `## Scoping`, `## Approved`, `## Implemented`, `## Declined`), `## Idea Details`, and `## Navigation`. Use stable IDs (`IDEA-001`, `IDEA-002`) so links survive reordering.
- `roadmap/known-issues.md` follows `templates/known-issues.md`: `## Contents`, `## Active`, `## Fixed`, `## Deferred`, and `## Navigation`. Domain-specific grouping belongs under those sections as labels or `###` subsections.
- `roadmap/mvp-priorities.md` follows `templates/mvp-priorities.md`: `## Contents`, `## Alpha Goal`, `## MVP Priorities`, `## Not Yet MVP`, and `## Navigation`.
- `roadmap/done-pending.md` follows `templates/done-pending.md`: `## Contents`, planning-note mirrored sections, `## General Done/Pending Without Dedicated Planning Note`, and `## Navigation`.
- Keep rough ideas in `ideas.md`, concrete approved work in `planning/` plus `done-pending.md`, active bugs/risks in `known-issues.md`, and engineering bug knowledge in `docs/Developer Guide/known-bugs.md`.

---

## Planning To Roadmap Sync

Concrete plans in `planning/` must be reflected in `roadmap/done-pending.md`.

`roadmap/done-pending.md` should mirror planning note filenames first:

- Create one `## <planning-file-stem>` section for each concrete `planning/*.md` note except `planning.md`.
- Start each mirrored section with `Planning note: [[...|<planning-file-stem>]]`.
- Summarize the plan's current done/pending checklist under that section.
- Keep `## General Done/Pending Without Dedicated Planning Note` for lightweight done/pending work that does not deserve a concrete planning note.
- Do not hide concrete plans only in the general section.

When creating or updating a planning note:

1. Add or update the matching planning-file-stem section in `roadmap/done-pending.md`.
2. Keep high-level priority framing in `roadmap/mvp-priorities.md` if the plan changes MVP direction.
3. Put bugs or risks discovered during planning in `roadmap/known-issues.md`.
4. Move rough ideas that are not approved plans to `roadmap/ideas.md`.

When a plan ships:

1. Mark related `roadmap/done-pending.md` items done.
2. Update relevant `system/` and `docs/` current-state notes.
3. Completed plans and completed done/pending sections should not remain in active PM lanes. Active `planning/` is for unfinished plans. Active `roadmap/done-pending.md` is for unfinished roadmap state and lightweight pending work.
4. If every checkbox in the related `roadmap/done-pending.md` section is complete, first distill durable current truth into `system/`, `docs/`, or `PRODUCT.md`, then archive that section to `history/YYYY-MM/history-YYYY-MM-DD-archived-sections.md` and remove it from active `done-pending.md`.
5. If the completed section mirrors a completed `planning/*.md` note, move the planning note to `archive/<slug>-archived.md` (drop the date prefix and any number; preserve the slug). Add an `archived: <date>` field to the frontmatter; keep the original `created:` field.
6. If a `planning/*.md` note is complete even without a matching roadmap section, first distill durable truth into `system/`, `docs/`, or `PRODUCT.md`, then move it to `archive/`.
7. Update `planning/planning.md`, `archive/archive.md`, `roadmap/done-pending.md`, the moved note's `## Navigation`, and every wiki link that points to the old planning filename.
8. Validate that the new archive filename is unique, each active planning note has a matching `done-pending.md` section, and no stale old planning stems remain.
9. Add a brief dated entry to `history/YYYY-MM/history-YYYY-MM-DD.md` (e.g., `history/2026-05/history-2026-05-04.md`).

Archived planning files use `<slug>-archived.md` (date prefix and any number are dropped; the slug from the original filename is preserved). The `created:` frontmatter is kept; an `archived: <date>` field is added. The renumbering rule from earlier conventions is no longer required.

---

## External Issue Tracker Integration

For projects with an external issue tracker (GitHub Issues, GitLab Issues, Linear, Jira, etc.), the PM folder's `roadmap/known-issues.md` is a **summary index**, not a duplicate. The detailed backlog lives in the external tracker; the PM folder links to it.

**Convention:** each `known-issues.md` entry can have a `tracker:` field pointing to the external issue URL.

```markdown
### 2026-05-04: OAuth provider misconfiguration breaks email setup
- **Tracker:** [GH-1234](https://github.com/owner/repo/issues/1234)
- **Discovered:** 2026-05-04
- **Impact:** Users can't connect Gmail; the wizard fails silently at step 3
- **Workaround:** Set `SMTP_FALLBACK_PROVIDER=gmail` env var
- **Status:** Acknowledged; fix in PR #1238
```

**Why a one-way link, not a sync?** Two-way sync between the PM folder and an external tracker is fragile (drift, conflicts, race conditions). The PM folder is the team's source of truth for "what we know about"; the external tracker is the public surface. The `tracker:` field keeps them connected without trying to keep them in lock-step.

**For very large projects** (thousands of open issues in the external tracker), the PM folder known-issues should focus on:
- High-impact bugs the team is actively tracking
- Bugs blocked on external dependencies
- Bugs the team has decided NOT to fix (and why)
- Bugs the team is fixing in the current sprint

The full backlog lives in the external tracker; the PM folder entry is a curated subset.

---

## Frontmatter Schema

Standard frontmatter fields for all notes in a project vault. Old notes may lack the new fields (backwards compatible). New notes should populate strongly-recommended fields.

### Base schema (all notes)

| Field | Required | Values | Notes |
|---|---|---|---|
| `title` | Required | string | Human-readable title |
| `created` | Required | `YYYY-MM-DD` | File creation date |
| `pageType` | Required | `planning` \| `system` \| `feature` \| `adr` \| `roadmap` \| `history` \| `index` \| `note` | Drives downstream tooling (stale detection, search filters) |
| `aliases` | Optional | `[string, ...]` | Backlink-friendly alternative titles |
| `tags` | Optional | `[string, ...]` | Existing convention; free-form |
| `updated` | Recommended | `YYYY-MM-DD` | Last meaningful edit; default `= created` if omitted |
| `last_reviewed` | Recommended | `YYYY-MM-DD` | Last human/agent review pass; powers stale detection |
| `status` | Recommended | (lifecycle, per `pageType`) | Lifecycle status. Valid values depend on `pageType`; see the pageType-specific sections below |
| `archived` | Optional | `YYYY-MM-DD` | File-location marker: present (with a date) when the file has been moved to `archive/`. Does NOT replace `status` — `status` still carries the lifecycle (a shipped-then-archived plan keeps `status: shipped` and adds `archived: <date>`) |
| `owner` | Recommended | string (role or name) | E.g. `PM`, `Platform team`, `Operator` |
| `source_of_truth` | Optional | path | Canonical source for this topic; use on `feature` pages and high-traffic `system/` docs |
| `related` | Optional | `[path, ...]` | Cross-links to other notes |

### `pageType`-specific fields

**ADR (`pageType: adr`):** the base `status` field uses the ADR lifecycle:
- `proposed` — under discussion, not yet accepted
- `accepted` — the chosen direction
- `deprecated` — no longer recommended; kept for historical record
- `superseded` — replaced by another ADR; pair with a new ADR's `supersedes` field

Add `decision_date: YYYY-MM-DD` and (if applicable) `supersedes: <ADR-id>`.

**Feature (`pageType: feature`):** the base `status` field uses feature maturity:
- `alpha` — internal only, breaking changes expected
- `beta` — usable but rough; gaps and known issues in body
- `stable` — production-quality; gaps and known issues tracked elsewhere
- `deprecated` — still present but slated for removal

Add `source_of_truth: <path>` (pointing to the `system/` doc that documents current behavior) and `roadmap_source: <path>` (pointing to the relevant `roadmap/` section).

**System (`pageType: system`):** the base `status` field uses doc currency:
- `active` — current source of truth
- `beta` — newly written, not yet authoritative
- `deprecated` — replaced by another system doc; cross-link to the replacement

**Planning (`pageType: planning`):** the base `status` field uses the planning lifecycle:
- `proposed` — drafted, not yet approved
- `active` — in flight
- `shipped` — fully done; planning file kept for historical reference
- `rejected` — proposal declined; planning file kept for the record
- `superseded` — replaced by a newer planning note or ADR

These are planning-specific values. The base `archived:` field is used separately to mark the file's move to `archive/` (see "Status vs archived" below).

**History (`pageType: history`):** history files are inherently past. The `status:` field is not lifecycle-bearing; omit it. The `kind:` field (changelog | worklog | mixed) carries the content type, not `status`.

### Status vs archived

`status` is the note's lifecycle. The valid values depend on `pageType` (see the pageType-specific sections above).

`archived: <date>` is a separate optional frontmatter field meaning "this file has been moved to `archive/`". It is set on the day the file is archived. It is only valid on moved archive files named `archive/*-archived.md`; folder indexes such as `archive/archive.md` were created in place and must not carry `archived:`.

`status` and `archived` are **orthogonal**: an archived file still has its lifecycle status. A shipped-then-archived plan keeps `status: shipped` and adds `archived: <date>`. A rejected-then-archived plan keeps `status: rejected` and adds `archived: <date>`. A deprecated-then-archived system doc keeps `status: deprecated` and adds `archived: <date>`.

**Conventions for archive files:**
- The filename uses the `<slug>-archived.md` suffix (date prefix dropped; `-archived` appended).
- The `created:` frontmatter is preserved (the original creation date).
- An `archived: <date>` field is added (the date of the move).
- The original `status:` value is **preserved** (not changed to `archived`).

### Stale detection

Notes with `last_reviewed` more than 30 days old are flagged as **stale**. Notes never reviewed or more than 90 days old are **very stale**. Run `node <skill_dir>/scripts/check-pm.mjs --project <ProjectName> --config <skill_dir>/projects.json` to generate the full validation report; surface the stale-doc summary in `CURRENT_STATUS.md` under "Stale Docs".

### Stale detection is report-only

The skill defines the schema and the stale detection concept. Validation scripts should never delete or modify notes — they only report.

### History entry kinds

When creating a new `history/YYYY-MM/history-YYYY-MM-DD.md`, add a `kind:` field to the frontmatter:

- `kind: changelog` — purely factual bullets ("Added X", "Fixed Y"). No reasoning. Quick to scan.
- `kind: worklog` — reasoning, decisions, tradeoffs, why-we-didn't-do-X. Longer form. The "what" can be inferred from the rationale.
- `kind: mixed` — both fact bullets and reasoning mixed in one entry. The default for daily files that mix both.

When reading history, agents and humans can filter by `kind` to find the level of detail they need. Existing history files have been retroactively tagged; new files should pick the right `kind` at creation time.

---

## History Conventions

This section collects the conventions for the `history/` folder: file organization (year-month) and bullet prefixes (Conventional Commits).

### History organization (year-month folders)

History files are organized by year and month:

```
history/
├── history.md                           (the index)
├── 2026-05/
│   ├── 2026-05.md                       (the month index)
│   ├── history-2026-05-01.md
│   ├── history-2026-05-04.md
│   └── history-2026-05-15.md
└── 2026-06/
    ├── 2026-06.md                       (the month index)
    ├── history-2026-06-02.md
    └── history-2026-06-12.md
```

**Why year-month folders?** At ~5 entries/week, a project generates 250+ files per year. Year-month folders keep the file count bounded per directory, and make it easy to scan a specific month's work.

**When to create the month folder:** implicitly, when the first history file of the month is created. Also create `history/YYYY-MM/YYYY-MM.md` as that folder's index and add it to `history/history.md` under `## Subfolders`. The `check-stale-docs.mjs` script handles both the nested layout (recommended) and the legacy flat layout (for graceful migration of existing projects).

**Filename convention:** `history-YYYY-MM-DD.md` (date is in the filename AND in the file's `created:` frontmatter; the year-month subfolder is for organization only).

### History bullet prefixes (Conventional Commits)

Adopt [Conventional Commits](https://www.conventionalcommits.org/) prefixes for history bullets. The 10 standard types:

| Prefix | Use for |
|---|---|
| `feat:` | A new user-facing feature or capability |
| `fix:` | A bug fix |
| `docs:` | Documentation-only changes (no code change) |
| `refactor:` | Code change that neither fixes a bug nor adds a feature |
| `chore:` | Build, dependency, tooling, or other non-user-facing change |
| `test:` | Adding or fixing tests only |
| `perf:` | Performance improvement |
| `style:` | Formatting, whitespace, etc. (no code change) |
| `build:` | Build system or external dependencies change |
| `ci:` | CI configuration change |

**Optional scope** in parens for clarity: `fix(email): handle OAuth provider misconfiguration` or `feat(auth): add Google sign-in`. The scope is a noun (component, area, file name); keep it short.

**Breaking changes:** append `BREAKING CHANGE:` on the next line with a description.

**Example history file:**

```markdown
---
title: history-2026-05-04
created: 2026-05-04
kind: mixed
---

# 2026-05-04

- **feat(auth):** add Google sign-in flow (PR #1234)
- **fix(email):** handle OAuth provider misconfiguration in the wizard
- **docs:** update README with new `tracker:` field convention
- **chore(deps):** bump minimax SDK to v2.3
- **refactor(system/):** split connectors-and-sessions.md into per-connector docs
- **BREAKING CHANGE:** the `source_of_truth` field replaces `current_behavior_source` on feature pages (migration in `archive/2026-05-04_current_behavior_source-archived.md`)
```

**The win:** when a bug recurs, `grep -E "^fix.*<symptom>" history/2026-*/history-*.md` finds all past fixes and their solutions. The Conventional Commits format is the de facto standard for code commits and changelogs; using it in history makes the skill's history files compatible with existing tooling (e.g., `conventional-changelog`, `standard-version`).

**Optional, not required.** Agents are encouraged to use Conventional Commits prefixes, but the skill accepts free-form bullets too.

---

## Configuration

The user's project paths live in a separate config file, not in the skill text. This keeps the skill portable and user-agnostic — the same skill can be shipped to another user without leaking personal paths.

**Config file location:** `projects.json` at the skill root, alongside `SKILL.md`. The file is the user's actual instance and may be gitignored or committed per their preference. A blank starter lives at `templates/projects.template.json`.

**Config file shape:**

```json
{
  "vault_root": "/path/to/Obsidian/Vault",
  "skill_dir": "/path/to/skill/install",
  "projects": {
    "<ProjectName>": {
      "code_repo": "/path/to/code/repo",
      "pm_folder": "/path/to/vault/Projects/<ProjectName>",
      "phase": "pre-alpha | alpha | beta | stable | deprecated",
      "notes": "one-line description",
      "access": "authoritative | read-only | unavailable"
    }
  }
}
```

- `vault_root` — the Obsidian vault root.
- `skill_dir` — where this skill is installed (used to resolve `projects.json` and templates).
- `projects.<name>.code_repo` — the project's code repository. Set to `null` when the project has no code yet.
- `projects.<name>.pm_folder` — the project's PM folder inside the vault.
- `projects.<name>.phase` — current phase (pre-alpha, alpha, beta, stable, deprecated). Free-form string; helps the agent calibrate detail.
- `projects.<name>.notes` — one-line description (optional).
- `projects.<name>.access` — `"authoritative"` (you own the PM folder; you can edit it directly), `"read-only"` (the PM folder is shared; you can read but not edit), or `"unavailable"` (you have code access but no PM folder access yet). Drives the `## PM folder` section written to the project's `AGENTS.md` (see "Coding Agent Integration" below). `pm_folder` may be empty/null only when `access` is `"unavailable"`.

**Auto-bootstrap on first use.** If `<skill_dir>/projects.json` is missing when the agent starts work, copy `templates/projects.template.json` to `<skill_dir>/projects.json` and walk the user through filling in `vault_root`, `skill_dir`, and one entry per project. Do not silently invent paths; ask the user.

**Validation requires registration.** If a collaborator runs `node <skill_dir>/scripts/check-pm.mjs --project <ProjectName>` while `projects.json` is still the empty template, the validators must stop with an actionable setup message. The correct next step is to use the skill and say "setup as collaborator" or "setup this repo" so the agent can register `access`, `code_repo`, and `pm_folder` (unless access is unavailable).

**When the agent should update `projects.json`:**

**Adding a new project:** the user says "setup", "add a new project", "register a new project", "initialize the PM folder for <name>", or similar. The agent collects the required fields (in this order) and adds the entry to the `projects` object:

- `code_repo` (path to the project's code repo, or `null` if no code yet) — required
- `pm_folder` (path to the project's PM folder inside the vault) — required unless `access` is `"unavailable"`
- `phase` (pre-alpha | alpha | beta | stable | deprecated) — required
- `access` (authoritative | read-only | unavailable) — required
- `notes` (one-line description) — optional

The agent reads the existing `projects.json` (if any), merges the new entry into `projects`, and writes back. **Never silently invent paths — ask the user for each field.** If the user is also bootstrapping the PM folder, this addition is Step 0 of the Bootstrap Workflow (see below).

---

## Setup Intake

Use this when the user says "setup", "set up this repo", "setup this project", "setup PM", "setup project management", "setup as collaborator", or any similar broad setup request. The user should not need to know whether they need bootstrap, repair, read-only registration, or unavailable collaborator mode.

### Inspect before asking

First infer what is safe to infer:

- Current working directory as `code_repo`, if it is a code repo.
- Repo/project name from the directory name, package metadata, README, or git remote.
- Existing project entry in `<skill_dir>/projects.json`.
- Existing `AGENTS.md` and whether it already has a `## PM folder` section.
- Existing PM folder path if `projects.json` already has one.
- Project description hints from README/package/docs.

Do not ask for facts that are already clear. Do ask for intent and missing paths.

### Ask with selectable suggestions

When the UI supports selectable answers, use the question tool. Otherwise, present concise numbered options. Ask in small groups rather than one long form.

1. **Role**
   - Owner / maintainer (recommended when the user controls the PM folder)
   - Collaborator with PM access
   - Collaborator without PM access yet

2. **PM folder state**
   - Create new PM folder (recommended for code-repo-only owner setup)
   - Use existing PM folder
   - Repair messy PM folder

3. **Project phase**
   - `pre-alpha` — idea, research, prototype, or no users yet
   - `alpha` — usable by owner/testers, breaking changes expected
   - `beta` — real users, rough edges remain
   - `stable` — production-quality and maintained
   - `deprecated` — kept for history, not actively developed

4. **AGENTS.md setup**
   - Add/update AGENTS.md (recommended)
   - Skip AGENTS.md for now

Ask free-text follow-ups only for values that cannot be selected:

- Project name, if not clear.
- Code repo path, if current working directory is not clearly the repo.
- PM folder path or vault root, unless access is unavailable.
- One-line project/product description.
- Optional notes.

Map role + PM state to `access` automatically:

- Owner / maintainer → `authoritative`
- Collaborator with PM access → `read-only`
- Collaborator without PM access yet → `unavailable`

### Route after intake

- **Owner + create new PM folder:** register `access: authoritative`, create the standard PM folder, seed initial docs from code repo evidence where possible, optionally add authoritative `AGENTS.md`, then validate.
- **Owner + existing/messy PM folder:** register `access: authoritative`, run repair/audit, preserve content, normalize structure, optionally add authoritative `AGENTS.md`, then validate.
- **Collaborator with PM access:** register `access: read-only`, add the read-only `AGENTS.md` section if requested, read the PM folder for context, and never edit it directly.
- **Collaborator without PM access:** register `access: unavailable`, leave `pm_folder` empty/null, add the unavailable `AGENTS.md` section if requested, ask the maintainer for a PM folder path or read-only mirror, and use PR PM-impact notes until access exists.

Never create a private "canonical" PM folder for a collaborator unless the user explicitly asks for a private local scratch copy. A private scratch copy is not authoritative and must not replace the owner's PM folder.

**Other updates:**
- A project moves (vault path change, code repo relocation).
- A project's phase changes (e.g., alpha → beta).
- A project's one-line description should change.
- A project's access level changes (e.g., promoting a read-only contributor to authoritative, or a collaborator's project becoming read-only because you no longer maintain it).

**Script auto-discovery.** The bundled validation scripts (`<skill_dir>/scripts/check-pm.mjs` plus the focused checks it runs) walk up from their own location looking for a sibling `SKILL.md`; the `projects.json` next to that `SKILL.md` is the default config. Explicit `--config <path>` always wins. An explicit PM-folder path scans that folder directly and bypasses auto-discovered config. Running `node <skill_dir>/scripts/check-pm.mjs` with no arguments validates every available project registered in the skill's local config.

**Why a config file instead of placeholders in the skill text?** Placeholders like `<vault_root>` would require the agent or scripts to substitute them, and would clutter the skill prose. A config file is the right abstraction for "user-specific runtime state" — the skill describes the *convention*; the config holds the *user's instance*.

---

## Features vs System

The `system/` and `features/` folders are **complementary, not redundant**:

| | `system/` | `features/` |
|---|---|---|
| **What it is** | Source of truth for **current behavior** | Curated index for **user-facing capabilities** |
| **Voice** | "How this works" | "What this is" |
| **Lifetime** | Stable; updated when behavior changes | Stable; updated when scope changes |
| **Authority** | Authoritative | Points at system/; never replaces it |
| **Length** | Often long (architectural detail) | Short (50-80 lines; mostly links) |

**Decision rule an agent can apply:**

> If a new agent asks "tell me about X" and X is a coherent thing they'd want to read end-to-end, **it's a feature page**. If X is a piece of architecture that informs multiple features, **it's a system doc only**.

**Concrete test examples:**
- A `chat` feature → "tell me about the chat surface" → **feature** ✓
- The LLM provider, the response parser, the context engine → technical components the chat feature *uses* but isn't the feature itself → **system only** ✓
- Auth → multiple features use auth → **system only** ✓
- Multi-tenancy boundary → multiple features depend on it → **system only** ✓

**When to write a feature page (vs only a system doc):**
- A coherent user-facing capability exists in product and is worth surfacing for agents.
- A coherent technical pillar has accumulated enough system/ and planning/ content that a "tell me everything about X" entry point is useful.
- Not for every system/ doc — only for things with cross-cutting context. Most system/ docs are best surfaced via the `system/` index alone.

**Feature pages do not duplicate content.** They *point* at system/ and planning/; they don't *replace* them. If a system/ doc changes, the feature page's `source_of_truth` link is still valid; no edit needed unless the feature itself changes.

---

## Coding Agent Integration

When a coding agent works in a project's code repo, the PM folder is the source of truth for current behavior. Without explicit guidance, the agent may make code changes without updating the PM folder, causing drift.

**The convention:** the project's `AGENTS.md` includes a `## PM folder` section. The section's content depends on whether the project is **authoritative** (you own the PM folder), **read-only** (someone else maintains it; you can read but not edit), or **unavailable** (you have code access but no PM folder access yet):

- **Authoritative projects** — the section tells the agent to read `system/<topic>.md` before coding and to update the PM folder directly after coding. See `templates/AGENTS_PM_SECTION_AUTHORITATIVE.md`.
- **Read-only projects** — the section tells the agent to read the PM folder for context, but to use the PR body template (`templates/PR_BODY_TEMPLATE.md`) to suggest PM folder changes. The maintainer applies the changes after merge. See `templates/AGENTS_PM_SECTION_READONLY.md`.
- **Unavailable PM projects** — the section tells the agent that no PM folder is available locally. It should ask the maintainer for access, use code repo docs only, and fill the PR body template's PM impact section instead of inventing PM folder edits. See `templates/AGENTS_PM_SECTION_UNAVAILABLE.md`.

The agent checks the project's `access` field in `<skill_dir>/projects.json` (`authoritative`, `read-only`, or `unavailable`) to determine which section to use. The `access` field is set during Setup Intake or when the project is added to the config, and confirmed when AGENTS.md is written/fixed (via the trigger phrases "setup", "add to AGENTS.md", "fix AGENTS.md", "set up AGENTS.md", or "update AGENTS.md for <project>").

A copyable snippet is provided in each template. Project repos that adopt the project-management skill should add the appropriate section to their `AGENTS.md`. The skill is the canonical reference; the project repo's `AGENTS.md` is a thin pointer to it.

**The pattern after a code change (authoritative):**

1. Did current behavior, architecture, data flow, runtime, auth, database, integration, connector, deployment, or operational behavior change? If yes, update the relevant `system/<topic>.md`.
2. Did user-facing behavior or UX change? If yes, update `docs/User Guide/` and the relevant `features/<feature>.md` when feature scope, behavior, known issues, or roadmap changed.
3. Did live product operation change for admins/operators (support, feedback, admin panel workflow, monitoring, statistics, background job run, access, incident response, production verification, or data repair)? If yes, update `docs/Admin Guide/` and add or update `docs/Quick Commands/` for useful commands.
4. Did a coding-engineer workflow change (local setup, codebase structure, API behavior, schema/prompt reference, testing, migration, build, release mechanics, adding/changing job code, or engineering bug knowledge)? If yes, update `docs/Developer Guide/` and add or update `docs/Quick Commands/` for useful commands.
5. Did the change resolve or partially implement a `planning/<date>_slug.md` plan? If yes, mark the relevant PENDING as DONE in `roadmap/done-pending.md`. If the plan is fully shipped, distill durable behavior into `system/`, `docs/`, or `PRODUCT.md`, then archive the plan to `archive/<slug>-archived.md`.
6. Did a bug, risk, or blocker appear or change status? If yes, update `roadmap/known-issues.md`; if it has engineering symptoms, root cause, fix, verification, or recurrence value, also update `docs/Developer Guide/known-bugs.md`.
7. Did a new idea, declined proposal, or backlog candidate appear? If yes, update `roadmap/ideas.md`.
8. Did the change introduce a new pattern, a non-obvious decision, or an architecture shift? If yes, write a new `planning/decisions/ADR-NNN_slug.md`.
9. Did any note get added, moved, renamed, archived, or deleted? If yes, update the affected folder indexes in the same session.
10. Always add a `history/YYYY-MM/history-YYYY-MM-DD.md` bullet for what changed and why (use Conventional Commits prefixes — see "History Conventions").

**The pattern after a code change (read-only):** the agent does not edit the PM folder. Instead, when opening a PR, it fills in the "PM folder impact" section of the PR body template (see `### Contributor Workflow` below). The maintainer applies the PM updates after merge.

**The pattern after a code change (unavailable):** the agent cannot read or edit the PM folder. It should ask the maintainer for read-only PM access if the code change needs project context, rely on code repo docs only until then, and fill in the PR body's "PM folder impact" section with best-effort suggestions and a note that the PM folder was unavailable locally.

---

## OpenClaw PM Agent Bootstrap

Use this when the user says "setup OpenClaw PM agent", "generate OpenClaw PM prompt", "bootstrap OpenClaw PM", "write OpenClaw AGENTS prompt", or similar.

OpenClaw PM agents are long-running project-management stewards. They complement coding agents instead of replacing them:

- **Coding agents** update PM folders after code changes in authoritative projects.
- **OpenClaw PM agents** brainstorm, capture ideas, triage issues, review priorities, audit/repair PM folders, curate coding-agent updates, and coordinate across projects.

### Display the prompt

Display the full copy-paste prompt directly in the response. Do not make the user run a separate install command before they can copy the OpenClaw instructions. The prompt itself tells OpenClaw to install or update the skill:

```bash
curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh \
  | bash -s -- --target openclaw --yes
```

For customized agent names, scopes, or non-default paths, run the read-only renderer and give the output to the user:

```bash
node <skill_dir>/scripts/render-openclaw-pm-agent-prompt.mjs
node <skill_dir>/scripts/render-openclaw-pm-agent-prompt.mjs --agent-name Quill --project-scope "all non-academic projects"
```

The script prints a copy-paste Markdown prompt. It does not edit OpenClaw files, `AGENTS.md`, or `projects.json`.

The prompt is based on `templates/OPENCLAW_PM_AGENT_BOOTSTRAP.md` and includes:

- the OpenClaw install/update command
- `<skill_dir>` — the project-management skill directory
- `<skill_dir>/projects.json` — the local project registry
- the OpenClaw agent's PM role and boundaries
- authoritative/read-only/unavailable access behavior
- common workflows for ideas, known issues, priorities, known bugs, history, validation, and bootstrap
- the required final response habit after PM-folder work

### How the user uses it

The user copies the prompt into their OpenClaw PM agent. The OpenClaw agent installs or updates the skill, verifies `projects.json`, then updates its own workspace `AGENTS.md` with a `## Project Management Skill` section that records the skill path, `projects.json` path, and working rules.

Do not directly mutate an OpenClaw workspace `AGENTS.md` unless the user explicitly asks for that and gives the exact file path. The generated-prompt workflow is the default because it lets the OpenClaw agent own its persistent instructions deliberately.

### PM-agent behavior

An OpenClaw PM agent using this bootstrap should:

1. Read `<skill_dir>/SKILL.md` for routing rules.
2. Read `<skill_dir>/REFERENCE.md` for setup, validation, repair, schema, or bootstrap details.
3. Use `<skill_dir>/projects.json` to find project PM folders and access levels.
4. Read each project PM folder `README.md` before deciding where information belongs.
5. Respect access:
   - `authoritative` — edit PM folder directly.
   - `read-only` — read for context and suggest changes.
   - `unavailable` — ask for access; do not invent a PM folder.
6. Keep durable current-state docs, roadmap notes, and folder indexes synchronized before writing history.
7. Avoid source-code edits unless the user explicitly asks it to code.

### Recommended trigger to tell users

Tell users they can say:

```text
setup OpenClaw PM agent
```

Then copy the displayed prompt into their OpenClaw PM agent.

---

## Big Tasks Must Be Planned

If a feature, fix, or change has **multi-step work, multi-session work, or many rounds of implementation and fixes**, the agent must write the plan to `planning/` first (in the correct format) and mirror it in `roadmap/done-pending.md` before starting implementation.

**Why?** Atomic commits go straight to `history/`. Big work goes through a plan first so the team can review, contribute, and track progress. The `planning/` folder is for big things; `history/` is for small atomic commits.

**Trigger phrases (user-explicit):**
- "this is a big task"
- "multi-session" / "this will take multiple sessions"
- "let me plan this out" / "plan this out"
- "let me think about this" / "let me figure out the approach"

**Auto-detect heuristics (agent infers):**
- The user's request has 3+ distinct steps ("first X, then Y, then Z" / "step 1/2/3" / "phase 1/2")
- The user's request mentions "and then..." or a sequential workflow
- The change spans multiple files in the code repo AND touches the PM folder
- The user previously discussed the task at a high level and is now asking to start

**The flow:**

1. **Write the plan** to `planning/YYYY-MM-DD_slug.md` (date-prefixed filename; see `templates/README.md` → Conventions by Page Type → Planning notes). The plan should have:
   - A clear title and status (`proposed` initially)
   - Context, options considered, decision
   - A step-by-step implementation checklist
2. **Mirror in done-pending:** add a `## YYYY-MM-DD_slug` section to `roadmap/done-pending.md` with the plan's checklist items.
3. **Update plan status** from `proposed` → `active` when implementation begins.
4. **Implement step by step.** For each step completed, mark the done-pending checkbox AND add a history bullet. Update the planning file's checklist as you go.
5. **Distill + archive** when shipped (per existing rules): move the plan to `archive/<slug>-archived.md`, distill the durable behavior into `system/`, and add the closing history bullets.

**Don't skip the plan for big tasks.** If the user says "this is a big task" but the agent dives in without writing the plan, that's a violation. The trigger phrase is a clear signal to plan first.

---

## Contributor Workflow

For projects with external collaborators, the convention is that **every PR body includes a "PM folder impact" section** that lists what PM folder docs should be updated to reflect the PR's changes.

A copyable PR body template is provided in `templates/PR_BODY_TEMPLATE.md`. Project repos should copy it to `.github/PULL_REQUEST_TEMPLATE.md` (or the platform's equivalent) and adapt as needed. The maintainer (or an agent acting on their behalf) applies the PM updates *after* the PR is merged — the PM folder is typically a separate vault from the code repo, so the PM updates don't go in the PR itself.

**The pattern for the contributor:**

1. Open a PR in the code repo.
2. In the PR body, fill in the "PM folder impact" section. Check the boxes for:
   - System docs affected (and what changed)
   - User Guide, Admin Guide, Developer Guide, and Quick Commands docs affected
   - Roadmap known issues or ideas affected
   - Features affected
   - History entries needed (the date and bullet)
   - Planning notes affected (updated, superseded, or moved to archive)
   - ADRs affected (new or existing)
3. Submit the PR.
4. After the PR is merged, the maintainer (or a maintainer-side agent) reads the PR's "PM folder impact" section and applies the corresponding PM updates.

The maintainer's job is to translate the contributor's "PM folder impact" claim into actual PM folder edits. This keeps the contributor focused on the code change while ensuring the PM folder stays in sync.

---

## Sharing and Collaborators

Collaborators typically need read-only access to the PM folder, plus the convention for contributing to the code repo. The skill itself is host-agnostic; the user picks the access mechanism that fits their setup. Common patterns:

- **OneDrive share link** (simplest for OneDrive-synced vaults): give collaborators read-only access to the project folder. They open the vault in their own Obsidian instance. No git involved.
- **Git subtree to a separate read-only mirror**: maintain a git repo with the PM folder content; collaborators clone (read-only) for offline access. Useful for code repos that also want a PM doc in the same repo (e.g., via git subtree).
- **Syncthing to a read-only folder on collaborators' machines**: point Syncthing at the vault; collaborators get a local read-only mirror. No git; near-real-time.
- **Public web mirror** (GitHub Pages, Quartz, etc.): publish the vault as a static site; collaborators browse in a web browser. Useful for non-technical collaborators or external auditors.

The skill does not endorse any specific mechanism; the user picks based on their tooling and threat model. The PM folder convention (planning/, system/, history/, archive/, decisions/, features/) is the same regardless of access mechanism.

---

## Templates

Reusable templates are provided in the `templates/` directory relative to this skill's installation location (i.e., `<skill_dir>/templates/`). When creating a new note or integration artifact, copy the relevant template and fill in the body:

- `templates/README.md` — project root README (sections: What Goes Where, Folder Structure, Quick Rules, Live PM Folder Rule, Naming Conventions, Update Frequency, Conventions by Page Type, Navigation)
- `templates/CURRENT_STATUS.md` — weekly snapshot at project root
- `templates/folder-note.md` — universal folder note (one per visible PM folder: `archive/`, `docs/`, `features/`, `history/`, `planning/`, `roadmap/`, `system/`, `planning/decisions/`, and generated `history/YYYY-MM/YYYY-MM.md` month indexes)
- `templates/planning.md` — planning folder guide
- `templates/features.md` — features folder guide
- `templates/ADR.md` — `planning/decisions/ADR-NNN_slug.md`
- `templates/feature.md` — `features/<feature>.md`
- `templates/ideas.md` — roadmap idea register
- `templates/known-issues.md` — roadmap active/fixed/deferred issue tracker
- `templates/mvp-priorities.md` — MVP priority tracker
- `templates/done-pending.md` — planning mirror and general done/pending tracker
- `templates/known-bugs.md` — `docs/Developer Guide/known-bugs.md`
- `templates/AGENTS_PM_SECTION_AUTHORITATIVE.md` — the `## PM folder` section for `AGENTS.md` when the project is authoritative (you own the PM folder; update it directly)
- `templates/AGENTS_PM_SECTION_READONLY.md` — the `## PM folder` section for `AGENTS.md` when the project is read-only (someone else maintains the PM folder; suggest changes via the PR body template)
- `templates/AGENTS_PM_SECTION_UNAVAILABLE.md` — the `## PM folder` section for `AGENTS.md` when a collaborator has code access but no PM folder access yet
- `templates/OPENCLAW_PM_AGENT_BOOTSTRAP.md` — copy-paste prompt template for bootstrapping an OpenClaw PM agent's workspace `AGENTS.md`
- `templates/PR_BODY_TEMPLATE.md` — copy to `.github/PULL_REQUEST_TEMPLATE.md` for the contributor's "PM folder impact" section
- `templates/projects.template.json` — blank starter for `projects.json` (not a Markdown file template but a JSON starter)

Each template is fully frontmatter-populated. The agent replaces the placeholder text in the body with the project-specific content.

Do not let planning notes become invisible backlog. The roadmap must show the active to-do state.

---

## Bootstrap Workflow

When an agent is asked to set up a new project vault from scratch, follow this workflow after the Setup Intake has routed the user to "Owner + create new PM folder". Each step references the relevant section of the skill or a template in `templates/`.

**0. Add the project to `projects.json`.** Collect the required fields (code_repo, pm_folder, phase, access) from the user and write a new entry to `<skill_dir>/projects.json`. See "Configuration → Adding a new project" for the field reference. Never silently invent paths. If `projects.json` doesn't exist, copy from `projects.template.json` first (this also satisfies the auto-bootstrap flow).

1. **Create the folder structure.** `mkdir planning/ roadmap/ system/ history/ archive/ docs/ features/`
2. **Create the four root notes** (copy templates from `templates/`):
   - `README.md` (from `templates/README.md`) — the "where to write things" guide
   - `PRODUCT.md` — product vision (write directly; no template)
   - `<Project>.md` — project landing note (write directly)
   - `CURRENT_STATUS.md` (from `templates/CURRENT_STATUS.md`) — initial weekly snapshot
3. **Create the planning index.** `planning/planning.md` (from `templates/folder-note.md`).
4. **Create the four standard roadmap notes** (lifecycle-tracked, slug filenames):
   - `roadmap/mvp-priorities.md`
   - `roadmap/known-issues.md`
   - `roadmap/done-pending.md`
   - `roadmap/ideas.md`
5. **Create the system index.** `system/system.md` plus at least one `system/*.md` doc.
6. **Create the archive and history indexes.** `archive/archive.md`, `history/history.md`. When the first `history/YYYY-MM/` month folder is created later, also create `history/YYYY-MM/YYYY-MM.md` and link it from `history/history.md`.
7. **Create the docs guide indexes and known-bugs note.** Create `docs/docs.md`, `docs/Admin Guide/Admin Guide.md`, `docs/Developer Guide/Developer Guide.md`, `docs/Developer Guide/known-bugs.md` (from `templates/known-bugs.md`), `docs/Quick Commands/Quick Commands.md`, and `docs/User Guide/User Guide.md`.
8. **Create the features folder + index** (new convention, **required for any project past initial planning**). Copy `templates/folder-note.md` to `features/features.md` and fill in the body. Pre-alpha projects have an empty index; mature projects seed feature pages as features enter the design phase.
9. **Use the bundled validation wrapper** in `<skill_dir>/scripts/`. Project repos do not need local script copies unless they want project-specific CI.
10. **Run `<skill_dir>/scripts/check-pm.mjs --project <ProjectName> --config <skill_dir>/projects.json`** to verify the structure, stale-doc metadata, frontmatter, folder notes, links, planning mirrors, and AGENTS.md PM section are correct.
11. **Fill in `CURRENT_STATUS.md`** with the initial snapshot (Current Phase, Top Priorities, Blocked, Recent Wins, Major Risks, Relevant ADRs, Relevant Features). Update weekly.

After bootstrap, the agent and any future agents should be able to open the project, read the four root notes, and orient themselves without further setup.

### When to skip the bootstrap workflow

- **For an existing project**, don't run the bootstrap. The project is already set up; agents should use the existing structure.
- **For a new sub-project** within an existing project (e.g., a new feature, a new doc), create the new note using the relevant template, but don't re-run the full bootstrap.
- **For a temporary project** (a spike, a sandbox), the bootstrap may be overkill. At minimum, create the root notes and a single planning file.

---

## Live Management Folder Rule

Management folders are live. Agents may create notes inside the right folder when the existing files are not a good fit, but they must keep the structure controlled.

### Permission Policy

| Action | Ask the user first? | Rule |
|---|---:|---|
| Create `history/YYYY-MM/history-YYYY-MM-DD.md` | No | Use for completed meaningful work on that date. Add `kind: changelog | worklog | mixed` to the frontmatter. If creating the month folder, also create/update `history/YYYY-MM/YYYY-MM.md` and link it from `history/history.md`. Use Conventional Commits prefixes (`feat:`, `fix:`, etc.) for each bullet — see "History Conventions" |
| Prefix history bullets with Conventional Commits types (`feat:`, `fix:`, etc.) | No (encouraged) | See "History bullet prefixes" for the 10 standard types and optional scope syntax |
| Add a `tracker:` field to a `roadmap/known-issues.md` entry | No (encouraged) | Use when the project has an external issue tracker (GitHub, GitLab, Linear, etc.). Format: `**Tracker:** [GH-NNNN](url)`. See "External Issue Tracker Integration" |
| Create a dated `planning/<date>_slug.md` for an approved plan | No | Also update `roadmap/done-pending.md`. Required for big tasks (multi-step / multi-session / many rounds) — see "Big Tasks Must Be Planned" |
| Create `planning/decisions/ADR-NNN_slug.md` for a significant architecture decision | No | ADR lifecycle: `proposed` → `accepted` → `deprecated`/`superseded`. If superseding, set the new ADR's `supersedes:` field |
| Create a `<topic>.md` `system/` note for durable current state | No | Only when existing system notes are not a good fit |
| Create `features/features.md` and per-feature pages | No | **Required** for any project past initial planning. Empty index is fine for pre-alpha; seed feature pages as features enter the design phase |
| Update `CURRENT_STATUS.md` at the project root | No | Weekly snapshot of where the project is now; PM agent maintains |
| Create a new note inside `docs/` existing guide folders | Usually no | Use when behavior/workflow docs need a clear page |
| Create a new note inside `roadmap/` | Yes | Prefer the four standard roadmap notes |
| Create a new content note inside `archive/` | No | Don't. `archive/` is for moved files only. The only in-place note is the folder index `archive/archive.md`, and it must not have `archived:`. Move retired content there with the rename convention `<slug>-archived.md` and add an `archived: <date>` field |
| Create a new root note | Yes | Root should almost always stay limited to `<Project>.md`, `README.md`, `PRODUCT.md`, and `CURRENT_STATUS.md` |
| Create a new top-level folder | Yes | Explain why existing lanes do not fit |
| Create a new docs guide category | Yes | Prefer Admin, Developer, Quick Commands, or User Guide |
| Restructure/archive large sections | Yes | Explain what becomes canonical after the move |

When asking permission, propose the exact path, purpose, and why existing lanes are insufficient.

---

## Project-Specific Configuration

Project-specific configuration (product names, taglines, vault roots, runtime directions, agent conventions, etc.) lives in each project's `README.md` and `AGENTS.md`, not in the skill. The skill is host-agnostic; each project configures its own details in the project root.

The canonical reference for any project's current state is its `README.md` at the PM folder root, and for any code project, its `AGENTS.md` in the code repo. The skill respects whatever the project says; the skill does not enforce a global "Project Boundaries" table.

**What the skill enforces (across all projects):**
- The folder structure (planning/, system/, history/, archive/, docs/, features/, roadmap/)
- The 4 standard roadmap notes and their slug filenames
- The date-prefixed planning filename convention
- The `<slug>-archived.md` rename rule
- The frontmatter schema (per `pageType`)
- The 5 planning-lifecycle `status` values
- The `access` field on each project in `projects.json`
- The Setup Intake routing and selectable phase/access suggestions

**What the skill leaves to each project:**
- Vault structure (`Projects/<Project>/...` vs other layouts)
- Project name, tagline, target user, MVP loop
- Choice of access mechanism for collaborators (OneDrive / Syncthing / Git subtree / web mirror)
- Choice of AI runtime, code style, deployment target
- Additional root notes (e.g., `TEAM.md`, `VALUES.md`) if the project needs them

The split keeps the skill portable while letting each project own its specifics.

---

## Pitfalls

- Logging only to `history/` when durable current state changed.
- Updating the matching `system/` doc but not the matching `features/<feature>.md` page (the feature page's `source_of_truth` link is stale).
- Creating a new root note because it feels convenient.
- Creating a new roadmap note instead of updating the four standard roadmap notes.
- Writing a concrete plan without adding matching pending items to `roadmap/done-pending.md`.
- Writing a significant architecture decision as a planning note but not as an ADR (use `planning/decisions/ADR-NNN_slug.md`).
- Adding a `history/YYYY-MM/history-YYYY-MM-DD.md` file without `kind: changelog | worklog | mixed` (stale detection treats untagged files as never-reviewed).
- Creating a new top-level folder without explaining why existing lanes are insufficient.
- Treating generic template rules as stronger than a project's root `README.md`.
- Forgetting to update folder indexes after creating, moving, archiving, or deleting notes.
- Renaming a planning file to `archive/` without applying the `<slug>-archived.md` rename rule and adding `archived: <date>`.
