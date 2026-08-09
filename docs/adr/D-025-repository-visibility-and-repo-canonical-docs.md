# D-025 — Repository visibility model and repo-canonical docs

**Status:** accepted (effective 2026-08-10)

## Context

The skill treated every project's PM folder as the only home for decisions, plans, and roadmap state. Two pressures made that insufficient:

1. Open-source repos have outside readers. Contributor-facing knowledge (architecture decisions, domain glossary, architecture overviews) belongs next to the code, where contributors and coding agents actually look — not in a maintainer-private Obsidian vault.
2. The matt-pocock engineering skills (`to-spec`, `to-tickets`, `triage`, `wayfinder`, `grill-with-docs`, `implement`) already publish artifacts to the repo (`CONTEXT.md`, `docs/adr/`, `docs/agents/`, `.out-of-scope/`) or its issue tracker. Without an integration contract, that work never reached the PM folder, and PM state drifted from tracker state.

A naive "copy PM notes into the repo" design creates two writable copies of the same information with no drift enforcement — guaranteed to diverge.

## Options Considered

- **A. True duplication (both sides writable).** Simplest to set up; guaranteed drift. Rejected.
- **B. PM folder canonical, repo gets generated exports.** Needs a generator plus drift detection, and still hides the canonical text from repo-native tooling. Rejected.
- **C. Repo canonical for contributor-safe info, PM folder keeps registry stubs (chosen).** One writable home per info type; the other side links. Enforceable deterministically.
- **D. Record open-source status as a boolean `opensource` flag plus duplicated tracker config in `projects.json`.** Conflates repo visibility with tracker location; tracker config already lives in the repo's `docs/agents/issue-tracker.md`. Rejected — visibility is a single enum, tracker config is read from the repo, never duplicated.

## Decision

Each `projects.json` project entry records `visibility: "public" | "private"`, detected at setup via `gh repo view --json visibility` and changeable on request through an asymmetric switch flow.

On `visibility: "public"` projects:

- **Repo-canonical:** ADRs live at `docs/adr/D-NNN-slug.md` (the PM decision id is the single identifier everywhere), the domain glossary lives at `CONTEXT.md`, contributor-facing architecture docs live under `docs/`.
- **PM registry stubs:** each repo ADR has a `decisions/D-NNN_ADR_<slug>.md` stub carrying the management fields (`status`, `supersedes`, `decision_date`), frontmatter `repo_path:` pointing at the repo file, and a 2-3 sentence summary. The PM folder remains the complete decision *registry* without holding a second writable copy of the prose.
- **PM-only, never copied to a public repo:** PRD/MKT/VND/POL/NEG/EXP decisions, roadmap plans and priorities, history, `TEAM.md`, `inbox/`, known-issues detail. Links point PM → repo/GitHub only; public artifacts never reference private vault paths.
- The AGENTS.md `## PM folder` section gains a repo-canonical-docs block via the `{{PUBLIC_REPO_BLOCK}}` template placeholder, rendered only for public projects.

Visibility switches are asymmetric: **private → public** requires a scrub review (agent lists what becomes repo-canonical, flags private-adjacent content, human approves) and repo bootstrap *before* the field flips; **public → private** flips the field and re-syncs AGENTS.md, nothing moves.

Matt-pocock skill outputs integrate by reference: spec → one PM plan with issue URLs, tickets → plan steps, wayfinder map → multi-session plan, triage rejections → `NEG` decision and verified bugs → `roadmap/known-issues.md`, new repo ADR → stub (public) or full entry (private).

## Consequences

- **Positive:** contributors get ADRs and glossary where they expect them; the PM folder stays the complete registry.
- **Positive:** drift is checkable — `check-repo-docs.mjs` verifies every stub's `repo_path` exists and every repo `docs/adr/D-*.md` has a stub.
- **Positive:** the scrub-review gate makes accidental private-content leakage a human decision, not an automation accident.
- **Negative:** stub summaries can drift from repo ADR bodies slowly; accepted — summaries are intentionally stable management metadata, not copies.
- **Negative:** flipping an existing project to public is real work (stub conversion); the migration path is documented but manual.

## Realization Notes

- `projects.json` gains `visibility`; migration `1.21.0-project-visibility` backfills the safe default `"private"`.
- `scripts/check-repo-docs.mjs` (registered validator) enforces the stub ↔ repo-ADR cross-reference.
- `scripts/lib/agents-section.mjs` renders the `{{PUBLIC_REPO_BLOCK}}` placeholder in `templates/AGENTS_PM_SECTION.md` for `check-agents.mjs`, `sync-agents-section.mjs`, and `bootstrap-pm.mjs`.
- `check-pm-closeout.mjs` suggests PM lanes when a session diff touches `CONTEXT.md`, `docs/adr/`, `docs/agents/`, `.scratch/`, or `.out-of-scope/`.
- The full convention text lives in REFERENCE.md ("Repository Visibility And Repo-Canonical Docs" and "Matt-Pocock Engineering Skills Integration").
