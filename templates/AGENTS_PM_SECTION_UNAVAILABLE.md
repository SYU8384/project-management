## PM folder

This project uses the project-management skill, but the PM folder is **not available locally** for this checkout yet. You have code repo access only.

Before coding:
- Use the code repo's `README.md`, `AGENTS.md`, local docs, tests, and source files for context.
- If the task requires product history, roadmap state, architecture rationale, or prior bug knowledge that is not in the code repo, ask the maintainer for the PM folder path or a read-only PM mirror.
- Do not invent a private canonical PM folder unless the user explicitly asks for a local scratch copy. A scratch copy is not authoritative.

When opening a PR:
- Use the PR body template (`.github/PULL_REQUEST_TEMPLATE.md`, copied from the project-management skill's `templates/PR_BODY_TEMPLATE.md`) if available.
- Fill in the "PM folder impact" section with best-effort suggestions for affected PM lanes: `system/`, `docs/User Guide/`, `docs/Admin Guide/`, `docs/Developer Guide/`, `docs/Developer Guide/known-bugs.md`, `docs/Quick Commands/`, `features/`, `roadmap/known-issues.md`, `roadmap/ideas.md`, `planning/`, ADRs, folder indexes, and `history/`.
- Add a note that the PM folder was unavailable locally, so the maintainer must verify and apply the PM updates.
- Do NOT make PM folder edits from this checkout.

After PM access is granted:
- Update the project-management skill's `projects.json` entry from `access: "unavailable"` to `access: "read-only"` or `access: "authoritative"`.
- Add the real `pm_folder` path.
- Replace this section with the matching read-only or authoritative PM folder section.

The full convention is documented in the project-management skill at `<skill_dir>/SKILL.md` (specifically "Setup Intake", "Coding Agent Integration", and "Contributor Workflow").
