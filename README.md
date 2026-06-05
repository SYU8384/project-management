# Project Management Skill

A portable Codex/agent skill for keeping project-management notes, product docs, roadmap state, and code changes in sync.

It works especially well with an Obsidian vault, but the convention is just Markdown files plus a small `projects.json` mapping. The core idea is simple: when meaningful project work happens, the agent updates the right durable docs, indexes, roadmap notes, and history logs in the same session.

## Why This Exists

Project notes usually decay for predictable reasons:

- Work gets shipped, but user guides, admin runbooks, and developer docs lag behind.
- Decisions are scattered across chats, PRs, issues, and half-finished planning files.
- Roadmaps become stale because done/pending state is not tied to real implementation work.
- Agents waste time rediscovering architecture, recurring bugs, and prior fixes.
- Folder structures grow organically until nobody knows where new information belongs.

This skill gives agents a strict, repeatable operating model for project memory.

## What It Does

| Capability | What the agent does |
|---|---|
| Log completed work | Updates current-state docs first, then writes a Conventional Commits-style history entry. |
| Initialize PM folders | Creates the standard project docs layout, indexes, root notes, roadmap notes, and validation scripts. |
| Repair existing folders | Finds missing indexes, stale schemas, broken conventions, roadmap drift, and folder-note problems. |
| Keep guides current | Routes user-facing, admin, developer, and quick-command changes into the right docs guide. |
| Track plans and decisions | Creates planning notes, mirrors active work into `roadmap/done-pending.md`, and records ADRs. |
| Archive shipped plans | Distills durable truth into current docs, moves superseded material to `archive/`, and records history. |
| Integrate code repos | Adds an `AGENTS.md` PM section so coding agents know what to read before work and update after work. |

## How The Workflow Works

```text
User or agent finishes meaningful work
        |
        v
Read the project's PM README routing map
        |
        v
Update affected current-state docs
system/ + docs/ + features/ + roadmap/ + planning/
        |
        v
Update folder-note indexes and navigation
        |
        v
Write the final history/YYYY-MM/history-YYYY-MM-DD.md entry
```

History is written last because it records what changed after the durable docs have already been updated.

## PM Folder Model

Each project gets a Markdown folder with stable lanes:

| Path | Purpose |
|---|---|
| `PRODUCT.md` | Product vision, target users, current product shape, principles, and boundaries. |
| `CURRENT_STATUS.md` | Weekly snapshot: phase, priorities, blockers, recent wins, risks, and stale-doc state. |
| `system/` | Current architecture, behavior, runtime, auth, database, integrations, and deployment. |
| `docs/User Guide/` | End-user manual, FAQ, and product reference notes. |
| `docs/Admin Guide/` | Live product operations: support, feedback, admin panel workflows, monitoring, statistics, background job runs, access, incident response, production verification, and data repair. |
| `docs/Developer Guide/` | Coding-engineer workflows: local setup, codebase structure, APIs, schemas, migrations, prompts, tests, implementation notes, changing jobs, release mechanics, and the required `known-bugs.md` bug knowledge base. |
| `docs/Quick Commands/` | Copy-pasteable commands; longer explanations link back to Admin or Developer Guide. |
| `features/` | Curated "tell me everything about this feature" pages that point into system and planning docs. |
| `roadmap/` | MVP priorities, known issues, ideas, and active done/pending work. |
| `planning/` | Concrete plans and architecture decisions that are not fully shipped yet. |
| `history/` | Chronological logs of completed work, organized by year-month. |
| `archive/` | Superseded material that has been replaced by current docs. |

Every visible folder has a folder-note index named after the folder, including history month folders such as `history/2026-06/2026-06.md`.

## Quick Start

Clone or install this folder wherever your agent can load local skills:

```bash
git clone https://github.com/SYU8384/project-management.git
```

Create your local project registry:

```bash
cp templates/projects.template.json projects.json
```

Fill in `projects.json` with your vault root, this skill path, and one entry per project:

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

Then use natural prompts with your agent:

| Prompt | Result |
|---|---|
| `initialize the PM folder for MyProject` | Creates or standardizes the PM folder layout. |
| `log this` | Updates relevant docs and appends a history entry. |
| `repair the PM folder` | Audits structure, schemas, indexes, naming, roadmap shape, and drift. |
| `add to AGENTS.md` | Installs PM-folder instructions into the code repo. |
| `I just opened a PR` | Helps fill in the PM impact and update the right project notes. |

## Validation Tools

The repo includes two Node scripts:

```bash
node scripts/check-vault-structure.mjs
node scripts/check-stale-docs.mjs
```

Both scripts auto-discover `projects.json` when run from this skill repo. You can also scan one project explicitly:

```bash
node scripts/check-vault-structure.mjs --project MyProject --config projects.json
node scripts/check-stale-docs.mjs --project MyProject --config projects.json
```

`check-vault-structure.mjs` verifies the required PM layout, required Developer Guide `known-bugs.md`, semantic folder casing, recursive folder notes, docs-guide naming, history filename casing, roadmap shape, and AGENTS.md drift.

`check-stale-docs.mjs` reports files with missing or old `last_reviewed` metadata.

## Repository Map

| Path | Purpose |
|---|---|
| [`SKILL.md`](./SKILL.md) | Agent entry point: intents, triggers, quick start, and routing map. |
| [`REFERENCE.md`](./REFERENCE.md) | Deep reference: schemas, workflows, repair rules, bootstrap, AGENTS.md integration, and pitfalls. |
| [`templates/`](./templates/) | Reusable Markdown templates for project READMEs, folder notes, ADRs, features, known-bugs notes, PR bodies, and AGENTS.md sections. |
| [`templates/projects.template.json`](./templates/projects.template.json) | Starter registry for your local project paths. |
| [`scripts/check-vault-structure.mjs`](./scripts/check-vault-structure.mjs) | Structure and convention validator. |
| [`scripts/check-stale-docs.mjs`](./scripts/check-stale-docs.mjs) | Stale documentation scanner. |
| [`LICENSE`](./LICENSE) | MIT license. |

## Design Principles

- **Current truth before history.** Update durable docs first; use history as the final chronological log.
- **Indexes stay indexes.** Folder notes list subfolders and notes; manuals and runbooks live in independent notes.
- **Bugs become knowledge.** Active bug tracking stays in `roadmap/known-issues.md`; root causes, solutions, verification, and recurrence patterns live in `docs/Developer Guide/known-bugs.md`.
- **Casing is semantic.** Top-level PM lanes are lowercase, docs guide folders use Title Case, content notes use lowercase slugs, and uppercase root docs stay reserved for `README.md`, `PRODUCT.md`, and `CURRENT_STATUS.md`.
- **Plans do not become invisible backlog.** Approved planning work is mirrored into `roadmap/done-pending.md`.
- **Agents should not guess where things go.** The project `README.md` is the routing map for every PM update.
- **The skill is portable.** `projects.json` is local and gitignored; the repo itself contains only reusable conventions, templates, and scripts.

## License

MIT. See [LICENSE](./LICENSE).
