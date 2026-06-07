---
name: project-management
description: "Keeps project-management folders, product docs, roadmap state, history logs, and code-repo agent guidance in sync. Use when the user asks to log, record, archive, update, create, configure, register, add, bootstrap, setup, standardize, initialize, verify, validate, repair, audit, or fix project docs or PM folders; set up or fix a project's AGENTS.md; or when meaningful project work finishes."
---

# Project Management

Use this skill for three intents:

1. **Log or update** an existing project (record a change, capture a decision, archive a doc).
2. **Initialize or standardize** a PM folder (create from scratch, or convert an existing folder into the canonical structure).
3. **Verify, repair, or audit** a PM folder and code-repo integration (run validation checks, then find and fix inconsistencies: missing fields, broken cross-links, schema drift, out-of-date READMEs, planning/roadmap mismatches, AGENTS.md drift, etc.).

> **For advanced topics** (frontmatter schema, validation and repair workflow, coding agent integration, contributor workflow, bootstrap workflow, permission policy, pitfalls), see [REFERENCE.md](REFERENCE.md). This file is the entry point; REFERENCE.md is the deep doc.

---

## Quick Start

The five most common actions:

**1. Log a change** — say "log this" or "I just finished <feature>". The agent reads the project's `README.md`, checks every PM-impact lane that could have changed (`system/`, `docs/`, `features/`, `roadmap/`, `planning/`, ADRs), updates the needed current-state docs and indexes, then appends a Conventional Commits-prefixed bullet to `history/YYYY-MM/history-YYYY-MM-DD.md` (e.g., `history/2026-05/history-2026-05-04.md`). If the month folder is new, the agent also creates `history/YYYY-MM/YYYY-MM.md` and links it from `history/history.md`.

**2. Set up project management** — say "setup", "setup this repo", "setup PM", or "setup as collaborator". The agent first inspects the current folder and `projects.json`; if the folder is empty or unrecognized, it asks whether the folder is the code repo, PM folder, or something else. Then it asks a short guided intake with selectable answer suggestions (role, PM folder state, project phase, AGENTS.md setup) plus free-text path/description questions only when needed. It then routes to create a new PM folder, repair an existing/messy PM folder, register read-only collaborator access, or register unavailable PM access. For owner setup with an empty code repo and empty PM folder, run `scripts/bootstrap-pm.mjs` to scaffold the PM folder and create the authoritative code repo `AGENTS.md` when a real `code_repo` path exists.

**3. Initialize a new project's PM folder directly** — say "initialize the PM folder for <name>". The agent asks for the missing fields (project name, code_repo, pm_folder, phase, access, notes), then runs `scripts/bootstrap-pm.mjs` as described in the Bootstrap Workflow in REFERENCE.md.

**4. Verify project management setup** — say "verify PM folder", "validate project setup", "check AGENTS.md", "audit project management", or "run PM checks". The agent first confirms the project is registered in `projects.json`, then runs `node <skill_dir>/scripts/check-pm.mjs` with any relevant `--project` / `--config` args, reports failures clearly, and only fixes files when the user asked to repair or the project has authoritative PM access.

**5. Add an AGENTS.md PM folder section to a project repo** — say "add to AGENTS.md" or "set up AGENTS.md for <project>". The agent reads the project's `access` field in `projects.json` and copies the right template (`AGENTS_PM_SECTION_AUTHORITATIVE.md`, `AGENTS_PM_SECTION_READONLY.md`, or `AGENTS_PM_SECTION_UNAVAILABLE.md`) into the project's `AGENTS.md`.

**6. Bootstrap an OpenClaw PM agent** — say "setup OpenClaw PM agent", "generate OpenClaw PM prompt", "bootstrap OpenClaw PM", or "write OpenClaw AGENTS prompt". The agent displays the short copy-paste prompt that tells OpenClaw to read `https://raw.githubusercontent.com/SYU8384/project-management/main/openclaw-instruction.md`. That instruction installs or updates the skill, verifies or creates `projects.json`, runs guided project intake when needed, checks its own workspace `AGENTS.md`, audits registered PM folders and project code repo `AGENTS.md` files, and asks approval before changing files.

---

## Triggers

Match user phrases to the right intent. If multiple intents apply, do all of them in this order: log → repair → initialize (log is fastest and least disruptive; initialize is most disruptive).

| User says | Intent | Workflow section |
|---|---|---|
| "setup", "set up this repo", "setup this project", "setup PM", "setup project management", "setup as collaborator" | Guided setup intake | Setup Intake (REFERENCE) |
| "log this", "record this", "capture this decision" | Log | Existing Project Management (REFERENCE) |
| "I just made a code change", "I just finished <feature>" | Log | Existing Project Management (REFERENCE) |
| "create the PM folder", "initialize the PM folder", "set up project docs", "bootstrap", "standardize the PM folder", "convert this mess to the standard layout", "restructure the PM folder", "normalize the PM folder" | Initialize (new or against existing) | Standard App Project Bootstrap (REFERENCE) |
| "verify PM folder", "validate PM folder", "check PM folder", "audit PM folder", "verify project setup", "validate project setup", "check PM setup", "check AGENTS.md", "validate AGENTS.md", "audit project management", "run PM checks", "check for inconsistencies", "find issues in the PM folder" | Validate / audit PM folder and AGENTS.md integration | Validation and Repair (REFERENCE) |
| "repair the PM folder", "fix the PM folder", "repair PM folder" | Repair: run validation, fix authoritative issues, rerun validation | Validation and Repair (REFERENCE) |
| "fix the schema", "migrate the frontmatter", "update the schema" | Repair (focused on schema) | Validation and Repair (REFERENCE) |
| "sync the READMEs", "update the routing map", "fix the Quick Rules", "fix the What Goes Where table" | Repair (focused on README) | Validation and Repair (REFERENCE) |
| "add to AGENTS.md", "fix AGENTS.md", "set up AGENTS.md", "update AGENTS.md for <project>", "write the PM folder section for <project>" | AGENTS.md work (checks `access` in `projects.json` to pick the right section) | Coding Agent Integration (REFERENCE) |
| "setup OpenClaw PM agent", "generate OpenClaw PM prompt", "bootstrap OpenClaw PM", "write OpenClaw AGENTS prompt", "OpenClaw PM bootstrap" | Display the short copy-paste prompt that points the OpenClaw PM agent to `openclaw-instruction.md` | OpenClaw PM Agent Bootstrap (REFERENCE) |
| "register <project> as authoritative", "mark <project> as read-only", "set access for <project>" | Config update | Configuration (REFERENCE) |
| "add a new project", "register a new project", "add <Project> to projects.json" | Config update | Configuration → Adding a new project (REFERENCE) |
| "I just opened a PR", "I just merged a PR", "review a PR for PM impact" | Contributor | Contributor Workflow (REFERENCE) |
| "this is a big task", "multi-session", "plan this out", "let me plan this", or the change has multi-step work / multi-session work / many rounds of fixes | Big task → plan first | Big Tasks Must Be Planned (REFERENCE) |

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
| `planning/` | Concrete implementation plans and design decisions for a set of features or initiatives |
| `features/` | Curated per-feature pages. Each page is a "tell me everything about X" index that points into `system/` and `planning/`. **Required** for any project past initial planning; pre-alpha projects have an empty index. |
| `roadmap/` | MVP priorities, known issues, planning-note mirrored done/pending status, lightweight general done/pending status, and ideas |
| `history/` | Brief chronological logs of completed meaningful work, organized by year-month |
| `archive/` | Superseded material replaced by current product, system, roadmap, or planning docs |
| `CURRENT_STATUS.md` | Weekly snapshot | Top priorities, blocked, recent wins, major risks, stale docs |

Naming is semantic: top-level PM lanes are lowercase, docs guide folders use Title Case, folder notes exactly match their folder name, content notes use neutral lowercase kebab-case slugs, and uppercase filenames are reserved for root artifacts (`README.md`, `PRODUCT.md`, `CURRENT_STATUS.md`) plus ADR prefixes. Personal/collaborator prefixes such as `haoyou_` are discouraged in canonical PM folders and should be treated as warnings, not hard failures.

Archive marker rule: `archived: <date>` appears only on moved archive files named `archive/*-archived.md`. Folder indexes such as `archive/archive.md` must not carry `archived:`.

Bug routing: `roadmap/known-issues.md` tracks active bugs, risks, and blockers; `docs/Developer Guide/known-bugs.md` is required for engineering bug knowledge, including active/fixed status, symptoms, root cause, solution, verification, recurrence patterns, and links to history or known issues.

---

## Advanced features

For the validation workflow, repair workflow, frontmatter schema, coding agent integration, contributor workflow, bootstrap workflow, permission policy, and pitfalls, see [REFERENCE.md](REFERENCE.md).

---

## Final Response Requirement

After logging or bootstrapping, say exactly which project/vault files were updated. If no files were updated, say that explicitly and why.
