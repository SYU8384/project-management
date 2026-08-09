# D-011 — Use one portable committed `AGENTS.md` PM section

**Status:** accepted (effective 2026-06-14)

## Context

The previous code-repo integration wrote one of two `AGENTS.md` PM sections into a repo: authoritative or read-only. That worked for the maintainer's local machine, but `AGENTS.md` is normally committed with the code repo. When someone clones the repo without the maintainer's PM folder, an access-specific committed section can leak local paths, create noisy instructions, or tell the contributor to do impossible PM work.

The registry design (D-001) already keeps PM identity local in `~/.config/project-management/projects.json`. The committed `AGENTS.md` section follows the same privacy boundary.

## Options Considered

- **A. Keep separate committed templates.** Simple for maintainers, but unsafe/noisy for public clones. Rejected.
- **B. Add a third `access: none` value.** Makes no-PM-access explicit, but puts non-access into the registered access model and reopens enum complexity that was deliberately removed (D-004). Rejected.
- **C. Use one portable template and resolve access locally (chosen).** Keeps committed guidance safe and lets each machine decide behavior from local `projects.json`.

## Decision

Use one committed `templates/AGENTS_PM_SECTION.md`. The section tells agents to resolve local PM access by matching the current repository path against `projects[*].code_repo` in `~/.config/project-management/projects.json`.

No PM access is represented by absence from local `projects.json`, not by a third enum value. If config is missing, no matching entry exists, the PM folder is inaccessible, or `access` is not `authoritative` or `read-only`, the agent treats the repo as no PM access and silently ignores PM instructions during normal coding.

## Consequences

- **Positive:** committed `AGENTS.md` files no longer contain maintainer-local PM folder paths.
- **Positive:** public clones get safe default behavior: no config means no PM work and no setup questions unless the user explicitly asks.
- **Positive:** the two-value registered access model remains intact.
- **Negative:** existing repos with old access-specific PM sections must be synced once to the portable section (`sync-agents-section.mjs`).
- **Negative:** path matching depends on contributors having their local `code_repo` entry correct when they do have PM access.

## Realization Notes

- `bootstrap-pm.mjs`, `check-agents.mjs`, and `sync-agents-section.mjs` render `templates/AGENTS_PM_SECTION.md`; `scripts/lib/agents-section.mjs` supplies the visibility-aware replacements (see D-025).
- `check-skill.mjs` rejects retired access-specific template files and checks the portable template for local path placeholders.
