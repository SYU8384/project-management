/**
 * validators/_index.mjs
 *
 * Default export: an array of validator descriptors in the order they
 * should be invoked by `check-pm.mjs`. Each entry has the shape:
 *
 *   {
 *     file:    "<filename>.mjs",   // relative to scripts/
 *     label:   "Human-readable name",
 *   }
 *
 * The orchestrator (`check-pm.mjs`) imports this array and spawns each
 * validator in sequence. Adding a new validator is one new file under
 * `scripts/` plus one entry here. The orchestrator does not need to be
 * edited.
 *
 * The `hasFix` flag (true if the validator accepts a `--fix` flag) is
 * currently inferred by the orchestrator by passing `--fix` to all
 * validators; the validators are responsible for accepting and
 * honoring the flag. If a future validator does not support `--fix`,
 * it should ignore the flag gracefully and print a one-line notice.
 */

const validators = [
  { file: "check-vault-structure.mjs",       label: "Vault structure" },
  { file: "check-stale-docs.mjs",            label: "Stale docs" },
  { file: "check-pm-consistency.mjs",        label: "PM consistency" },
  { file: "check-roadmap-conventions.mjs",   label: "Roadmap conventions (D-007/008/009/010/012)" },
  { file: "check-content-semantics.mjs",     label: "Content semantics (A/B/C/D)" },
  { file: "check-known-bugs-shape.mjs",      label: "Known-bugs shape (D-011)" },
  { file: "check-live-routing.mjs",          label: "Live routing hygiene (D-013)" },
  { file: "check-obsidian-links.mjs",        label: "Obsidian links (D-014)" },
  { file: "check-agents.mjs",                label: "AGENTS.md integration" },
];

export default validators;
