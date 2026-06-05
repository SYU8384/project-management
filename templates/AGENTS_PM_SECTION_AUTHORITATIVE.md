## PM folder

This project has a PM folder at `<pm_folder>` (replace with the actual path; see `projects.json` at the root of the project-management skill for the canonical mapping).

Before coding:
- Read the project's PM folder `README.md` to know the routing map.
- Read the relevant `system/<topic>.md` doc to understand current behavior.
- If a planning note (`planning/<date>_slug.md`) is in progress, read it for design rationale.
- If your change affects a coherent feature, read `features/<feature>.md`.

After coding:
- Did current behavior, architecture, data flow, runtime, auth, database, integration, connector, deployment, or operational behavior change? If yes, update the relevant `system/<topic>.md`.
- Did user-facing behavior or UX change? If yes, update `docs/User Guide/` and the relevant `features/<feature>.md` when feature scope, behavior, known issues, or roadmap changed.
- Did admin/operator workflow change? If yes, update `docs/Admin Guide/` and add or update `docs/Quick Commands/` for useful commands.
- Did developer workflow, API behavior, schema/prompt reference, testing, build, or local setup change? If yes, update `docs/Developer Guide/` and add or update `docs/Quick Commands/` for useful commands.
- Did the change resolve or partially implement a `planning/<date>_slug.md` plan? If yes, mark the relevant PENDING as DONE in `roadmap/done-pending.md`. If the plan is fully shipped, distill durable behavior into `system/`, `docs/`, or `PRODUCT.md`, then archive the plan to `archive/<slug>-archived.md`.
- Did a bug, risk, or blocker appear or change status? If yes, update `roadmap/known-issues.md`.
- Did a new idea, declined proposal, or backlog candidate appear? If yes, update `roadmap/ideas.md`.
- Did the change introduce a new pattern, a non-obvious decision, or an architecture shift? If yes, write a new `planning/decisions/ADR-NNN_slug.md`.
- Did any note get added, moved, renamed, archived, or deleted? If yes, update the affected folder indexes in the same session.
- Always add a `history/YYYY-MM/history-YYYY-MM-DD.md` bullet for what changed and why (use Conventional Commits prefixes: `feat:`, `fix:`, etc.).

The full convention is documented in the project-management skill at `<skill_dir>/SKILL.md` (specifically the "Coding Agent Integration" subsection).

If the PM folder path is unknown, check the project-management skill's `projects.json` for the project's `pm_folder` field, or ask the maintainer.
