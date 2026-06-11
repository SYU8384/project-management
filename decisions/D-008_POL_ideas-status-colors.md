---
title: "D-008 Ideas status colors"
aliases: [D-008, Ideas status colors]
tags:
  - project-management
  - decision
  - POL
created: 2026-06-12
updated: 2026-06-12
last_reviewed: 2026-06-12
pageType: decision
decision_type: POL
status: accepted
date: 2026-06-12
supersedes: null
owner: PM
---
# D-008 — `ideas.md` uses colored status emojis (🟣/🟡/🔵/🟢/🔴)

## Status

`accepted` (effective 2026-06-12).

## Context

`ideas.md` has 5 statuses: Brainstorming, Scoping, Approved, Implemented, Declined. Pre-v1.4.1, the statuses were plain text in the Status Key table, the Idea Register, and the Idea Details sections. Visual differentiation was limited to a reader's familiarity with the terms.

The post-v1.4.1 audit surfaced an opportunity: a colored round icon for each status would give a visual signal at a glance. The user specified the color scheme:

| Status | Color |
|---|---|
| Brainstorming | purple |
| Scoping | yellow |
| Approved | blue |
| Implemented | green |
| Declined | red |

The cross-platform implementation uses the Unicode colored circle emojis (🟣/🟡/🔵/🟢/🔴) which render in any markdown viewer (Obsidian, GitHub, plain text editors with Unicode support). Plugin-specific alternatives (like the `iconize` plugin's `%% icon-name %%` syntax) are out of scope.

## Options Considered

- **A. No colors (status quo).** Status names are plain text. **Rejected**: the visual signal improves status recognition at a glance, especially in long Idea Register tables where the status column is the only differentiator between ideas.
- **B. Colored emojis (chosen).** Each status carries a colored round emoji in three places: the Status Key table, the Idea Register's Status column, and the Idea Details `**Status:**` line.
- **C. Color blocks via HTML/CSS.** Use `<span style="color:...">` for inline color. **Rejected**: not portable across markdown viewers; the colored emojis are simpler and equally effective.
- **D. Plugin-specific icons (e.g., `iconize` plugin's Lucide icon names).** Like `icon: "LiTrendingUp"` and `iconColor: "#16a34a"` from the OpenManager project. **Rejected**: requires a specific Obsidian plugin; breaks portability; the colored emojis are zero-dependency.

## Decision

Option B. The colored emoji scheme is adopted:

- 🟣 Brainstorming
- 🟡 Scoping
- 🔵 Approved
- 🟢 Implemented
- 🔴 Declined

The emojis appear in three places:

1. The `## Status Key` table (each row's Status cell carries the emoji prefix).
2. The `## Idea Register` table (the Status column for each idea carries the emoji).
3. The `## Idea Details` section's `**Status:** <status>` line (the emoji precedes the status name).

The section headers (`## Brainstorming` / `## Scoping` / etc.) and the per-idea wikilinks in those sections are plain text without emojis; only the Status Key, Register, and Details use the color.

The convention is documented in `templates/README.md` "Conventions by Page Type → Roadmap notes → Ideas" and in the new "Status color scheme" sub-section.

## Consequences

- **Positive**: a reader can identify an idea's status at a glance from the emoji, even in a long Idea Register.
- **Positive**: cross-platform — Unicode colored circle emojis render in any markdown viewer that supports Unicode (which is essentially all of them).
- **Positive**: zero-dependency — no plugin required, no HTML/CSS, no special syntax. The emojis are just text characters in the markdown source.
- **Positive**: the convention is small and additive. Existing PM folders can adopt it by editing the Status Key, the Idea Register's Status column, and the Idea Details lines.
- **Negative**: the convention is not enforced by the validator. The validator checks for the 5 status names but not for the emoji presence. A future validator could check that the Status column in the Idea Register has the emoji for the matching status; not yet built.
- **Negative**: the convention is scoped to `ideas.md` only. `mvp-priorities.md`, `known-issues.md`, and other roadmap files don't have the color scheme. The user didn't ask for it; future requests can extend the convention.

## Realization Notes

- The `templates/ideas.md` reference template and the `bootstrap-pm.mjs` inline content (which writes the skeleton to new PM folders) are updated to use the color scheme.
- A one-line "Status colors" lead note at the top of `ideas.md` documents the convention and points to D-008.
- The user's PM folder (the project-management skill itself) was the first to use the new scheme. The 7 ideas (IDEA-001 through IDEA-007) are color-coded.

## Related

- `templates/ideas.md` — the reference template
- `templates/README.md` "Conventions by Page Type → Roadmap notes → Ideas" and "Status color scheme" — the convention doc
- `decisions/D-007_POL_done-pending-format.md` — sibling decision for the `done-pending.md` format

## Navigation

- [[decisions/decisions|Back to decisions]]
- [[Project Management|Back to Project Management]]
