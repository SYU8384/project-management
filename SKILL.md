---
name: project-management
description: "Keeps project-management folders, product docs, roadmap state, history logs, decisions log, and code-repo agent guidance in sync. Use when the user asks to log, record, archive, update, create, configure, register, add, bootstrap, setup, standardize, initialize, verify, validate, repair, audit, or fix project docs or PM folders; set up or fix a project's AGENTS.md; or when meaningful project work finishes. Enforces observed-defect-only entries in `roadmap/known-issues.md`, full-description entries in `roadmap/ideas.md`, and single-source-of-truth for items in `roadmap/plans/<date>_slug.md § NOT in scope (deferred)`. Decisions are a typed first-class PM lane at the project root (not under `roadmap/`), recording made decisions across architecture, product, market, vendor, policy, rejection, and experiment types, with a unified `proposed | accepted | active | superseded | deprecated` status."
---

# Project Management

Use this skill for three intents:

1. **Log or update** an existing project (record a change, capture a decision, archive a doc).
2. **Initialize or standardize** a PM folder (create from scratch, or convert an existing folder into the canonical structure).
3. **Verify, repair, or audit** a PM folder and code-repo integration (run validation checks, then find and fix inconsistencies: missing fields, broken cross-links, schema drift, out-of-date READMEs, `roadmap/plans/` ↔ roadmap mismatches, AGENTS.md drift, etc.).

> **For advanced topics** (frontmatter schema, validation and repair workflow, coding agent integration, contributor workflow, bootstrap workflow, permission policy, pitfalls), see [REFERENCE.md](REFERENCE.md). This file is the entry point; REFERENCE.md is the deep doc.

---

## Quick Start

The five most common actions:

**1. Log a change** — say "log this" or "I just finished <feature>". The agent reads the project's `README.md`, checks every PM-impact lane that could have changed (`system/`, `docs/`, `features/`, `roadmap/`, `decisions/`), updates the needed current-state docs and indexes, then appends a Conventional Commits-prefixed bullet to `history/YYYY-MM/history-YYYY-MM-DD.md` (e.g., `history/2026-05/history-2026-05-04.md`). If the month folder is new, the agent also creates `history/YYYY-MM/YYYY-MM.md` and links it from `history/history.md`.

**2. Set up project management** — say "setup", "setup this repo", "setup PM", or "setup as collaborator". The agent first inspects the current folder and `~/.config/project-management/projects.json`; if the folder is empty or unrecognized, it asks whether the folder is the code repo, PM folder, or something else. Then it asks a short guided intake with selectable answer suggestions (role, PM folder state, project phase, AGENTS.md setup) plus free-text path/description questions only when needed. It then routes to create a new PM folder, repair an existing/messy PM folder, register read-only collaborator access, or register unavailable PM access. For owner setup with an empty code repo and empty PM folder, run `scripts/bootstrap-pm.mjs` to scaffold the PM folder and create the authoritative code repo `AGENTS.md` when a real `code_repo` path exists. v1.3.0+ stores `projects.json` at `~/.config/project-management/projects.json`, not in the skill directory.

**3. Initialize a new project's PM folder directly** — say "initialize the PM folder for <name>". The agent asks for the missing fields (project name, code_repo, pm_folder, phase, access, notes), then runs `scripts/bootstrap-pm.mjs` as described in the Bootstrap Workflow in REFERENCE.md. **After bootstrap**, the user should: (a) populate `CURRENT_STATUS.md` (Top Priorities, Blocked, Recent Wins, Major Risks sections — Stale Docs is auto-generated), and (b) run `node <skill_dir>/scripts/check-pm.mjs --project <name>` to verify the scaffold is clean. Both are part of the Quick Start item 4 flow.

**4. Verify project management setup** — say "verify setup", "validate setup", "check setup", "audit setup", "verify project setup", "check PM setup", or "run setup checks". The agent first confirms the project is registered in `~/.config/project-management/projects.json`, then runs `node <skill_dir>/scripts/check-pm.mjs` with any relevant `--project` / `--config` args. This is one integrated setup check covering both the PM folder and code repo `AGENTS.md`; if the user asks to check either one directly, run the full setup check.

**5. Add an AGENTS.md PM folder section to a project repo** — say "add to AGENTS.md" or "set up AGENTS.md for <project>". The agent reads the project's `access` field in `~/.config/project-management/projects.json` and copies the right template (`AGENTS_PM_SECTION_AUTHORITATIVE.md`, `AGENTS_PM_SECTION_READONLY.md`, or `AGENTS_PM_SECTION_UNAVAILABLE.md`) into the project's `AGENTS.md`.

**6. Bootstrap an OpenClaw PM agent** — say "setup OpenClaw PM agent", "generate OpenClaw PM prompt", "bootstrap OpenClaw PM", or "write OpenClaw AGENTS prompt". The agent displays the short copy-paste prompt that tells OpenClaw to read `https://raw.githubusercontent.com/SYU8384/project-management/main/openclaw-instruction.md`. That instruction installs or updates the skill, verifies or creates `~/.config/project-management/projects.json`, runs guided project intake when needed, checks its own workspace `AGENTS.md`, audits registered PM folders and project code repo `AGENTS.md` files, and asks approval before changing files.

**7. Migrate an existing project** — say "migrate this project", "run migrations", "clear migration debt", "upgrade PM", or "migrate to v1". If the validator flags an unapplied registered migration for the project you're working on, the agent offers to run `node <skill_dir>/scripts/migrate.mjs --project <name>`, names the specific migration, lists its effects, and asks once per session. Suppress re-asks within the session if the user declines. Do not surface migration debt on unrelated projects during unrelated work.

**8. Reconcile a project (validate + repair + migrate)** — say "reconcile this project", "repair and migrate this project", "fix everything", "fix this project end-to-end", or "reconcile the PM folder". The agent runs `node <skill_dir>/scripts/check-pm.mjs --project <name> --fix`. The orchestrator runs validators with `--fix` (creates missing folder notes from `templates/folder-note.md`, rewrites `pageType:` mismatches), then runs pending migrations from the registry (idempotent; reads `.pm/migrations.json` ledger), then re-runs validators without `--fix` to report residual issues that need human review. Suppress re-asks within the session if the user declines. Do not surface reconciliation debt on unrelated projects during unrelated work.

---

## Triggers

Match user phrases to the right intent. If multiple intents apply, do all of them in this order: log → repair → initialize (log is fastest and least disruptive; initialize is most disruptive).

| User says | Intent | Workflow section |
|---|---|---|
| "setup", "set up this repo", "setup this project", "setup PM", "setup project management", "setup as collaborator" | Guided setup intake | Setup Intake (REFERENCE) |
| "log this", "record this", "capture this decision" | Log | Existing Project Management (REFERENCE) |
| "I just made a code change", "I just finished <feature>" | Log | Existing Project Management (REFERENCE) |
| "create the PM folder", "initialize the PM folder", "set up project docs", "bootstrap", "standardize the PM folder", "convert this mess to the standard layout", "restructure the PM folder", "normalize the PM folder" | Initialize (new or against existing) | Standard App Project Bootstrap (REFERENCE) |
| "verify setup", "validate setup", "check setup", "audit setup", "verify project setup", "validate project setup", "check PM setup", "run setup checks", or direct requests to check the PM folder or AGENTS.md | Validate / audit the integrated project setup: PM folder plus AGENTS.md integration | Validation and Repair (REFERENCE) |
| "repair the PM folder", "fix the PM folder", "repair PM folder" | Repair: run validation, fix authoritative issues, rerun validation | Validation and Repair (REFERENCE) |
| "fix the schema", "migrate the frontmatter", "update the schema" | Repair (focused on schema) | Validation and Repair (REFERENCE) |
| "sync the READMEs", "update the routing map", "fix the Quick Rules", "fix the What Goes Where table" | Repair (focused on README) | Validation and Repair (REFERENCE) |
| "add to AGENTS.md", "fix AGENTS.md", "set up AGENTS.md", "update AGENTS.md for <project>", "write the PM folder section for <project>" | AGENTS.md work (checks `access` in `projects.json` to pick the right section) | Coding Agent Integration (REFERENCE) |
| "setup OpenClaw PM agent", "generate OpenClaw PM prompt", "bootstrap OpenClaw PM", "write OpenClaw AGENTS prompt", "OpenClaw PM bootstrap" | Display the short copy-paste prompt that points the OpenClaw PM agent to `openclaw-instruction.md` | OpenClaw PM Agent Bootstrap (REFERENCE) |
| "register <project> as authoritative", "mark <project> as read-only", "set access for <project>" | Config update | Configuration (REFERENCE) |
| "add a new project", "register a new project", "add <Project> to projects.json" | Config update | Configuration → Adding a new project (REFERENCE) |
| "I just opened a PR", "I just merged a PR", "review a PR for PM impact" | Contributor | Contributor Workflow (REFERENCE) |
| "this is a big task", "multi-session", "plan this out", "let me plan this", or the change has multi-step work / multi-session work / many rounds of fixes | Big task → plan first | Big Tasks Must Be Planned (REFERENCE) |
| "migrate this project", "run migrations", "clear migration debt", "upgrade PM", "migrate to v1", or implicit detection of an unapplied registered migration by `check-pm.mjs` for the project in scope | Migrate: name the migration, list effects, ask once per session, run `node <skill_dir>/scripts/migrate.mjs` on approval | Migrations (REFERENCE) |
| "reconcile this project", "reconcile the PM folder", "reconcile<ProjectName>", "repair and migrate this project", "repair and migrate", "fix everything", "fix this project end-to-end" | Reconcile: validate with `--fix`, apply pending migrations, re-validate. Idempotent. | Validation and Repair (REFERENCE) — Phase 3: Fix |

---

## PM-folder rules that agents most often violate

These are the failure modes I have hit most often when an agent builds up
a project's roadmap, planning, and decisions folders from a planning note.
Read them before adding entries to `roadmap/known-issues.md`,
`roadmap/ideas.md`, `roadmap/plans/`, or `decisions/`.

### `roadmap/known-issues.md` is for observed defects only

A "known issue" is something the user has hit, an alert has fired on, or
a test has caught — not a possibility surfaced during planning. Do **not**
add entries for:

- **Theoretical risks that have not yet manifested.** They live in the
  planning note's risk register or error/rescue map. Promote to a defect
  only after a real incident.
- **Design features with built-in mitigations.** These are not defects at
  all; they live only in the planning note's design section. They should
  never be logged as known issues.

If you find yourself writing "we don't control X's stability" or "this
could break if Y happens" without a concrete incident, that is a **design
consideration**, not a known issue. If the planning note's error/rescue
map concept is not yet defined for this project, create it as
`roadmap/plans/<date>_slug.md § Error and rescue map` before logging
mitigations there — do not suppress the concern.

### `roadmap/ideas.md` registry entries must always have a full description

Do **not** add single-line rows to the `## Idea Register` table without
also writing the full description (problem, why now, what changes,
dependencies, who thinks about it) in the `## Idea Details` section below.

A row with only a one-line description is a **backlog dump** — it gives
the illusion of being tracked while losing the reasoning. Either describe
the idea properly in `## Idea Details` (so a future agent or human can pick
it up) or do not add it.

### Single source of truth for deferred items

A deferred item lives in exactly one place:

- `roadmap/ideas.md` Brainstorming — never been scoped.
- `roadmap/plans/<date>_slug.md § NOT in scope (deferred)` — scoped then
  deferred.
- `decisions/D-NNN_<type>_<slug>.md` — if the deferred item is an explicit
  rejection, record it as a `NEG` decision.

An item in `roadmap/plans/<date>_slug.md § NOT in scope (deferred)` is the
canonical record. Do not also list it in `roadmap/ideas.md`. Re-scoping a
deferred item is a lifecycle transition, not a new entry — update the
plan, do not add a parallel idea.

### Decisions are a typed lane, not an ADR monoculture

`decisions/` is a first-class PM lane at the project root, peers with
`roadmap/`, `system/`, `features/`, and `history/`. It is a record of
decisions *made*, not a place to track open questions.

- **Type codes:** `ADR` (architecture), `PRD` (product), `MKT`
  (market/positioning), `VND` (vendor pick), `POL` (policy/operating
  rule), `NEG` (explicit rejection), `EXP` (time-boxed experiment).
  Extend cautiously; prefer existing codes.
- **Filename:** `D-NNN_<type>_<slug>.md`. One global number sequence.
- **Frontmatter:** `pageType: decision`, `decision_type: <type>`,
  `status`, optional `supersedes: <D-id>`.
- **Status:** `proposed | accepted | active | superseded | deprecated`.
  `accepted` is the default for a decision in force. `active` is allowed
  but should be temporary — it means "accepted and being rolled out."
  A decision lingering in `active` past the underlying work is a smell;
  either it's `accepted` (work is done, decision stands) or it should
  be re-evaluated and either `superseded` or `deprecated`.
- **Body shape:** *Context, Options Considered, Decision, Consequences,
  Realization Notes, Related, Navigation*. Optional per-type sections:
  `Success Metric` (EXP), `Affected Users` (PRD/MKT), `Review Cadence`
  (POL).
- **`NEG` relaxation:** a rejection decision may collapse *Options
  Considered* into *Decision* ("**Decision: not X.** Alternatives
  considered: A, B; both rejected because…"). The other mandatory
  sections still apply.
- **Append-mostly:** once a decision is `accepted`, do not edit its body
  to re-litigate it. To change a decision, write a new decision that
  `supersedes:` it.
- **Cross-type `supersedes` is allowed** (e.g. an ADR superseded by a PRD
  that scopes a v2 migration). The Related section of both decisions
  should link to the same underlying plan.
- **One decision, one home.** A decision lives at `decisions/D-NNN_…`. A
  planning note that records a decision either *is* the decision (use
  the `D-NNN_…` naming and a brief planning pointer) or *cites* it via
  a `Related` link. Do not restate the same decision in a plan, a
  feature page, and a roadmap entry — pick the home and link from the
  others.

### Lifecycle

```text
                      ┌──────────────────────────────────────┐
                      │  ideas.md Brainstorming              │
                      │  (never been scoped)                 │
                      └──────────────┬───────────────────────┘
                                     │ (scoped)
                                     ▼
                ┌────────────────────────────────────────────┐
                │  roadmap/plans/<date>_slug.md              │
                │                                            │
                │   in scope  ──────────────► done-pending.md
                │                                            │   (in flight)
                │   NOT in scope (deferred) ──► stays here   │
                │                                            │
                │   (later re-scoped) ──► in scope           │
                └────────────────────────────────────────────┘
                                     │
                                     ▼
                              history/  (shipped)

Parallel decision record (cites plans, not the other way around):
  decisions/D-NNN_<type>_<slug>.md
  status: proposed → accepted → (active*) → superseded | deprecated
    * "active" is temporary; the default for a made decision is "accepted"
```

---

## Where Information Goes

Always read the project `README.md` first. If it exists, it wins over this generic map.

| Lane | Purpose |
|---|---|
| `PRODUCT.md` | Product vision, target users, core loop, current product shape, product principles, boundaries, future goals |
| `README.md` | Folder structure, routing rules, update frequency, live PM folder rules |
| `system/` | Current architecture, behavior, data flow, runtime, auth, database, integrations, deployment, operational reference |
| `docs/User Guide/` | End-user behavior, user manual, FAQ, and product reference notes |
| `docs/Admin Guide/` | Live product operations for admins/operators: support and feedback triage, admin panel workflows, monitoring, statistics, background job runs, access, incident response, production verification, and data repair. No source-code modification workflows. |
| `docs/Developer Guide/` | Coding-engineer workflows: local setup, codebase structure, implementation notes, APIs, schemas, migrations, prompts, tests, adding/changing jobs, release mechanics, contribution workflow, and required `known-bugs.md`. |
| `docs/Quick Commands/` | Copy-pasteable commands; longer explanation belongs in Admin or Developer Guide |
| `roadmap/` | MVP priorities, known issues, planning-note mirrored done/pending status, lightweight general done/pending status, ideas, and scoped plans under `roadmap/plans/` |
| `roadmap/plans/` | Concrete implementation plans and design strategies for a set of features or initiatives. Plans are mirrored into `roadmap/done-pending.md` when in flight |
| `decisions/` | First-class PM lane at the project root. Record of decisions *made*, typed (`ADR / PRD / MKT / VND / POL / NEG / EXP`), peers with `roadmap/` |
| `features/` | Curated per-feature pages. Each page is a "tell me everything about X" index that points into `system/` and `decisions/`. **Required** for any project past initial planning; pre-alpha projects have an empty index. |
| `meetings/` | **Optional** meeting records lane (not auto-scaffolded; for projects with meeting-recording agents) | Date-stamped meeting records; cross-link decisions and plans rather than duplicating. See `templates/README.md` → Conventions by Page Type → Meeting records |
| `history/` | Brief chronological logs of completed meaningful work, organized by year-month |
| `archive/` | Superseded material replaced by current product, system, `roadmap/plans/`, or `decisions/` docs |
| `CURRENT_STATUS.md` | Weekly snapshot | Top priorities, blocked, recent wins, major risks, stale docs |

Naming is semantic: top-level PM lanes are lowercase, docs guide folders use Title Case, folder notes exactly match their folder name, content notes use neutral lowercase kebab-case slugs, and uppercase filenames are reserved for root artifacts (`README.md`, `PRODUCT.md`, `CURRENT_STATUS.md`) plus decision id prefixes (`D-NNN_`). Personal/collaborator prefixes such as `haoyou_` are discouraged in canonical PM folders and should be treated as warnings, not hard failures.

Archive marker rule: `archived: <date>` appears only on moved archive files named `archive/*-archived.md`. Folder indexes such as `archive/archive.md` must not carry `archived:`.

Bug routing: `roadmap/known-issues.md` tracks active bugs, risks, and blockers; `docs/Developer Guide/known-bugs.md` is required for engineering bug knowledge, including active/fixed status, symptoms, root cause, solution, verification, recurrence patterns, and links to history or known issues.

---

## Advanced features

For the validation workflow, repair workflow, frontmatter schema, coding agent integration, contributor workflow, bootstrap workflow, permission policy, and pitfalls, see [REFERENCE.md](REFERENCE.md).

---

## Final Response Requirement

After logging or bootstrapping, say exactly which project/vault files were updated. If no files were updated, say that explicitly and why.
