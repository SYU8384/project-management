## PM folder

This repository may be linked to a project-management PM folder, but PM access is local to each contributor's machine. Do not assume the PM folder exists just because this section is present in `AGENTS.md`.

Before doing PM-related work, resolve local access:
- Check whether the project-management skill is installed and whether `~/.config/project-management/projects.json` exists.
- Match this repository's absolute path to a `projects[*].code_repo` entry in that local config.
- If there is no config, no matching entry, the entry has no accessible `pm_folder`, or the `access` value is not `authoritative` or `read-only`, treat this as **no PM access**.

Behavior by resolved access:
- **`authoritative`**: read the PM folder `README.md` before coding, read relevant `CURRENT_STATUS.md`, the active `roadmap/milestones/<phase>.md`, `system/`, `features/`, and active `roadmap/plans/` notes for context, then update affected PM docs directly after meaningful code changes. Resolve commit_policy from the matching local projects.json entry: an explicit task restriction such as do not commit or code only wins; auto-scoped (legacy scoped-by-default) is standing authorization: after verifying meaningful task-owned implementation work, inspect status, stage only named task-owned files, review the staged diff, and commit without asking again; no commit was requested is never valid. Commit authoritative PM documentation separately after it contains the implementation reference. Missing or requires-explicit policy requires an explicit commit request. Never push, merge, deploy, use broad staging, or include unrelated files. After each implementation commit exists, add Implementation commits to every affected PM record using a verified GitHub/GitLab Markdown URL when recognized, otherwise full SHA and subject. Without an implementation commit, record Implementation commits: uncommitted / commit pending — explain why. If authority arrives later, commit the verified implementation first and replace every matching pending marker; if the user says it was already committed, verify that commit is task-relevant before replacing markers and do not create another implementation commit. Update current-state docs before history; refresh CURRENT_STATUS.md and the active or explicitly linked milestone whenever priorities, blockers, risks, wins, plans, decisions, features, known issues, or phase state change. Create the active milestone if missing. Keep active or proposed planning notes linked from Related to their done-pending mirror. Update the folder index whenever a PM note is created, moved, renamed, archived, or deleted. Before creating or materially changing a plan, decision, or feature page, perform and record a supersession review. Put milestone evidence links inline, not in a generic Related Notes dump. Before the final response, run check-pm-closeout.mjs when the skill path is known; otherwise inspect the diff and confirm current-state documentation and history were updated or have no impact.
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
