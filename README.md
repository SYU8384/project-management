# project-management skill

A portable, host-agnostic skill for managing PM folders (Obsidian vaults) for any project. Log work, initialize new project folders, repair inconsistencies, and keep code repos in sync with their PM folders.

## Where to start

- **[SKILL.md](./SKILL.md)** — the entry point (~76 lines). Read this first. It covers the 3 intents (log, initialize, repair), trigger phrases, the routing map, and the final-response rule.
- **[REFERENCE.md](./REFERENCE.md)** — the deep doc (~573 lines). Read this when you need the details: frontmatter schema, repair workflow, coding agent integration, contributor workflow, bootstrap workflow, permission policy, pitfalls.

## What's in the box

| Path | Purpose |
|---|---|
| `SKILL.md` | Entry point: intents, triggers, quick start, routing map |
| `REFERENCE.md` | Deep doc: schemas, workflows, conventions, pitfalls |
| `templates/` | 10 file templates (README, CURRENT_STATUS, planning, ADR, feature, features, AGENTS_PM_SECTION_*, PR_BODY_TEMPLATE, projects.template.json) |
| `scripts/` | 2 check scripts (stale detection, structure verification) |
| `LICENSE` | MIT |

## Install

The skill is host-agnostic. To use it, point your agent at this folder as a skill installation directory. The agent reads `SKILL.md` and the rest on demand.

A typical flow:

1. **Read `SKILL.md`** to learn the trigger phrases and the 3 intents.
2. **Set up `projects.json`** by copying `templates/projects.template.json` to the skill root and filling in `vault_root`, `skill_dir`, and one entry per project (with `access: "authoritative" | "read-only"`).
3. **Use the natural flow:** say "log this", "initialize the PM folder for <name>", "repair the PM folder", or "add to AGENTS.md" — the agent handles the rest.

The agent will auto-discover `projects.json` by walking up from the script's location to a sibling `SKILL.md`. Explicit `--config <path>` always wins.

## About `projects.json`

Your `projects.json` is the user's actual instance — paths to your vault, your projects, and your `access` settings. **It is not part of this repo** (it's gitignored). When you clone this skill, copy `templates/projects.template.json` to the skill root and fill it in. The skill is portable; `projects.json` is per-user.

## License

MIT — see [LICENSE](./LICENSE).
