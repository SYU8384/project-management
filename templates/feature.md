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
roadmap_source: "[[<ProjectPath>/roadmap/done-pending|done-pending]]"
source_of_truth: "[[<ProjectPath>/system/<topic>|system/<topic>]]"
related:
  - "[[<ProjectPath>/roadmap/plans/YYYY-MM-DD_slug|YYYY-MM-DD_slug]]"
  - "[[<ProjectPath>/decisions/D-NNN_<type>_slug|D-NNN <title>]]"
---
# <Feature Name>

> **Tell me everything about <feature>.** This is a curated index. Current behavior lives in `[[<ProjectPath>/system/<topic>|system/<topic>]]`. Decisions are in `[[<ProjectPath>/decisions|decisions]]`. Pending work is in the Roadmap section below.

> **When to revisit this page:** a feature's current behavior changed (mirror from `system/`), its scope changed (capability added/removed/deprecated), its known issues shifted, or its roadmap status changed. The page is *not* a source of truth for behavior — `system/` is. The page is a curated "tell me about X" entry point. See the README "Quick Rules" for the full trigger list.

<!-- Replace every source_of_truth, roadmap_source, related, and body reference with a link to an existing note. Do not leave stale paths or retired lane names. -->

## Status

**<Status (alpha | beta | stable | deprecated)>.** <one-paragraph description of the feature's current state — what works, what's rough, what's missing>.

## Current Behavior

<one or two paragraphs of current behavior. Point to the system/ doc as the source of truth.>

**Key components / surfaces:**
- <component 1> — <brief description>
- <component 2> — <brief description>

Full current-behavior documentation: `[[<ProjectPath>/system/<topic>|system/<topic>]]`.

## Known Issues

- **<Issue 1>** — Tracked in `[[<ProjectPath>/roadmap/known-issues|known-issues]]` "<section name>".
- **<Issue 2>** — Tracked in `[[<ProjectPath>/roadmap/known-issues|known-issues]]` "<section name>".

## Roadmap

- **<Roadmap item 1>** — PENDING in `[[<ProjectPath>/roadmap/done-pending|done-pending]]` `## <slug>`.
- **<Roadmap item 2>** — PENDING in `[[<ProjectPath>/roadmap/done-pending|done-pending]]` `## <slug>`.

## Relevant Decisions

- `[[<ProjectPath>/decisions/D-NNN_<type>_slug|D-NNN <title>]]`
- `[[<ProjectPath>/decisions/D-NNN_<type>_slug|D-NNN <title>]]`

## Source of Truth

Current behavior: `[[<ProjectPath>/system/<topic>|system/<topic>]]`

## Navigation

- [[<ProjectPath>/features/features|Back to features index]]
- [[<ProjectPath>/<Project>|Back to <Project>]]
- [[Projects/Projects|Back to Projects]]
- [[Home|Back to Home]]
