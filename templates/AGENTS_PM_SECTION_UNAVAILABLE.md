## PM folder

> **Deprecated since v1.4.1.** The `access: "unavailable"` mode is no longer registered in `projects.json`. Contributors with no PM folder access are not users of the skill on their side — they submit PRs with PM folder impact notes, and the maintainer's PM agent applies PM updates on merge. The modern equivalent for the rare case where a code repo is checked out before PM access is granted: register the project on the maintainer's side as `read-only` (or `authoritative` once PM access is set up) and use the corresponding `AGENTS_PM_SECTION_READONLY.md` / `AGENTS_PM_SECTION_AUTHORITATIVE.md` template. This file is kept in the repo for historical reference only.

This project uses the project-management skill, but the PM folder is **not available locally** for this checkout yet. You have code repo access only.

Before coding:
- Use the code repo's `README.md`, `AGENTS.md`, local docs, tests, and source files for context.
- If the task requires product history, roadmap state, architecture rationale, or prior bug knowledge that is not in the code repo, ask the maintainer for the PM folder path or a read-only PM mirror.
- Do not invent a private canonical PM folder unless the user explicitly asks for a local scratch copy. A scratch copy is not authoritative.

When opening a PR:
- Use the PR body template (`.github/PULL_REQUEST_TEMPLATE.md`, copied from the project-management skill's `templates/PR_BODY_TEMPLATE.md`) if available.
- Fill in the "PM folder impact" section with best-effort suggestions for affected PM lanes: `system/`, `docs/User Guide/`, `docs/Admin Guide/`, `docs/Developer Guide/`, `docs/Developer Guide/known-bugs.md`, `docs/Quick Commands/`, `features/`, `roadmap/known-issues.md`, `roadmap/ideas.md`, `roadmap/done-pending.md`, `roadmap/plans/`, `decisions/`, folder indexes, and `history/`.
- Add a note that the PM folder was unavailable locally, so the maintainer must verify and apply the PM updates.
- Do NOT make PM folder edits from this checkout.

After PM access is granted:
- Update `~/.config/project-management/projects.json` (user-specific, from v1.3.0+) entry from `access: "unavailable"` to `access: "read-only"` or `access: "authoritative"`.
- Add the real `pm_folder` path.
- Replace this section with the matching read-only or authoritative PM folder section.

The full convention is documented in the project-management skill at `<skill_dir>/SKILL.md` (specifically "Setup Intake", "Coding Agent Integration", and "Contributor Workflow").
