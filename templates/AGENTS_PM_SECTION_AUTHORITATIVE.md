## PM folder

This project has a PM folder at `<pm_folder>` (replace with the actual path; see `projects.json` at the root of the project-logging skill for the canonical mapping).

Before coding:
- Read the relevant `system/<topic>.md` doc to understand current behavior.
- If a planning note (`planning/<date>_slug.md`) is in progress, read it for design rationale.

After coding:
- Did the change alter any `system/<topic>.md` doc's "current behavior" description? If yes, update the system/ doc.
- Did the change resolve or partially implement a `planning/<date>_slug.md` plan? If yes, mark the relevant PENDING as DONE in `roadmap/done-pending.md`. If the plan is fully shipped, distill the durable behavior into `system/`, then archive the plan to `archive/<slug>-archived.md`.
- Did the change introduce a new pattern, a non-obvious decision, or an architecture shift? If yes, write a new `planning/decisions/ADR-NNN_slug.md`.
- Always add a `history/YYYY-MM/HISTORY-YYYY-MM-DD.md` bullet for what changed and why (use Conventional Commits prefixes: `feat:`, `fix:`, etc.).

The full convention is documented in the project-logging skill at `<skill_dir>/SKILL.md` (specifically the "Coding Agent Integration" subsection).

If the PM folder path is unknown, check the project-logging skill's `projects.json` for the project's `pm_folder` field, or ask the maintainer.
