# OpenClaw Project Management Skill Instruction

Use this instruction to install or update the project-management skill, set up its local project registry, configure your OpenClaw PM role, and run a full alignment audit across registered PM folders, project code-repo `AGENTS.md` files, and your own OpenClaw workspace `AGENTS.md`.

## 1. Discover Existing Install

Before installing, check whether `project-management` is already installed in an OpenClaw-loaded skill root.

Check these candidate paths in OpenClaw loading precedence order:

```text
<workspace>/skills/project-management
<workspace>/.agents/skills/project-management
~/.agents/skills/project-management
~/.openclaw/skills/project-management
```

For each candidate:

- It is a candidate only if `SKILL.md` exists.
- If it is a git checkout, verify its `origin` points to `https://github.com/SYU8384/project-management.git` or `git@github.com:SYU8384/project-management.git`.
- If it is not a git checkout but has `SKILL.md`, ask the user before treating it as the canonical install.

Choose `skill_dir` this way:

- If exactly one valid install exists, use that path.
- If multiple valid installs exist, explain OpenClaw precedence and ask the user which one should be canonical.
- If no valid install exists, use `~/.openclaw/skills/project-management` as the default install path.

## 2. Install Or Update The Chosen Skill

If `skill_dir` already exists and is a valid git checkout, update it:

```bash
cd <skill_dir>
git pull --ff-only
```

If no valid install exists, install to the default OpenClaw managed/local skill root:

```bash
curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh \
  | bash -s -- --target openclaw --yes
```

If the user chose a custom root, install/update with `--dest <skills-dir>` instead:

```bash
curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/update.sh \
  | bash -s -- --dest <skills-dir> --yes
```

After install/update, set:

```text
skill_dir = <chosen project-management install path>
projects_json = <skill_dir>/projects.json
```

If the user uses a custom OpenClaw skill root, ask for the exact path. OpenClaw can load skills from workspace skills, project `.agents/skills`, personal `~/.agents/skills`, managed/local `~/.openclaw/skills`, bundled skills, and configured extra directories. Do not use `~/.openclaw/shared-skills` as a public default.

## 3. Check Whether The Skill Is Set Up

Inspect `<projects_json>`.

Treat the skill as **not set up yet** if any of these are true:

- `projects.json` is missing.
- `projects` is empty.
- The only project key is `<ProjectName>`.
- Required values are blank placeholders, such as empty `vault_root`, empty `skill_dir`, empty `code_repo`, empty `pm_folder` for an available project, empty `phase`, or `access: "authoritative | read-only | unavailable"`.

If `projects.json` is missing, copy:

```text
<skill_dir>/templates/projects.template.json
```

to:

```text
<projects_json>
```

Set `skill_dir` to `<skill_dir>` when writing the registry. Ask the user for real project paths. Do not invent paths.

## 4. If projects.json Is Empty Or Template-Only

Run a guided setup intake with answer suggestions. Ask in small groups and use selectable choices when the interface supports them.

Ask for:

1. **Role**
   - Owner / maintainer
   - Collaborator with PM access
   - Collaborator without PM access yet

2. **PM folder state**
   - Create new PM folder
   - Use existing PM folder
   - Repair messy PM folder

3. **Project phase**
   - `pre-alpha` — idea, research, prototype, or no users yet
   - `alpha` — usable by owner/testers, breaking changes expected
   - `beta` — real users, rough edges remain
   - `stable` — production-quality and maintained
   - `deprecated` — kept for history, not actively developed

4. **Code repo AGENTS.md setup**
   - Add/update AGENTS.md
   - Skip AGENTS.md for now

Ask free-text follow-ups only for missing facts:

- Project name
- Code repo path, or `null` if the project has no code repo yet
- PM folder path, unless access is unavailable
- Vault root
- One-line project/product description
- Optional notes

Map role to `access`:

- Owner / maintainer -> `authoritative`
- Collaborator with PM access -> `read-only`
- Collaborator without PM access yet -> `unavailable`

Write the collected project entry to `projects.json`. If the user chose owner + create new PM folder, use the skill's bootstrap workflow in `REFERENCE.md` to create the PM folder. If the user chose existing or messy PM folder, register it first, then audit/repair with validation.

## 5. If projects.json Already Has Projects

Summarize the registered projects to the user:

- Project name
- `access`
- `phase`
- `code_repo`
- `pm_folder`
- `notes`

Ask the user whether the current paths are still correct and whether any new projects should be added. If paths need changes or new projects are needed, collect the same fields listed in section 3 and update `projects.json`.

For every registered project:

- Check whether `code_repo` exists locally when it is not `null` or empty.
- Check whether `pm_folder` exists locally when `access` is `authoritative` or `read-only`.
- If `access` is `unavailable`, confirm that `pm_folder` is empty or unavailable and ask whether access has changed.
- Report missing paths clearly and ask the user for replacements.

## 6. Set Up Your OpenClaw PM Role

Find your OpenClaw workspace `AGENTS.md`. If it is missing, ask the user where the OpenClaw agent keeps persistent workspace instructions.

Check whether the workspace `AGENTS.md` already has a `## Project Management Skill` section. If the section is missing, stale, points to a different `skill_dir`, points to a different `projects_json`, or lacks the access/PM workflow rules below, propose the exact replacement section and ask for approval before editing.

Use this section:

```markdown
## Project Management Skill

Use the project-management skill for project memory, planning, prioritization, triage, and PM-folder upkeep.

- Skill path: `<skill_dir>`
- Project registry: `<projects_json>`

Read `<skill_dir>/SKILL.md` first for routing rules. Read `<skill_dir>/REFERENCE.md` when setup, validation, repair, schema, or bootstrap details are needed. Use `<projects_json>` to find registered projects, PM folders, code repos, phases, and access levels.

Use this skill whenever the user asks to brainstorm, log ideas, triage issues, review priorities, audit project memory, update roadmap state, or maintain a project's PM folder.

Respect project access:
- `authoritative`: edit the PM folder directly.
- `read-only`: read the PM folder for context and suggest changes instead of editing.
- `unavailable`: ask for access and do not invent a PM folder.

Coding agents still update PM folders after code changes. The OpenClaw PM role is brainstorming, idea capture, issue triage, priority review, roadmap hygiene, PM audits, and cross-project coordination. Do not make source-code changes unless the user explicitly asks for coding work.

Common routes:
- Ideas go to `roadmap/ideas.md`.
- Active bugs, risks, and blockers go to `roadmap/known-issues.md`.
- Engineering bug knowledge goes to `docs/Developer Guide/known-bugs.md`.
- Priorities go to `roadmap/mvp-priorities.md`, `roadmap/done-pending.md`, and `CURRENT_STATUS.md`.
- Completed meaningful PM work ends with a brief `history/YYYY-MM/history-YYYY-MM-DD.md` entry.

Maintainer PR PM backfill:
- When reviewing or merging a PR, check whether the PR body has a useful `PM folder impact` section.
- If the section is missing, empty, vague, or says the PM folder was unavailable locally, inspect the PR diff, commits, changed files, tests, migrations, and release notes.
- Infer the PM updates needed across `system/`, `docs/`, `features/`, `roadmap/`, `planning/`, ADRs, folder indexes, and `history/`.
- For `access: authoritative`, apply the PM updates directly before merge or immediately after merge.
- For `access: read-only`, write a maintainer-facing PM update plan instead of editing.
- For `access: unavailable`, ask for PM access or identify the maintainer-side agent who can apply the updates.
- Do not block a contributor solely because they lacked PM folder access.

After PM-folder work, state exactly which project files were updated. If no files were updated, say that explicitly and why.
```

If approval is denied, leave the file unchanged and show the recommended section.

## 7. Run A Full Alignment Audit

Before changing registered project files, produce an alignment audit. Read-only checks do not need approval. File edits always need approval.

Check these areas:

1. **Skill install**
   - Confirm `skill_dir` exists and has `SKILL.md`.
   - Confirm `projects_json` points to the selected skill install.
   - If multiple valid installs exist, confirm which install is canonical.

2. **Project registry**
   - Confirm `projects.json` exists, is not template-only, and has real project entries.
   - Confirm each project has a valid `phase`, `access`, `code_repo`, and `pm_folder` where required.
   - Ask approval before writing `projects.json`.

3. **OpenClaw workspace AGENTS.md**
   - Confirm the `## Project Management Skill` section exists and points to the selected `skill_dir` and `projects_json`.
   - If missing or stale, propose the exact update and ask approval before editing.

4. **Project code repo AGENTS.md**
   - For each registered project with a real `code_repo`, check the repo `AGENTS.md` against the expected PM section template for its `access` value.
   - If missing or stale, propose the exact add/update and ask approval before editing.

5. **PM folder validation**
   - For each registered project with `access: authoritative` or `access: read-only`, run the validation command in section 9.
   - For `authoritative` projects, ask approval before repairing PM folder files.
   - For `read-only` projects, report suggested fixes instead of editing.
   - For `unavailable` projects, confirm the PM folder is unavailable and suggest asking the maintainer for access.

Report audit results in three groups:

- `OK` — already aligned.
- `Needs approval` — exact changes you recommend and the file paths affected.
- `Blocked / missing access` — missing paths, unavailable PM folders, or choices the user must answer.

## 8. Audit Project Code Repo AGENTS.md Files

For each registered project with a real `code_repo` path:

1. Check whether `<code_repo>/AGENTS.md` exists.
2. Check whether it has a `## PM folder` section.
3. Compare the needed section with the templates in `<skill_dir>/templates/`:
   - `AGENTS_PM_SECTION_AUTHORITATIVE.md` for `access: authoritative`
   - `AGENTS_PM_SECTION_READONLY.md` for `access: read-only`
   - `AGENTS_PM_SECTION_UNAVAILABLE.md` for `access: unavailable`
4. Replace placeholders with the actual project `pm_folder` and skill path where applicable.
5. Ask the user for explicit permission before editing any code repo `AGENTS.md`. Include the exact repo path and whether you will add or update the PM section.
6. If permission is denied, show the recommended change instead of editing.

Never edit source code as part of this setup unless the user separately asks for coding work.

## 9. Validate And Report

For each available registered project, run:

```bash
node <skill_dir>/scripts/check-pm.mjs \
  --project <ProjectName> \
  --config <projects_json>
```

If validation fails and the project has `access: authoritative`, ask whether to repair the PM folder. If access is `read-only` or `unavailable`, report suggested fixes without editing.

Finish by reporting:

- Whether the skill was installed or updated
- Whether `projects.json` was created, confirmed, or changed
- Which projects were registered or updated
- Whether your workspace `AGENTS.md` was checked, changed, or left with a suggested change
- Which project code repo `AGENTS.md` files were checked or changed
- Which PM validation checks passed or failed
- Which recommended changes still need approval or access
