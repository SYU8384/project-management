# Project Management Skill

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Install with bash or PowerShell](https://img.shields.io/badge/install-bash%20%2F%20PowerShell-0f766e.svg)](#quick-start)
[![Markdown PM folders](https://img.shields.io/badge/docs-Markdown%20%2B%20Obsidian-2563eb.svg)](#pm-folder-model)

**A fluid brain for your project.** Your agent remembers the big plans, maps them to pending to-dos, records every decision, keeps manuals and feature specs current, and writes the history as work ships — all in plain Markdown, in a folder you own.

The important part is behavioral: when meaningful work happens, the agent updates the right current-state docs, roadmap notes, and history logs *in the same session*. Six months later, a new session — or a new teammate, or a new agent — reads the folder and knows exactly where things stand. No archaeology through chat logs and PR threads.

## 🧠 Why This Exists

Coding agents have no memory beyond the session. As a project grows, decisions scatter across chat logs and PR threads, docs lag behind the code, and every new session starts from zero. This skill gives your project a memory that doesn't decay — one strict, repeatable operating model, so any agent, on any machine, picks up exactly where the last session left off.

## ✨ Highlights

- 🧭 **Productive in minutes** — say `setup this repo`; the agent bootstraps the folder, registers the project, and wires up `AGENTS.md`. No workflow to learn.
- 📝 **The memory loop** — when work ships, the agent updates current-state docs, roadmap, and an outcome-first history entry in the same session. "Where are we?" is always answered.
- 🧩 **Decisions stay typed and linked** — architecture, product, market, vendor, policy, rejection, experiment. "Why we chose this" is never lost, and superseded plans cascade to archive.
- 📚 **Manuals stay honest** — changes route into the right user/admin/developer guide instead of decaying into traps for the next reader.
- 🐞 **Recurring bugs solved in minutes** — active issues in the roadmap; root causes and fixes in `known-bugs.md`. Known issues, bugs, risks, blockers, limitations, and current gaps are always logged to `roadmap/known-issues.md` first, so nothing falls through.
- 🧹 **Self-cleaning** — validators repair drift, broken links, and stale schemas; lane-aware stale review ignores historical/evidence records, existing JSON/PNG evidence resolves, and human-approved reorganization keeps growth navigable.
- 🧪 **Live-state and evidence validation** — D-028 checks reject implementation journals, duplicated live sections, and commit ledgers; oversized notes become review warnings, not auto-rewrites. Planning states include `verifying`, `blocked`, and `deferred`; terminal plans and evidence do not create mirror debt. Existing attachments resolve, and required index links do not count as narrative bloat.
- ✅ **Traceable close-out guard** — before an agent signs off, it verifies affected current-state docs, history, and scoped implementation-commit references. Explicit priority/milestone event flags prevent timestamp-only updates, while live-state checks reject duplicated journals and ledgers.
- 🔗 **Obsidian-optional** — as an Obsidian vault, every note is structured and interlinked so agents retrieve exactly the relevant context. But the convention is just Markdown plus a small local `projects.json` registry; it works anywhere.

## 🔓 Open-source aware & plays well with others

- **Public vs private repos.** Every project registers `visibility: public | private`. On open-source repos, contributor-facing knowledge is canonical *in the repo* — ADRs at `docs/adr/D-NNN-slug.md`, glossary at `CONTEXT.md` — while the PM folder keeps registry stubs with `repo_path:` links, staying the complete decision registry. Strategy, roadmap priorities, vendor calls, and history never leave the PM folder. Going public later? Say "make this project open source" — the agent runs a scrub review and bootstraps the repo docs before flipping. Details: `REFERENCE.md` → "Repository Visibility."
- **Integrates with the [matt-pocock engineering skills](https://github.com/mattpocock/skills).** `to-spec` → a PM plan linked to the GitHub issue; `to-tickets` → plan steps; `wayfinder` → a multi-session plan; `triage` rejections → rejection decisions and verified bugs → known issues; new ADRs → decision stubs. Their artifacts stay in the repo/tracker; the PM folder registers and links them. Details: `REFERENCE.md` → "Matt-Pocock Engineering Skills Integration."

<a id="quick-start"></a>

## 🚀 Quick Start

Pick the path that matches how you use the skill and which shell you can run.

### Path A — OpenClaw PM agent (any OS; recommended for PM-domain work)

OpenClaw PM agents live in your chat, not in your repo — brainstorming, capturing decisions and meetings, tracking progress across projects. Use this path on any OS where OpenClaw can run the matching installer. Paste this to your OpenClaw agent:

```text
Read https://raw.githubusercontent.com/SYU8384/project-management/main/openclaw-instruction.md and follow its instructions.
```

The OpenClaw instruction is OS-aware: it uses the bash installer on macOS, Linux, WSL, or Git Bash, and the PowerShell installer on native Windows. The agent handles the rest — installing the skill, creating `~/.config/project-management/projects.json`, and running guided setup for each project.

### Path B — Coding agent on macOS / Linux / WSL / Git Bash

Use this path for Codex, Claude, or another coding agent when your shell can run POSIX `bash`. These `curl | bash` commands do **not** run in native Windows PowerShell or `cmd.exe`; use [Path C](#path-c--coding-agent-on-native-windows-powershell) there.

```bash
curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh | bash
```

With a TTY, the installer shows an interactive menu; without one (CI, scripts, `ssh -T`), it defaults to `--target agents`. Non-interactive: `bash -s -- --target agents --yes`. Targets: `agents`, `codex`, `claude`, `openclaw`, or `--dest <path>`.

### Path C — Coding agent on native Windows PowerShell

Use this path from PowerShell 5.1 (Windows 10 default) or PowerShell 7+:

```powershell
$installer = Join-Path $env:TEMP "project-management-install.ps1"
Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/SYU8384/project-management/main/install.ps1" -OutFile $installer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer -Target agents -Yes
```

The installer needs `git` on PATH (ships with Git for Windows). The temp-file path keeps the command working even if PowerShell opens in `C:\WINDOWS\system32`; the process-scoped execution-policy bypass is only for this run. Targets are `agents` (`%USERPROFILE%\.agents\skills\project-management`), `codex`, `claude`, `openclaw`, or `-Dest <skills-dir>` for a custom parent skills directory.

## 🎯 Triggers

If you went through Path A (OpenClaw), the agent handles setup, repair, and migration autonomously — you don't need any of these. If you went through Path B or Path C, after install + first setup the project lives at `<pm_folder>` and `projects.json` lives at `~/.config/project-management/projects.json`. Restart your coding agent and say:

| Say | What happens |
|---|---|
| `setup this repo` | Bootstraps the PM folder and registers the project. |
| `log this` | Updates current-state docs and history after a code change. If the logged item is a known issue, bug, risk, blocker, limitation, or current gap, records it in `roadmap/known-issues.md` first. |
| `verify setup` | Reports problems without changing anything. |
| `reconcile this project` | Repairs drift, applies pending migrations, re-validates. Idempotent. |
| `organize PM folder` | Detects tiny/stale/overlapping pages and proposes an approval-gated merge/retire plan. |
| `summarize this project` | One-paragraph overview pointing at the right files. |

The full table — including collaborator setup, visibility switching, and all aliases — is in `REFERENCE.md` → "Trigger Phrases."

## 🛡️ Access & visibility at a glance

- **Owner** (`access: authoritative`): the agent edits your PM folder directly.
- **Collaborator** (`access: read-only`): the agent reads the PM folder but suggests PM updates in the PR body instead of editing it.
- **Contributor (no PM access)**: nothing to register; the maintainer's agent backfills PM updates from the code diff.

Independently, `visibility: public | private` controls whether contributor-facing docs (ADRs, glossary) are canonical in the repo — see "Open-source aware" above. The `AGENTS.md` PM section is portable and committed; each machine resolves what it may do from its local `projects.json`.

Commit policy is local: requires-explicit waits for a request; auto-scoped automatically commits verified, narrow task-owned implementation work without another request. Legacy scoped-by-default is treated as auto-scoped during migration. It never authorizes push, merge, deployment, broad staging, or unrelated files.

<a id="pm-folder-model"></a>

## 🗂️ The PM Folder at a Glance

`PRODUCT.md` vision · `TEAM.md` roster (optional) · `CURRENT_STATUS.md` live snapshot · `system/` architecture · `docs/User Guide/` · `docs/Admin Guide/` · `docs/Developer Guide/` · `docs/Quick Commands/` manuals · `features/` per-feature context · `inbox/` raw intake · `roadmap/` + `roadmap/milestones/` + `roadmap/plans/` plans, known issues, ideas · `decisions/` typed decision log · `history/` chronological work logs · `archive/` superseded material.

Every folder has an index note; every note links to its neighbors. Full lane descriptions: `REFERENCE.md` and the generated project README.

## 🧰 Maintainer Corner

| Path | Purpose |
|---|---|
| [`SKILL.md`](./SKILL.md) | Agent entry point: trigger router and highest-risk PM rules. |
| [`scripts/check-live-state-shape.mjs`](./scripts/check-live-state-shape.mjs) | D-028 live-state shape and duplication checks. |
| [`REFERENCE.md`](./REFERENCE.md) | Deep reference: schemas, workflows, repair rules, pitfalls. |
| [`install.sh`](./install.sh) / [`install.ps1`](./install.ps1) | Bash and native PowerShell installers; rerun to update. |
| [`openclaw-instruction.md`](./openclaw-instruction.md) | Copy-paste instruction for bootstrapping an OpenClaw PM agent. |
| [`scripts/`](./scripts/) | Dependency-free Node validators, fixers, and migrations; entry point is `check-pm.mjs`. |
| [`templates/`](./templates/) | Templates for project READMEs, roadmap notes, decisions, features, PR bodies, and AGENTS.md sections. |
| [`test/`](./test/) | Node built-in test suite. |

<details>
<summary>Versioning & releasing (maintainers)</summary>

Versioned with `VERSION` + `CHANGELOG.md`; tags follow `vMAJOR.MINOR.PATCH`.

- **Default install** pulls the moving `v1` branch (latest stable). `--channel main` follows bleeding edge; `--ref vX.Y.Z` pins an exact release.
- **Update an install:** re-run the same install command (add `--force` to discard local changes).
- **Check installed version:** `cat <skill_dir>/VERSION`.

To release: bump `VERSION`, move `## [Unreleased]` in `CHANGELOG.md` to the versioned heading, commit `release: vX.Y.Z`, push, tag `vX.Y.Z`, push the tag. Before tagging: `bash -n install.sh`, `node --check scripts/**/*.mjs`, `node --test`, `node scripts/check-skill.mjs`, and `node scripts/check-pm.mjs` against a fresh scaffold or the self-hosted PM folder.

</details>

## 📄 License

MIT. See [LICENSE](./LICENSE).
