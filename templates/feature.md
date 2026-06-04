---
title: <Feature Name>
aliases: [<feature name>, <short alias>]
tags:
  - <project>
  - feature
  - <area>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
last_reviewed: <YYYY-MM-DD>
pageType: feature
status: alpha
owner: PM
roadmap_source: roadmap/done-pending.md
source_of_truth: system/<topic>.md
related:
  - planning/YYYY-MM-DD_slug
  - planning/decisions/ADR-NNN_slug
---
# <Feature Name>

> **Tell me everything about <feature>.** This is a curated index. Current behavior lives in `[[Projects/<Project>/system/<topic>|system/<topic>]]`. Architecture decisions are in `[[Projects/<Project>/planning/decisions|planning/decisions]]`. Pending work is in the Roadmap section below.

> **When to revisit this page:** a feature's current behavior changed (mirror from `system/`), its scope changed (capability added/removed/deprecated), its known issues shifted, or its roadmap status changed. The page is *not* a source of truth for behavior — `system/` is. The page is a curated "tell me about X" entry point. See the README "Quick Rules" for the full trigger list.

## Status

**<Status (alpha | beta | stable | deprecated)>.** <one-paragraph description of the feature's current state — what works, what's rough, what's missing>.

## Current Behavior

<one or two paragraphs of current behavior. Point to the system/ doc as the source of truth.>

**Key components / surfaces:**
- <component 1> — <brief description>
- <component 2> — <brief description>

Full current-behavior documentation: `[[Projects/<Project>/system/<topic>|system/<topic>]]`.

## Known Issues

- **<Issue 1>** — Tracked in `[[Projects/<Project>/roadmap/known-issues|known-issues]]` "<section name>".
- **<Issue 2>** — Tracked in `[[Projects/<Project>/roadmap/known-issues|known-issues]]` "<section name>".

## Roadmap

- **<Roadmap item 1>** — PENDING in `[[Projects/<Project>/roadmap/done-pending|done-pending]]` `## YYYY-MM-DD_slug`.
- **<Roadmap item 2>** — PENDING in `[[Projects/<Project>/roadmap/done-pending|done-pending]]` `## YYYY-MM-DD_slug`.

## Relevant ADRs

- `[[Projects/<Project>/planning/decisions/ADR-NNN_slug|ADR-NNN <title>]]`
- `[[Projects/<Project>/planning/decisions/ADR-NNN_slug|ADR-NNN <title>]]`

## Source of Truth

Current behavior: `[[Projects/<Project>/system/<topic>|system/<topic>]]`

## Navigation

- [[Projects/<Project>/features/features|Back to features index]]
- [[Projects/<Project>/<Project>|Back to <Project>]]
- [[Projects/Projects|Back to Projects]]
- [[Home|Back to Home]]
