---
title: "D-011 Known-bugs shape"
aliases: [D-011, Known-bugs shape]
tags:
  - project-management
  - decision
  - POL
created: 2026-06-13
updated: 2026-06-13
last_reviewed: 2026-06-13
pageType: decision
decision_type: POL
status: accepted
date: 2026-06-13
supersedes: null
owner: PM
---
# D-011 — `known-bugs.md` entry shape convention

## Status

`accepted` (effective 2026-06-13).

## Context

The project-management skill has long required `docs/Developer Guide/known-bugs.md` as the engineering bug knowledge base. The `templates/known-bugs.md` scaffold gives the four top-level sections (`Recurring Root-Cause Patterns`, `Active Bugs`, `Fixed Bugs`, `Deferred / Monitoring`) and a per-entry field template. However, the convention was not enforced by validators, so real PM folders drifted: placeholder `<to be filled in by maintainer>` fields were left in place, `Active Bugs` entries grew extra fields such as `Verification`, the Contents TOC linked to H3 bug headings, and status values such as `mitigated` leaked in.

## Options Considered

- **A. Leave shape unenforced.** Rely on authors to follow `templates/known-bugs.md`. **Rejected**: without enforcement the file slowly diverges from the template, making it harder to scan and to trust that every fixed bug has root cause, solution, and verification.
- **B. Add a shape validator and migration (chosen).** Define required fields per section, allowed status values, a placeholder-to-TBD normalizer, and a Contents TOC cleaner. Surface `TBD` fields as `MANUAL REVIEW` so they are visible but do not block PASS.
- **C. Require all fields to be non-placeholder before PASS.** **Rejected**: engineering verification sometimes cannot be written until a later deploy or smoke test; the file should still PASS while clearly flagging what needs human input.

## Decision

Option B. `docs/Developer Guide/known-bugs.md` must follow the per-section entry shape from `templates/known-bugs.md`:

- **Recurring Root-Cause Patterns** entries:
  - `Status`: `active`, `fixed`, or `monitoring`
  - `Symptoms`
  - `Root cause`
  - `Solution`
  - `Seen in`
  - `References`
- **Active Bugs** entries:
  - `Status`: `active`
  - `Symptoms`
  - `Root cause` (`unknown` if not diagnosed)
  - `Current workaround`
  - `Next action`
  - `References`
- **Fixed Bugs** entries:
  - `Status`: `fixed`
  - `Symptoms`
  - `Root cause`
  - `Solution`
  - `Verification`
  - `References`
- **Deferred / Monitoring** entries:
  - `Status`: `deferred` or `monitoring`
  - `Symptoms`
  - `Reason deferred`
  - `Trigger to reopen`
  - `References`

Additional rules:

- The `## Contents` TOC may only link to the top-level sections, not to individual H3 bug/pattern headings.
- Missing required fields are a `FAIL`; the auto-fixer adds them as `TBD`.
- Placeholder text (`<to be filled in by maintainer ...>`) is normalized to `TBD — ...` and surfaced as `MANUAL REVIEW`.
- Fields explicitly marked `TBD` are surfaced as `MANUAL REVIEW`.

## Consequences

- Positive: every known-bugs entry has a predictable shape, making the file scannable and making missing root cause / verification obvious.
- Positive: the migration can repair old drift automatically.
- Positive: active bugs keep engineering detail in `known-bugs.md` while the PM-level tracker stays in `roadmap/known-issues.md`.
- Negative: authors must learn the per-section field list. The template and validator output make the list discoverable.

## Realization Notes

- Added `scripts/check-known-bugs-shape.mjs` to the validator registry.
- Added `scripts/lib/known-bugs-fixers.mjs` for shared parse/fix logic.
- Added migration `scripts/migrations/1.9.0-known-bugs-shape.mjs` to apply the fixes to existing PM folders.
- Updated `templates/known-bugs.md` to document the rules in the scaffold.

## Related

- `templates/known-bugs.md`
- `decisions/D-009_POL_known-issues-format.md`
- `scripts/check-known-bugs-shape.mjs`
- `scripts/lib/known-bugs-fixers.mjs`
- `scripts/migrations/1.9.0-known-bugs-shape.mjs`

## Navigation

- [[decisions/decisions|Back to decisions]]
- [[Project Management|Back to Project Management]]
