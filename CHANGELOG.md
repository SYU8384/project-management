# Changelog

All notable changes to this skill are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- New `## 🛡️ Access model` section in the README, between Quick Start and What It Does. Explains the three access modes (`authoritative` / `read-only` / `unavailable`) so the reader knows whether the skill will edit their PM folder directly, fill in a PR body, or ask the maintainer for access. Points to `REFERENCE.md` for the full per-mode behavior.

### Changed

- README Quick Start trigger table: reordered to reconcile → verify → migrate (recommended first-time pick is the all-in-one fix). Added a "When to use" column so the relationship between reconcile / verify / migrate is explicit. Renamed "Result" → "What happens" for clarity.
- README consolidated: the previous `## 🚀 Quick Start`, `## ⚙️ Install Or Update`, `## Local Registry (Advanced)`, and `## 🚀 After Installer: Start With One Prompt` sections are merged into one canonical `## 🚀 Quick Start` section at the top of the README. Three install paths (OpenClaw, interactive installer, manual) are presented with the OpenClaw-vs-coding-agent distinction explicit. Trigger phrases are scoped to "Path B / C only" so OpenClaw users don't see them as required. README is ~30% shorter; net removal of ~120 lines of redundant install content.
- Top-of-README badge `install-or-update` → `quick-start`. Anchor `<a id="install-or-update">` replaced with `<a id="quick-start">`.
- README: dropped the redundant `## 🧪 Validation And Integration Checks` and `## 🔁 Migrations` sections. The integration is now stated in the Quick Start trigger table (reconcile does validate + repair + migrate in one command); the Migrations subsection, runner CLI, and per-check script reference are in `REFERENCE.md` for the developer who needs them.

## [1.4.0] - 2026-06-10

A focused release that adds the **Reconcile** workflow (validate + repair + migrate) as a single user-triggered action, and improves the new-user install experience.

### Added

- `scripts/check-pm.mjs --fix`: orchestrates the full reconcile workflow in four phases.
  1. Baseline validators (report-only).
  2. Validators with `--fix` (auto-create missing folder notes from `templates/folder-note.md`, rewrite `pageType:` mismatches).
  3. Pending migrations from the registry (idempotent; reads `.pm/migrations.json` ledger; honors `--dry-run` and `--force`).
  4. Re-validation (final report; residual issues surface as warnings for human review).
  Backward compatible: without `--fix`, runs validators in report-only mode (existing behavior).
- `scripts/migrate.mjs --list --json`: machine-readable registry output for orchestration. Default `--list` (human-readable) is unchanged.
- New SKILL.md Quick Start item 8 ("Reconcile a project") and Triggers table row mapping phrases like `reconcile this project`, `repair and migrate this project`, `fix everything`, `reconcile the PM folder` to the `--fix` orchestration.

### Changed

- README Quick Start section added at the top, just below the badges. Covers the OpenClaw PM-agent path (with the unique-role framing: PM work *broader* than what a coding agent does as a side effect of code changes) and the installer path (with `--target agents` as the recommended default and a TTY-aware menu fallback). Includes a trigger-phrase table mapping user intent to action.
- README: dropped the redundant `#start-with-one-prompt` badge (the Quick Start section now covers that content at the top).
- `install.sh`: when no `--target` is passed AND no TTY is available (e.g., `curl | bash -s -- --yes` from a CI/script), the installer now defaults to `--target agents` instead of failing. Interactive installs (TTY attached) still show the menu. Backward compatible.

## [1.3.0] - 2026-06-10

`projects.json` moves from the skill root to a user-specific location at `~/.config/project-management/projects.json` (XDG-conformant). This keeps the skill portable and user-agnostic — the same skill can be shipped to another user without leaking personal paths, and skill reinstalls no longer clobber user config.

### Added

- `scripts/lib/paths.mjs`: shared path-resolution helpers. `resolveProjectsConfigPath(explicitConfigPath)` returns the path with strict precedence: `--config <path>` flag (highest) → `~/.config/project-management/projects.json`. `findSkillDir()` and `getUserConfigDir()` round out the module.
- `bootstrap-pm.mjs` writes `projects.json` to `~/.config/project-management/projects.json` on first run (creating the directory if missing). The `_comment` field is stripped from the user file.

### Changed

- All seven scripts (`bootstrap-pm.mjs`, `migrate.mjs`, `check-pm.mjs`, `check-pm-consistency.mjs`, `check-vault-structure.mjs`, `check-stale-docs.mjs`, `check-agents.mjs`) now resolve `projects.json` via `scripts/lib/paths.mjs`. None reads from `<skill_dir>/projects.json`.
- `install.sh` no longer writes `projects.json` to the skill root. The bootstrap script handles it at the user location.
- `templates/projects.template.json` includes a `_comment` field documenting that v1.3.0+ copies this content to the user location, not the skill root.
- Documentation updated across `README.md`, `SKILL.md`, `openclaw-instruction.md`, `REFERENCE.md`, `templates/CURRENT_STATUS.md`, `templates/AGENTS_PM_SECTION_AUTHORITATIVE.md`, and `templates/AGENTS_PM_SECTION_UNAVAILABLE.md` to document the new user location.
- Removed all `<skill_dir>/projects.json` references from example commands and error messages.

### Migration note (existing users)

If you previously had `projects.json` at `<skill_dir>/projects.json`, move it once:

```bash
mv <skill_dir>/projects.json ~/.config/project-management/projects.json
```

v1.3.0+ scripts will not read from the skill-root location. If neither file exists after the move, the next bootstrap run will create the file at the user location.

## [1.2.0] - 2026-06-10

A focused release addressing the audit findings from the post-v1.1.0 coherence + practicality pass. Most material is template/validator/migration refinement; no breaking changes for fresh bootstraps.

### Added

- `scripts/migrate.mjs --force --migration <id>` flag: bypasses the applied-migrations ledger for the targeted migration. Use this when a migration's `detect()` patterns are extended after you already ran it — without `--force`, the ledger blocks re-running. Most users running v1.2.0 will *not* need this; it's a recovery path for the case where the extended 1.0.2 migration (below) needs to fire on existing projects.
- `scripts/check-vault-structure.mjs --fix`: creates missing folder notes from `templates/folder-note.md` (substitutes the project name and current date). Does not fix shape violations (extra `##` sections).
- `scripts/check-pm-consistency.mjs --fix`: rewrites the `pageType:` frontmatter field on files where it doesn't match the expected value derived from the file's path. Inserts the field if it's missing. Does not add or rename other fields.
- `templates/planning.md`: `## Related` body section, with placeholder comment for decision / system / feature links. The `## Conventions` block already references this section; the section now exists.
- `templates/meetings.md` and `templates/README.md → Conventions by Page Type → Meeting records`: documented `status: active` (in-progress meeting) alongside the default `status: closed`.

### Changed

- `scripts/migrations/1.0.2-v0-content-rewrite.mjs`: extended coverage.
  The migration's `detect()` and `apply()` now match v1.0.0/v1.0.1/v1.0.2/v1.0.3-era text patterns in addition to the original v0.x patterns. Existing projects that already ran the migration pre-v1.2.0 can re-trigger the extended coverage with `migrate.mjs --force --migration 1.0.2-v0-content-rewrite`. The migration's `from` is now `<1.2.0`; the `to` is `1.2.0`.
- `scripts/migrations/1.0.2-v0-content-rewrite.mjs`: manual-review messages now include file:line references (`<file>:<line>:`) so the user can jump directly to the offending text in their editor.
- `scripts/bootstrap-pm.mjs`: the `folderNote()` helper accepts an optional `conventions` parameter; the bootstrap's `plans.md` and `features.md` calls now pass the lane-specific `## Conventions` text. Matches the templates.
- `templates/README.md` "Live PM Folder Rule": expanded with an "always safe (no ask needed)" / "ask before" split, so the agent has a clearer heuristic.
- `templates/known-issues.md`, `templates/ideas.md`, `templates/done-pending.md`, `templates/mvp-priorities.md`: added `title:` frontmatter field (these templates previously omitted it, which would have caused the consistency check to fail if a user copied the template directly).
- `templates/known-bugs.md`: added `updated:` frontmatter field (was missing).
- `templates/decision.md`: comment clarifies `decision_date` and `supersedes` are convention-only (not enforced by validators). The validator checks the 6 base fields only.
- `REFERENCE.md` "Frontmatter Schema": reconciled schema-vs-validator — `updated`, `last_reviewed`, `status`, `owner` are now marked **Required** (matching what `check-pm-consistency.mjs` actually enforces).
- `SKILL.md` Quick Start item 3: added a post-bootstrap note that the user should populate `CURRENT_STATUS.md` and run `check-pm.mjs --project <name>` to verify.
- `openclaw-instruction.md`: added an `## meetings/ lane — optional` section documenting the convention.
- `SKILL.md` and `README.md`: tightened the "planning docs" phrasing in the archive and features lane rows to reference `roadmap/plans/` and `decisions/` explicitly.
- `templates/README.md` "Naming Conventions" table: added a "Meeting records" row for the `meetings/YYYY-MM-DD_<topic-slug>.md` filename pattern.

### Migration note

If you ran `1.0.0-lane-restructure` followed by `1.0.2-v0-content-rewrite` before v1.2.0, your existing PM folders still have the v1.0.0/v1.0.1/v1.0.2/v1.0.3-era text in `decisions/decisions.md` and `roadmap/plans/plans.md` `## Conventions` block. Re-running the migration on v1.2.0+ cleans them:

```bash
node <skill_dir>/scripts/migrate.mjs --pm-folder <path> --migration 1.0.2-v0-content-rewrite --force --yes
```

The `--force` is required because the migration is in your `.pm/migrations.json` ledger from the prior run. The dry-run form is `--dry-run` instead of `--yes`.

## [1.1.0] - 2026-06-11

### Added

- `meetings/` as an **optional** meeting records lane. Two new
  templates ship in `templates/`: `meetings.md` (folder-note template
  for the lane) and `meeting-record.md` (content-note template for
  individual meeting records). The lane is *not* auto-scaffolded by
  `bootstrap-pm.mjs`; users create the folder on demand. Filename
  pattern is `YYYY-MM-DD_<topic-slug>.md`; body sections are
  Attendees / Agenda / Discussion / Decisions Made / Action Items /
  Notes. Decisions and plans are not duplicated inside meeting records
  — they are cited by reference to `decisions/D-NNN_<type>_<slug>.md`
  and `roadmap/plans/YYYY-MM-DD_<slug>.md`. A new row in `SKILL.md`'s
  "Where Information Goes" lane table and a new subsection in
  `templates/README.md`'s "Conventions by Page Type" document the
  lane.

## [1.0.4] - 2026-06-10

Quality + correctness patch. No new features. Resolves three
high-severity contradictions in the v1.0.0/v1.0.2 pipeline (planning-mirror
false positive, validator-vs-migration date-prefix mismatch, v0.x text
preserved in the v1.0.2 migration), plus a sweep of remaining v0.x
apologetic framing and SKILL.md forward-refs that the v1.0.3 cleanup
missed.

### Fixed

- `scripts/check-pm-consistency.mjs`: the planning-mirror check now
  excludes folder notes (`roadmap/plans/plans.md` is a folder note and
  was being falsely flagged as needing a `## plans` mirror in
  `roadmap/done-pending.md`). A freshly-bootstrapped project now
  passes the consistency check on first run.
- `scripts/migrations/1.0.2-v0-content-rewrite.mjs`:
  - `processDonePending` no longer strips the date prefix from
    `## YYYY-MM-DD_slug` headings in `done-pending.md`. The validator
    (`check-pm-consistency.mjs`) and the documented convention (README,
    `templates/planning.md`, REFERENCE.md) all require the date
    prefix; stripping it caused every plan to fail validation after
    the v1.0.2 migration ran. The pass is preserved as a no-op for
    backward compatibility with the v1.0.2 detect()/plan() entries.
  - The decisions intro string written by `processDecisionsFolderNote`
    now matches the cleaned v1.0.3 bootstrap text (no "ADRs are one
    type" apology, no forward reference to `SKILL.md` "PM-folder
    rules"; the seven-type legend is inlined).
  - The `## Conventions` block written by `processPlansFolderNote` now
    inlines the five planning status values as a bulleted list and
    inlines the archive-rename rule (no forward references to
    `SKILL.md` "Frontmatter Schema → Planning" or "Planning To Roadmap
    Sync").
- `scripts/check-vault-structure.mjs`: removed the comment (line 215-219)
  and error-message text (line 660) claiming that folder notes
  shouldn't have `## Conventions` blocks. v1.0.3 established that
  folder notes *may* include `## Conventions` (used by `roadmap/plans/`,
  `features/`, `decisions/`).
- `scripts/bootstrap-pm.mjs`:
  - The bootstrap now includes `## Conventions` blocks in
    `roadmap/plans/plans.md` and `features/features.md`, matching
    `templates/planning.md` and `templates/features.md`. Before this
    fix, freshly-bootstrapped projects had plans/features folder
    notes without `## Conventions`, while the templates had them — a
    bootstrap-vs-template contradiction.
  - The archive folder-note intro now reads "Superseded material
    replaced by current product, system, roadmap, or `roadmap/plans/`
    and `decisions/` docs." (previously missing the `roadmap/plans/`
    reference).
- `templates/done-pending.md`, `templates/known-issues.md`,
  `templates/ideas.md`: removed `wip` from the example frontmatter
  tags. `wip` is v0.x vocabulary that the v1.0.2 migration's
  `detect()` would flag on freshly-bootstrapped projects.
- `templates/folder-note.md`: rewrote the HTML comment that
  incorrectly claimed folder notes are index-only and shouldn't hold
  conventions.
- `templates/README.md` `decisions/` row: dropped the v0.x
  "ADRs are one type, not the only kind" trailing apology (the row
  already enumerates the seven types inline).
- `templates/decision.md` line 21 blockquote: simplified to
  `**Decision type:** \`<decision_type>\` (\`ADR\` / \`PRD\` / \`MKT\` /
  \`VND\` / \`POL\` / \`NEG\` / \`EXP\`).` (removed the apologetic
  "ADRs are an `ADR` instance, not a separate artifact class" framing
  and the "See `SKILL.md` 'PM-folder rules' for the type legend"
  forward reference).
- `templates/AGENTS_PM_SECTION_AUTHORITATIVE.md` and
  `templates/PR_BODY_TEMPLATE.md`: replaced the "(use `ADR` for
  architecture; other types per `SKILL.md` 'PM-folder rules')"
  forward reference with an inline enumeration of all seven type codes.
- `REFERENCE.md`:
  - Replaced `adr` with `decision` in the `pageType` schema table.
  - Removed the apologetic + forward-reference sentence at line 430
    ("ADRs are one type of decision, not the only kind. See `SKILL.md`
    'PM-folder rules' for the full convention").
  - Removed the "see `SKILL.md` 'PM-folder rules' for the type legend"
    forward reference at line 759; the seven-type codes are now
    enumerated inline.

## [1.0.3] - 2026-06-10

### Fixed

- `README.md` was stale relative to v1.0.0/v1.0.1:
  - The Versioning section described the v1.0.0 default-install behavior
    ("pulls `main` (bleeding edge)") instead of the v1.0.1 default
    ("pulls `v1` (latest v1.x.x)"). Updated with a "how to check your
    current version" one-liner (`cat <skill_dir>/VERSION`).
  - The README did not document the migration registry, the migration
    runner, or the per-project ledger. Added a `## Migrations` section
    listing the two currently registered migrations, the `migrate.mjs`
    CLI flags (`--list`, `--dry-run`, `--project`, `--pm-folder`,
    `--migration <id>`, `--yes`), and the `.pm/migrations.json` ledger
    location.
  - The Repository Map did not list `scripts/migrate.mjs` or
    `scripts/migrations/`. Added both.
  - The validator table row for `check-vault-structure.mjs` did not
    mention migration detection. Updated to note that it emits
    `## Unapplied Migrations` for the migration registry.
  - The `decisions/` lane row in PM Folder Model did not list the
    decision type codes. Updated to include `ADR / PRD / MKT / VND /
    POL / NEG / EXP`.

No behavioral change. Doc-only patch.

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
