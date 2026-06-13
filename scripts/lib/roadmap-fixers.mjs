/**
 * lib/roadmap-fixers.mjs
 *
 * Auto-fixer functions for the four content-level roadmap conventions
 * (D-007 / D-008 / D-009 / D-010). Imported by both the
 * `check-roadmap-conventions.mjs` validator (for `--fix` mode) and the
 * `1.7.0-roadmap-content-conventions.mjs` migration (for `apply()`).
 *
 * Design: each fixer is a pure function that takes the file content (and
 * any needed context) and returns `{ updated, changes, manualReview }`.
 * The caller is responsible for writing `updated` to disk and reporting
 * `changes` to the user. No I/O happens inside the fixers themselves.
 *
 * All fixers are idempotent: re-running on a conformant file returns
 * `updated === content` and `changes === []`. The migration relies on
 * this property to be safe to re-apply.
 */

const STATUS_EMOJI = Object.freeze({
  Brainstorming: "🟣",
  Scoping: "🟡",
  Approved: "🔵",
  Implemented: "🟢",
  Declined: "🔴",
});

const STATUS_NAMES = Object.freeze(Object.keys(STATUS_EMOJI));

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * D-008: insert the canonical status emoji in three places inside
 * `roadmap/ideas.md`:
 *   1. The `## Status Key` table (Status column rows).
 *   2. The `## Idea Register` table (Status column rows).
 *   3. The `## Idea Details` `**Status:** <name>` lines.
 *
 * Idempotent: a status name that already has the emoji prefix is left
 * alone. Unknown status names are left alone (caller surfaces a finding
 * via `manualReview`).
 */
export function insertStatusEmojisInIdeas(content) {
  const changes = [];
  const manualReview = [];
  let updated = content;

  // 1) Status Key table: rows look like `| Brainstorming | Rough idea, ... |`
  //    Match the row start, prepend the emoji if missing.
  for (const name of STATUS_NAMES) {
    const emoji = STATUS_EMOJI[name];
    const re = new RegExp(`^(\\|\\s*)${escapeRegExp(name)}(\\s*\\|)`, "gm");
    updated = updated.replace(re, (match, before, after) => {
      if (before.includes(emoji)) return match;
      changes.push(`status-key row "${name}" -> ${emoji} ${name}`);
      return `${before}${emoji} ${name}${after}`;
    });
  }

  // 2) Idea Register table: a row like
  //    `| IDEA-001 | ... | Brainstorming | ... |`
  //    The Status column is whichever cell contains a plain status name
  //    (no emoji). Match conservatively: only touch rows that have
  //    exactly one plain status token in a cell.
  const lines = updated.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trimStart().startsWith("|")) continue;
    if (line.includes("|---") || line.includes("|:--")) continue;
    if (line.includes("**Status:**")) continue;
    const cells = line.split("|");
    let touched = false;
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c].trim();
      if (STATUS_NAMES.includes(cell)) {
        const emoji = STATUS_EMOJI[cell];
        cells[c] = cells[c].replace(cell, `${emoji} ${cell}`);
        changes.push(`register row line ${i + 1}: ${cell} -> ${emoji} ${cell}`);
        touched = true;
      } else if (Object.values(STATUS_EMOJI).some((e) => cell.startsWith(`${e} `)) && STATUS_NAMES.some((n) => cell === `${STATUS_EMOJI[n]} ${n}`)) {
        // already conformant; skip
      }
    }
    if (touched) lines[i] = cells.join("|");
  }
  updated = lines.join("\n");

  // 3) Idea Details `**Status:** <name>` lines.
  for (const name of STATUS_NAMES) {
    const emoji = STATUS_EMOJI[name];
    const re = new RegExp(`(\\*\\*Status:\\*\\*\\s*)${escapeRegExp(name)}\\b`, "g");
    updated = updated.replace(re, (match, before) => {
      if (before.includes(emoji)) return match;
      changes.push(`idea details "**Status:** ${name}" -> **Status:** ${emoji} ${name}`);
      return `${before}${emoji} ${name}`;
    });
  }

  return { updated, changes, manualReview };
}

/**
 * D-009: drop the `## Fixed` section from `roadmap/known-issues.md` if it
 * contains no items (no `- [x]` or `- [ ]` lines under the heading).
 * If the section HAS items, the fixer leaves it alone and reports a
 * `manualReview` finding (the migration's user needs to migrate items
 * to `docs/Developer Guide/known-bugs.md` or delete them by hand).
 *
 * Also removes the `## Contents` TOC link to `## Fixed` if present.
 */
export function dropEmptyFixedSection(content) {
  const changes = [];
  const manualReview = [];
  let updated = content;

  const fixedH2Re = /^## Fixed\s*$/m;
  const m = updated.match(fixedH2Re);
  if (!m) {
    return { updated, changes, manualReview };
  }
  const start = m.index + m[0].length;
  const rest = updated.slice(start);
  const nextH2 = rest.match(/\n## (?!#)/);
  const sectionEnd = nextH2 ? start + nextH2.index : updated.length;
  const body = updated.slice(start, sectionEnd);

  const hasItems = /^\s*-\s*\[[ x]\]/m.test(body);
  if (hasItems) {
    manualReview.push(
      "`## Fixed` section has items; auto-fixer skips it. Migrate items to `docs/Developer Guide/known-bugs.md` (D-009 lifecycle) or delete them, then re-run."
    );
    return { updated, changes, manualReview };
  }

  // Drop the H2 heading + body. Collapse the surrounding blank lines
  // (the section is preceded by a `\n\n` to separate it from the prior
  // section, and followed by `\n\n` to separate from the next section;
  // after removal we want exactly `\n\n` between the prior and next
  // section headings).
  const before = updated.slice(0, m.index).replace(/\n+$/, "\n");
  const after = updated.slice(sectionEnd).replace(/^\n+/, "\n");
  updated = before + "\n" + after;
  changes.push("dropped empty `## Fixed` section");

  // Update the `## Contents` TOC: remove the `[[#Fixed]]` line.
  const tocRe = /^- \[\[#Fixed\]\]\s*$/m;
  if (tocRe.test(updated)) {
    updated = updated.replace(tocRe, "");
    changes.push("removed `[[#Fixed]]` from Contents TOC");
  }

  return { updated, changes, manualReview };
}

/**
 * D-009 (additional): the `## Active` section in `roadmap/known-issues.md`
 * SHOULD have `### <Domain>` H3 subsections when it has multiple items.
 * The fixer cannot pick the right domain names (they're project-specific),
 * so it only DETECTS the violation. The validator surfaces it as a
 * `manualReview` finding.
 */
export function checkDomainGroupingInActive(content) {
  const manualReview = [];
  const h2 = content.match(/^## Active\s*$/m);
  if (!h2) return { manualReview };
  const start = h2.index + h2[0].length;
  const rest = content.slice(start);
  const nextH2 = rest.match(/\n## (?!#)/);
  const sectionEnd = nextH2 ? start + nextH2.index : content.length;
  const body = content.slice(start, sectionEnd);

  const itemRe = /^\s*-\s*\[[ x]\]/gm;
  const items = body.match(itemRe) ?? [];
  const hasDomainH3 = /^###\s+\S+/m.test(body);

  if (items.length >= 2 && !hasDomainH3) {
    manualReview.push(
      `\`## Active\` has ${items.length} items but no \`### <Domain>\` H3 subsections. Group items under project-specific domain names (e.g. \`### Migrations\`, \`### Validators\`, \`### Connectors\`). The auto-fixer cannot pick the right names.`
    );
  }
  return { manualReview };
}

/**
 * D-010: the `## MVP Priorities` section in `roadmap/mvp-priorities.md`
 * SHOULD have `### <Lane>` H3 subsections when it has items. Like
 * domain grouping, lane names are project-specific; the fixer only
 * DETECTS the violation.
 */
export function checkLaneGroupingInMvpPriorities(content) {
  const manualReview = [];
  const h2 = content.match(/^## MVP Priorities\s*$/m);
  if (!h2) return { manualReview };
  const start = h2.index + h2[0].length;
  const rest = content.slice(start);
  const nextH2 = rest.match(/\n## (?!#)/);
  const sectionEnd = nextH2 ? start + nextH2.index : content.length;
  const body = content.slice(start, sectionEnd);

  const itemRe = /^\s*-\s*\[[ x]\]/gm;
  const items = body.match(itemRe) ?? [];
  const hasLaneH3 = /^###\s+\S+/m.test(body);

  if (items.length >= 1 && !hasLaneH3) {
    manualReview.push(
      `\`## MVP Priorities\` has ${items.length} item(s) but no \`### <Lane>\` H3 subsections. Group items under project-specific lane names. The auto-fixer cannot pick the right names.`
    );
  }
  return { manualReview };
}

/**
 * D-007: rename date-prefixed H2s in `roadmap/done-pending.md` to
 * slug-only H2s. E.g. `## 2026-05-22_tier-system` -> `## tier-system`.
 *
 * Also updates the `## Contents` TOC: replaces the date-prefixed entry
 * with the slug-only form. The `Planning note:` wikilink inside each
 * mirror section is NOT touched (the link target stays date-prefixed
 * because the planning-note filename is date-prefixed).
 */
export function renameDatePrefixedH2s(content) {
  const changes = [];
  const manualReview = [];
  let updated = content;

  const dateRe = /^## (\d{4}-\d{2}-\d{2}_(.+?))\s*$/gm;
  updated = updated.replace(dateRe, (match, fullSlug, slug) => {
    if (slug === fullSlug) return match;
    // The convention in OpenManager is hyphen-separated slugs
    // (e.g. `## openclaw-inspired-agent-memory`), so convert any
    // underscores in the slug part to hyphens to match.
    const slugHyphen = slug.replace(/_/g, "-");
    changes.push(`H2: \`## ${fullSlug}\` -> \`## ${slugHyphen}\``);
    return `## ${slugHyphen}`;
  });

  // Update the Contents TOC if it references the old slug.
  if (changes.length > 0) {
    const tocRe = /^- \[\[#(\d{4}-\d{2}-\d{2}_([^\]]+))\]\]\s*$/gm;
    updated = updated.replace(tocRe, (match, _fullSlug, slug) => `- [[#${slug.replace(/_/g, "-")}}]]`);
  }

  return { updated, changes, manualReview };
}

/**
 * D-008 lead note: insert the "Status colors" lead note after the
 * `## Contents` TOC if missing. The note is a single paragraph that
 * documents the convention. The text matches the canonical phrasing
 * used in `templates/ideas.md` and the Project Management PM folder.
 */
export function insertIdeasStatusColorsLeadNote(content) {
  const changes = [];
  const manualReview = [];
  let updated = content;

  const LEAD_NOTE = "**Status colors:** 🟣 Brainstorming · 🟡 Scoping · 🔵 Approved · 🟢 Implemented · 🔴 Declined. The colors appear in the Status Key, the Idea Register, and the Idea Details sections. (Convention adopted in `decisions/D-008_POL_ideas-status-colors.md`.)";

  if (updated.includes("Status colors:") && updated.includes("🟣 Brainstorming")) {
    return { updated, changes, manualReview };
  }

  // Find the `## Contents` TOC's end marker and insert the lead note
  // after it. If the marker is missing, fall back to inserting after
  // the H1 heading.
  const tocEnd = /<!--\s*vault-maintain:toc:end\s*-->/;
  if (tocEnd.test(updated)) {
    updated = updated.replace(tocEnd, (m) => `${m}\n\n${LEAD_NOTE}`);
    changes.push("inserted Status colors lead note after Contents TOC");
  } else {
    const h1 = updated.match(/^# .+\n/);
    if (h1) {
      const idx = h1.index + h1[0].length;
      updated = updated.slice(0, idx) + `\n${LEAD_NOTE}\n` + updated.slice(idx);
      changes.push("inserted Status colors lead note after H1 (no TOC end marker found)");
    } else {
      manualReview.push("could not locate insertion point for Status colors lead note (no H1, no TOC end marker)");
    }
  }

  return { updated, changes, manualReview };
}

export const __test = { STATUS_EMOJI, STATUS_NAMES };
