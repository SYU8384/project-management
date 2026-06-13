/**
 * lib/content-semantic-fixers.mjs
 *
 * Auto-fixer functions for the four content-semantic checks in
 * `scripts/check-content-semantics.mjs` (v1.8.0):
 *
 *   A. D-009 `## Active` introduce a `### Pending Triage` H3 placeholder
 *      when there are >= 2 items but no `### <Domain>` grouping.
 *   A. D-010 `## MVP Priorities` introduce a `### All Priorities` H3
 *      placeholder when there are items but no `### <Lane>` grouping.
 *   B. Strip brackets from `[[X]]` (or `[[X|Display]]`) wikilinks whose
 *      target is not in the vault's existing-file set. In `--fix-strict`
 *      mode the fixer is a no-op (caller surfaces MANUAL REVIEW).
 *   C. Plan `status:` frontmatter -> body-marker sync. Scan the first
 *      200 words of a planning-note body for `SUPERSEDED by ...`,
 *      `NOT YET APPROVED`, `WON'T DO`, `POSTPONED to ...`,
 *      `ARCHIVED as ...`. When a strong marker is found, update
 *      `status:` to match.
 *   D. `## Active` in `known-issues.md` theoretical-risk wording
 *      detection. Add a `**possibly theoretical risk — review for
 *      migration to ideas.md**` note after items that match risk
 *      markers (`possible`, `could`, `if X happens`, `potential`,
 *      `risk of`). Do not move the item.
 *
 * Imported by `scripts/check-content-semantics.mjs` (for `--fix` mode)
 * and `scripts/migrations/1.8.0-content-semantic-fixes.mjs` (for
 * `apply()`).
 *
 * All fixers are pure: input content in, output content out, plus a
 * `changes` array describing what was done. Idempotent: re-running on
 * a conformant file is a no-op.
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

/* ---------------------------------------------------------------------- */
/* Fixer A.1: D-009 `## Active` introduce a `### Pending Triage` placeholder. */
/* ---------------------------------------------------------------------- */

export function introduceActivePlaceholder(content) {
  const changes = [];
  const manualReview = [];
  const h2 = content.match(/^## Active\s*$/m);
  if (!h2) return { updated: content, changes, manualReview };
  const start = h2.index + h2[0].length;
  const rest = content.slice(start);
  const nextH2 = rest.match(/\n## (?!#)/);
  const sectionEnd = nextH2 ? start + nextH2.index : content.length;
  const body = content.slice(start, sectionEnd);

  // Only act when the section has >= 2 items and no H3.
  const items = body.match(/^\s*-\s*\[[ x]\]/gm) ?? [];
  const hasH3 = /^###\s+\S+/m.test(body);
  if (items.length < 2) {
    return { updated: content, changes, manualReview };
  }
  if (hasH3) {
    return { updated: content, changes, manualReview };
  }

  // Indent the items by 2 spaces and wrap them under `### Pending Triage`.
  const indented = body.replace(/^(\s*-)/gm, "  $1");
  const newBody = `\n\n### Pending Triage\n\n${indented.trimEnd()}\n`;
  const updated =
    content.slice(0, start) + newBody + content.slice(sectionEnd);
  changes.push(
    "introduced `### Pending Triage` H3 placeholder under `## Active` (rename to your project domain name)"
  );
  return { updated, changes, manualReview };
}

/* ---------------------------------------------------------------------- */
/* Fixer A.2: D-010 `## MVP Priorities` introduce a `### All Priorities` placeholder. */
/* ---------------------------------------------------------------------- */

export function introduceMvpPrioritiesPlaceholder(content) {
  const changes = [];
  const manualReview = [];
  const h2 = content.match(/^## MVP Priorities\s*$/m);
  if (!h2) return { updated: content, changes, manualReview };
  const start = h2.index + h2[0].length;
  const rest = content.slice(start);
  const nextH2 = rest.match(/\n## (?!#)/);
  const sectionEnd = nextH2 ? start + nextH2.index : content.length;
  const body = content.slice(start, sectionEnd);

  const items = body.match(/^\s*-\s*\[[ x]\]/gm) ?? [];
  const hasH3 = /^###\s+\S+/m.test(body);
  if (items.length < 1) {
    return { updated: content, changes, manualReview };
  }
  if (hasH3) {
    return { updated: content, changes, manualReview };
  }

  const indented = body.replace(/^(\s*-)/gm, "  $1");
  const newBody = `\n\n### All Priorities\n\n${indented.trimEnd()}\n`;
  const updated =
    content.slice(0, start) + newBody + content.slice(sectionEnd);
  changes.push(
    "introduced `### All Priorities` H3 placeholder under `## MVP Priorities` (rename to your project lane names)"
  );
  return { updated, changes, manualReview };
}

/* ---------------------------------------------------------------------- */
/* Fixer B: strip dead wikilinks. */
/* ---------------------------------------------------------------------- */

/**
 * Strip the brackets from any `[[X]]` or `[[X|Display]]` whose target is
 * not in `vaultTargets` (a Set of file stems relative to the PM folder).
 *
 *   `[[foo]]`       -> `foo`        (target not in vaultTargets)
 *   `[[foo|Kei]]`   -> `Kei`        (target not in vaultTargets, display wins)
 *   `[[foo]]`       -> `[[foo]]`    (target IS in vaultTargets; no-op)
 *
 * In strict mode (`strict=true`) this is a no-op. The caller surfaces
 * MANUAL REVIEW instead.
 */
export function stripDeadWikiLinks(content, vaultTargets, strict = false) {
  const changes = [];
  const manualReview = [];
  if (strict) {
    return { updated: content, changes, manualReview };
  }
  const linkRe = /\[\[([^\]|#]+)(?:#[^\]|]+)?(\|[^\]]+)?\]\]/g;
  const updated = content.replace(linkRe, (match, target, display) => {
    const normalized = target.replace(/\.md$/, "").trim();
    if (vaultTargets.has(normalized)) {
      return match;
    }
    const replacement = display ? display.slice(1) : target;
    changes.push(`stripped dead wikilink \`${match}\` -> \`${replacement}\``);
    return replacement;
  });
  return { updated, changes, manualReview };
}

/* ---------------------------------------------------------------------- */
/* Fixer C: plan `status:` -> body-marker sync. */
/* ---------------------------------------------------------------------- */

const STATUS_MARKERS = [
  { re: /\bSUPERSEDED\s+by\b/i, status: "superseded", strength: "strong" },
  { re: /\bARCHIVED\s+as\b/i, status: "archived", strength: "strong" },
  { re: /\bPOSTPONED\s+to\b/i, status: "deferred", strength: "strong" },
  { re: /\bDEFERRED\s+to\b/i, status: "deferred", strength: "strong" },
  { re: /\bWON['’]T\s+DO\b/i, status: "declined", strength: "strong" },
  { re: /\bNOT\s+YET\s+APPROVED\b/i, status: "proposed", strength: "weak" },
];

const STRONG_STATUS = new Set(["superseded", "archived", "declined", "deferred"]);

/**
 * Scan the first 200 words of the planning-note body for status markers.
 * If a strong marker is found and the frontmatter `status:` does not
 * match, update it. Weak markers (e.g. "NOT YET APPROVED" with no
 * target reference) are left as MANUAL REVIEW for the user to decide.
 */
export function syncPlanStatusFromBodyMarker(content) {
  const changes = [];
  const manualReview = [];
  if (!/^---\n/.test(content)) {
    return { updated: content, changes, manualReview };
  }
  const fmEnd = content.indexOf("\n---\n", 4);
  if (fmEnd === -1) return { updated: content, changes, manualReview };

  const frontmatter = content.slice(0, fmEnd + 5);
  const body = content.slice(fmEnd + 5);

  const statusMatch = frontmatter.match(/^status:\s*(.+)$/m);
  const currentStatus = statusMatch ? statusMatch[1].trim() : null;

  // First 200 words of the body.
  const first200 = body.split(/\s+/).slice(0, 200).join(" ");

  let detectedMarker = null;
  for (const { re, status, strength } of STATUS_MARKERS) {
    if (re.test(first200)) {
      detectedMarker = { status, strength };
      break;
    }
  }

  if (!detectedMarker) {
    return { updated: content, changes, manualReview };
  }
  if (currentStatus === detectedMarker.status) {
    return { updated: content, changes, manualReview };
  }
  if (detectedMarker.strength === "weak") {
    manualReview.push(
      `weak marker matched in body (would set \`status: ${detectedMarker.status}\`); current is \`${currentStatus}\`. Update by hand or strengthen the marker.`
    );
    return { updated: content, changes, manualReview };
  }

  // Strong marker + mismatch: rewrite the frontmatter `status:` line.
  let updated;
  if (statusMatch) {
    updated = content.replace(
      /^status:\s*.+$/m,
      `status: ${detectedMarker.status}`
    );
  } else {
    updated = content.replace(
      /^---\n/,
      `---\nstatus: ${detectedMarker.status}\n`
    );
  }
  changes.push(
    `plan \`status:\` ${currentStatus ?? "(unset)"} -> ${detectedMarker.status} (body marker matched)`
  );
  return { updated, changes, manualReview };
}

/* ---------------------------------------------------------------------- */
/* Fixer D: flag theoretical-risk wording in known-issues `## Active`. */
/* ---------------------------------------------------------------------- */

const RISK_MARKERS = [
  /\bpossible\b/i,
  /\bcould\b/i,
  /\bif\s+\w+\s+happens\b/i,
  /\bpotential\b/i,
  /\brisk\s+of\b/i,
];

function hasRiskMarker(line) {
  return RISK_MARKERS.some((re) => re.test(line));
}

/**
 * For each item in `## Active` of known-issues.md, check for risk
 * markers. When found, add a note line after the item flagging it for
 * manual review (and possible migration to ideas.md). Idempotent.
 */
export function flagTheoreticalRiskWording(content) {
  const changes = [];
  const manualReview = [];
  const h2 = content.match(/^## Active\s*$/m);
  if (!h2) return { updated: content, changes, manualReview };
  const start = h2.index + h2[0].length;
  const rest = content.slice(start);
  const nextH2 = rest.match(/\n## (?!#)/);
  const sectionEnd = nextH2 ? start + nextH2.index : content.length;
  const body = content.slice(start, sectionEnd);

  const lines = body.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(\s*)-\s*(\[[ x]\])(\s*)(.*)$/);
    if (m && hasRiskMarker(line)) {
      const [, indent, check, sep, rest] = m;
      out.push(line);
      const noteIndent = indent + "  ";
      const note = `${noteIndent}**possibly theoretical risk — review for migration to ideas.md**`;
      // Check whether the next line is already this note.
      if (lines[i + 1]?.trim() === note.trim()) {
        // already there, skip
        out.push(lines[i + 1]);
        i += 1;
      } else {
        out.push(note);
        changes.push(`flagged item for risk-wording review: \`${line.trim()}\``);
      }
      continue;
    }
    out.push(line);
  }
  if (changes.length === 0) {
    return { updated: content, changes, manualReview };
  }
  const newBody = out.join("\n");
  const updated = content.slice(0, start) + newBody + content.slice(sectionEnd);
  return { updated, changes, manualReview };
}

export const __test = { STATUS_MARKERS, STRONG_STATUS, RISK_MARKERS };

/* ---------------------------------------------------------------------- */
/* Fixer E: ensure parent folder note has a wikilink to the child folder note. */
/* ---------------------------------------------------------------------- */

/**
 * For a parent folder note's content, ensure that the `## Subfolders`
 * section has a wikilink to the child folder note. The child is
 * referenced as `[[<childRel>|<basename>]]` (Obsidian anchor style).
 *
 * Idempotent: re-running on a parent that already has the wikilink is
 * a no-op.
 */
export function ensureParentLinksToChild(parentContent, childRel, opts = {}) {
  const changes = [];
  const manualReview = [];
  const childStem = childRel.replace(/\.md$/, "").replace(/^.*\//, "");
  const childLink = `[[${childRel.replace(/\.md$/, "")}|${childStem}]]`;
  const childTarget = childRel.replace(/\.md$/, "");

  const { pmFolder, vaultRoot } = opts;
  const childVaultRel =
    pmFolder && vaultRoot
      ? relative(vaultRoot, join(pmFolder, childRel)).replace(/\.md$/, "")
      : null;
  function matchesChild(target) {
    const t = target.replace(/\.md$/, "");
    if (t === childTarget) return true;
    if (childVaultRel && t === childVaultRel) return true;
    return false;
  }

  // If the child link (in any form) is already present, no-op.
  const allLinks = [...parentContent.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(\|[^\]]+)?\]\]/g)]
    .map((m) => m[1]);
  if (allLinks.some(matchesChild)) {
    return { updated: parentContent, changes, manualReview };
  }

  // Find the `## Subfolders` section.
  const subRe = /^## Subfolders\s*$/m;
  const m = parentContent.match(subRe);
  if (!m) {
    // No Subfolders section: insert one before `## Notes` (or end of file).
    const notesRe = /^## Notes\s*$/m;
    const notesMatch = parentContent.match(notesRe);
    if (notesMatch) {
      const idx = notesMatch.index;
      const updated = parentContent.slice(0, idx) +
        `## Subfolders\n\n- ${childLink}\n\n` +
        parentContent.slice(idx);
      changes.push(`added Subfolders section with link to \`${childRel}\``);
      return { updated, changes, manualReview };
    }
    const updated = parentContent.trimEnd() + `\n\n## Subfolders\n\n- ${childLink}\n`;
    changes.push(`appended Subfolders section with link to \`${childRel}\``);
    return { updated, changes, manualReview };
  }

  // Subfolders section exists. Find the section's body.
  const start = m.index + m[0].length;
  const rest = parentContent.slice(start);
  const nextH2 = rest.match(/\n## (?!#)/);
  const sectionEnd = nextH2 ? start + nextH2.index : parentContent.length;
  const body = parentContent.slice(start, sectionEnd);

  // If a plain-text line `- <basename>` already exists, REPLACE it with
  // the proper wikilink. This is the cleanup path for archives / old
  // bootstraps that wrote plain text instead of wikilinks.
  const plainLineRe = new RegExp(`^(\\s*)-\\s+${childStem}\\s*$`, "gm");
  if (plainLineRe.test(body)) {
    const newBody = body.replace(plainLineRe, `$1- ${childLink}`);
    const updated = parentContent.slice(0, start) + newBody + parentContent.slice(sectionEnd);
    changes.push(`replaced plain-text subfolder line for \`${childStem}\` with wikilink to \`${childRel}\``);
    return { updated, changes, manualReview };
  }

  // Find the last list item in the section, append after it.
  const lines = body.split("\n");
  let lastItemIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\s*-\s/.test(lines[i])) {
      lastItemIdx = i;
      break;
    }
  }
  if (lastItemIdx === -1) {
    const newBody = `\n- ${childLink}\n` + body.replace(/^\n+/, "\n");
    const updated = parentContent.slice(0, start) + newBody + parentContent.slice(sectionEnd);
    changes.push(`added subfolder link to \`${childRel}\` (section was empty)`);
    return { updated, changes, manualReview };
  }

  const before = lines.slice(0, lastItemIdx + 1).join("\n");
  const after = lines.slice(lastItemIdx + 1).join("\n");
  const newBody = `${before}\n- ${childLink}${after}`;
  const updated = parentContent.slice(0, start) + newBody + parentContent.slice(sectionEnd);
  changes.push(`appended subfolder link to \`${childRel}\``);
  return { updated, changes, manualReview };
}
