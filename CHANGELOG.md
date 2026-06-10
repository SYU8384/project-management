# Changelog

All notable changes to this skill are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.2] - 2026-06-10

### Added

- Second registered migration: `1.0.2-v0-content-rewrite`. Rewrites v0.x body text and frontmatter fields that the v1.0.0 lane restructure left behind: `decisions/decisions.md` intro and `## Decisions Log`, `roadmap/plans/plans.md` H1 / title / `## Conventions`, `archive/archive.md` "or planning docs." phrasing, `## Relevant ADRs` → `## Relevant Decisions`, `> No ADRs yet.` → `> No decisions yet.`, `templates/ADR.md` → `templates/decision.md`, frontmatter `current_behavior_source` / `source_of_truth` / `related` paths (`planning/` → `roadmap/plans/`), v0.x tags (`wip`, `deprecated`), `status: in-progress` → `active`, decision body shape (`## Implementation Notes` → `## Realization Notes`, `## Alternatives considered` → `## Options Considered`), decision title/H1 (`ADR-NNN:` → `D-NNN:`), plan H1 → slug-only (with original descriptive title preserved as `## Summary`), broken wikilinks (missing `]]`), and `roadmap/done-pending.md` date-prefixed section headers.
- Manual-review warnings emitted for items that need human judgement, not auto-fix: plan status/body mismatches, decision content authoring on plans that have `## Decisions Locked` or `## Decisions (all explicit, ...)` sections, and known-issues theoretical-risk wording.

### Migration note

If you ran the v1.0.0 lane restructure before this release, your PM folder has v0.x body text and frontmatter fields that the v1.0.0 migration did not touch (folder moves and wikilink rewrites succeeded; prose-level cleanup did not). The agent will offer to run `1.0.2-v0-content-rewrite` on your next PM-skill interaction. Run with `--dry-run` first to see what will change. Items that require human judgement are surfaced as MANUAL REVIEW warnings in the migration output and not auto-fixed.

The `1.0.0-lane-restructure` migration is unchanged. No new dependencies.

## [1.0.1] - 2026-06-10

### Changed

- `install.sh` default `--ref` is now `v1` (latest v1.x.x release). Pass
  `--ref main` or `--channel main` for the bleeding edge.
- `openclaw-instruction.md` install URLs use `v1` (latest v1.x.x) instead of
  `main`.
- `check-vault-structure.mjs` removes the legacy `LEGACY_DIRS` /
  `findings.legacy` shape in favor of the registry-driven unapplied-migrations
  check. Behavior for users with no legacy layout is unchanged.

### Notes

- The `1.0.0-lane-restructure` migration has been part of the registry since
  `v1.0.0`. No new migrations in this release.

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
