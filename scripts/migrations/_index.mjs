/**
 * migrations/_index.mjs
 *
 * Ordered registry of migration module specifiers. The runner applies
 * migrations in the order they appear here. Each module is a small,
 * self-contained migration with `id`, `to`, `describe`, `detect()`, and
 * `apply()`.
 *
 * To add a new migration:
 *   1. Drop a new file in this directory (e.g. `1.1.0-foo.mjs`).
 *   2. Add its filename to the array below, in the order it should run.
 *   3. Update `CHANGELOG.md` with the new migration under the version
 *      that introduces the change.
 */
export default [
  "1.0.0-lane-restructure.mjs",
  "1.0.2-v0-content-rewrite.mjs",
  "1.4.1-unavailable-downgrade.mjs",
  "1.7.0-roadmap-content-conventions.mjs",
  "1.8.0-content-semantic-fixes.mjs",
  "1.8.0-plans-related-h3-repair.mjs",
  "1.8.0-parent-subfolder-links.mjs",
  "1.9.0-known-bugs-shape.mjs",
  "1.10.0-human-readable-pm-notes.mjs",
  "1.11.0-live-routing-and-feature-link-hygiene.mjs",
  "1.12.0-vault-relative-obsidian-links.mjs",
  "1.13.0-roadmap-milestones.mjs",
  "1.13.1-agent-maintained-milestones.mjs",
  "1.13.2-inline-milestone-evidence-links.mjs",
  "1.14.0-inbox-lane.mjs",
  "1.15.0-plan-related-links.mjs",
  "1.16.0-planning-note-opening-shape.mjs",
];
