# Project Management Skill

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Install with curl](https://img.shields.io/badge/install-curl%20%7C%20bash-0f766e.svg)](#quick-start)
[![Markdown PM folders](https://img.shields.io/badge/docs-Markdown%20%2B%20Obsidian-2563eb.svg)](#pm-folder-model)

A portable agent skill for keeping project-management notes, product docs, roadmap state, and code changes in sync.

It works especially well with an Obsidian vault, but the convention is plain Markdown plus a small local `projects.json` registry. The important part is behavioral: when meaningful project work happens, the agent updates the right current-state docs, indexes, roadmap notes, and history logs in the same session.

<a id="quick-start"></a>

## 🚀 Quick Start

Pick the path that matches your situation. Both end at a working PM folder.

### Path A — You have an OpenClaw PM agent (recommended for PM-domain work)

OpenClaw PM agents live in your chat, not in your repo. Their job is the PM work itself — brainstorming, capturing decisions and meetings, tracking progress across projects, and keeping the PM folder current. This is *broader* than what a coding agent does as a side effect of code changes. Use OpenClaw when the work is PM-shaped.

Paste this to your OpenClaw agent:

```text
Read https://raw.githubusercontent.com/SYU8384/project-management/main/openclaw-instruction.md and follow its instructions.
```

The OpenClaw agent handles the rest — installing or updating the skill, creating `~/.config/project-management/projects.json`, running a guided setup for each project, and auditing everything else. **You don't need to say `setup this repo` afterward**; OpenClaw runs setup autonomously.

### Path B — You use Codex / Claude / another coding agent (PM is a side effect of code work)

**Interactive installer (recommended for first-time installs):**

```bash
curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh | bash
```

With a TTY attached, the installer shows an interactive menu of four targets plus a custom-directory option. Without a TTY (CI, scripts, `ssh -T`), it defaults to `--target agents` (the most portable target).

**Non-interactive (CI / scripts):** pass `--target <name> --yes`:

```bash
curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh | bash -s -- --target agents --yes
```

Targets: `agents` (`~/.agents/skills/project-management`), `codex`, `claude`, `openclaw`, or `--dest <path>` for a custom directory.

### After install: trigger phrases for your coding agent

If you went through Path A (OpenClaw), the OpenClaw agent handles setup, repair, and migration autonomously — you don't need any of these. If you went through Path B, restart your coding agent and use these. The order below is the recommended flow: start with reconcile (the all-in-one fix), use verify when you want a report without any changes, and reserve migrate for the narrow case of migrations-only.

| You want to | Say | When to use | What happens |
|---|---|---|---|
| Fix everything that's wrong | `reconcile this project` *(or* `repair and migrate` */* `fix everything` */* `reconcile the PM folder`*) | First-time pick after install, or after a long stretch without running the skill. | Runs validators with `--fix`, applies pending migrations, re-validates. Idempotent. |
| Just see what's wrong | `verify setup` | When you want a report without any changes. | Runs all four focused validators. No mutation. |
| Apply pending migrations only | `migrate this project` | Rare. Use when you specifically want migration without validation. | Runs `migrate.mjs` for unapplied migrations. |
| Bootstrap a new project's PM folder | `setup this repo` | First time you set up a project. | Creates PM folder + registers project as `access: authoritative`. |
| Register as a collaborator | `setup as collaborator` | When you have code access but don't own the PM folder. | Registers `access: read-only` or `unavailable` based on your input. |
| Log a code change | `log this` | After finishing a code change in an authoritative project. | Updates affected current-state docs + history. |

After install + first setup, the project lives at `<pm_folder>` and `projects.json` lives at `~/.config/project-management/projects.json`.

## 🛡️ Access model

The skill behaves differently depending on whether you own the PM folder or are a collaborator on a project whose PM folder is maintained by someone else. Pick your path at setup time; the agent uses the access mode you register to decide which files to write, what `AGENTS.md` section to install, and which trigger phrases to expose.

- **Owner / maintainer** (`access: authoritative`): you own the PM folder for the project. The agent edits the PM folder directly when you change code, run setup, or reconcile. Use `setup this repo` to bootstrap a new project, or `reconcile this project` to fix an existing one.
- **Collaborator with PM access** (`access: read-only`): you can read the owner's PM folder for context but cannot edit it. When you change code, the agent fills in a "PM folder impact" section in your PR body instead of editing the PM folder. The maintainer applies the PM updates after merge. Use `setup as collaborator` to register this mode.
- **Collaborator without PM access yet** (`access: unavailable`): you have code access but the PM folder doesn't exist locally or you can't read it. The agent asks the maintainer for access, uses code-repo docs only, and writes a "PM folder unavailable locally" note in your PR body. Use `setup as collaborator` to register this mode.

The access field is set when you first run `setup this repo` or `setup as collaborator`, and recorded in `~/.config/project-management/projects.json`. The agent checks this field before every write, so a coding agent on a read-only project will *never* edit the PM folder directly — even by accident.

The full per-access-mode behavior (what `AGENTS.md` gets written, what trigger phrases fire, what the contributor-vs-maintainer workflow looks like for read-only and unavailable projects) is in `REFERENCE.md` → "Coding Agent Integration."

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

## 🧰 Repository Map

| Path | Purpose |
|---|---|
| [`SKILL.md`](./SKILL.md) | Agent entry point: intents, triggers, quick start, and routing map. |
| [`REFERENCE.md`](./REFERENCE.md) | Deep reference: schemas, workflows, repair rules, bootstrap, AGENTS.md integration, and pitfalls. |
| [`install.sh`](./install.sh) | Curl-friendly installer for Codex, agent skills, Claude, OpenClaw, or a custom skills directory; rerun it to update. |
| [`openclaw-instruction.md`](./openclaw-instruction.md) | Copy-paste instruction for bootstrapping an OpenClaw PM agent. |
| [`templates/`](./templates/) | Reusable templates for project READMEs, folder notes, roadmap notes, decisions, features, known-bugs notes, PR bodies, and AGENTS.md sections. |
| [`templates/projects.template.json`](./templates/projects.template.json) | Starter for `projects.json`; the bootstrap script copies it to `~/.config/project-management/projects.json` on first run. |
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
- **The skill is portable.** `projects.json` lives at `~/.config/project-management/projects.json` (user-specific, gitignored); the repo itself contains only reusable conventions, templates, and scripts.

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

## 📄 License

MIT. See [LICENSE](./LICENSE).
