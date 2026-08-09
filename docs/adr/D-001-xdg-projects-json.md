# D-001 — Store `projects.json` at the XDG user-specific location

**Status:** accepted (since v1.3.0, 2026-05)

## Context

The original v1.0.0 / v1.1.0 / v1.2.0 design stored `projects.json` at the skill root. The skill root is `git`-tracked; `projects.json` is user-specific (paths to local PM folders, paths to local code repos, machine-specific phase notes). Committing `projects.json` to the skill repo would leak local filesystem paths into the public repo, which is a privacy and security concern.

## Options Considered

- **A. Skill root, gitignored.** Keeps the file discoverable next to the skill scripts; trades off the discoverability of the public repo's `projects.json` reference in documentation.
- **B. Skill root, in-repo (committed).** Every user commits their local paths. Rejected for the privacy and security reasons above.
- **C. User-specific XDG location (chosen).** Standard, no privacy concern, multi-machine friendly. The cost is "you have to know where it is", addressed by the `scripts/lib/paths.mjs::resolveProjectsConfigPath()` helper and the README's mention of `~/.config/project-management/projects.json`.
- **D. Per-project, alongside the PM folder.** Each PM folder has its own `.pm/projects.json`. The cost is that the skill's setup intake needs to walk all PM folders to find projects, and bootstrap would have to write to a path the user just chose — chicken-and-egg. Rejected.

## Decision

Option C. `projects.json` lives at `~/.config/project-management/projects.json` from v1.3.0+. The skill-root `projects.json` is no longer read. `scripts/lib/paths.mjs` resolves the path with the precedence `--config <path>` > XDG location. Existing users moving from a pre-v1.3.0 install migrate once with `mv <skill_dir>/projects.json ~/.config/project-management/projects.json` (see CHANGELOG.md [1.3.0]).

## Consequences

- **Positive**: `projects.json` is not in the public repo. Multi-machine users (laptop + desktop) keep their own registry.
- **Positive**: the XDG location is the standard user-specific config dir on Linux; on macOS, it's non-standard (the canonical macOS path is `~/Library/Application Support/project-management/`) but the skill accepts the XDG path everywhere for consistency.
- **Positive**: the resolver helper makes the path discoverable; the docs surface it explicitly.
- **Negative**: pre-v1.3.0 users have to migrate their `projects.json` once. The CHANGELOG entry documents the one-time `mv` command.
- **Negative**: discoverability from the skill repo is lower; a fresh `git clone` of the skill doesn't show the user's registry. The trade-off is intentional.

## Realization Notes

- The `resolveProjectsConfigPath()` helper centralizes path resolution; all scripts that read `projects.json` use it.
- The skill-root `projects.json` is no longer read by any script. `templates/projects.template.json` still ships in the repo as the bootstrap starter, used by `bootstrap-pm.mjs::loadConfig()` only when no `projects.json` is found anywhere.
