## PM folder

This project has a PM folder at `<pm_folder>` (replace with the actual path; see `~/.config/project-management/projects.json` for the canonical mapping — `projects.json` lives at the user-specific XDG location from v1.3.0+, not at the skill root).

Before coding:
- Read the project's PM folder `README.md` to know the routing map.
- Read the relevant `system/<topic>.md` doc to understand current behavior.
- If a planning note (`roadmap/plans/<date>_slug.md`) is in progress, read it for design rationale.
- If your change affects a coherent feature, read `features/<feature>.md`.

After coding:
- Did current behavior, architecture, data flow, runtime, auth, database, integration, connector, deployment, or operational behavior change? If yes, update the relevant `system/<topic>.md`.
- Did user-facing behavior or UX change? If yes, update `docs/User Guide/` and the relevant `features/<feature>.md` when feature scope, behavior, known issues, or roadmap changed.
- Did live product operation change for admins/operators (support, feedback, admin panel workflow, monitoring, statistics, background job run, access, incident response, production verification, or data repair)? If yes, update `docs/Admin Guide/` and add or update `docs/Quick Commands/` for useful commands.
- Did a coding-engineer workflow change (local setup, codebase structure, API behavior, schema/prompt reference, testing, migration, build, release mechanics, or adding/changing job code)? If yes, update `docs/Developer Guide/` and add or update `docs/Quick Commands/` for useful commands.
- Did the change resolve or partially implement a `roadmap/plans/<date>_slug.md` plan? If yes, mark the relevant PENDING as DONE in `roadmap/done-pending.md`. If the plan is fully shipped, distill durable behavior into `system/`, `docs/`, or `PRODUCT.md`, then archive the plan to `archive/<slug>-archived.md`.
- Did a bug, risk, or blocker appear or change status? If yes, update `roadmap/known-issues.md`; if it has engineering symptoms, root cause, solution, verification, or recurrence value, also update `docs/Developer Guide/known-bugs.md`.
- Did a new idea, declined proposal, or backlog candidate appear? If yes, update `roadmap/ideas.md`.
- Did the change introduce a new pattern, a non-obvious decision, or an architecture shift? If yes, write a new `decisions/D-NNN_<type>_<slug>.md`. Type codes: `ADR` (architecture), `PRD` (product), `MKT` (market/positioning), `VND` (vendor pick), `POL` (policy/operating rule), `NEG` (explicit rejection), `EXP` (time-boxed experiment).
- Did any note get added, moved, renamed, archived, or deleted? If yes, update the affected folder indexes in the same session.
- Always add a `history/YYYY-MM/history-YYYY-MM-DD.md` bullet for what changed and why (use Conventional Commits prefixes: `feat:`, `fix:`, etc.).

The full convention is documented in the project-management skill at `<skill_dir>/SKILL.md` (specifically the "Coding Agent Integration" subsection).

If the PM folder path is unknown, check `~/.config/project-management/projects.json` (user-specific, from v1.3.0+) for the project's `pm_folder` field, or ask the maintainer.

### Maintainer PR review

When reviewing or merging a PR, check whether the PR body has a useful `PM folder impact` section.

If the section is missing, empty, or vague:
- Inspect the PR diff, commits, changed files, tests, migrations, and release notes.
- Infer the PM updates needed across `system/`, `docs/User Guide/`, `docs/Admin Guide/`, `docs/Developer Guide/`, `docs/Developer Guide/known-bugs.md`, `docs/Quick Commands/`, `features/`, `roadmap/known-issues.md`, `roadmap/ideas.md`, `roadmap/done-pending.md`, `roadmap/plans/`, `decisions/`, folder indexes, and `history/`.
- Write a concrete PM update plan before merge, or immediately after merge if the PR must land first.
- Apply the PM folder updates directly for this authoritative project, then add the normal history entry.

Do not block a contributor solely because they lacked PM folder access. Maintainer-side agents are responsible for backfilling PM updates when contributor PRs cannot provide them.
