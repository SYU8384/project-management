# Project Management Skill

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Install with curl](https://img.shields.io/badge/install-curl%20%7C%20bash-0f766e.svg)](#install-or-update)
[![Setup trigger](https://img.shields.io/badge/bootstrap-say%20setup%20this%20repo-7c3aed.svg)](#start-with-one-prompt)
[![Markdown PM folders](https://img.shields.io/badge/docs-Markdown%20%2B%20Obsidian-2563eb.svg)](#pm-folder-model)

A portable agent skill for keeping project-management notes, product docs, roadmap state, and code changes in sync.

It works especially well with an Obsidian vault, but the convention is plain Markdown plus a small local `projects.json` registry. The important part is behavioral: when meaningful project work happens, the agent updates the right current-state docs, indexes, roadmap notes, and history logs in the same session.

## ✨ What It Does

| Capability | What the agent does |
|---|---|
| 🧭 Guided setup | Lets users say `setup this repo` instead of knowing the bootstrap workflow. |
| 🏗️ Bootstrap PM folders | Creates the standard project docs layout, indexes, root notes, roadmap notes, and validation scripts. |
| 🧹 Repair existing folders | Finds missing indexes, stale schemas, broken conventions, roadmap drift, and folder-note problems. |
| 📝 Log completed work | Updates current-state docs first, then writes a Conventional Commits-style history entry. |
| 📚 Keep guides current | Routes user, admin, developer, and quick-command changes into the right docs guide. |
| 🧩 Track plans and decisions | Creates planning notes under `roadmap/plans/`, mirrors active work into `roadmap/done-pending.md`, and records typed decisions under `decisions/`. |
| 🐞 Preserve bug knowledge | Keeps active issues in roadmap and root causes/solutions in `docs/Developer Guide/known-bugs.md`. |
| 🤝 Integrate code repos | Adds an `AGENTS.md` PM section so coding agents know what to read and update. |
| 🧑‍💼 Bootstrap OpenClaw PM agents | Gives OpenClaw a copy-paste prompt to install or discover the skill, set up its PM role, audit PM folders and `AGENTS.md`, and ask before edits. |

## 🧠 Why This Exists

Project memory usually decays in predictable ways:

- Work ships, but user guides, admin runbooks, and developer docs lag behind.
- Decisions are scattered across chats, PRs, issues, and half-finished plans.
- Roadmaps become stale because done/pending state is not tied to implementation work.
- Agents waste time rediscovering architecture, recurring bugs, and prior fixes.
- Folder structures grow organically until nobody knows where new information belongs.

This skill gives agents a strict, repeatable operating model for project memory.

<a id="install-or-update"></a>

## ⚙️ Install Or Update

Choose one setup path. If you use the OpenClaw PM prompt, do not also run the installer unless the OpenClaw agent asks you to.

| Path | Best for | What it does |
|---|---|---|
| OpenClaw PM prompt | Recommended when you have an OpenClaw PM agent | Installs or updates the skill if needed, verifies `projects.json`, configures the PM role, audits registered PM folders and `AGENTS.md`, and asks approval before edits. No separate `setup this repo` step is required. |
| Installer | Codex, Claude, or a local agent skill root | Installs or updates the skill files and creates or preserves local `projects.json`. After install/update, restart the coding agent and say `setup this repo`. |

### OpenClaw PM Agent Setup (Recommended for OpenClaw PM agents)

Copy this prompt to your OpenClaw PM agent:

```text
Read and follow this instruction:
https://raw.githubusercontent.com/SYU8384/project-management/main/openclaw-instruction.md
```

The instruction checks existing OpenClaw skill roots first. If the skill is already installed, it updates that install; otherwise it installs it. It then verifies or creates `projects.json`, asks setup questions with answer suggestions when needed, runs a full alignment audit of `projects.json`, existing PM folders, project repo `AGENTS.md` files, and the OpenClaw workspace `AGENTS.md`, asks before changing files, and shows suggested changes when approval is denied.

### Install With The Installer

Interactive installer:

```bash
curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh | bash
```

Run the same installer command again to update an existing install.

Target commands:

| Target | Install or update |
|---|---|
| Agent skills | `curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh \| bash -s -- --target agents --yes` |
| Codex | `curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh \| bash -s -- --target codex --yes` |
| Claude | `curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh \| bash -s -- --target claude --yes` |
| OpenClaw | `curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh \| bash -s -- --target openclaw --yes` |

Installing into OpenClaw with the installer only installs or updates the skill files in OpenClaw's skill root. It does not configure the OpenClaw PM role or run the alignment audit. For that full setup, use the OpenClaw PM prompt above.

### Manual Install

```bash
git clone https://github.com/SYU8384/project-management.git ~/.agents/skills/project-management
```

Manual clones do not create `projects.json`. After cloning, create it if needed:

```bash
cd <skill_dir>
cp templates/projects.template.json projects.json
```

Restart your agent after installing or updating the skill.

### Local Registry (Advanced)

`projects.json` is private local config and is gitignored. The installer creates it from `templates/projects.template.json` if it does not already exist.

`<skill_dir>` is whichever install path you chose, such as:

| Target | Default skill directory |
|---|---|
| Agent skills | `~/.agents/skills/project-management` |
| Codex | `~/.codex/skills/project-management` |
| Claude | `~/.claude/skills/project-management` |
| OpenClaw | `~/.openclaw/skills/project-management` |

Example registry:

```json
{
  "vault_root": "/path/to/your/vault",
  "skill_dir": "/path/to/project-management",
  "projects": {
    "MyProject": {
      "code_repo": "/path/to/MyProject",
      "pm_folder": "/path/to/your/vault/Projects/MyProject",
      "phase": "alpha",
      "notes": "Short project description",
      "access": "authoritative"
    }
  }
}
```

`access` can be:

| Access | Use when |
|---|---|
| `authoritative` | You own the PM folder and agents may edit it directly. |
| `read-only` | You can read the owner's PM folder but must suggest changes through PR impact notes. |
| `unavailable` | You cloned the code repo but do not have the PM folder yet. |

Most users do not need to edit this manually after setup. The guided setup flow registers projects for you.

<a id="versioning"></a>

## 🏷️ Versioning

This skill is versioned with `VERSION` and `CHANGELOG.md` at the repo root. Tags follow `vMAJOR.MINOR.PATCH` (Semantic Versioning).

- **Default install (v1.0.1+):** pulls `v1` (latest `v1.x.x` release). Use `--ref main` or `--channel main` for the bleeding edge.
- **Pinned install:** `curl -fsSL .../install.sh | bash -s -- --ref v1.0.0` pins to an exact version.
- **Release channel:** `curl -fsSL .../install.sh | bash -s -- --channel v1` resolves to the latest `v1.x.x` release. The `main` channel resolves to `main` (bleeding edge).
- **Update an existing install:** re-run the same install command; existing clones `git pull --ff-only` and the script prints the resolved version from the `VERSION` file. To check the currently installed version without re-running the installer: `cat <skill_dir>/VERSION`.

The version is printed after every install or update:

```text
==> Installed version: 1.0.0
```

<a id="releasing"></a>

## 📦 Releasing (Maintainers)

To cut a new release:

1. Bump `VERSION` to the new `MAJOR.MINOR.PATCH`.
2. Add a new top entry to `CHANGELOG.md` under `## [Unreleased]` (or rename `## [Unreleased]` to the versioned heading) with `Added / Changed / Deprecated / Removed / Fixed / Security` sections.
3. Commit: `git commit -m "release: vX.Y.Z"`.
4. Push: `git push origin main`.
5. Tag: `git tag -a vX.Y.Z -m "vX.Y.Z — <one-line summary>"`.
6. Push the tag: `git push origin vX.Y.Z`.

That's it. `CHANGELOG.md` is the single source of truth for what changed in each version; `VERSION` and the git tag are the versioned snapshot. The skill is small enough that an additional release-notes layer (per-version prose files, GitHub Releases UI paste) doesn't pay for itself.

Before tagging, sanity-check with `bash -n install.sh` and `node --check scripts/*.mjs`. For a full end-to-end check, run the `gstack-ship` skill (if installed) or manually invoke `node scripts/check-pm.mjs` against a fresh scaffold.

<a id="start-with-one-prompt"></a>

## 🚀 After Installer: Start With One Prompt

If you used the installer path in Codex, Claude, or another coding agent, restart that agent and say:

```text
setup this repo
```

The agent will inspect the current folder and `projects.json`, ask what the folder is when it is empty or unrecognized, then run a short guided intake with selectable suggestions and route to the right workflow:

| Situation | Say this | Result |
|---|---|---|
| You own a code repo but have no PM folder yet | `setup this repo` | Bootstraps a new authoritative PM folder and creates PM guidance in `AGENTS.md` when a real code repo path exists. |
| You already have a messy PM folder | `setup PM for this project` | Registers, audits, repairs, validates, and preserves existing content. |
| You are a collaborator with PM access | `setup as collaborator` | Registers read-only access and uses PR PM-impact notes instead of direct PM edits. |
| You cloned code but do not have the PM folder | `setup as collaborator` | Registers `access: unavailable`, adds unavailable-PM guidance, and asks the maintainer for access. |

Setup uses suggested choices where possible:

- **Role:** Owner / maintainer, collaborator with PM access, collaborator without PM access yet.
- **PM folder state:** Create new PM folder, use existing PM folder, repair messy PM folder.
- **Project phase:** `pre-alpha`, `alpha`, `beta`, `stable`, `deprecated`.
- **AGENTS.md setup:** Owner setup creates/updates AGENTS.md when a real code repo path exists; collaborator or no-code setup can skip.

The agent asks free-text follow-ups only for facts it cannot infer, such as a vault root, PM folder path, or one-line project description.

If the current folder is empty or lacks clear signals, setup asks whether it is the code repo, the PM folder, or something unrelated. Empty code repos and empty PM folders are valid once confirmed; owner setup runs `scripts/bootstrap-pm.mjs` to scaffold the PM folder and create the code repo `AGENTS.md` when `code_repo` is not `null`.

If you used the OpenClaw PM prompt, you do not need to say `setup this repo` separately. The OpenClaw instruction runs setup and alignment itself.

<a id="pm-folder-model"></a>

## 🗂️ PM Folder Model

Each project gets a Markdown folder with stable lanes:

| Path | Purpose |
|---|---|
| `PRODUCT.md` | Product vision, target users, current product shape, principles, and boundaries. |
| `CURRENT_STATUS.md` | Weekly snapshot: phase, priorities, blockers, recent wins, risks, and stale-doc state. |
| `system/` | Current architecture, behavior, runtime, auth, database, integrations, and deployment. |
| `docs/User Guide/` | End-user manual, FAQ, and product reference notes. |
| `docs/Admin Guide/` | Live product operations: support, feedback, admin workflows, monitoring, statistics, jobs, access, incident response, and data repair. |
| `docs/Developer Guide/` | Engineering workflows: local setup, codebase structure, APIs, schemas, migrations, prompts, tests, release mechanics, and `known-bugs.md`. |
| `docs/Quick Commands/` | Copy-pasteable commands; longer explanations link back to Admin or Developer Guide. |
| `features/` | Curated "tell me everything about this feature" pages that point into `system/`, `decisions/`, and `roadmap/plans/` docs. |
| `roadmap/` | MVP priorities, known issues, ideas, active done/pending work, and scoped plans under `roadmap/plans/`. |
| `roadmap/plans/` | Concrete plans and design strategies not fully shipped yet. Mirrored into `roadmap/done-pending.md` when in flight. |
| `decisions/` | First-class PM lane at the project root. Typed record of decisions *made* across architecture, product, market, vendor, policy, rejection, and experiment types. Type codes: `ADR / PRD / MKT / VND / POL / NEG / EXP`. |
| `history/` | Chronological logs of completed work, organized by year-month. |
| `archive/` | Superseded material replaced by current docs. |

Every visible folder has a folder-note index named after the folder, including history month folders such as `history/2026-06/2026-06.md`.

## 🔄 Workflow

```text
User or agent finishes meaningful work
        |
        v
Read the project's PM README routing map
        |
        v
Update affected current-state docs
system/ + docs/ + features/ + roadmap/ + decisions/
        |
        v
Update folder-note indexes and navigation
        |
        v
Write the final history/YYYY-MM/history-YYYY-MM-DD.md entry
```

History is written last because it records what changed after the durable docs have already been updated.

## 🧪 Validation And Integration Checks

Manual validation is optional, but agents use these checks during setup, repair, and OpenClaw alignment audits. The primary check validates both the PM folder and the registered code repo `AGENTS.md` integration.

Ask an agent to run the integrated setup check with any of these trigger phrases:

```text
verify setup
validate setup
check setup
audit setup
verify project setup
validate project setup
check PM setup
run setup checks
```

Or run the primary validator directly:

```bash
node scripts/check-pm.mjs
```

It auto-discovers `projects.json` when run from this skill repo. You can also scan one project explicitly:

```bash
node scripts/check-pm.mjs --project MyProject --config projects.json
```

Run `setup this repo` or `setup as collaborator` before project-scoped validation so `projects.json` has a real entry for the project.

Pass a real config file path for `--config`; shell file descriptors such as `/dev/fd/*` are not a supported public interface.

The wrapper runs all focused checks and exits nonzero if any check fails:

| Script | Purpose |
|---|---|
| `bootstrap-pm.mjs` | Owner setup scaffold: registers a project, creates the canonical PM folder, and wires code repo `AGENTS.md`. |
| `check-pm.mjs` | Primary entry point; runs all PM validation checks in sequence. |
| `check-vault-structure.mjs` | Required PM layout, guide folders, folder notes, semantic casing, and roadmap note sections. |
| `check-stale-docs.mjs` | Missing or old `last_reviewed` metadata. |
| `check-pm-consistency.mjs` | Visible-file frontmatter, page types, history/archive fields, internal wiki links, planning mirrors, and sync-conflict cleanup. |
| `check-agents.mjs` | Registered code repo `AGENTS.md` presence, PM section template, access mode, and placeholder drift. |

Use the individual scripts directly when debugging a specific class of failure.

When using an individual script, an explicit PM-folder path scans that folder directly. Auto-discovered `projects.json` is used only when no path is provided or when `--config` is passed.

Projects registered with `access: unavailable` are skipped cleanly because the collaborator has no local PM folder yet.

## 🔁 Migrations

Breaking PM-folder changes (lane moves, file renames, schema promotions) ship as **registered migrations** so existing projects can adopt them without losing content. The runner applies them idempotently and records what it did to a per-project ledger.

When the validator finds a registered migration that has not been applied to a project, it emits a `## Unapplied Migrations` section that names the specific migration, lists its effects, and tells the user how to run it. The agent offers to run the migration once per session, scoped to the project in scope.

### Currently registered migrations

| Migration | What it does |
|---|---|
| `1.0.0-lane-restructure` | Move `planning/` → `roadmap/plans/`; promote `planning/decisions/` to top-level `decisions/`; rename `ADR-NNN_*.md` → `D-NNN_ADR_*.md`; rewrite frontmatter and wikilinks. `archive/` and `history/` are preserved untouched. |
| `1.0.2-v0-content-rewrite` | Rewrite v0.x body text and frontmatter fields the v1.0.0 migration missed: `decisions/decisions.md` intro, `roadmap/plans/plans.md` H1 and `## Conventions`, `archive/archive.md` phrasing, `## Relevant ADRs` → `## Relevant Decisions`, v0.x tags, decision body shape, decision title/H1, plan H1 → slug-only, broken wikilinks, and `roadmap/done-pending.md` date-prefixed headers. Surfaces manual-review items for plan status/body mismatches, decision content authoring, and known-issues theoretical-risk wording. |

### Running migrations

List the registered migrations and their descriptions:

```bash
node <skill_dir>/scripts/migrate.mjs --list
```

Preview what a migration will change without applying it:

```bash
node <skill_dir>/scripts/migrate.mjs --project <Name> --dry-run
```

Apply all unapplied migrations to a project:

```bash
node <skill_dir>/scripts/migrate.mjs --project <Name> --yes
```

Apply a specific migration by id (escape hatch for partial-failure recovery):

```bash
node <skill_dir>/scripts/migrate.mjs --pm-folder <path> --migration 1.0.2-v0-content-rewrite --yes
```

The runner is **idempotent**: re-running on a fully-migrated project prints `No applicable migrations.` Each project's applied migrations are recorded at `<pm_folder>/.pm/migrations.json` (hidden dir, auto-gitignored on first apply).

## 🧰 Repository Map

| Path | Purpose |
|---|---|
| [`SKILL.md`](./SKILL.md) | Agent entry point: intents, triggers, quick start, and routing map. |
| [`REFERENCE.md`](./REFERENCE.md) | Deep reference: schemas, workflows, repair rules, bootstrap, AGENTS.md integration, and pitfalls. |
| [`install.sh`](./install.sh) | Curl-friendly installer for Codex, agent skills, Claude, OpenClaw, or a custom skills directory; rerun it to update. |
| [`openclaw-instruction.md`](./openclaw-instruction.md) | Copy-paste instruction for bootstrapping an OpenClaw PM agent. |
| [`templates/`](./templates/) | Reusable templates for project READMEs, folder notes, roadmap notes, decisions, features, known-bugs notes, PR bodies, and AGENTS.md sections. |
| [`templates/projects.template.json`](./templates/projects.template.json) | Starter registry for local project paths. |
| [`scripts/bootstrap-pm.mjs`](./scripts/bootstrap-pm.mjs) | Deterministic owner setup scaffold for PM folders and code repo `AGENTS.md`. |
| [`scripts/check-pm.mjs`](./scripts/check-pm.mjs) | Primary validation entry point that runs all PM checks. |
| [`scripts/check-agents.mjs`](./scripts/check-agents.mjs) | Code repo `AGENTS.md` integration validator. |
| [`scripts/check-vault-structure.mjs`](./scripts/check-vault-structure.mjs) | Structure and convention validator; emits `## Unapplied Migrations` for the migration registry. |
| [`scripts/check-stale-docs.mjs`](./scripts/check-stale-docs.mjs) | Stale documentation scanner. |
| [`scripts/check-pm-consistency.mjs`](./scripts/check-pm-consistency.mjs) | Strict visible-file consistency validator. |
| [`scripts/migrate.mjs`](./scripts/migrate.mjs) | Declarative migration runner for breaking PM-folder changes; applies registered migrations idempotently. |
| [`scripts/migrations/`](./scripts/migrations/) | Registered migrations (`1.0.0-lane-restructure.mjs`, `1.0.2-v0-content-rewrite.mjs`) and the registry index (`_index.mjs`). |
| [`LICENSE`](./LICENSE) | MIT license. |

## 📐 Design Principles

- **Current truth before history.** Update durable docs first; use history as the final chronological log.
- **Indexes stay indexes.** Folder notes list subfolders and notes; manuals and runbooks live in independent notes.
- **Bugs become knowledge.** Active bug tracking stays in `roadmap/known-issues.md`; root causes, solutions, verification, and recurrence patterns live in `docs/Developer Guide/known-bugs.md`.
- **Casing is semantic.** Top-level PM lanes are lowercase, docs guide folders use Title Case, content notes use lowercase slugs, and uppercase root docs stay reserved for `README.md`, `PRODUCT.md`, and `CURRENT_STATUS.md`.
- **Archive markers mean moved files.** `archived:` appears only on `archive/*-archived.md`, never on folder indexes like `archive/archive.md`.
- **Plans do not become invisible backlog.** Approved planning work is mirrored into `roadmap/done-pending.md`.
- **Agents should not guess where things go.** The project `README.md` is the routing map for every PM update.
- **The skill is portable.** `projects.json` is local and gitignored; the repo itself contains only reusable conventions, templates, and scripts.

## 📄 License

MIT. See [LICENSE](./LICENSE).
