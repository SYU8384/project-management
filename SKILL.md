---
name: project-management
description: "Keeps project-management folders, product docs, roadmap state, history logs, decisions, and code-repo AGENTS.md guidance in sync. Use when the user asks to log, record, archive, update, create, configure, register, bootstrap, setup, standardize, initialize, verify, validate, repair, audit, reconcile, migrate, or fix project docs or PM folders; set up or fix a project's AGENTS.md; summarize a project; review PR PM-folder impact; or when meaningful project work finishes."
---

# Project Management

Use this skill when project work needs to be recorded, a PM folder needs to be created or repaired, or a code repo needs PM-folder instructions in `AGENTS.md`.

`SKILL.md` is the operational entry point. Load [REFERENCE.md](REFERENCE.md) only for detailed workflow rules, schema details, migrations, contributor flow, setup intake, permission policy, and pitfalls.

## Core Workflow

1. Identify the project from the current repo, user request, or `~/.config/project-management/projects.json`.
2. Read the project PM folder `README.md` first. Its routing map wins over generic guidance.
3. Apply the access model:
   - `authoritative`: update the PM folder directly.
   - `read-only`: read the PM folder, then fill the PR body's PM impact section; do not edit the PM folder.
   - no PM access: do not register the project locally; contributor workflow is PR-body-only.
4. Update current-state docs before history. For code work, check `CURRENT_STATUS.md`, the active `roadmap/milestones/<phase>.md`, `system/`, `docs/`, `features/`, `roadmap/`, `decisions/`, folder indexes, then append `history/YYYY-MM/history-YYYY-MM-DD.md`. Refresh `CURRENT_STATUS.md` and the active or explicitly linked milestone whenever priorities, blockers, risks, wins, plans, decisions, features, known issues, or phase/milestone state change.
5. Before the final response after meaningful code work, run `scripts/check-pm-closeout.mjs` when possible, or explicitly state the no-impact reason. Validate when setup, repair, migration, or structural drift is in scope.

## Trigger Map

| User says | Do this |
|---|---|
| "log this", "record this", "I just finished..." | Read the PM README, update affected current-state docs and indexes, append history. |
| "setup", "setup this repo", "setup PM", "setup as collaborator" | Run setup intake from `REFERENCE.md`; route to bootstrap, repair, or read-only registration. |
| "initialize/bootstrap/create PM folder" | Run `scripts/bootstrap-pm.mjs` with project, PM folder, code repo/null, phase, notes, access, and config path. |
| "verify/check/audit setup" | Run `node <skill_dir>/scripts/check-pm.mjs --project <name> --config <path>` when registered. |
| "audit/check PM folder quality", "checkup PM folder" | Use the PM Folder Quality Audit workflow in `REFERENCE.md`: validate, scan live routing/link drift, refresh status, compress roadmap lanes, check for secrets, then write history last. |
| "repair/reconcile/fix everything" for one project | Run `node <skill_dir>/scripts/check-pm.mjs --project <name> --config <path> --fix`, then re-check residual findings. |
| "reconcile all projects", "reconcile existing projects", "reconcile outdated projects", "update projects with latest skill changes" | Run `node <skill_dir>/scripts/check-pm.mjs --config ~/.config/project-management/projects.json --fix` with no `--project` filter. This reconciles every registered project: deterministic metadata/content fixes, pending migrations, registered repo `AGENTS.md` repairs, then re-validation. |
| "migrate/upgrade PM/clear migration debt" | Use `scripts/migrate.mjs`; name the migration and concrete effects before applying. |
| "add/fix AGENTS.md PM folder section" | Apply the portable AGENTS template; local `projects.json` access controls runtime behavior. |
| "sync AGENTS.md / PM section is stale" | Run `node <skill_dir>/scripts/sync-agents-section.mjs --project <name>` (or omit `--project` for all). Re-renders the `## PM folder` span in each code repo's `AGENTS.md` from the latest template; preserves all other AGENTS.md content. |
| "summarize this project" | Read README, CURRENT_STATUS, PRODUCT, done-pending, known-issues, and recent history; return one paragraph. |
| "PR PM impact", "opened/merged/reviewed a PR" | Use Contributor Workflow in `REFERENCE.md`; maintainer agents backfill PM docs when needed. |
| "big task", "multi-session", or broad architecture/doc redesign | Write or update a planning note before implementation and mirror it in `roadmap/done-pending.md`. |
| meaningful code work finishes | Run `node <skill_dir>/scripts/check-pm-closeout.mjs --project <name> --config <path>` before final response; fix PM docs or pass `--allow-no-impact "reason"` only for real no-PM-impact work. |

## High-Risk Routing Rules

- `roadmap/known-issues.md` is for observed bugs, risks, and blockers only. Theoretical risks stay in the plan's risk/error map until they happen.
- History bullets start with a bold human-readable outcome sentence, then keep a concise conventional type/scope token (`feat:`, `fix:`, `docs:`, etc.) in the detail text. Do not write history as raw commit-comment bullets.
- `roadmap/done-pending.md` Contents links point only to actual H2 headings inside the same note. Put planning-note, decision, feature, system, and docs links inside each section, not in the TOC.
- Cross-note PM wikilinks are vault-relative when `vault_root` is known (for example `[[Projects/Example/roadmap/done-pending|done-pending]]`), never OS-absolute and never hardcoded to a specific user's folder layout. Same-note links stay as `[[#Heading]]`.
- `inbox/` is raw intake, not backlog. Use it for untriaged owner/collaborator notes only; after owner review, digest durable content into ideas, plans, done-pending, decisions, system, features, docs, or known issues. When the owner digests an inbox note, flip `status` to `processed`, set `resolution` to the routing value (`idea / planning / done-pending / decision / feature / system / docs / known-issue / addressed-directly / no-action / multiple`), and set `destination` to the vault-relative wikilink of the canonical lane — body `Owner Triage` wikilinks alone do not satisfy `check-inbox-conventions.mjs`. If creating an inbox note without a provided creator name, use `NAME_PLACEHOLDER` in the filename, title/H1, and `author`, then ask the user what name should replace it.
- `roadmap/ideas.md` entries need a real `**Summary:**` paragraph in `## Idea Details`; do not leave one-line backlog dumps.
- Deferred items have one home: ideas if never scoped, the plan's `NOT in scope` section if scoped then deferred, or a `NEG` decision if explicitly rejected.
- Decisions live in root `decisions/` as `D-NNN_<type>_<slug>.md`, with type `ADR / PRD / MKT / VND / POL / NEG / EXP`.
- Planning notes live in `roadmap/plans/YYYY-MM-DD_slug.md` and are mirrored into `roadmap/done-pending.md` while active or proposed. Plan bodies do not repeat the title as a body H1; start with useful content such as `## Summary`, then keep `## Related` near the top. Active/proposed plans keep `## Related` linked to the exact `roadmap/done-pending.md#<slug>` mirror and repeat relevant decision/feature/system/docs links already present in that mirror. Planning mirrors must include the human archive-confirmation checkbox; leave it pending until the user says testing is OK or explicitly asks to archive, then check it and run the normal `--fix` archive path. A newer planning note that absorbs an older plan's scope flips the older plan's frontmatter `status` to `superseded` and prepends a `**Superseded by [[<parent>]]**` line to the older mirror in `roadmap/done-pending.md` (D-020); the archive move happens only at parent close-out + human verification and cascades to superseded dependents whose rolled-up PENDING bullets are closed.
- Milestone notes under `roadmap/milestones/` are agent-maintained live state. Derive the active milestone from `CURRENT_STATUS.md` `## Current Phase` (fallback: `projects.json` phase), create it if missing, and review/update it before history whenever plans, done-pending mirrors, decisions, features, known issues, blockers, risks, top priorities, or phase state change. If prose does not change, refresh `updated` and `last_reviewed`.
- Milestone evidence links belong inline: link specific plans, done-pending sections, decisions, feature notes, known issues, or docs inside the priority, major step, exit criterion, or deferred item they support. Do not maintain a generic milestone `## Related Notes` link dump.
- Live PM notes outside `history/` and `archive/` must not teach retired lanes. Use `roadmap/plans/`, root `decisions/`, and `Relevant decisions:`; link bare `ADR-NNN` / `D-NNN` references only when the target is unique.
- `archived: <date>` belongs only on moved `archive/*-archived.md` files. Do not use `status: archived`.
- Active bug tracking belongs in `roadmap/known-issues.md`; engineering root cause, fix, verification, and recurrence knowledge belongs in `docs/Developer Guide/known-bugs.md`. Entries follow the D-021 shape convention (per-section required fields, no H3 links in Contents, placeholders surfaced as MANUAL REVIEW).
- PM notes must not store plaintext credentials, tokens, API keys, private URLs with secrets, or recovery codes. Document purpose, status, and where credentials live outside the PM folder.

## Commands

- Validate PM setup: `node <skill_dir>/scripts/check-pm.mjs --project <name> --config ~/.config/project-management/projects.json`
- Reconcile PM setup: `node <skill_dir>/scripts/check-pm.mjs --project <name> --config ~/.config/project-management/projects.json --fix`
- Reconcile all registered PM setups: `node <skill_dir>/scripts/check-pm.mjs --config ~/.config/project-management/projects.json --fix`
- Check code-work PM close-out: `node <skill_dir>/scripts/check-pm-closeout.mjs --project <name> --config ~/.config/project-management/projects.json` (add `--since 2026-06-16T00:00:00+09:00` for a stricter session baseline, or `--allow-no-impact "reason"` for explicit no-PM-impact work)
- Sync the AGENTS.md `## PM folder` section with the latest template: `node <skill_dir>/scripts/sync-agents-section.mjs --project <name> --config ~/.config/project-management/projects.json` (use `--dry-run --no-history` to preview; `--no-history` to skip the auto history bullet)
- Sync the OpenClaw workspace `AGENTS.md` `## Project Management Skill` block with the section-6 template in `openclaw-instruction.md`: `node <skill_dir>/scripts/sync-openclaw-pm-section.mjs --check` (drift table), `--apply` (with per-workspace confirmation; `--force` skips the prompt), or `--bootstrap <path>` (first-time insert). Discovery defaults to `~/.openclaw/workspace-*/AGENTS.md` and follows the `~/.openclaw/workspace` symlink; pass `--workspace <path>` to limit scope.
- Validate roadmap content conventions (D-007/008/009/012/015/016/018/019/020 plus human-gated planning mirrors): `node <skill_dir>/scripts/check-roadmap-conventions.mjs --project <name> --config <path>`
- Auto-fix roadmap content conventions: `node <skill_dir>/scripts/check-roadmap-conventions.mjs --project <name> --config <path> --fix` (covers D-008 emoji insertion, D-009 empty `## Fixed` removal, D-007 slug-only H2 rename, D-012 done-pending TOC/link repair, deterministic D-016 generic milestone `Related Notes` removal, D-018 plan-side `## Related` mirror/relevant-link repair, D-019 planning-note opening cleanup, D-020 supersede status sync (older plan → `status: superseded` when mirror declares "Superseded by") and D-020 parent-archive cascade (superseded dependents → `archive/` when parent close-out runs), missing human archive-confirmation insertion, missing idea Summary insertion as `TBD`, and completed planning-mirror archive close-out when the linked active plan is deterministic and the confirmation checkbox is checked; D-009 `### <Domain>`, D-015 milestone-section shape, D-016 specific related-note integration, missing mirrors, unsafe archive cases, ambiguous links, non-matching early planning-note H1s, unresolved "Superseded by" targets, archived or terminal-status dependents, ambiguous cascade candidates, and `TBD` summaries surface as `MANUAL REVIEW`)
- Reconcile metadata fixers now repair deterministic frontmatter/date/history/known-bugs section drift. They may insert `TBD`; those fields remain manual-review items, not invented prose.
- Validate live routing hygiene (D-013): `node <skill_dir>/scripts/check-live-routing.mjs --project <name> --config <path>`; add `--fix` to repair deterministic retired lane paths and unique decision links.
- Validate Obsidian links (D-014): `node <skill_dir>/scripts/check-obsidian-links.mjs --project <name> --config <path>`; add `--fix` to repair deterministic malformed links, marked TOCs, and PM-root-relative slash links.
- Detect backticked wikilinks (wikilinks wrapped in single-backtick inline code, which Obsidian does not render as clickable links): `node <skill_dir>/scripts/check-backticked-wikilinks.mjs --check` (report) or `--fix` (strip the wrapping backticks when the span is just the wikilink; documented-syntax examples with extra text are flagged but not auto-fixed).
- Validate inbox raw-intake notes: `node <skill_dir>/scripts/check-inbox-conventions.mjs --project <name> --config <path>`; add `--fix` to fill deterministic missing metadata without inventing destinations.
- Run migrations: `node <skill_dir>/scripts/migrate.mjs --project <name> --config ~/.config/project-management/projects.json`
- Check the skill repo itself: `node <skill_dir>/scripts/check-skill.mjs`

## Final Response

After logging, bootstrapping, repairing, migrating, or closing out code work, state exactly which project/vault files changed. If no PM files changed, state the `check-pm-closeout.mjs` no-impact reason or resolved access mode.
