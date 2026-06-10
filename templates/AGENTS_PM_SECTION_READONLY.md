## PM folder

This project's PM folder at `<pm_folder>` is **shared read-only** — the maintainer owns the canonical copy. You have read access for context but cannot edit directly.

Before coding:
- Read the project's `README.md` to know the routing map
- Read the relevant `system/<topic>.md` to understand current behavior
- If a planning note (`roadmap/plans/<date>_slug.md`) is in progress, read it for design rationale
- If your change affects a feature, read `features/<feature>.md`

When opening a PR:
- Use the PR body template (`.github/PULL_REQUEST_TEMPLATE.md`, copied from the project-management skill's `templates/PR_BODY_TEMPLATE.md`)
- Fill in the "PM folder impact" section with every affected PM lane: `system/`, `docs/User Guide/`, `docs/Admin Guide/`, `docs/Developer Guide/`, `docs/Developer Guide/known-bugs.md`, `docs/Quick Commands/`, `features/`, `roadmap/known-issues.md`, `roadmap/ideas.md`, `roadmap/done-pending.md`, `roadmap/plans/`, `decisions/`, folder indexes, and `history/`
- Be specific: "system/connectors-and-sessions.md — add new OAuth provider entry" not "update system docs"
- Do NOT make the PM folder edits in your PR — the maintainer applies them after merge

After PR is merged:
- The maintainer (or a maintainer-side agent) reads the "PM folder impact" section and applies the PM folder updates
- You may want to re-read the relevant system/ docs to confirm the update landed

The full convention is documented in the project-management skill at `<skill_dir>/SKILL.md` (specifically "Contributor Workflow").
