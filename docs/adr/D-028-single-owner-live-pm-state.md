# D-028 — Single-owner live PM state and semantic close-out

**Status:** accepted (effective 2026-11-01)
**Supersedes:** D-015

## Context

OpenManager and Schophia showed that the previous close-out policy rewards duplication rather than useful project memory. Both projects prepend implementation journals to `CURRENT_STATUS.md` and the active milestone, repeat the same sections across those notes and feature/system pages, and still retain months-old priorities under fresh `updated` and `last_reviewed` metadata. Modification-time checks certify activity, not truthful current state.

Historical records also produce routine stale findings, while exact-path links to existing JSON/PNG evidence fail because the Obsidian resolver indexes only Markdown. Finally, `proposed | active | shipped | rejected | superseded` cannot distinguish implementation underway from verification, blockage, or deferral.

## Decision

### One owner per kind of information

| Lane | Canonical content | Content that must move or be linked instead of copied |
|---|---|---|
| `history/` | Full outcome, verification, release evidence, and implementation-commit ledger | Do not repeat the ledger across every affected live note |
| `roadmap/plans/` | Design, canonical detailed checklist, acceptance state | Mirrors link here; they do not need a second full design/checklist |
| `roadmap/done-pending.md` | Open next actions, blockers, short outcome links, and human archive confirmation | Completed evidence compacts into history/plan links |
| `CURRENT_STATUS.md` | Current phase, a small set of priorities, current blockers, a few linked wins, current risks, stale-doc summary | No dated implementation journal or commit ledger |
| `roadmap/milestones/` | Phase goal, priorities, major steps, exit criteria, deferred scope | No per-task implementation journal or commit ledger |
| `features/` | Current user-facing capability scope and curated links | No copied system implementation sections |
| `system/` | Current technical behavior and architecture | Feature pages point here rather than replacing it |

`CURRENT_STATUS.md` uses only `Current Phase`, `Top Priorities`, `Blocked`, `Recent Wins`, `Major Risks`, `Stale Docs`, optional `Relevant Decisions`, optional `Relevant Features`, and `Navigation`. Milestones retain the D-015 required sections and inline evidence links from D-016. Size growth beyond the recommended snapshot/strategy budgets is a review warning; unknown implementation sections and duplicated live content are hard shape failures.

### Semantic close-out events

Routine plan, feature, decision, or issue edits do not automatically prove that top-level priorities changed. Agents review status and milestone relevance, but touch them only when the corresponding semantic event occurs. `check-pm-closeout.mjs` provides explicit declarations:

- `--priority-change`: phase, top priorities, or current blockers changed; require a current-status update.
- `--milestone-change`: milestone scope, priorities, major steps, or exit criteria changed; require an active/linked milestone update.

Without those flags, close-out requires affected current-state documentation and history but does not force timestamp-only status/milestone edits. Human review remains responsible for semantic truth.

### Planning lifecycle

Open planning states are `proposed`, `active`, `verifying`, `blocked`, and `deferred`; all retain mirror traceability. Terminal states remain `shipped`, `rejected`, and `superseded`. `verifying` means implementation exists but acceptance/release verification is incomplete; it does not mean shipped.

### Lane-aware review and evidence

- `history/`, `archive/`, terminal plans/decisions, and `roadmap/plans/assets/` evidence do not produce routine stale-review findings.
- Live roadmap/inbox notes default to 30-day review, docs/features/system to 60 days, and accepted/active decisions to 90 days; environment overrides remain available.
- Obsidian exact-path links resolve to existing files of any type. Heading checks remain Markdown-only.
- `roadmap/plans/assets/` is an evidence tree, not a hierarchy requiring folder-note indexes.

## Consequences

- D-015's milestone lane and required sections remain, but its broad freshness triggers are replaced; D-015 is superseded.
- D-018 mirror backlinks and D-027 narrow implementation-commit authority remain. Implementation references normally live in history and, when useful, the owning plan rather than every affected PM record.
- Existing folders with implementation journals will fail the new live-state shape validator until a separate human-approved cleanup; the skill does not bulk-rewrite their meaning.
- Existing evidence links require a resolver fix, not evidence relocation.

## Realization Notes

Implement a registered live-state shape validator, semantic close-out flags, expanded planning statuses, lane-aware stale detection, attachment resolution, evidence-tree exemptions, template/instruction updates, and focused regression tests. Dry-run against OpenManager and Schophia before proposing their cleanup.
