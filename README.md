# Project Management Skill

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Install with curl](https://img.shields.io/badge/install-curl%20%7C%20bash-0f766e.svg)](#quick-start)
[![Markdown PM folders](https://img.shields.io/badge/docs-Markdown%20%2B%20Obsidian-2563eb.svg)](#pm-folder-model)

A portable agent skill for keeping project-management notes, product docs, roadmap state, and code changes in sync.

It works especially well with an Obsidian vault, but the convention is plain Markdown plus a small local `projects.json` registry. The important part is behavioral: when meaningful project work happens, the agent updates the right current-state docs, indexes, roadmap notes, and history logs in the same session.

<a id="quick-start"></a>

## 🚀 Quick Start

Pick the path that matches your situation. OpenClaw can handle setup end to end; coding-agent installs need one project setup step after installation.

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

## 🎯 Triggers (coding-agent users)

If you went through Path A (OpenClaw), the OpenClaw agent handles setup, repair, and migration autonomously — you don't need any of these. If you went through Path B, after install + first setup the project lives at `<pm_folder>` and `projects.json` lives at `~/.config/project-management/projects.json`. Restart your coding agent and use these phrases.

The order below follows a new user's natural flow: **register your project first** (`setup this repo` or `setup as collaborator`), then use verify / reconcile to clean state, and reserve migrate for the narrow case of migrations-only. Use `log this` after code changes in authoritative projects.

| You want to | Say | When to use | What happens |
|---|---|---|---|
| Bootstrap a new project's PM folder | `setup this repo` | First time you set up a project. | Creates PM folder + registers project as `access: authoritative`. |
| Register as a collaborator | `setup as collaborator` | When you have the PM folder mounted read-only (e.g., OneDrive read-link, Syncthing read-only mirror). | Registers `access: read-only` (you can read the PM folder but cannot edit it). |
| Just see what's wrong | `verify setup` | When you want a report without any changes. | Runs the registered validators. No mutation. |
| Fix one project's PM state | `reconcile this project` *(or* `repair and migrate` */* `fix everything` */* `reconcile the PM folder`*) | After setup, or periodically. | Runs validators with `--fix` for the resolved project, repairs its registered repo `AGENTS.md` PM section, applies pending migrations, re-validates. Idempotent. |
| Update all registered projects | `reconcile all projects` *(or* `reconcile existing projects` */* `reconcile outdated projects` */* `update projects with latest skill changes`*) | When the skill changed and registered projects may be stale. | Runs all registered projects with no `--project` filter: deterministic fixes, pending migrations, stale registered repo `AGENTS.md` repairs, then re-validation. |
| Apply pending migrations only | `migrate this project` | Rare. Use when you specifically want migration without validation. | Runs `migrate.mjs` for unapplied migrations. |
| Log a code change | `log this` | After finishing a code change in an authoritative project. | Updates affected current-state docs + history. |
| Check code-work PM close-out | run `check-pm-closeout.mjs` | Before a coding agent gives its final response after meaningful code work. | Verifies local access, worktree changes, current-state PM updates, and the current-day history log; allows explicit no-impact reasons. |
| Get a one-paragraph overview of a project | `summarize this project` *(or* `summarize <ProjectName>` *)* | When you open a PM folder you don't recognize (e.g., a friend's, or your own after a long break). | Reads `README.md`, `CURRENT_STATUS.md`, `PRODUCT.md`, active roadmap state, known issues, and recent history; produces a 1-paragraph summary pointing to the right files. |

If you have code access but no PM folder at all, none of these apply — see **Access model** below.

## 🛡️ Access model

The skill behaves differently depending on whether you own the PM folder or are a collaborator on a project whose PM folder is maintained by someone else. Pick your path at setup time; the agent uses the access mode you register to decide which files to write and which trigger phrases to expose. Code repos get one portable `AGENTS.md` PM section; local `projects.json` decides what that section means on each machine.

- **Owner / maintainer** (`access: authoritative`): you own the PM folder for the project. The agent edits the PM folder directly when you change code, run setup, or reconcile. Use `setup this repo` to bootstrap a new project, `reconcile this project` to fix one existing project, or `reconcile all projects` to update every registered project after skill changes.
- **Collaborator with PM access** (`access: read-only`): you can read the owner's PM folder for context but cannot edit it. When you change code, the agent fills in a "PM folder impact" section in your PR body instead of editing the PM folder. The maintainer applies the PM updates after merge. Use `setup as collaborator` to register this mode. You need the PM folder mounted read-only (e.g., via OneDrive read-link, Syncthing read-only mirror) to use this mode.
- **Contributor (no PM access)** — the skill is not really for you. You have code access but no PM folder: either the maintainer doesn't share the PM folder with you, or the maintainer doesn't use the skill at all. Don't run `setup as collaborator` — there's nothing to register on your side.

If you have code access but no PM folder, leave the "PM folder impact" section of your PR body empty. The maintainer's agent reads the code diff and applies PM updates on their side. (A read-only collaborator with PM folder read access should fill in the per-lane checkboxes in the same section — they can see the PM folder, so they can be specific.)

The `access` field is set when you first run `setup this repo` or `setup as collaborator`, and recorded in `~/.config/project-management/projects.json`. The agent checks this local field before every PM write, so a coding agent on a read-only project will *never* edit the PM folder directly — even by accident. Projects with no PM access aren't registered in `projects.json` at all; if a cloned repo has a committed `AGENTS.md` PM section but no matching local config entry, the agent treats it as no PM access and ignores the PM section during normal coding.

The full per-access-mode behavior (how the portable `AGENTS.md` section resolves local access, what trigger phrases fire, and what the contributor-vs-maintainer workflow looks like) is in `REFERENCE.md` → "Coding Agent Integration."

## ✨ What It Does

| Capability | What the agent does |
|---|---|
| 🧭 Guided setup | Lets users say `setup this repo` instead of knowing the bootstrap workflow. |
| 🏗️ Bootstrap PM folders | Creates the standard project docs layout, indexes, root notes, roadmap notes, and code-repo `AGENTS.md` integration. |
| 🧹 Repair existing folders | Finds and fixes missing indexes, stale schemas, broken conventions, roadmap drift, folder-note problems, and stale registered `AGENTS.md` PM sections. |
| 🧭 Keep live routing current | Catches live notes that still point to retired PM lanes and repairs deterministic plan/decision link drift. |
| 🔗 Keep Obsidian links navigable | Validates rendered wikilinks against the vault model and repairs deterministic PM-root-relative links, malformed links, and marked TOCs. |
| ✅ Guard PM close-out | Checks whether meaningful local code changes in authoritative projects have matching current-state PM updates and a current-day history entry. |
| 📝 Log completed work | Updates current-state docs first, then writes an outcome-first history entry with a bold human-readable sentence plus a concise type/scope token. |
| 📚 Keep guides current | Routes user, admin, developer, and quick-command changes into the right docs guide. |
| 🧩 Track plans and decisions | Creates planning notes under `roadmap/plans/`, mirrors active work into `roadmap/done-pending.md` with real section links, and records typed decisions under `decisions/`. |
| 🐞 Preserve bug knowledge | Keeps active issues in roadmap and root causes/solutions in `docs/Developer Guide/known-bugs.md`. |
| 🤝 Integrate code repos | Adds a portable `AGENTS.md` PM section that resolves local PM access from `projects.json`. |
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
| `history/` | Human-readable chronological logs of completed work, organized by year-month. |
| `archive/` | Superseded material replaced by current docs. |

Every visible folder has a folder-note index named after the folder, including history month folders such as `history/2026-06/2026-06.md`.

## 🔄 Workflow

The workflow has three branches — one per access mode. The owner's path is the only one that writes the PM folder directly; collaborators and contributors route their work through the PR body.

| Step | `access: authoritative` | `access: read-only` | No PM access |
|---|---|---|---|
| 1. Read the project's PM README | Yes (routing map) | Yes (context only) | (skip — no PM folder) |
| 2. Update current-state docs (`system/`, `docs/`, `features/`, `roadmap/`, `decisions/`) | Yes | No | No |
| 3. Update folder-note indexes and navigation | Yes | No | No |
| 4. Write `history/YYYY-MM/history-YYYY-MM-DD.md` | Yes | No | No |
| 5. Run close-out guard / PR impact check | `check-pm-closeout.mjs` should pass, or the agent states an explicit no-impact reason | Fill in the per-lane checkboxes (be specific) | Leave the section empty |
| After merge | (done) | Maintainer applies PM updates from the PR body | Maintainer inspects the code diff and infers PM updates |

History is written last because it records what changed after the durable docs have already been updated. The close-out guard is a worktree/session check, not a replacement for `check-pm.mjs` structural validation.

## 🧰 Repository Map

| Path | Purpose |
|---|---|
| [`SKILL.md`](./SKILL.md) | Agent entry point: concise trigger router and highest-risk PM rules. |
| [`REFERENCE.md`](./REFERENCE.md) | Deep reference: schemas, workflows, repair rules, bootstrap, AGENTS.md integration, and pitfalls. |
| [`install.sh`](./install.sh) | Curl-friendly installer for Codex, agent skills, Claude, OpenClaw, or a custom skills directory; rerun it to update. |
| [`openclaw-instruction.md`](./openclaw-instruction.md) | Copy-paste instruction for bootstrapping an OpenClaw PM agent. |
| [`templates/`](./templates/) | Reusable templates for project READMEs, folder notes, roadmap notes, decisions, features, known-bugs notes, PR bodies, and AGENTS.md sections. |
| [`templates/projects.template.json`](./templates/projects.template.json) | Starter for `projects.json`; the bootstrap script copies it to `~/.config/project-management/projects.json` on first run. |
| [`scripts/bootstrap-pm.mjs`](./scripts/bootstrap-pm.mjs) | Deterministic owner setup scaffold for PM folders and code repo `AGENTS.md`. |
| [`scripts/check-pm.mjs`](./scripts/check-pm.mjs) | Primary validation/reconcile entry point that runs all PM checks and coordinates `--fix`. |
| [`scripts/check-pm-closeout.mjs`](./scripts/check-pm-closeout.mjs) | Non-mutating worktree/session guard that checks whether meaningful code changes have PM close-out evidence. |
| [`scripts/check-agents.mjs`](./scripts/check-agents.mjs) | Code repo `AGENTS.md` integration validator and `--fix` repair path for missing/stale PM sections. |
| [`scripts/sync-agents-section.mjs`](./scripts/sync-agents-section.mjs) | Targeted AGENTS PM-section sync utility for re-rendering registered repos from the latest portable template. |
| [`scripts/check-vault-structure.mjs`](./scripts/check-vault-structure.mjs) | Structure and convention validator; emits `## Migration Debt` for registry migrations that still apply and are not in the project ledger. |
| [`scripts/check-stale-docs.mjs`](./scripts/check-stale-docs.mjs) | Stale documentation scanner. |
| [`scripts/check-pm-consistency.mjs`](./scripts/check-pm-consistency.mjs) | Strict visible-file consistency validator. |
| [`scripts/check-roadmap-conventions.mjs`](./scripts/check-roadmap-conventions.mjs) | Content-level roadmap convention validator for done-pending, ideas, known-issues, MVP priorities, and human-readable note shape. |
| [`scripts/check-content-semantics.mjs`](./scripts/check-content-semantics.mjs) | Semantic content validator for placeholders, dead links, plan status markers, and theoretical-risk wording. |
| [`scripts/check-known-bugs-shape.mjs`](./scripts/check-known-bugs-shape.mjs) | Known-bugs shape validator for root-cause, solution, verification, and recurrence knowledge. |
| [`scripts/check-live-routing.mjs`](./scripts/check-live-routing.mjs) | Live routing hygiene validator for retired lane references and deterministic decision-link repair. |
| [`scripts/check-obsidian-links.mjs`](./scripts/check-obsidian-links.mjs) | Obsidian rendered-link validator for malformed wiki syntax, missing targets/headings, marked TOCs, and PM-root-relative slash links. |
| [`scripts/check-skill.mjs`](./scripts/check-skill.mjs) | Skill-repo quality gate for stale public-doc phrases, template placeholders, and convention coverage. |
| [`scripts/migrate.mjs`](./scripts/migrate.mjs) | Declarative migration runner for breaking PM-folder changes; applies registered migrations idempotently. |
| [`scripts/validators/_index.mjs`](./scripts/validators/_index.mjs) | Validator registry used by `check-pm.mjs`; adding a validator is one new script plus one registry entry. |
| [`scripts/migrations/`](./scripts/migrations/) | Registered migrations and the registry index (`_index.mjs`), including lane restructure, content conventions, known-bugs shape, human-readable PM notes, live-routing hygiene, and vault-relative Obsidian link normalization. |
| [`scripts/lib/convention.mjs`](./scripts/lib/convention.mjs) | Canonical PM convention model: access values, lanes, required files, roadmap shapes, page-type inference, and route rows. |
| [`scripts/lib/markdown.mjs`](./scripts/lib/markdown.mjs) | Shared Markdown/frontmatter/heading/wiki-link helpers. |
| [`scripts/lib/obsidian-links.mjs`](./scripts/lib/obsidian-links.mjs) | Shared Obsidian link helpers for vault-relative targets, rendered-link scanning, marked TOCs, and deterministic link normalization. |
| [`scripts/lib/findings.mjs`](./scripts/lib/findings.mjs) | Shared finding shape and report renderer for newer checks. |
| [`scripts/lib/template-renderer.mjs`](./scripts/lib/template-renderer.mjs) | Template substitution and unresolved-placeholder detection. |
| [`scripts/lib/scaffold-plan.mjs`](./scripts/lib/scaffold-plan.mjs) | Shared scaffold-plan summary helpers. |
| [`scripts/lib/live-routing-fixers.mjs`](./scripts/lib/live-routing-fixers.mjs) | Shared pure fixers for retired live-lane paths and unique decision links. |
| [`scripts/lib/paths.mjs`](./scripts/lib/paths.mjs) | Shared path-resolution helpers: `findSkillDir()`, `resolveProjectsConfigPath()` (the XDG user-specific `projects.json` lookup all validators use), and `findVaultRoot()`. |
| [`scripts/lib/skip.mjs`](./scripts/lib/skip.mjs) | Shared `.pm/skip` parser used by validators to ignore project-specific files. |
| [`test/`](./test/) | Node built-in test suite for shared helpers plus AGENTS, roadmap, live-routing, and Obsidian-link behavior. |
| [`LICENSE`](./LICENSE) | MIT license. |

## 📐 Design Principles

- **Current truth before history.** Update durable docs first; use history as the final human-readable chronological log.
- **Indexes stay indexes.** Folder notes list subfolders and notes; manuals and runbooks live in independent notes.
- **Bugs become knowledge.** Active bug tracking stays in `roadmap/known-issues.md`; root causes, solutions, verification, and recurrence patterns live in `docs/Developer Guide/known-bugs.md`.
- **Casing is semantic.** Top-level PM lanes are lowercase, docs guide folders use Title Case, content notes use lowercase slugs, and uppercase root docs stay reserved for `README.md`, `PRODUCT.md`, and `CURRENT_STATUS.md`.
- **Archive markers mean moved files.** `archived:` appears only on `archive/*-archived.md`, never on folder indexes like `archive/archive.md`.
- **Plans do not become invisible backlog.** Approved planning work is mirrored into `roadmap/done-pending.md` with TOC links that match real H2 sections and plan/decision/feature links inside each section.
- **Live instructions route future agents.** README, current status, folder notes, and feature pages must point to current lanes and existing notes.
- **Obsidian links follow the vault model.** Generated cross-note PM links use vault-relative targets derived from `vault_root`; same-note section links stay as `[[#Heading]]`.
- **PM folders do not store secrets.** Keep account purpose and credential location in PM notes; keep plaintext credentials in external secret stores.
- **Agents should not guess where things go.** The project `README.md` is the routing map for every PM update.
- **Conventions have one model.** Reusable PM vocabulary lives in `scripts/lib/convention.mjs`; scripts and checks import it instead of copying lists.
- **Quality gates are local.** The repo stays dependency-free; `node --test`, `scripts/check-skill.mjs`, and `scripts/check-pm-closeout.mjs` cover the internal model, public-doc drift, and coding-session PM close-out.
- **The skill is portable.** `projects.json` lives at `~/.config/project-management/projects.json` (user-specific, gitignored); the repo itself contains only reusable conventions, templates, and scripts.

## 🏷️ Versioning

This skill is versioned with `VERSION` and `CHANGELOG.md` at the repo root. Tags follow `vMAJOR.MINOR.PATCH` (Semantic Versioning).

- **Default install:** pulls `main` (bleeding edge). Use `--ref v1.0.0` to pin an exact release, or `--channel v1` to follow the latest `v1.x.x` release.
- **Pinned install:** `curl -fsSL .../install.sh | bash -s -- --ref v1.0.0` pins to an exact version.
- **Release channel:** `curl -fsSL .../install.sh | bash -s -- --channel v1` resolves to the latest `v1.x.x` release. The `main` channel resolves to `main` (bleeding edge).
- **Update an existing install:** re-run the same install command; existing clones fetch and fast-forward to the selected ref. If the checkout has local changes, pass `--force` to discard them.
- **Force update:** `curl -fsSL .../install.sh | bash -s -- --force --yes` resets the skill directory to the selected ref and removes untracked files.

**Check the installed version** without re-running the installer:

```bash
cat <skill_dir>/VERSION
```

The version is printed after every install or update:

```text
==> Installed version: <version>
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

Before tagging, sanity-check with `bash -n install.sh`, `node --check scripts/*.mjs scripts/lib/*.mjs scripts/migrations/*.mjs scripts/validators/*.mjs`, `node --test`, and `node scripts/check-skill.mjs`. For a full end-to-end check, invoke `node scripts/check-pm.mjs` against a fresh scaffold or the self-hosted Project Management PM folder.

## 📄 License

MIT. See [LICENSE](./LICENSE).
