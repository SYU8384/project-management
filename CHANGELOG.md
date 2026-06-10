# Changelog

All notable changes to this skill are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Declarative migration runner at `scripts/migrate.mjs` and registry at
  `scripts/migrations/_index.mjs`. Adding a new migration is one new file
  in `scripts/migrations/` plus one line in `_index.mjs` — the runner,
  validator, and CLI stay the same.
- First registered migration: `1.0.0-lane-restructure` (restructures
  `planning/` → `roadmap/plans/`, promotes `planning/decisions/` to
  top-level `decisions/`, renames `ADR-NNN_` to `D-NNN_ADR_`, rewrites
  frontmatter and wikilinks; preserves `archive/` and `history/`).
- Per-project applied-migrations ledger at `<pm_folder>/.pm/migrations.json`,
  with `.pm/.gitignore` auto-written on first apply. The runner is
  idempotent and safe to re-run.
- `## Unapplied Migrations` section in `check-vault-structure.mjs` output,
  sourced from the same registry as the runner. When this section appears
  for the project the user is working on, the agent should name the
  migration, list its effects, ask once per session, and run
  `migrate.mjs --project <name>` on approval. Do not auto-migrate; do not
  nag if the user declines.
- `## Migrations` section in `REFERENCE.md` documenting the registry
  pattern, CLI, ledger, authoring guide, agent behavior rules, and the
  v1.0.0 migration.
- New Quick Start entry `#7. Migrate an existing project` and a new
  Triggers-table row mapping migration phrases (including implicit
  validator detection) to the migration intent.

### Changed

- `install.sh` default `--ref` will flip from `main` to `v1` in a follow-up
  commit, after the `v1.0.0` tag exists on `origin`. Until then, the default
  remains `main`. This avoids a window where a fresh `install.sh` would
  resolve to a non-existent `v1` ref.
- `openclaw-instruction.md` install URL will switch from `main` to `v1` in
  the same follow-up commit.
- `check-vault-structure.mjs` removes the legacy `LEGACY_DIRS` /
  `findings.legacy` shape in favor of the registry-driven unapplied-migrations
  check. Behavior for users with no legacy layout is unchanged.

## [1.0.0] - 2026-06-10

The first explicitly versioned release. The major bump reflects the breaking
PM-folder layout change: `planning/` is now `roadmap/plans/`, ADRs are one
type of a typed decision record under a new top-level `decisions/` lane, and
the validator scripts now treat the new layout as canonical.

### Added

- New PM-folder rules section in `SKILL.md` covering four high-failure
  rules: `roadmap/known-issues.md` is for observed defects only;
  `roadmap/ideas.md` registry entries must always have a full description;
  deferred items have a single source of truth; decisions are a typed
  lane, not an ADR monoculture.
- Top-level `decisions/` PM lane at the project root, peers with
  `roadmap/`, `system/`, `features/`, and `history/`. Records decisions
  *made* with seven type codes: `ADR` (architecture), `PRD` (product),
  `MKT` (market/positioning), `VND` (vendor pick), `POL` (policy),
  `NEG` (explicit rejection), `EXP` (time-boxed experiment).
- Decision filename convention: `D-NNN_<type>_<slug>.md`, with a single
  global number sequence.
- Decision status lifecycle: `proposed | accepted | active | superseded |
  deprecated`. `active` is allowed but should be temporary. Append-mostly:
  to change an `accepted` decision, write a new one that `supersedes:` it.
- Cross-type `supersedes` chains (e.g. an `ADR` superseded by a `PRD`
  that scopes a v2 migration) are explicitly allowed.
- Lifecycle diagram in `SKILL.md` showing the plan/deferred/in-flight
  state machine alongside the parallel decision record.
- `VERSION` file at the repo root (this file's companion). The install
  script reads it after update to print the resolved version.
- `CHANGELOG.md` (this file).
- `--channel` flag on `install.sh` (resolves to `main` or `v1`) for
  friendlier version selection. The default `--ref` is still `main` in
  this revision; the follow-up commit will flip it to `v1`.

### Changed

- **Breaking: PM folder layout restructured.** `planning/` is now
  `roadmap/plans/`. `planning/decisions/` is replaced by a top-level
  `decisions/` lane. Existing projects must migrate (see Migration,
  below).
- `templates/ADR.md` is replaced by `templates/decision.md`. The new
  template is typed (`ADR / PRD / MKT / VND / POL / NEG / EXP`) and
  generalizes the ADR body shape (Context, Options Considered, Decision,
  Consequences, Realization Notes, Related, Navigation).
- `scripts/bootstrap-pm.mjs` now scaffolds `roadmap/plans/` and `decisions/`
  at the project root for new projects. Old `planning/` and
  `planning/decisions/` paths are no longer created.
- `scripts/check-pm-consistency.mjs` recognizes `D-` filename pattern and
  returns `pageType: decision` for files under `decisions/`. Files under
  `roadmap/plans/` return `pageType: planning`.
- `SKILL.md` "Where Information Goes" lane table updated: `roadmap/plans/`
  and `decisions/` rows added, `planning/` row removed.
- `install.sh` accepts `--ref` for exact-version pinning
  (e.g. `--ref v1.0.0`) and prints the resolved version after update.
- `update.sh` is **deleted**. Users run `install.sh --update` directly.
- `SKILL.md` description extended to ~115 words to advertise the new
  rules and the typed decision lane.

### Deprecated

- `planning/` (top-level) is deprecated. New projects must not create it.
  Existing projects will see a "Migration Debt (legacy)" warning from
  `check-vault-structure.mjs` until they migrate.
- `planning/decisions/` (top-level) is deprecated for the same reason.
- The `ADR-NNN_<filename>` prefix is deprecated. Use `D-NNN_<type>_<slug>.md`.
- The `pageType: adr` frontmatter value is deprecated. Use
  `pageType: decision` with a `decision_type` field.

### Removed

- `templates/ADR.md` (replaced by `templates/decision.md`).
- `update.sh` (use `install.sh --update` instead).

### Fixed

- `scripts/check-pm-consistency.mjs` no longer requires the legacy
  `planning/` folder note check, which was reporting false failures on
  projects that had already migrated.
- `scripts/check-vault-structure.mjs` separates required-folder checks
  from migration-debt warnings; the latter are soft failures, not hard.

### Migration

For each existing project registered in `projects.json`:

1. `git mv planning roadmap/plans`
2. `git mv planning/decisions decisions` (out of `roadmap/plans/`, *not*
   into it)
3. Rename any `ADR-NNN_*.md` files to `D-NNN_ADR_*.md`; update frontmatter
   (`pageType: decision`, `decision_type: ADR`).
4. Rewrite wikilinks: `[[…/planning/…]]` → `[[…/roadmap/plans/…]]`;
   `[[…/planning/decisions/…]]` → `[[…/decisions/…]]`.
5. Update `decisions/decisions.md` to the typed register shape
   (see `templates/README.md`).
6. Append a `history/<current-month>/<date>.md` bullet:
   `chore(pm): migrate planning/ → roadmap/plans/, generalize
   planning/decisions/ → decisions/ as a typed first-class PM lane at root`.
7. Run `node <skill_dir>/scripts/check-pm.mjs --project <name>` to
   verify; the "Migration Debt (legacy)" warning should clear.

A per-project `scripts/migrate-roadmap.mjs` one-shot script is forthcoming
in a follow-up release.

### Security

- No security-relevant changes in this release.
