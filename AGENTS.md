## PM folder

This repository may be linked to a project-management PM folder, but PM access is local to each contributor's machine. Do not assume the PM folder exists just because this section is present in `AGENTS.md`.

Before doing PM-related work, resolve local access:
- Check whether the project-management skill is installed and whether `~/.config/project-management/projects.json` exists.
- Match this repository's absolute path to a `projects[*].code_repo` entry in that local config.
- If there is no config, no matching entry, the entry has no accessible `pm_folder`, or the `access` value is not `authoritative` or `read-only`, treat this as **no PM access**.

Behavior by resolved access:
- **`authoritative`**: read the PM folder `README.md` before coding, read relevant `CURRENT_STATUS.md`, the active `roadmap/milestones/<phase>.md`, `system/`, `features/`, and active `roadmap/plans/` notes for context, then update affected PM docs directly after meaningful code changes. Update current-state docs before `history/YYYY/<Month>/history-YYYY-MM-DD.md`, and refresh `CURRENT_STATUS.md` plus the active or explicitly linked milestone whenever priorities, blockers, risks, wins, plans, decisions, features, known issues, or phase/milestone state change. Create the active milestone note if it is missing. Keep active/proposed planning notes linked from `## Related` to their exact `roadmap/done-pending.md#<slug>` mirror when changing plan or done-pending state. Whenever you create, move, rename, archive, or delete a PM note, update the folder index's `## Notes` list (or `## Subfolders` for folders) in the same session — the index lives inside the folder note's `vault-maintain:index` markers, and every folder (e.g. `roadmap/plans/plans.md`) has one. Before creating or materially changing a plan, decision, or feature page, add `## Supersession Review` and record whether it supersedes prior PM state, is merely related, or has no predecessor; update the superseded prior decision/plan/feature lifecycle state when applicable. In milestone notes, put specific plan, decision, feature, known-issue, or docs links inline inside the priority, step, exit criterion, or deferred item they support; do not add a generic `## Related Notes` link dump. Before the final response, run `node path/to/project-management/scripts/check-pm-closeout.mjs --project "Project Name" --config ~/.config/project-management/projects.json` when the project-management skill path is known; otherwise manually verify the same close-out: repo diff inspected, current-state docs updated or explicitly no-impact, history updated last.
- **`read-only`**: read the PM folder for context, but never edit it. When opening a PR, fill in the PR body's `PM folder impact` section with specific suggested PM updates.
- **No PM access**: ignore this PM section during normal coding. Do not ask PM setup questions, do not invent PM paths, and do not edit PM files. If a PR template has a `PM folder impact` section, leave it empty so the maintainer can backfill from the code diff.

Inbox note behavior:
- `inbox/` is raw owner/collaborator intake, not backlog. When the user asks an agent to create an inbox note and no creator name is provided, use `NAME_PLACEHOLDER` in the filename, title/H1, and `author`, then ask the user what name should replace it. The user may provide the replacement or edit it manually.

Repo-canonical docs (this repository is public):
- `docs/adr/` (ADRs), `CONTEXT.md` (domain glossary), and contributor-facing architecture docs under `docs/` are canonical in this repository. Update them in the same change as the code they describe.
- With `authoritative` PM access, also record the change in the PM folder: each repo ADR gets a stub in `decisions/` (`decision_type: ADR`, frontmatter `repo_path:` pointing at the repo file) so the PM folder stays the complete decision registry.
- Never copy PM-private content into this repository: PRD/MKT/VND/POL/NEG/EXP decisions, roadmap plans and priorities, history, TEAM.md, inbox, and known-issues stay in the PM folder.

Only ask the user about PM setup when they explicitly request setup, registration, repair, reconciliation, migration, or logging for the project-management workflow.

Maintainer-side agents with `authoritative` access are responsible for applying PM updates after merge when contributors have `read-only` or no PM access.
