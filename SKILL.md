---
name: project-logging
description: "Use when the user asks to log, record, archive, update, create, configure, register, add, bootstrap, standardize, initialize, repair, audit, or fix project docs or PM folders; set up or fix a project's AGENTS.md; or when meaningful project work finishes."
---

# Project Logging

Use this skill for three intents:

1. **Log or update** an existing project (record a change, capture a decision, archive a doc).
2. **Initialize or standardize** a PM folder (create from scratch, or convert an existing folder into the canonical structure).
3. **Repair or audit** a PM folder (find and fix inconsistencies: missing fields, broken cross-links, schema drift, out-of-date READMEs, planning/roadmap mismatches, etc.).

> **For advanced topics** (frontmatter schema, repair workflow, coding agent integration, contributor workflow, bootstrap workflow, permission policy, pitfalls), see [REFERENCE.md](REFERENCE.md). This file is the entry point; REFERENCE.md is the deep doc.

---

## Quick Start

The three most common actions:

**1. Log a change** — say "log this" or "I just finished <feature>". The agent reads the project's `README.md` and the relevant `system/<topic>.md` (current behavior), updates the docs that need to change, then appends a Conventional Commits-prefixed bullet to `history/YYYY-MM/HISTORY-YYYY-MM-DD.md` (e.g., `history/2026-05/HISTORY-2026-05-04.md`).

**2. Initialize a new project's PM folder** — say "initialize the PM folder for <name>". The agent asks for 5 fields (project name, code_repo, pm_folder, phase, access, notes), writes them to `<skill_dir>/projects.json`, then runs the 11-step Bootstrap Workflow in REFERENCE.md.

**3. Add an AGENTS.md PM folder section to a project repo** — say "add to AGENTS.md" or "set up AGENTS.md for <project>". The agent reads the project's `access` field in `projects.json` and copies the right template (`AGENTS_PM_SECTION_AUTHORITATIVE.md` or `AGENTS_PM_SECTION_READONLY.md`) into the project's `AGENTS.md`.

---

## Triggers

Match user phrases to the right intent. If multiple intents apply, do all of them in this order: log → repair → initialize (log is fastest and least disruptive; initialize is most disruptive).

| User says | Intent | Workflow section |
|---|---|---|
| "log this", "record this", "capture this decision" | Log | Existing Project Logging (REFERENCE) |
| "I just made a code change", "I just finished <feature>" | Log | Existing Project Logging (REFERENCE) |
| "create the PM folder", "initialize the PM folder", "set up project docs", "bootstrap", "standardize the PM folder", "convert this mess to the standard layout", "restructure the PM folder", "normalize the PM folder" | Initialize (new or against existing) | Standard App Project Bootstrap (REFERENCE) |
| "repair the PM folder", "fix the PM folder", "audit the PM folder", "check for inconsistencies", "find issues in the PM folder" | Repair | Repair the PM Folder (REFERENCE) |
| "fix the schema", "migrate the frontmatter", "update the schema" | Repair (focused on schema) | Repair the PM Folder (REFERENCE) |
| "sync the READMEs", "update the routing map", "fix the Quick Rules", "fix the What Goes Where table" | Repair (focused on README) | Repair the PM Folder (REFERENCE) |
| "add to AGENTS.md", "fix AGENTS.md", "set up AGENTS.md", "update AGENTS.md for <project>", "write the PM folder section for <project>" | AGENTS.md work (checks `access` in `projects.json` to pick the right section) | Coding Agent Integration (REFERENCE) |
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
| `docs/` | User, admin, developer, and quick-command documentation |
| `planning/` | Concrete implementation plans and design decisions for a set of features or initiatives |
| `features/` | Curated per-feature pages. Each page is a "tell me everything about X" index that points into `system/` and `planning/`. **Required** for any project past initial planning; pre-alpha projects have an empty index. |
| `roadmap/` | MVP priorities, known issues, planning-note mirrored done/pending status, lightweight general done/pending status, and ideas |
| `history/` | Brief chronological logs of completed meaningful work, organized by year-month |
| `archive/` | Superseded material replaced by current product, system, roadmap, or planning docs |
| `CURRENT_STATUS.md` | Weekly snapshot | Top priorities, blocked, recent wins, major risks, stale docs |

---

## Advanced features

For the repair workflow, frontmatter schema, coding agent integration, contributor workflow, bootstrap workflow, permission policy, and pitfalls, see [REFERENCE.md](REFERENCE.md).

---

## Final Response Requirement

After logging or bootstrapping, say exactly which project/vault files were updated. If no files were updated, say that explicitly and why.
