# OpenClaw Project Management Skill Instruction

Use this instruction to install the project-management skill, set up its local project registry, configure your OpenClaw PM role, and audit project code-repo `AGENTS.md` files.

## 1. Install Or Update The Skill

Install or update the project-management skill. For existing installs, prefer the explicit update command:

```bash
curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/update.sh \
  | bash -s -- --target openclaw --yes
```

For first-time setup, this install command is equivalent and also updates an existing install:

```bash
curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh \
  | bash -s -- --target openclaw --yes
```

Default OpenClaw skill path:

```text
~/.openclaw/skills/project-management
```

Default project registry:

```text
~/.openclaw/skills/project-management/projects.json
```

If the user uses a custom OpenClaw skill root, ask for the exact path. OpenClaw can load skills from workspace skills, project `.agents/skills`, personal `~/.agents/skills`, managed/local `~/.openclaw/skills`, bundled skills, and configured extra directories. Do not use `~/.openclaw/shared-skills` as a public default.

## 2. Check Whether The Skill Is Set Up

Inspect `~/.openclaw/skills/project-management/projects.json`.

Treat the skill as **not set up yet** if any of these are true:

- `projects.json` is missing.
- `projects` is empty.
- The only project key is `<ProjectName>`.
- Required values are blank placeholders, such as empty `vault_root`, empty `skill_dir`, empty `code_repo`, empty `pm_folder` for an available project, empty `phase`, or `access: "authoritative | read-only | unavailable"`.

If `projects.json` is missing, copy:

```text
~/.openclaw/skills/project-management/templates/projects.template.json
```

to:

```text
~/.openclaw/skills/project-management/projects.json
```

Set `skill_dir` to `~/.openclaw/skills/project-management` when writing the registry. Ask the user for real project paths. Do not invent paths.

## 3. If projects.json Is Empty Or Template-Only

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

## 4. If projects.json Already Has Projects

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

## 5. Set Up Your OpenClaw PM Role

Add or update this section in your workspace `AGENTS.md`:

```markdown
## Project Management Skill

Use the project-management skill for project memory, planning, prioritization, triage, and PM-folder upkeep.

- Skill path: `~/.openclaw/skills/project-management`
- Project registry: `~/.openclaw/skills/project-management/projects.json`

Read `~/.openclaw/skills/project-management/SKILL.md` first for routing rules. Read `~/.openclaw/skills/project-management/REFERENCE.md` when setup, validation, repair, schema, or bootstrap details are needed. Use `projects.json` to find registered projects, PM folders, code repos, phases, and access levels.

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

## 6. Audit Project Code Repo AGENTS.md Files

For each registered project with a real `code_repo` path:

1. Check whether `<code_repo>/AGENTS.md` exists.
2. Check whether it has a `## PM folder` section.
3. Compare the needed section with the templates in `~/.openclaw/skills/project-management/templates/`:
   - `AGENTS_PM_SECTION_AUTHORITATIVE.md` for `access: authoritative`
   - `AGENTS_PM_SECTION_READONLY.md` for `access: read-only`
   - `AGENTS_PM_SECTION_UNAVAILABLE.md` for `access: unavailable`
4. Replace placeholders with the actual project `pm_folder` and skill path where applicable.
5. Ask the user for explicit permission before editing any code repo `AGENTS.md`. Include the exact repo path and whether you will add or update the PM section.
6. If permission is denied, show the recommended change instead of editing.

Never edit source code as part of this setup unless the user separately asks for coding work.

## 7. Validate And Report

For each available registered project, run:

```bash
node ~/.openclaw/skills/project-management/scripts/check-pm.mjs \
  --project <ProjectName> \
  --config ~/.openclaw/skills/project-management/projects.json
```

If validation fails and the project has `access: authoritative`, ask whether to repair the PM folder. If access is `read-only` or `unavailable`, report suggested fixes without editing.

Finish by reporting:

- Whether the skill was installed or updated
- Whether `projects.json` was created, confirmed, or changed
- Which projects were registered or updated
- Whether your workspace `AGENTS.md` was updated
- Which project code repo `AGENTS.md` files were checked or changed
- Which PM validation checks passed or failed
