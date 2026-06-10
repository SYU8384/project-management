---
title: D-NNN <short title>
aliases: [D-NNN, <short title>]
tags:
  - <project>
  - decision
  - <decision_type>
  - <area>
created: <YYYY-MM-DD>
decision_date: <YYYY-MM-DD>
supersedes: <D-id>     # omit (or set to null) if this decision does not supersede another
updated: <YYYY-MM-DD>
last_reviewed: <YYYY-MM-DD>
pageType: decision
decision_type: <ADR | PRD | MKT | VND | POL | NEG | EXP>
status: proposed
owner: PM
---
# D-NNN: <short title>

> **Decision type:** `<decision_type>`. See `SKILL.md` "PM-folder rules" for the type legend. ADRs are an `ADR` instance, not a separate artifact class.

## Status

**Proposed** | **Accepted** | **Active** (accepted and being rolled out) | **Superseded by D-MMM** (<YYYY-MM-DD>) | **Deprecated** (<YYYY-MM-DD>).
When this decision supersedes another, set `supersedes: <D-id>` in this file's frontmatter and move the prior decision's `status` to `superseded` with the date recorded here. `active` is allowed but should be temporary — a decision lingering in `active` past the underlying work is a smell; either it's `accepted` or it should be re-evaluated.

## Context

Why this decision came up. What forces are at play. What constraints exist. The reader should be able to understand the problem without prior knowledge of the project.

## Options Considered

- **Option A.** <description, key tradeoffs, why it was considered>
- **Option B.** <description, key tradeoffs, why it was considered>
- **Option C (chosen).** <description, key tradeoffs, why it was considered>
- **Option D (rejected).** <description, key tradeoffs, why it was rejected>

`NEG` relaxation: a rejection decision may collapse this section into *Decision* ("**Decision: not X.** Alternatives considered: A, B; both rejected because…") rather than a full sub-list.

## Decision

<One-sentence statement of the decision. Repeat the choice for emphasis.>

## Consequences

**Positive:**
- <Benefit 1>
- <Benefit 2>

**Negative / risks:**
- <Risk 1> — <mitigation>
- <Risk 2> — <mitigation>

## Realization Notes

<Where the decision shows up in practice. Code paths, config keys, deployed services, market artifacts, policy docs, vendor contracts. The reader should be able to trace the decision to where it lives.>

## Related

- `[[Projects/<Project>/roadmap/plans/YYYY-MM-DD_slug|YYYY-MM-DD_slug]]` — the planning note that contains the full design (or "—")
- `[[Projects/<Project>/system/<topic>|system/<topic>]]` — the current-behavior doc that reflects the decision (or "—")
- `[[Projects/<Project>/features/<feature>|features/<feature>]]` — the feature page that summarizes the decision (or "—")
- `[[Projects/<Project>/decisions/D-NNN|D-NNN]]` — related decision (or "—")

## Navigation

- [[Projects/<Project>/decisions/decisions|Back to decisions index]]
- [[Projects/<Project>/<Project>|Back to <Project>]]
- [[Projects/Projects|Back to Projects]]
- [[Home|Back to Home]]
