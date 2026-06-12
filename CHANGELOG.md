# Changelog

All notable changes to this skill are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - v1.6.0 starts (I6 --strict flag)

The first v1.6.0 carryover item from the planning note `2026-06-12_v1.6.0-carryover`. `--strict` tightens the `check-stale-docs.mjs` thresholds from 30/90 days to 7/14 days for CI runs.

### Added

- `scripts/check-stale-docs.mjs --strict` flag: tightens the stale-doc threshold from 30 days to 7 days, and the very-stale threshold from 90 days to 14 days. For nightly CI: a doc whose `last_reviewed` is more than a week old fails the run. The flag is opt-in; the default behavior is unchanged. The report's `Thresholds:` line and the section header (`Stale (30-90 days)` vs `Stale (7-14 days)`) reflect the active mode. A `(Strict mode active: stale threshold lowered to 7 days, very-stale to 14 days.)` notice prints at the start of the run.
- The `STALE_DAYS` / `VERY_STALE_DAYS` env-var overrides still work in non-strict mode. `--strict` is a CLI-only override; the env-var overrides are the per-project customization knob.

### Notes

- `--strict` is honored by `check-stale-docs.mjs` only. The other three validators (vault-structure, pm-consistency, agents) have no soft-warning categories to escalate and ignore the flag.
- `check-pm.mjs` passes `--strict` through to each spawned validator (no orchestrator change needed).
- The v1.6.0 plan (`roadmap/plans/2026-06-12_v1.6.0-carryover`) moves from `proposed` to `active` with this work.

## [Unreleased] - v1.6.0 close-out (F7, F2+F3, I8, code_repo)

A batch of v1.6.0 carryover items from the planning note `2026-06-12_v1.6.0-carryover`. Closes the day-1 setup gap, makes validator errors pedagogical, and makes phase/notes edits single-source-of-truth.

### Added

- `scripts/check-agents.mjs`: the validator now FAILs (not SKIPs) for `authoritative` projects without `code_repo`. The pre-v1.4.0 "every project has a code_repo" assumption is now defensible: an authoritative project that lost its code_repo entry is caught at validation time. Read-only projects still SKIP (legitimate "no code repo" case for project-only setups). The FAIL message is: `authoritative project '<name>' has no code_repo; AGENTS.md cannot be validated. Set code_repo to the code repo path, or downgrade to access: read-only if this is a project-only setup.`
- `scripts/bootstrap-pm.mjs --sync` flag: re-reads `projects.json` and rewrites the `## Current Phase` and `## Summary` lines in `CURRENT_STATUS.md` and `PRODUCT.md` to match the canonical `phase` and `notes` values. Idempotent (re-run is a no-op when already in sync). Useful for projects where phase changes mid-lifecycle and the docs would otherwise drift.
- `scripts/check-pm-consistency.mjs`: new phase-consistency rule. If `projects.json` has a `phase` for the project, the body of `## Current Phase` in `CURRENT_STATUS.md` and `PRODUCT.md` must match. Drift returns FAIL with `Run \`bootstrap-pm.mjs --project <name> --sync\` to fix.`. The validator was reading `resolveProjectsConfigPath(null)` (XDG default only); fixed to honor `--config` (a latent bug that this rule exposed).
- `scripts/bootstrap-pm.mjs`: pre-scaffold `notice: target PM folder has N existing markdown files` line (useful for idempotent re-runs), and the final summary line now includes `N files skipped (already exist)`.

### Changed

- `templates/PR_BODY_TEMPLATE.md`: the hidden `<!-- if you have no PM folder access, ... -->` block was moved to a visible blockquote at the top of the `## PM folder impact` section. Contributors skimming the template now see the "if you have no PM access, leave this section empty" instruction instead of having it hidden in an HTML comment. The checkboxes below are unchanged.

### Fixed

- `scripts/check-pm-consistency.mjs`: latent bug where the validator's call to `resolveProjectsConfigPath(null)` ignored the `--config` flag. The validator now passes `CLI.config` through (matching the pattern in `check-stale-docs.mjs`, `check-agents.mjs`, and `check-vault-structure.mjs`).
- `scripts/check-agents.mjs`: the SKIP path for projects without `code_repo` is now gated on `access: read-only`. The pre-v1.4.0 assumption ("every project has a code_repo") was undocumented; v1.4.0's expansion to project-only setups introduced a SKIP path that conflated "legitimately no code repo" with "missing field". The fix differentiates.

### Notes

- C1-C6 (cosmetic items from the v1.6.0 plan) are deferred per the plan's own recommendation ("touching them invites bikeshedding").
- The v1.6.0 plan (`roadmap/plans/2026-06-12_v1.6.0-carryover`) is fully shipped; it can be archived by the user on the next planning pass (the file is already a historical record; no v1.6.0 tag is needed for the archive step).

## [1.5.0] - 2026-06-12

A release that closes the day-1 setup gap, makes validator errors pedagogical, brings the orchestration layer into a registry-driven shape, formalizes four OpenManager-derived conventions (`done-pending.md`, `ideas.md`, `known-issues.md`, `mvp-priorities.md`), and ships a translation migration for pre-v1.5.0 `access: "unavailable"` entries. The post-v1.4.1 audit findings (planning note `2026-06-12_v1.5.0-backlog-from-audit`) and a v1.4.1 doc-only data-model refactor are aggregated here.

### Added

- **`scripts/bootstrap-pm.mjs --access authoritative|read-only`**: registers the project with the chosen access mode (default `authoritative` for backward compatibility). Validates against the 2-value enum and exits 2 on invalid input. `assertConfigCanUpdate()`, `writeConfig()`, and `writeAgents()` write/read the chosen value; `writeAgents()` picks the `AGENTS_PM_SECTION_*` template by `access` (read-only → `AGENTS_PM_SECTION_READONLY.md`, authoritative → `AGENTS_PM_SECTION_AUTHORITATIVE.md`). The agent's Setup Intake routes to `--access read-only` when the user picks "Collaborator with PM access", closing the day-1 setup gap.
- **`scripts/validators/_index.mjs`**: validator registry. Mirrors the migration registry design. Default-exports an array of `{ file, label }` entries in invocation order. Adding a new validator is one new file under `scripts/` plus one entry here. `check-pm.mjs` reads the registry at startup via dynamic import; if the registry is malformed (missing `file` or `label`), the orchestrator exits 2.
- **`scripts/lib/skip.mjs`**: shared `.pm/skip` parser. The `.pm/skip` file in a project's PM folder lists filenames (one per line, `#` for comments) that the validators should ignore. Entries match against either the relative path or the basename. Wired into `check-vault-structure.mjs`, `check-stale-docs.mjs`, and `check-pm-consistency.mjs`. The orchestrator prints `(Honoring .pm/skip: <filename>)` when the file is present.
- **`scripts/migrations/1.4.1-unavailable-downgrade.mjs`**: detects legacy `access: "unavailable"` entries in `~/.config/project-management/projects.json` and downgrades them to `access: "read-only"` (conservative default; users who actually own the PM folder can re-run `bootstrap-pm.mjs --access authoritative --project <name>` to upgrade). Idempotent. Registered in `scripts/migrations/_index.mjs`.
- **`scripts/migrate.mjs` now passes `configPath` in `ctx`**: migrations read from the `--config` flag if set, else fall back to the XDG default. Future migrations can be `--config`-aware.
- **`summarize this project` trigger phrase**: README trigger table, `SKILL.md` Triggers table, and a new `REFERENCE.md` "Summarize This Project" section. Reads 6 files (`README`, `CURRENT_STATUS`, `PRODUCT`, `done-pending`, `known-issues`, current-month `history`); skips 5 folders (`decisions`, `features`, `archive`, `system`, `.pm`); output is one 4-8 sentence paragraph + 2-3 wikilinks.
- **Bootstrap ergonomics** in `scripts/bootstrap-pm.mjs`:
  - **Grouped dry-run output** (I3): `mkdir`/`write` log lines are deferred into a `planEntries` array; the dry-run output is grouped by folder, sorted alphabetically, with one `## <folder> (N)` heading per directory.
  - **`--yes` flag** (I4): quiet flag for non-interactive invocation.
  - **Existing-entries notice** (I4): `writeConfig()` prints `notice: <config> contains N other project entries: <names>.` when other projects exist.
  - **Summary line** (I12): final line is `summary: 13 dirs created, 25 files written.` (or with config/AGENTS.md updates).
  - **Dry-run exit code** (I13): the dry-run path validates that every parent directory in the plan either already exists or is in the plan; if not, prints an error and exits 2.
- **Four OpenManager-derived conventions** formalized as typed decisions:
  - `decisions/D-007_POL_done-pending-format.md`: `done-pending.md` holds two lanes (planning-note mirrors + general done/pending), slug-only H2, `Planning note:` line, DONE/PENDING checklist, `Relevant decisions:` / `Relevant features:` bullets.
  - `decisions/D-008_POL_ideas-status-colors.md`: `ideas.md` uses colored round emojis (🟣 Brainstorming, 🟡 Scoping, 🔵 Approved, 🟢 Implemented, 🔴 Declined) in the Status Key, the Idea Register, and the Idea Details `**Status:**` line.
  - `decisions/D-009_POL_known-issues-format.md`: `known-issues.md` uses the OpenManager domain-grouped format. `## Active` and `## Deferred` sections; each grouped by `### <Domain>` H3 subsections. Lead paragraphs document the convention inline.
  - `decisions/D-010_POL_mvp-priorities-format.md`: `mvp-priorities.md` uses the OpenManager lane-grouped format. `## Alpha Goal`, `## MVP Priorities` grouped by `### <Lane>` H3 subsections, `## Not Yet MVP` uses bare bullets.
- **Known-issues lifecycle rule (D-009 `## Lifecycle`)**: fixed items migrate to `docs/Developer Guide/known-bugs.md` and are removed from `known-issues.md`; whole `### <Domain>` sections archive to `archive/known-issues-<domain>-archived.md` when fully fixed; `## Deferred` items stay.

### Changed

- **`scripts/check-stale-docs.mjs`**: split the `findings.neverReviewed` array into three distinct arrays — `findings.missingFrontmatter`, `findings.missingLastReviewed`, `findings.unparseableLastReviewed` — and print one report section per category with a category-specific message (e.g., `last_reviewed value \`X\` is not a YYYY-MM-DD date; fix the frontmatter.` for unparseable).
- **`scripts/check-pm-consistency.mjs`**: when a file is missing `pageType`, the validator now suggests "did you mean `pageType: <X>`?" based on the file's path prefix. Six heuristics: `decisions/D-*` (decision), `roadmap/plans/` (planning), `features/<slug>.md` (feature), `system/<topic>.md` (system), `history/YYYY-MM/...` (history), `docs/<Guide>/<topic>.md` (note), `roadmap/<lane>.md` (roadmap).
- **Bootstrap and template content**: `done-pending.md`, `ideas.md`, `mvp-priorities.md`, `known-issues.md` scaffolds updated to the new formats with worked examples. `templates/README.md` "Conventions by Page Type → Roadmap notes" expanded to document all four new formats.
- **README structural refactor**: `## 🎯 Triggers (coding-agent users)` promoted to H2; Quick Start trigger table reordered for new-user natural flow; Workflow section replaced with a 3-column table covering all three access modes; Versioning section split; redundant sections dropped (~120 lines removed).
- **Contributor workflow tightened**: a contributor with no PM folder access now leaves the PR body's `PM folder impact` section empty instead of writing a "PM folder unavailable locally" signal line. The maintainer reads the code diff directly. The `AGENTS_PM_SECTION_READONLY.md` (read-only) workflow is unchanged.
- **`scripts/check-agents.mjs`**: removed the dead positional-`<vault>` argument code path; the script now always goes through `projects.json`.
- **`scripts/check-vault-structure.mjs`**: the `## Unapplied Migrations` check stays; the `## Fixed` requirement for `roadmap/known-issues.md` is removed (per D-009 Lifecycle).

### Deprecated

None.

### Removed

- **`access: "unavailable"` registration mode**: the `access` field is now a strict two-value enum (`authoritative` / `read-only`). Contributors with no PM access at all are not users of the skill on their side — they submit PRs with PM folder impact notes, and the maintainer's PM agent applies PM updates on merge. The `setup as collaborator` trigger now registers read-only access only.
- **`templates/AGENTS_PM_SECTION_UNAVAILABLE.md`**: retired as a generated template and deleted from the repo. The modern read-only + PR body convention covers the no-PM-access case. `scripts/check-agents.mjs::templateForAccess()` no longer returns it.
- **Pre-v1.4.1 dead code paths** in the validators (positional `<vault>` args, hardcoded `OpenManager.md` in `SKIP_FILES`, etc.).

### Fixed

- **F8 from the v1.5.0 audit (validator's done-pending mirror check)**: `scripts/check-pm-consistency.mjs:195` now accepts both `## YYYY-MM-DD_slug` (date-prefixed) and `## <slug>`-only H2 (per the new convention), with a token-overlap fallback for human-readable expansions.
- **Audit pass on residual contradictions**: removed stale references in `SKILL.md`, `openclaw-instruction.md`, `REFERENCE.md`, and the validators to the retired `unavailable` mode and the deleted `AGENTS_PM_SECTION_UNAVAILABLE.md` template.
- **CHANGELOG self-contradiction**: the `[Unreleased] ### Added` entry that still said "three access modes" was rewritten to match the final two-modes-plus-contributor-case state.
- **`check-agents.mjs` dead code**: removed the dead positional-`<vault>` argument and an orphaned comment below the access-FAIL check.
- **`check-stale-docs.mjs` OpenManager.md residue**: removed the hardcoded entry from the `SKIP_FILES` set; users with per-project skip needs use `.pm/skip` (new in this release).
- **`check-vault-structure.mjs` `## Fixed` requirement**: no longer requires `## Fixed` for `known-issues.md` (per D-009 Lifecycle).

### Security

None.

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
