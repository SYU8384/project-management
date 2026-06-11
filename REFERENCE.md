# Project Management — Reference

This is the deep doc for the project-management skill. SKILL.md has the entry point (intents, triggers, quick start, routing map, final response); this file has everything else — repair workflows, schemas, contributor conventions, bootstrap workflow, permission policy, pitfalls.

The split mirrors the "Writing Skills" framework: SKILL.md is lean (~150 lines) and loadable for any matching trigger; REFERENCE.md is the deep doc an agent reads when it needs the details.

---

## Validation and Repair

Use this when the user asks to "verify", "validate", "audit", "check", "repair", or "fix" the PM folder, project setup, or code repo `AGENTS.md` integration.

- **Verify / validate / check / audit** means run the validation tools and report findings without editing files.
- **Repair / fix** means run validation, fix authoritative PM-folder and code repo AGENTS.md integration issues, then rerun validation.

Primary command:

```bash
node <skill_dir>/scripts/check-pm.mjs
node <skill_dir>/scripts/check-pm.mjs --project <ProjectName>
# --config is only needed for non-default locations; v1.3.0+ defaults to
# ~/.config/project-management/projects.json
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
node <skill_dir>/scripts/check-pm.mjs --project <ProjectName>
```

The wrapper runs:

- `node <skill_dir>/scripts/check-vault-structure.mjs` — verifies the required folder/file layout
- `node <skill_dir>/scripts/check-stale-docs.mjs` — surfaces never-reviewed and stale docs
- `node <skill_dir>/scripts/check-pm-consistency.mjs` — verifies visible-file frontmatter, page types, history/archive fields, internal wiki links, planning mirrors, and archive/sync-conflict naming
- `node <skill_dir>/scripts/check-agents.mjs` — verifies registered code repo `AGENTS.md` files have the expected `## PM folder` section for each project's `access` value

Then check the schema and content dimensions:

1. **Schema compliance** — every note has the right `pageType:`, `status:` (per pageType vocabulary), `archived:` (only on archive files), `kind:` (only on history files), and other recommended fields. The `status: archived` value is **invalid** — `archived` is a separate date field, not a status value.
2. **H1 vs filename** — each note's H1 matches its filename stem (no leftover numbered prefixes, no date prefix in the H1).
3. **Cross-link integrity** — all `[[wiki-link]]` targets resolve to existing files.
4. **CURRENT_STATUS freshness** — the weekly snapshot exists and is not stale.
5. **Planning ↔ roadmap mirror** — each `roadmap/plans/*.md` has a matching `## YYYY-MM-DD_slug` section in `roadmap/done-pending.md`.
6. **History `kind:`** — every `history/YYYY-MM/history-YYYY-MM-DD.md` has a `kind: changelog | worklog | mixed` field.
7. **Archive `archived:` field** — every moved archive file named `archive/*-archived.md` has both a meaningful `status:` (lifecycle) and an `archived: <date>` field. Folder indexes such as `archive/archive.md` must not carry `archived:`.
8. **Folder structure** — all required folders and root files exist; feature/ADR/roadmap index pages exist where needed.
9. **Feature pages** — coherent features have pages; technical components stay in `system/`.
10. **Docs guide indexes** — `docs/Admin Guide/Admin Guide.md`, `docs/Developer Guide/Developer Guide.md`, `docs/Quick Commands/Quick Commands.md`, and `docs/User Guide/User Guide.md` are folder-note indexes only; durable content lives in independent notes.
11. **Known bugs note** — `docs/Developer Guide/known-bugs.md` exists and records engineering bug knowledge with status, symptoms, root cause, solution, verification, and references.
12. **README sync** — the project's `README.md` "What Goes Where", "Quick Rules", and "Update Frequency" sections match the canonical template.
13. **AGENTS.md integration** — registered projects with a real `code_repo` have an `AGENTS.md` file with the expected `## PM folder` section for `access: authoritative | read-only`; no unresolved placeholders remain.

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

## Migrations

The skill ships a declarative migration runner for breaking PM-folder changes (lane moves, field renames, schema promotions). Adding a new migration is one new file in `scripts/migrations/` plus one line in `_index.mjs` — the runner, validator, and CLI stay the same.

### How it works

```
scripts/
├── migrate.mjs                    # the runner
└── migrations/
    ├── _index.mjs                 # ordered registry (default-exports specifier list)
    └── 1.0.0-lane-restructure.mjs # first registered migration
```

Each migration module default-exports:

```js
export default {
  id: "1.0.0-lane-restructure",   // unique, stable
  from: "<1.0.0",                  // pre-state version range (informational)
  to: "1.0.0",                     // post-state version
  describe: "Move planning/ → roadmap/plans/; …", // one-paragraph summary
  detect({ pmFolder }) { … },      // return true if the migration should run
  plan({ pmFolder }) { … },        // optional: return string[] for confirmation prompt
  apply({ pmFolder, ctx }) { … },  // perform the change; idempotent
};
```

The runner:

1. Reads `.pm/migrations.json` in the project root (created on first apply; contains the applied-migrations ledger).
2. Walks the registry in order. For each migration whose `id` is not in the ledger, calls `detect()`. If true, calls `apply()` after user confirmation.
3. On success, appends `{ id, applied_at, skill_version }` to the ledger.
4. **Idempotent.** Re-running on an already-migrated project is a no-op.

### CLI

```bash
node <skill_dir>/scripts/migrate.mjs --project <name>           # resolves pm_folder from projects.json
node <skill_dir>/scripts/migrate.mjs --pm-folder <path>         # bypass projects.json
node <skill_dir>/scripts/migrate.mjs --list                     # print registered migrations
node <skill_dir>/scripts/migrate.mjs --migration <id>           # apply only this one (escape hatch)
node <skill_dir>/scripts/migrate.mjs --dry-run                  # print the plan, don't change anything
node <skill_dir>/scripts/migrate.mjs --yes                      # skip the confirm prompt
```

Exit codes: `0` = no work or all migrations applied cleanly, `1` = a migration failed mid-apply (re-run after fixing the cause), `2` = argument or state error.

### Ledger

The applied-migrations ledger lives at `<pm_folder>/.pm/migrations.json`. Hidden dir (`.pm/`) so it doesn't trip the "no new top-level files" rule. The runner writes `.pm/.gitignore` containing `*` on first apply so users who git-track their PM folder don't accidentally commit the ledger.

Ledger shape:

```json
{
  "schema_version": 1,
  "applied": [
    { "id": "1.0.0-lane-restructure", "applied_at": "2026-06-10T…", "skill_version": "1.0.0" }
  ]
}
```

### Out of scope for migrations

`archive/` and `history/` are intentionally **not** rewritten by migrations. Both are immutable in spirit; broken wikilinks that result from a lane move surface in `check-pm-consistency.mjs` as unresolved links, which is the correct behavior — the user can decide whether to add a redirect note, fix the wikilink, or leave it for historical accuracy.

### Authoring a new migration

1. Create `scripts/migrations/<id>.mjs`. Pick `<id>` as `<version>-<slug>` (e.g. `1.1.0-decision-type-required`).
2. Export `{ id, from, to, describe, detect, plan?, apply }`. Make `detect()` safe to call multiple times; make `apply()` idempotent (the runner does not guarantee single-call semantics).
3. Add `"<id>.mjs"` to the array in `scripts/migrations/_index.mjs`.
4. Add a `CHANGELOG.md` entry under the version that introduces the change.
5. Update `REFERENCE.md` if the migration changes the lane shape in a way that other docs need to reflect.

### Agent behavior on detection

The validator (`check-vault-structure.mjs`) reads the same registry and emits a `## Unapplied Migrations` section when a registered migration's `detect()` returns true. When the agent (the LLM running the skill) sees this section in its validator output, it should:

1. **Scope the ask to the project the user is currently working on.** Do not surface migration debt on unrelated projects during unrelated work.
2. **Name the specific migration id.** Not "want to migrate?" — "Migration `1.0.0-lane-restructure` is unapplied for project *X*. It would: move `planning/` to `roadmap/plans/`, …" with the concrete list of effects.
3. **Ask once per session.** If the user declines, suppress re-asks for the rest of the session. Do not nag.
4. **Run on approval.** On user "yes," run `node <skill_dir>/scripts/migrate.mjs --project <name> --yes`. Report the script's output verbatim and suggest the history bullet the script prints.
5. **Do not auto-migrate.** Migration is structurally different from "log this." Migration restructures existing files; logging is append-only. Even in `access: authoritative` projects, the user must approve.

### Registered migrations (v1.0.0)

#### `1.0.0-lane-restructure`

The first registered migration. Restructures the PM-folder layout:

- `planning/` → `roadmap/plans/`
- `planning/decisions/` → `decisions/` (top-level, peers with `roadmap/`)
- `ADR-NNN_<slug>.md` → `D-NNN_ADR_<slug>.md`
- Frontmatter `pageType: adr` → `pageType: decision`, adds `decision_type: ADR`
- Wikilinks: `[[…/planning/…]]` → `[[…/roadmap/plans/…]]`, `[[…/planning/decisions/…]]` → `[[…/decisions/…]]`

Preserves `archive/` and `history/` untouched. Idempotent: re-running is a no-op. Use `--dry-run` first to see the plan.

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

If your setup has multiple projects, identify which one applies from the context (channel, working directory, recent files, explicit mention). The user's own config (`~/.config/project-management/projects.json` from v1.3.0+) is the canonical place for project paths and metadata.

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
- `roadmap/plans/plans.md`
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

Casing is semantic, not uniform. Top-level PM lanes stay lowercase (`archive/`, `docs/`, `history/`, `system/`). The four standard docs guide folders use Title Case (`Admin Guide/`, `Developer Guide/`, `Quick Commands/`, `User Guide/`) because they are user-facing category labels. Folder notes exactly match their folder names, content notes use lowercase slugs, and uppercase filenames are reserved for root artifacts (`README.md`, `PRODUCT.md`, `CURRENT_STATUS.md`) plus the `D-NNN_` decision-id prefix.

`docs/Developer Guide/known-bugs.md` is required for every PM folder. It is the engineering bug knowledge base: active bugs, fixed bugs, recurring root-cause patterns, solutions, verification, and references to `roadmap/known-issues.md` or `history/`. `roadmap/known-issues.md` remains the active roadmap tracker for bugs, risks, and blockers.

When adding or moving a docs note, update the nearest guide index and `docs/docs.md` if a guide folder changes.

### Roadmap Note Shape

The four standard roadmap notes are active working notes, not folder notes, but they still need a predictable scan shape:

- `roadmap/ideas.md` follows `templates/ideas.md`: `## Contents`, `## Status Key`, `## Idea Register`, status buckets (`## Brainstorming`, `## Scoping`, `## Approved`, `## Implemented`, `## Declined`), `## Idea Details`, and `## Navigation`. Use stable IDs (`IDEA-001`, `IDEA-002`) so links survive reordering.
- `roadmap/known-issues.md` follows `templates/known-issues.md`: `## Contents`, `## Active`, `## Fixed`, `## Deferred`, and `## Navigation`. Domain-specific grouping belongs under those sections as labels or `###` subsections.
- `roadmap/mvp-priorities.md` follows `templates/mvp-priorities.md`: `## Contents`, `## Alpha Goal`, `## MVP Priorities`, `## Not Yet MVP`, and `## Navigation`.
- `roadmap/done-pending.md` follows `templates/done-pending.md`: `## Contents`, planning-note mirrored sections, `## General Done/Pending Without Dedicated Planning Note`, and `## Navigation`.
- Keep rough ideas in `ideas.md`, concrete approved work in `roadmap/plans/` plus `done-pending.md`, active bugs/risks in `known-issues.md`, and engineering bug knowledge in `docs/Developer Guide/known-bugs.md`.

---

## Planning To Roadmap Sync

Concrete plans in `roadmap/plans/` must be reflected in `roadmap/done-pending.md`.

`roadmap/done-pending.md` should mirror planning note filenames first:

- Create one `## <planning-file-stem>` section for each concrete `roadmap/plans/*.md` note except `plans.md`.
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
3. Completed plans and completed done/pending sections should not remain in active PM lanes. Active `roadmap/plans/` is for unfinished plans. Active `roadmap/done-pending.md` is for unfinished roadmap state and lightweight pending work.
4. If every checkbox in the related `roadmap/done-pending.md` section is complete, first distill durable current truth into `system/`, `docs/`, or `PRODUCT.md`, then archive that section to `history/YYYY-MM/history-YYYY-MM-DD-archived-sections.md` and remove it from active `done-pending.md`.
5. If the completed section mirrors a completed `roadmap/plans/*.md` note, move the planning note to `archive/<slug>-archived.md` (drop the date prefix and any number; preserve the slug). Add an `archived: <date>` field to the frontmatter; keep the original `created:` field.
6. If a `roadmap/plans/*.md` note is complete even without a matching roadmap section, first distill durable truth into `system/`, `docs/`, or `PRODUCT.md`, then move it to `archive/`.
7. Update `roadmap/plans/plans.md`, `archive/archive.md`, `roadmap/done-pending.md`, the moved note's `## Navigation`, and every wiki link that points to the old planning filename.
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
| `pageType` | Required | `planning` \| `system` \| `feature` \| `decision` \| `roadmap` \| `history` \| `index` \| `note` | Drives downstream tooling (stale detection, search filters) |
| `aliases` | Optional | `[string, ...]` | Backlink-friendly alternative titles |
| `tags` | Optional | `[string, ...]` | Existing convention; free-form |
| `updated` | Required | `YYYY-MM-DD` | Last meaningful edit; default `= created` if omitted |
| `last_reviewed` | Required | `YYYY-MM-DD` | Last human/agent review pass; powers stale detection |
| `status` | Required | (lifecycle, per `pageType`) | Lifecycle status. Valid values depend on `pageType`; see the pageType-specific sections below. `history/YYYY-MM/history-YYYY-MM-DD.md` files omit this field (use `kind: changelog \| worklog \| mixed` instead) |
| `archived` | Optional | `YYYY-MM-DD` | File-location marker: present (with a date) when the file has been moved to `archive/`. Does NOT replace `status` — `status` still carries the lifecycle (a shipped-then-archived plan keeps `status: shipped` and adds `archived: <date>`) |
| `owner` | Required | string (role or name) | E.g. `PM`, `Platform team`, `Operator` |
| `source_of_truth` | Optional | path | Canonical source for this topic; use on `feature` pages and high-traffic `system/` docs |
| `related` | Optional | `[path, ...]` | Cross-links to other notes |

### `pageType`-specific fields

**Decision (`pageType: decision`):** the base `status` field uses the decision lifecycle:
- `proposed` — under discussion, not yet accepted
- `accepted` — the chosen direction; default for a decision in force
- `active` — accepted and being rolled out; should be temporary
- `deprecated` — no longer recommended; kept for historical record
- `superseded` — replaced by another decision; pair with a new decision's `supersedes` field

Add `decision_type: <ADR | PRD | MKT | VND | POL | NEG | EXP>`, `decision_date: YYYY-MM-DD`, and (if applicable) `supersedes: <D-id>`. `decisions/` is a typed first-class PM lane at the project root.

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

Notes with `last_reviewed` more than 30 days old are flagged as **stale**. Notes never reviewed or more than 90 days old are **very stale**. Run `node <skill_dir>/scripts/check-pm.mjs --project <ProjectName>` to generate the full validation report; surface the stale-doc summary in `CURRENT_STATUS.md` under "Stale Docs". v1.3.0+ resolves `projects.json` from `~/.config/project-management/projects.json` by default.

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

**Config file location:** v1.3.0+ stores `projects.json` at `~/.config/project-management/projects.json` (XDG-conformant user-specific location), not in the skill directory. This keeps the skill portable and user-agnostic — the same skill can be shipped to another user without leaking personal paths. A blank starter lives at `templates/projects.template.json`. Path resolution precedence: `--config <path>` flag (highest) → user-specific `projects.json`. The skill-root `projects.json` is **not** read; pre-v1.3.0 users must move their file once (`mv <skill_dir>/projects.json ~/.config/project-management/projects.json`).

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
      "access": "authoritative | read-only"
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
- `projects.<name>.access` — `"authoritative"` (you own the PM folder; the agent edits it directly when you change code, run setup, or reconcile) or `"read-only"` (you have the maintainer's PM folder mounted read-only; the agent never edits it and uses the PR body to signal PM changes). Drives the `## PM folder` section written to the project's `AGENTS.md` (see "Coding Agent Integration" below). Projects with no PM access at all are not registered in `projects.json`; the maintainer registers the project on their side, and the contributor workflow is via PR body, not the skill.

**Auto-bootstrap on first use.** v1.3.0+: if `~/.config/project-management/projects.json` is missing when the agent starts work, the bootstrap script (`scripts/bootstrap-pm.mjs`) copies `templates/projects.template.json` to the user location and walks the user through filling in `vault_root`, `skill_dir`, and one entry per project. Do not silently invent paths; ask the user.

**Validation requires registration.** If a user runs `node <skill_dir>/scripts/check-pm.mjs --project <ProjectName>` while `projects.json` is still the empty template, the validators must stop with an actionable setup message. The correct next step is to use the skill and say "setup this repo" (owner/maintainer) or "setup as collaborator" (read-only collaborator) so the agent can register `access`, `code_repo`, and `pm_folder`. Projects with no PM access at all are not registered here; the maintainer registers them on the maintainer's side, and the contributor workflow is via PR body, not the skill.

**Setup always verifies registration first.** Whether setup is started by a coding agent ("setup this repo") or by an OpenClaw PM agent (`openclaw-instruction.md`), the agent must inspect `projects.json` before assuming the skill is configured. Missing, empty, or template-only registries mean setup has not completed. Populated registries should be summarized back to the user for path confirmation and optional new-project registration.

**When the agent should update `projects.json`:**

**Adding a new project:** the user says "setup", "add a new project", "register a new project", "initialize the PM folder for <name>", or similar. The agent collects the required fields (in this order) and adds the entry to the `projects` object:

- `code_repo` (path to the project's code repo, or `null` if no code yet) — required
- `pm_folder` (path to the project's PM folder inside the vault) — required
- `phase` (pre-alpha | alpha | beta | stable | deprecated) — required
- `access` (authoritative | read-only) — required
- `notes` (one-line description) — optional

The agent reads the existing `projects.json` (if any), merges the new entry into `projects`, and writes back. **Never silently invent paths — ask the user for each field.** If the user is also bootstrapping the PM folder, this addition is Step 0 of the Bootstrap Workflow (see below).

---

## Setup Intake

Use this when the user says "setup", "set up this repo", "setup this project", "setup PM", "setup project management", "setup as collaborator", or any similar broad setup request. The user should not need to know whether they need bootstrap, repair, or read-only registration. (Contributors with no PM access don't use this flow; their workflow is via PR body, not the skill.)

### Inspect before asking

First infer what is safe to infer:

- Current working directory classification: clear code repo, clear PM folder, registered project path, or empty/unrecognized.
- Repo/project name from the directory name, package metadata, README, or git remote.
- Existing project entry in `~/.config/project-management/projects.json`.
- Existing `AGENTS.md` and whether it already has a `## PM folder` section.
- Existing PM folder path if `projects.json` already has one.
- Project description hints from README/package/docs.

Treat an empty or unrecognized current working directory as a candidate path, not as evidence that setup cannot continue. If `cwd` is empty, has no strong repo/PM-folder signals, or could plausibly be either an empty code repo or an empty PM folder, ask what the current folder represents:

- Current folder is the code repo, even if empty.
- Current folder is the PM folder, even if empty.
- Current folder is neither; use another path, or `code_repo: null` if no code exists yet.

Then route path follow-ups from that answer:

- If `cwd` is the code repo, set `code_repo` to the absolute `cwd` path and ask for the PM folder path or vault root (only when the user has authoritative or read-only access; contributors with no PM access do not register projects in `projects.json`).
- If `cwd` is the PM folder, set `pm_folder` to the absolute `cwd` path and ask for the code repo path or `null` if no code exists yet.
- If `cwd` is neither, ask for both paths as needed.

Do not ask for facts that are already clear. Do ask for intent and missing paths.

### Ask with selectable suggestions

When the UI supports selectable answers, use the question tool. Otherwise, present concise numbered options. Ask in small groups rather than one long form.

1. **Role**
   - Owner / maintainer (recommended when the user controls the PM folder)
   - Collaborator with PM access (the PM folder is mounted read-only on the user's machine)

   Contributors with no PM access at all don't use this flow. The maintainer registers the project on the maintainer's side, and the contributor workflow is via PR body, not the skill.

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
   - Owner / maintainer with a real `code_repo`: create or update `AGENTS.md` automatically unless the user explicitly refuses file edits.
   - Collaborator or no-code setup: add/update `AGENTS.md` when useful, or skip when `code_repo` is `null`.

Ask free-text follow-ups only for values that cannot be selected:

- Project name, if not clear.
- Code repo path, if current working directory was not confirmed as the repo.
- PM folder path or vault root, if current working directory was not confirmed as the PM folder and the user has access.
- One-line project/product description.
- Optional notes.

Map role + PM state to `access` automatically:

- Owner / maintainer → `authoritative`
- Collaborator with PM access → `read-only`

(Contributors with no PM access at all are not registered in `projects.json`; their workflow is via PR body, not the skill.)

### Route after intake

- **Owner + create new PM folder:** register `access: authoritative`, create the standard PM folder, seed initial docs from code repo evidence where possible, create/update authoritative `AGENTS.md` when `code_repo` is not `null`, then validate. Empty confirmed PM folders are valid bootstrap targets, and empty confirmed code repos still get `AGENTS.md`.
- **Owner + existing/messy PM folder:** register `access: authoritative`, run repair/audit, preserve content, normalize structure, create/update authoritative `AGENTS.md` when `code_repo` is not `null`, then validate.
- **Collaborator with PM access:** register `access: read-only`, add the read-only `AGENTS.md` section if requested, read the PM folder for context, and never edit it directly.

Never create a private "canonical" PM folder for a collaborator unless the user explicitly asks for a private local scratch copy. A private scratch copy is not authoritative and must not replace the owner's PM folder.

**Other updates:**
- A project moves (vault path change, code repo relocation).
- A project's phase changes (e.g., alpha → beta).
- A project's one-line description should change.
- A project's access level changes (e.g., promoting a read-only contributor to authoritative, or a collaborator's project becoming read-only because you no longer maintain it).

**Script auto-discovery.** v1.3.0+: the bundled validation scripts read `projects.json` from `~/.config/project-management/projects.json` by default. Path resolution precedence: `--config <path>` flag (highest) → user-specific `projects.json`. The skill-root `projects.json` is **not** read; pre-v1.3.0 installs must move their file once. An explicit PM-folder path scans that folder directly and bypasses config-based project discovery. Running `node <skill_dir>/scripts/check-pm.mjs` with no arguments validates every available project registered in the local config.

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
- A coherent technical pillar has accumulated enough system/, `roadmap/plans/`, and `decisions/` content that a "tell me everything about X" entry point is useful.
- Not for every system/ doc — only for things with cross-cutting context. Most system/ docs are best surfaced via the `system/` index alone.

**Feature pages do not duplicate content.** They *point* at system/, `roadmap/plans/`, and `decisions/`; they don't *replace* them. If a system/ doc changes, the feature page's `source_of_truth` link is still valid; no edit needed unless the feature itself changes.

---

## Coding Agent Integration

When a coding agent works in a project's code repo, the PM folder is the source of truth for current behavior. Without explicit guidance, the agent may make code changes without updating the PM folder, causing drift.

**The convention:** the project's `AGENTS.md` includes a `## PM folder` section. The section's content depends on whether the project is **authoritative** (you own the PM folder) or **read-only** (someone else maintains it; you have the PM folder mounted read-only):

- **Authoritative projects** — the section tells the agent to read `system/<topic>.md` before coding and to update the PM folder directly after coding. See `templates/AGENTS_PM_SECTION_AUTHORITATIVE.md`.
- **Read-only projects** — the section tells the agent to read the PM folder for context, but to use the PR body template (`templates/PR_BODY_TEMPLATE.md`) to suggest PM folder changes. The maintainer applies the changes after merge. See `templates/AGENTS_PM_SECTION_READONLY.md`.

Projects with no PM access at all (either the maintainer doesn't use the skill, or the maintainer uses it but doesn't share the PM folder) don't get an `AGENTS.md` PM section and aren't registered in `projects.json` on the contributor's side. The contributor's role is via PR body: fill in the "PM folder impact" section per the template. The maintainer's agent reads the PR body and applies the PM folder updates on their side. The `templates/AGENTS_PM_SECTION_UNAVAILABLE.md` template is now retired; if you encounter a reference to it, the modern equivalent is the read-only workflow + PR body convention.

The agent checks the project's `access` field in `~/.config/project-management/projects.json` (`authoritative` or `read-only`) to determine which section to use. The `access` field is set during Setup Intake or when the project is added to the config, and confirmed when AGENTS.md is written/fixed (via the trigger phrases "setup", "add to AGENTS.md", "fix AGENTS.md", "set up AGENTS.md", or "update AGENTS.md for <project>").

A copyable snippet is provided in each template. Project repos that adopt the project-management skill should add the appropriate section to their `AGENTS.md`. The skill is the canonical reference; the project repo's `AGENTS.md` is a thin pointer to it.

**The pattern after a code change (authoritative):**

1. Did current behavior, architecture, data flow, runtime, auth, database, integration, connector, deployment, or operational behavior change? If yes, update the relevant `system/<topic>.md`.
2. Did user-facing behavior or UX change? If yes, update `docs/User Guide/` and the relevant `features/<feature>.md` when feature scope, behavior, known issues, or roadmap changed.
3. Did live product operation change for admins/operators (support, feedback, admin panel workflow, monitoring, statistics, background job run, access, incident response, production verification, or data repair)? If yes, update `docs/Admin Guide/` and add or update `docs/Quick Commands/` for useful commands.
4. Did a coding-engineer workflow change (local setup, codebase structure, API behavior, schema/prompt reference, testing, migration, build, release mechanics, adding/changing job code, or engineering bug knowledge)? If yes, update `docs/Developer Guide/` and add or update `docs/Quick Commands/` for useful commands.
5. Did the change resolve or partially implement a `roadmap/plans/<date>_slug.md` plan? If yes, mark the relevant PENDING as DONE in `roadmap/done-pending.md`. If the plan is fully shipped, distill durable behavior into `system/`, `docs/`, or `PRODUCT.md`, then archive the plan to `archive/<slug>-archived.md`.
6. Did a bug, risk, or blocker appear or change status? If yes, update `roadmap/known-issues.md`; if it has engineering symptoms, root cause, fix, verification, or recurrence value, also update `docs/Developer Guide/known-bugs.md`.
7. Did a new idea, declined proposal, or backlog candidate appear? If yes, update `roadmap/ideas.md`.
8. Did the change introduce a new pattern, a non-obvious decision, or an architecture shift? If yes, write a new `decisions/D-NNN_<type>_<slug>.md`. Type codes: `ADR` (architecture), `PRD` (product), `MKT` (market/positioning), `VND` (vendor pick), `POL` (policy/operating rule), `NEG` (explicit rejection), `EXP` (time-boxed experiment). Architecture shifts default to `ADR`.
9. Did any note get added, moved, renamed, archived, or deleted? If yes, update the affected folder indexes in the same session.
10. Always add a `history/YYYY-MM/history-YYYY-MM-DD.md` bullet for what changed and why (use Conventional Commits prefixes — see "History Conventions").

**The pattern after a code change (read-only):** the agent does not edit the PM folder. Instead, when opening a PR, it fills in the "PM folder impact" section of the PR body template (see `### Contributor Workflow` below). The maintainer applies the PM updates after merge.

**The pattern after a code change (no PM access, contributor side):** the contributor fills in the "PM folder impact" section of the PR body (per `templates/PR_BODY_TEMPLATE.md`) describing what PM updates their change implies. The maintainer's agent reads the PR body and applies the PM folder updates on their side after merge.



Use this when the user says "setup OpenClaw PM agent", "generate OpenClaw PM prompt", "bootstrap OpenClaw PM", "write OpenClaw AGENTS prompt", or similar.

OpenClaw PM agents are long-running project-management stewards. They complement coding agents instead of replacing them:

- **Coding agents** update PM folders after code changes in authoritative projects.
- **OpenClaw PM agents** brainstorm, capture ideas, triage issues, review priorities, audit/repair PM folders, curate coding-agent updates, and coordinate across projects.

### Display the prompt

Display this short copy-paste prompt directly in the response:

```text
Read and follow this instruction:
https://raw.githubusercontent.com/SYU8384/project-management/main/openclaw-instruction.md
```

The instruction installs or updates the project-management skill, verifies or creates `projects.json`, asks setup questions with answer suggestions when needed, then runs a full alignment audit of `projects.json`, existing PM folders, project repo `AGENTS.md` files, and the OpenClaw workspace `AGENTS.md`. It checks existing OpenClaw skill roots before installing, uses an existing `project-management` skill when one is already available, asks before changing files, and shows suggested changes when approval is denied.

The public instruction file is `openclaw-instruction.md` at the repository root. It uses the OpenClaw managed/local skill root `~/.openclaw/skills/project-management` by default. If the user has a custom OpenClaw skill root, the OpenClaw agent must ask for the exact path. OpenClaw setup is an alternative full setup path: install/update the skill, verify or create the registry, run guided setup when the registry is empty/template-only, configure the OpenClaw PM role, and run a full alignment audit across the registry, PM folders, project code repo `AGENTS.md` files, and the OpenClaw workspace `AGENTS.md`.

### How the user uses it

The user copies the prompt into their OpenClaw PM agent. The OpenClaw agent reads the public instruction, installs or updates the skill, verifies `projects.json`, asks guided setup questions when needed, then checks its own workspace `AGENTS.md` for a `## Project Management Skill` section that records the skill path, `projects.json` path, and working rules. If the section is missing or stale, the OpenClaw agent proposes the exact update and asks approval before editing.

The OpenClaw agent also checks each registered project: path correctness in `projects.json`, PM folder validation, and whether the code repo `AGENTS.md` has the correct PM section for the project's `access` value. It reports results as `OK`, `Needs approval`, or `Blocked / missing access`. It asks approval before changing `projects.json`, the OpenClaw workspace `AGENTS.md`, project repo `AGENTS.md`, or any authoritative PM folder files. For read-only PM folders, it reports suggested changes instead of editing.

The coding agent that displays this prompt should not directly mutate an OpenClaw workspace `AGENTS.md` unless the user explicitly asks for that and gives the exact file path. The generated-prompt workflow is the default because it lets the OpenClaw agent own its persistent instructions deliberately, then ask approval before changing its own workspace files.

### PM-agent behavior

An OpenClaw PM agent using this bootstrap should:

1. Read `<skill_dir>/SKILL.md` for routing rules.
2. Read `<skill_dir>/REFERENCE.md` for setup, validation, repair, schema, or bootstrap details.
3. Use `~/.config/project-management/projects.json` (v1.3.0+) to find project PM folders and access levels.
4. Read each project PM folder `README.md` before deciding where information belongs.
5. Respect access:
   - `authoritative` — edit PM folder directly.
   - `read-only` — read for context and suggest changes.
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

If a feature, fix, or change has **multi-step work, multi-session work, or many rounds of implementation and fixes**, the agent must write the plan to `roadmap/plans/` first (in the correct format) and mirror it in `roadmap/done-pending.md` before starting implementation.

**Why?** Atomic commits go straight to `history/`. Big work goes through a plan first so the team can review, contribute, and track progress. The `roadmap/plans/` folder is for big things; `history/` is for small atomic commits.

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

1. **Write the plan** to `roadmap/plans/YYYY-MM-DD_slug.md` (date-prefixed filename; see `templates/README.md` → Conventions by Page Type → Planning notes). The plan should have:
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
2. In the PR body, fill in the "PM folder impact" section. If the contributor has no PM folder access, write: "PM folder unavailable locally; maintainer must infer and apply PM updates."
3. When PM access is available, check the boxes for:
   - System docs affected (and what changed)
   - User Guide, Admin Guide, Developer Guide, and Quick Commands docs affected
   - Roadmap known issues or ideas affected
   - Features affected
   - History entries needed (the date and bullet)
   - Planning notes affected (updated, superseded, or moved to archive)
   - ADRs affected (new or existing)
4. Submit the PR.
5. After the PR is merged, the maintainer (or a maintainer-side agent) reads the PR's "PM folder impact" section and applies the corresponding PM updates.

The maintainer's job is to translate the contributor's "PM folder impact" claim into actual PM folder edits. This keeps the contributor focused on the code change while ensuring the PM folder stays in sync.

### Maintainer PR PM Backfill

Maintainer-side agents must ensure PM impact is handled at merge time even when the contributor could not provide it.

When reviewing or merging a PR:

1. Check whether the PR body has a useful `PM folder impact` section.
2. If the section is complete, verify it against the diff and apply the needed PM updates after merge.
3. If the section is missing, empty, vague, or says `PM folder unavailable locally`, inspect the PR diff, commits, changed files, tests, migrations, and release notes.
4. Infer the PM updates needed across `system/`, `docs/`, `features/`, `roadmap/`, `decisions/`, folder indexes, and `history/`.
5. For authoritative projects, apply the PM updates directly before merge or immediately after merge. If the PR must land first, write the PM update plan before merge so the follow-up is explicit.
6. For read-only projects, produce a maintainer-facing PM update plan instead of editing the PM folder.
7. For PRs from contributors with no PM folder access (PR body says "PM folder unavailable locally"), record that PM access is missing and ask the contributor or a maintainer-side PM agent to apply the updates.

Do not block a contributor solely because they lacked PM folder access. The merge/review agent owns PM backfill for maintainer-side workflows.

---

## Sharing and Collaborators

Collaborators typically need read-only access to the PM folder, plus the convention for contributing to the code repo. The skill itself is host-agnostic; the user picks the access mechanism that fits their setup. Common patterns:

- **OneDrive share link** (simplest for OneDrive-synced vaults): give collaborators read-only access to the project folder. They open the vault in their own Obsidian instance. No git involved.
- **Git subtree to a separate read-only mirror**: maintain a git repo with the PM folder content; collaborators clone (read-only) for offline access. Useful for code repos that also want a PM doc in the same repo (e.g., via git subtree).
- **Syncthing to a read-only folder on collaborators' machines**: point Syncthing at the vault; collaborators get a local read-only mirror. No git; near-real-time.
- **Public web mirror** (GitHub Pages, Quartz, etc.): publish the vault as a static site; collaborators browse in a web browser. Useful for non-technical collaborators or external auditors.

The skill does not endorse any specific mechanism; the user picks based on their tooling and threat model. The PM folder convention (roadmap/, roadmap/plans/, system/, history/, archive/, decisions/, features/) is the same regardless of access mechanism.

---

## Templates

Reusable templates are provided in the `templates/` directory relative to this skill's installation location (i.e., `<skill_dir>/templates/`). When creating a new note or integration artifact, copy the relevant template and fill in the body:

- `templates/README.md` — project root README (sections: What Goes Where, Folder Structure, Quick Rules, Live PM Folder Rule, Naming Conventions, Update Frequency, Conventions by Page Type, Navigation)
- `templates/CURRENT_STATUS.md` — weekly snapshot at project root
- `templates/folder-note.md` — universal folder note (one per visible PM folder: `archive/`, `docs/`, `features/`, `history/`, `roadmap/`, `roadmap/plans/`, `decisions/`, `system/`, and generated `history/YYYY-MM/YYYY-MM.md` month indexes)
- `templates/planning.md` — `roadmap/plans/` folder guide
- `templates/features.md` — features folder guide
- `templates/decision.md` — `decisions/D-NNN_<type>_<slug>.md` (typed decision record; ADRs are a `decision_type: ADR` instance)
- `templates/feature.md` — `features/<feature>.md`
- `templates/ideas.md` — roadmap idea register
- `templates/known-issues.md` — roadmap active/fixed/deferred issue tracker
- `templates/mvp-priorities.md` — MVP priority tracker
- `templates/done-pending.md` — planning mirror and general done/pending tracker
- `templates/known-bugs.md` — `docs/Developer Guide/known-bugs.md`
- `templates/AGENTS_PM_SECTION_AUTHORITATIVE.md` — the `## PM folder` section for `AGENTS.md` when the project is authoritative (you own the PM folder; update it directly)
- `templates/AGENTS_PM_SECTION_READONLY.md` — the `## PM folder` section for `AGENTS.md` when the project is read-only (someone else maintains the PM folder; suggest changes via the PR body template)
- `templates/AGENTS_PM_SECTION_UNAVAILABLE.md` — the `## PM folder` section for `AGENTS.md` when a collaborator has code access but no PM folder access yet
- `templates/PR_BODY_TEMPLATE.md` — copy to `.github/PULL_REQUEST_TEMPLATE.md` for the contributor's "PM folder impact" section
- `templates/projects.template.json` — blank starter for `projects.json` (not a Markdown file template but a JSON starter)
- `scripts/bootstrap-pm.mjs` — deterministic owner setup script for registering a project, scaffolding an authoritative PM folder, and wiring code repo `AGENTS.md`
- `scripts/check-agents.mjs` — focused validator for registered code repo `AGENTS.md` PM folder sections

Each template is fully frontmatter-populated. The agent replaces the placeholder text in the body with the project-specific content.

Do not let planning notes become invisible backlog. The roadmap must show the active to-do state.

---

## Bootstrap Workflow

When an agent is asked to set up a new project vault from scratch, follow this workflow after the Setup Intake has routed the user to "Owner + create new PM folder". Each step references the relevant section of the skill or a template in `templates/`.

**Default path: run the bootstrap script.** After collecting project name, `code_repo`, `pm_folder`, phase, vault root, and one-line notes, run:

```bash
node <skill_dir>/scripts/bootstrap-pm.mjs \
  --project <ProjectName> \
  --pm-folder <pm_folder> \
  --code-repo <code_repo_or_null> \
  --phase <phase> \
  --notes "<one-line description>" \
  --vault-root <vault_root>
# --config is only needed for non-default locations; v1.3.0+ defaults to
# ~/.config/project-management/projects.json
```

Use `--dry-run` first when the user wants a preview, and `--date YYYY-MM-DD` when bootstrapping for a specific date.

The script owns deterministic setup:

- Creates `projects.json` from `templates/projects.template.json` when missing, sets `skill_dir`, and registers the project as `access: authoritative`.
- Creates the canonical PM folder scaffold, including folder notes, standard roadmap notes, docs guide indexes, `known-bugs.md`, `decisions/`, `roadmap/plans/`, initial history, and `system/overview.md`.
- Uses create-only behavior for PM files: existing PM files are preserved and reported as skipped.
- Adds or replaces only the managed `## PM folder` section in `<code_repo>/AGENTS.md` when `code_repo` is not `null`, preserving unrelated AGENTS.md content.
- Refuses to silently change a conflicting existing `projects.json` project entry.

After the script runs, audit and refine the generated docs. Empty code repos provide no seed evidence, so the script uses the collected project name, phase, and one-line description instead of inventing architecture or features. If the script cannot be run, perform the same deterministic scaffold manually and then run validation.

Finally, run:

```bash
node <skill_dir>/scripts/check-pm.mjs --project <ProjectName>
```

The validation checks structure, stale-doc metadata, frontmatter, folder notes, links, planning mirrors, and AGENTS.md PM section drift.

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
| Create a dated `roadmap/plans/<date>_slug.md` for an approved plan | No | Also update `roadmap/done-pending.md`. Required for big tasks (multi-step / multi-session / many rounds) — see "Big Tasks Must Be Planned" |
| Create `decisions/D-NNN_<type>_<slug>.md` for a significant decision | No | Decision lifecycle: `proposed` → `accepted` → `active` (temporary) → `superseded` / `deprecated`. If superseding, set the new decision's `supersedes:` field |
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
- The folder structure (roadmap/, roadmap/plans/, decisions/, system/, history/, archive/, docs/, features/)
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
- Writing a significant decision as a planning note but not as a typed `decisions/D-NNN_<type>_<slug>.md` (use `templates/decision.md`; `ADR` is one valid `decision_type`, not the only one).
- Adding a `history/YYYY-MM/history-YYYY-MM-DD.md` file without `kind: changelog | worklog | mixed` (stale detection treats untagged files as never-reviewed).
- Creating a new top-level folder without explaining why existing lanes are insufficient.
- Treating generic template rules as stronger than a project's root `README.md`.
- Forgetting to update folder indexes after creating, moving, archiving, or deleting notes.
- Renaming a planning file to `archive/` without applying the `<slug>-archived.md` rename rule and adding `archived: <date>`.
