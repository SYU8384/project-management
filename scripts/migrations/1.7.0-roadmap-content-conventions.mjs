/**
 * migrations/1.7.0-roadmap-content-conventions.mjs
 *
 * Bring existing PM folders up to the four content-level roadmap
 * conventions (D-007 / D-008 / D-009 / D-010) that the new
 * `check-roadmap-conventions.mjs` validator enforces.
 *
 * The deterministic fixes (D-008 status-color emoji insertion, D-009
 * empty-`## Fixed` removal, D-007 slug-only H2 rename) are applied
 * directly by the auto-fixers in `scripts/lib/roadmap-fixers.mjs`.
 * Lane names (D-010) and domain names (D-009 active-section grouping)
 * are project-specific and cannot be picked by the auto-fixer; those
 * findings surface in the `manualReview` return value so the maintainer
 * can triage them.
 *
 * Idempotent: re-running on a conformant PM folder is a no-op (the
 * fixers return `updated === content` when nothing changes).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  insertIdeasStatusColorsLeadNote,
  insertStatusEmojisInIdeas,
  dropEmptyFixedSection,
  checkDomainGroupingInActive,
  checkLaneGroupingInMvpPriorities,
  renameDatePrefixedH2s,
} from "../lib/roadmap-fixers.mjs";

function readIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function applyFixer(pmFolder, relPath, fixer) {
  const abs = join(pmFolder, relPath);
  const original = readIfExists(abs);
  if (original === null) {
    return { changed: false, manualReview: [], log: `${relPath}: not present, skipped` };
  }
  const result = fixer(original);
  if (result.updated === original) {
    return { changed: false, manualReview: result.manualReview ?? [], log: null };
  }
  if (!ctx.dryRun) {
    writeFileSync(abs, result.updated);
  }
  return {
    changed: true,
    manualReview: result.manualReview ?? [],
    log: `${relPath}: ${result.changes.length} change(s) applied`,
  };
}

let ctx;

function detect({ pmFolder }) {
  const ideas = readIfExists(join(pmFolder, "roadmap/ideas.md"));
  const known = readIfExists(join(pmFolder, "roadmap/known-issues.md"));
  const mvp = readIfExists(join(pmFolder, "roadmap/mvp-priorities.md"));
  const dp = readIfExists(join(pmFolder, "roadmap/done-pending.md"));

  // D-008: any of the 3 places in ideas.md missing a status emoji
  const ideasNeedsEmojis = ideas !== null && (() => {
    const lead = insertIdeasStatusColorsLeadNote(ideas);
    const withLead = lead.updated;
    const emoji = insertStatusEmojisInIdeas(withLead);
    return emoji.changes.length > 0 || lead.changes.length > 0;
  })();

  // D-009: `## Fixed` section present (with or without items)
  const knownNeedsFixed = known !== null && /^## Fixed\s*$/m.test(known);

  // D-007: any date-prefixed H2 in done-pending.md
  const dpNeedsRename = dp !== null && /^## \d{4}-\d{2}-\d{2}_/m.test(dp);

  // D-009: active section domain grouping missing
  const knownNeedsDomain = known !== null && checkDomainGroupingInActive(known).manualReview.length > 0;

  // D-010: mvp-priorities lane grouping missing
  const mvpNeedsLane = mvp !== null && checkLaneGroupingInMvpPriorities(mvp).manualReview.length > 0;

  return ideasNeedsEmojis || knownNeedsFixed || dpNeedsRename || knownNeedsDomain || mvpNeedsLane;
}

function plan({ pmFolder }) {
  const lines = [
    `Apply the four content-level roadmap conventions (D-007 / D-008 / D-009 / D-010) to this PM folder.`,
    `Auto-fixed: D-008 status-color emojis in \`roadmap/ideas.md\`, D-009 empty \`## Fixed\` removal in \`roadmap/known-issues.md\`, D-007 slug-only H2 rename in \`roadmap/done-pending.md\`.`,
    `Manual review: D-009 \`### <Domain>\` H3 grouping in \`## Active\`, D-010 \`### <Lane>\` H3 grouping in \`## MVP Priorities\` (lane/domain names are project-specific).`,
  ];
  return lines;
}

function apply({ pmFolder, ctx: c }) {
  ctx = c;
  const allManualReview = [];
  const log = [];

  // D-008: ideas.md lead note + emojis
  const lead = applyFixer(pmFolder, "roadmap/ideas.md", (content) => insertIdeasStatusColorsLeadNote(content));
  if (lead.log) log.push(lead.log);
  if (lead.changed) {
    const emoji = applyFixer(pmFolder, "roadmap/ideas.md", (content) => insertStatusEmojisInIdeas(content));
    if (emoji.log) log.push(emoji.log);
  }
  for (const r of lead.manualReview) allManualReview.push(`roadmap/ideas.md: ${r}`);

  // D-009: known-issues.md
  const drop = applyFixer(pmFolder, "roadmap/known-issues.md", (content) => dropEmptyFixedSection(content));
  if (drop.log) log.push(drop.log);
  for (const r of drop.manualReview) allManualReview.push(`roadmap/known-issues.md: ${r}`);

  // Re-read for the manual-review checks (they're checks, not fixes)
  const knownAfter = readIfExists(join(pmFolder, "roadmap/known-issues.md"));
  if (knownAfter !== null) {
    const domain = checkDomainGroupingInActive(knownAfter);
    for (const r of domain.manualReview) allManualReview.push(`roadmap/known-issues.md: ${r}`);
  }

  // D-010: mvp-priorities.md (manual only)
  const mvpContent = readIfExists(join(pmFolder, "roadmap/mvp-priorities.md"));
  if (mvpContent !== null) {
    const lane = checkLaneGroupingInMvpPriorities(mvpContent);
    for (const r of lane.manualReview) allManualReview.push(`roadmap/mvp-priorities.md: ${r}`);
  }

  // D-007: done-pending.md slug-only H2
  const rename = applyFixer(pmFolder, "roadmap/done-pending.md", (content) => renameDatePrefixedH2s(content));
  if (rename.log) log.push(rename.log);
  for (const r of rename.manualReview) allManualReview.push(`roadmap/done-pending.md: ${r}`);

  for (const l of log) c.log(l.startsWith("wrote:") ? "wrote" : "info", l);

  if (allManualReview.length > 0) {
    c.log("manual-review", `${allManualReview.length} item(s) need human judgment (lane/domain names)`);
  } else {
    c.log("done", "all auto-fixable conventions applied");
  }

  return {
    suggestedHistory: [
      `- **Roadmap notes now follow the D-007/D-008/D-009/D-010 scan conventions.** chore(pm): apply migration \`1.7.0-roadmap-content-conventions\`. Auto-fixed: ${log.length} file(s). Manual review: ${allManualReview.length} item(s).`,
    ],
    manualReview: allManualReview,
  };
}

export default {
  id: "1.7.0-roadmap-content-conventions",
  from: "<1.7.0",
  to: "1.7.0",
  describe:
    "Apply the four content-level roadmap conventions (D-007 / D-008 / D-009 / D-010) to existing PM folders. Auto-fixes: D-008 status-color emoji insertion in `roadmap/ideas.md`, D-009 empty `## Fixed` section removal in `roadmap/known-issues.md`, D-007 slug-only H2 rename in `roadmap/done-pending.md`. Manual review: D-009 `### <Domain>` H3 grouping in `## Active`, D-010 `### <Lane>` H3 grouping in `## MVP Priorities` (lane/domain names are project-specific and cannot be auto-picked). Idempotent.",
  detect,
  plan,
  apply,
};
