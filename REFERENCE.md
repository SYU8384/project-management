# Project Logging — Reference

This is the deep doc for the project-logging skill. SKILL.md has the entry point (intents, triggers, quick start, routing map, final response); this file has everything else — repair workflows, schemas, contributor conventions, bootstrap workflow, permission policy, pitfalls.

The split mirrors the "Writing Skills" framework: SKILL.md is lean (~150 lines) and loadable for any matching trigger; REFERENCE.md is the deep doc an agent reads when it needs the details.

---

## Repair the PM Folder

Use this when the user asks to "repair", "fix", "audit", or "check" the PM folder — meaning to find and fix inconsistencies in an existing vault against the canonical conventions.

The repair workflow has 3 phases: **audit, plan, fix**.

### Phase 1: Audit

Run the two optional-but-recommended scripts (bundled in `<skill_dir>/scripts/`):

- `node <skill_dir>/scripts/check-vault-structure.mjs` — verifies the required folder/file layout
- `node <skill_dir>/scripts/check-stale-docs.mjs` — surfaces never-reviewed and stale docs

Then check the schema and content dimensions:

1. **Schema compliance** — every note has the right `pageType:`, `status:` (per pageType vocabulary), `archived:` (only on archive files), `kind:` (only on history files), and other recommended fields. The `status: archived` value is **invalid** — `archived` is a separate date field, not a status value.
2. **H1 vs filename** — each note's H1 matches its filename stem (no leftover numbered prefixes, no date prefix in the H1).
3. **Cross-link integrity** — all `[[wiki-link]]` targets resolve to existing files.
4. **CURRENT_STATUS freshness** — the weekly snapshot exists and is not stale.
5. **Planning ↔ roadmap mirror** — each `planning/*.md` has a matching `## YYYY-MM-DD_slug` section in `roadmap/done-pending.md`.
6. **History `kind:`** — every `HISTORY-YYYY-MM-DD.md` has a `kind: changelog | worklog | mixed` field.
7. **Archive `archived:` field** — every `archive/*-archived.md` has both a meaningful `status:` (lifecycle) and an `archived: <date>` field.
8. **Folder structure** — all required folders and root files exist; feature/ADR/roadmap index pages exist where needed.
9. **Feature pages** — coherent features have pages; technical components stay in `system/`.
10. **README sync** — the project's `README.md` "What Goes Where", "Quick Rules", and "Update Frequency" sections match the canonical template.

### Phase 2: Plan

Build a fix list: for each inconsistency found, decide the target state and the right migration. Group related fixes so they can be committed/recorded together. For example:
- Schema drift (all `status: archived` → real lifecycle) is one fix group.
- README sync (all 3 missing rows × all 3 projects) is another.
- Cross-link repair is another.

### Phase 3: Fix

Apply the fixes in this order:

1. **Schema first** (REFERENCE.md + templates) — establishes the new convention.
2. **Verify, then migrate** existing files — each file read first to determine its original lifecycle / kind.
3. **Update HISTORY** with brief bullets recording what was fixed.
4. **Validate** with the structure check + stale-docs check.
5. **Re-run the audit** to confirm a clean state.

---

## Existing Project Logging

> STOP — read this first when logging project work.
>
> 1. Determine the project from context.
> 2. Read that project's root `README.md`; it is the source of truth for where to log what.
> 3. Read the project-logging skill at `<skill_dir>/SKILL.md`.
> 4. Apply the project README before any generic rule in this skill.
> 5. Update current-state docs before history when behavior, architecture, data flow, runtime, auth, database, connectors, deployment, UX, or documentation structure changes.
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
│   └── HISTORY-YYYY-MM-DD.md
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
4. If every checkbox in the related `roadmap/done-pending.md` section is complete, first distill durable current truth into `system/`, `docs/`, or `PRODUCT.md`, then archive that section to `history/HISTORY-YYYY-MM-DD-archived-sections.md` and remove it from active `done-pending.md`.
5. If the completed section mirrors a completed `planning/*.md` note, move the planning note to `archive/<slug>-archived.md` (drop the date prefix and any number; preserve the slug). Add an `archived: <date>` field to the frontmatter; keep the original `created:` field.
6. If a `planning/*.md` note is complete even without a matching roadmap section, first distill durable truth into `system/`, `docs/`, or `PRODUCT.md`, then move it to `archive/`.
7. Update `planning/planning.md`, `archive/archive.md`, `roadmap/done-pending.md`, the moved note's `## Navigation`, and every wiki link that points to the old planning filename.
8. Validate that the new archive filename is unique, each active planning note has a matching `done-pending.md` section, and no stale old planning stems remain.
9. Add a brief dated entry to `history/HISTORY-YYYY-MM-DD.md`.

Archived planning files use `<slug>-archived.md` (date prefix and any number are dropped; the slug from the original filename is preserved). The `created:` frontmatter is kept; an `archived: <date>` field is added. The renumbering rule from earlier conventions is no longer required.

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

`archived: <date>` is a separate optional frontmatter field meaning "this file has been moved to `archive/`". It is set on the day the file is archived.

`status` and `archived` are **orthogonal**: an archived file still has its lifecycle status. A shipped-then-archived plan keeps `status: shipped` and adds `archived: <date>`. A rejected-then-archived plan keeps `status: rejected` and adds `archived: <date>`. A deprecated-then-archived system doc keeps `status: deprecated` and adds `archived: <date>`.

**Conventions for archive files:**
- The filename uses the `<slug>-archived.md` suffix (date prefix dropped; `-archived` appended).
- The `created:` frontmatter is preserved (the original creation date).
- An `archived: <date>` field is added (the date of the move).
- The original `status:` value is **preserved** (not changed to `archived`).

### Stale detection

Notes with `last_reviewed` more than 30 days old are flagged as **stale**. Notes never reviewed or more than 90 days old are **very stale**. Run `<skill_dir>/scripts/check-stale-docs.mjs` (in projects that adopt it) to generate a report; surface results in `CURRENT_STATUS.md` under "Stale Docs".

### Stale detection is opt-in per project

The skill defines the schema and the stale detection concept. Each project opts in by adding `scripts/check-stale-docs.mjs` and running it. The script should never delete or modify notes — it only reports.

### History entry kinds

When creating a new `history/HISTORY-YYYY-MM-DD.md`, add a `kind:` field to the frontmatter:

- `kind: changelog` — purely factual bullets ("Added X", "Fixed Y"). No reasoning. Quick to scan.
- `kind: worklog` — reasoning, decisions, tradeoffs, why-we-didn't-do-X. Longer form. The "what" can be inferred from the rationale.
- `kind: mixed` — both fact bullets and reasoning mixed in one entry. The default for daily files that mix both.

When reading history, agents and humans can filter by `kind` to find the level of detail they need. Existing history files have been retroactively tagged; new files should pick the right `kind` at creation time.

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
- `projects.<name>.access` — `"authoritative"` (you own the PM folder; you can edit it directly) or `"read-only"` (the PM folder is shared; you can read for context but the maintainer applies changes after you suggest them via the PR body template). Drives the `## PM folder` section written to the project's `AGENTS.md` (see "Coding Agent Integration" below).

**Auto-bootstrap on first use.** If `<skill_dir>/projects.json` is missing when the agent starts work, copy `templates/projects.template.json` to `<skill_dir>/projects.json` and walk the user through filling in `vault_root`, `skill_dir`, and one entry per project. Do not silently invent paths; ask the user.

**When the agent should update `projects.json`:**

**Adding a new project:** the user says "add a new project", "register a new project", "initialize the PM folder for <name>", or similar. The agent collects the required fields (in this order) and adds the entry to the `projects` object:

- `code_repo` (path to the project's code repo, or `null` if no code yet) — required
- `pm_folder` (path to the project's PM folder inside the vault) — required
- `phase` (pre-alpha | alpha | beta | stable | deprecated) — required
- `access` (authoritative | read-only) — required
- `notes` (one-line description) — optional

The agent reads the existing `projects.json` (if any), merges the new entry into `projects`, and writes back. **Never silently invent paths — ask the user for each field.** If the user is also bootstrapping the PM folder, this addition is Step 0 of the Bootstrap Workflow (see below).

**Other updates:**
- A project moves (vault path change, code repo relocation).
- A project's phase changes (e.g., alpha → beta).
- A project's one-line description should change.
- A project's access level changes (e.g., promoting a read-only contributor to authoritative, or a collaborator's project becoming read-only because you no longer maintain it).

**Script auto-discovery.** The bundled scripts (`<skill_dir>/scripts/check-stale-docs.mjs`, `<skill_dir>/scripts/check-vault-structure.mjs`) walk up from their own location looking for a sibling `SKILL.md`; the `projects.json` next to that `SKILL.md` is the default config. Explicit `--config <path>` always wins. This means running the scripts with no arguments works whether the scripts live at `<skill_dir>/scripts/` (the bundled case) or are copied into a project repo (the user-local case).

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

**The convention:** the project's `AGENTS.md` includes a `## PM folder` section. The section's content depends on whether the project is **authoritative** (you own the PM folder) or **read-only** (someone else maintains it; you can read but not edit):

- **Authoritative projects** — the section tells the agent to read `system/<topic>.md` before coding and to update the PM folder directly after coding. See `templates/AGENTS_PM_SECTION_AUTHORITATIVE.md`.
- **Read-only projects** — the section tells the agent to read the PM folder for context, but to use the PR body template (`templates/PR_BODY_TEMPLATE.md`) to suggest PM folder changes. The maintainer applies the changes after merge. See `templates/AGENTS_PM_SECTION_READONLY.md`.

The agent checks the project's `access` field in `<skill_dir>/projects.json` (`authoritative` or `read-only`) to determine which section to use. The `access` field is set when the project is added to the config and confirmed when AGENTS.md is written/fixed (via the trigger phrases "add to AGENTS.md" / "fix AGENTS.md" / "set up AGENTS.md" / "update AGENTS.md for <project>").

A copyable snippet is provided in each template. Project repos that adopt the project-logging skill should add the appropriate section to their `AGENTS.md`. The skill is the canonical reference; the project repo's `AGENTS.md` is a thin pointer to it.

**The pattern after a code change (authoritative):**

1. Did the change alter any `system/<topic>.md` doc's "current behavior" description? If yes, update the system/ doc.
2. Did the change resolve or partially implement a `planning/<date>_slug.md` plan? If yes, mark the relevant PENDING as DONE in `roadmap/done-pending.md`. If the plan is fully shipped, distill the durable behavior into `system/`, then archive the plan to `archive/<slug>-archived.md`.
3. Did the change introduce a new pattern, a non-obvious decision, or an architecture shift? If yes, write a new `planning/decisions/ADR-NNN_slug.md`.
4. Always add a `history/HISTORY-YYYY-MM-DD.md` bullet for what changed and why.

**The pattern after a code change (read-only):** the agent does not edit the PM folder. Instead, when opening a PR, it fills in the "PM folder impact" section of the PR body template (see `### Contributor Workflow` below). The maintainer applies the PM updates after merge.

---

## Contributor Workflow

For projects with external collaborators, the convention is that **every PR body includes a "PM folder impact" section** that lists what PM folder docs should be updated to reflect the PR's changes.

A copyable PR body template is provided in `templates/PR_BODY_TEMPLATE.md`. Project repos should copy it to `.github/PULL_REQUEST_TEMPLATE.md` (or the platform's equivalent) and adapt as needed. The maintainer (or an agent acting on their behalf) applies the PM updates *after* the PR is merged — the PM folder is typically a separate vault from the code repo, so the PM updates don't go in the PR itself.

**The pattern for the contributor:**

1. Open a PR in the code repo.
2. In the PR body, fill in the "PM folder impact" section. Check the boxes for:
   - System docs affected (and what changed)
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

Nine file templates are provided in the `templates/` directory relative to this skill's installation location (i.e., `<skill_dir>/templates/`). When creating a new note of one of these types, copy the template and fill in the body:

- `templates/README.md` — project root README (sections: What Goes Where, Folder Structure, Quick Rules, Live PM Folder Rule, Planning Convention, Naming Conventions, Update Frequency, Navigation)
- `templates/CURRENT_STATUS.md` — weekly snapshot at project root
- `templates/planning.md` — `planning/planning.md` index
- `templates/ADR.md` — `planning/decisions/ADR-NNN_slug.md`
- `templates/feature.md` — `features/<feature>.md`
- `templates/features.md` — `features/features.md` index
- `templates/AGENTS_PM_SECTION_AUTHORITATIVE.md` — the `## PM folder` section for `AGENTS.md` when the project is authoritative (you own the PM folder; update it directly)
- `templates/AGENTS_PM_SECTION_READONLY.md` — the `## PM folder` section for `AGENTS.md` when the project is read-only (someone else maintains the PM folder; suggest changes via the PR body template)
- `templates/PR_BODY_TEMPLATE.md` — copy to `.github/PULL_REQUEST_TEMPLATE.md` for the contributor's "PM folder impact" section
- `templates/projects.template.json` — blank starter for `projects.json` (not a Markdown file template but a JSON starter)

Each template is fully frontmatter-populated. The agent replaces the placeholder text in the body with the project-specific content.

Do not let planning notes become invisible backlog. The roadmap must show the active to-do state.

---

## Bootstrap Workflow

When an agent is asked to set up a new project vault from scratch, follow this 11-step workflow. Each step references the relevant section of the skill or a template in `templates/`.

**0. Add the project to `projects.json`.** Collect the required fields (code_repo, pm_folder, phase, access) from the user and write a new entry to `<skill_dir>/projects.json`. See "Configuration → Adding a new project" for the field reference. Never silently invent paths. If `projects.json` doesn't exist, copy from `projects.template.json` first (this also satisfies the auto-bootstrap flow).

1. **Create the folder structure.** `mkdir planning/ roadmap/ system/ history/ archive/ docs/ features/`
2. **Create the four root notes** (copy templates from `templates/`):
   - `README.md` (from `templates/README.md`) — the "where to write things" guide
   - `PRODUCT.md` — product vision (write directly; no template)
   - `<Project>.md` — project landing note (write directly)
   - `CURRENT_STATUS.md` (from `templates/CURRENT_STATUS.md`) — initial weekly snapshot
3. **Create the planning index.** `planning/planning.md` (from `templates/planning.md`).
4. **Create the four standard roadmap notes** (lifecycle-tracked, slug filenames):
   - `roadmap/mvp-priorities.md`
   - `roadmap/known-issues.md`
   - `roadmap/done-pending.md`
   - `roadmap/ideas.md`
5. **Create the system index.** `system/system.md` plus at least one `system/*.md` doc.
6. **Create the archive and history indexes.** `archive/archive.md`, `history/history.md`.
7. **Create the features folder + index** (new convention, **required for any project past initial planning**). Copy `templates/features.md` to `features/features.md` and fill in the body. Pre-alpha projects have an empty index; mature projects seed feature pages as features enter the design phase.
8. **Wire the two bundled scripts** in `scripts/` (already bundled in `<skill_dir>/scripts/`; project repos can copy them to their own `scripts/` if needed):
   - `scripts/check-stale-docs.mjs` — weekly stale detection
   - `scripts/check-vault-structure.mjs` — one-time setup verification, also useful in CI
9. **Run `<skill_dir>/scripts/check-vault-structure.mjs`** to verify the structure is correct. All required folders, root files, planning index, and roadmap notes must be present.
10. **Fill in `CURRENT_STATUS.md`** with the initial snapshot (Current Phase, Top Priorities, Blocked, Recent Wins, Major Risks, Relevant ADRs, Relevant Features). Update weekly.

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
| Create `history/HISTORY-YYYY-MM-DD.md` | No | Use for completed meaningful work on that date. Add `kind: changelog | worklog | mixed` to the frontmatter |
| Create a dated `planning/<date>_slug.md` for an approved plan | No | Also update `roadmap/done-pending.md` |
| Create `planning/decisions/ADR-NNN_slug.md` for a significant architecture decision | No | ADR lifecycle: `proposed` → `accepted` → `deprecated`/`superseded`. If superseding, set the new ADR's `supersedes:` field |
| Create a `<topic>.md` `system/` note for durable current state | No | Only when existing system notes are not a good fit |
| Create `features/features.md` and per-feature pages | No | **Required** for any project past initial planning. Empty index is fine for pre-alpha; seed feature pages as features enter the design phase |
| Update `CURRENT_STATUS.md` at the project root | No | Weekly snapshot of where the project is now; PM agent maintains |
| Create a new note inside `docs/` existing guide folders | Usually no | Use when behavior/workflow docs need a clear page |
| Create a new note inside `roadmap/` | Yes | Prefer the four standard roadmap notes |
| Create a new note inside `archive/` | No | Don't. `archive/` is for moved files only. Move a file there with the rename convention `<slug>-archived.md` and add an `archived: <date>` field |
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
- Adding a `HISTORY-YYYY-MM-DD.md` file without `kind: changelog | worklog | mixed` (stale detection treats untagged files as never-reviewed).
- Creating a new top-level folder without explaining why existing lanes are insufficient.
- Treating generic template rules as stronger than a project's root `README.md`.
- Forgetting to update folder indexes after creating, moving, archiving, or deleting notes.
- Renaming a planning file to `archive/` without applying the `<slug>-archived.md` rename rule and adding `archived: <date>`.
