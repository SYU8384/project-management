/**
 * migrations/1.8.0-content-semantic-fixes.mjs
 *
 * Apply the four content-semantic auto-fixers to existing PM folders:
 *   A. Introduce `### Pending Triage` H3 in `## Active` and
 *      `### All Priorities` H3 in `## MVP Priorities` when the section
 *      has items but no `### <Domain>` / `### <Lane>` grouping.
 *   B. Strip dead wikilinks (brackets) — only in non-strict mode.
 *   C. Plan `status:` body-marker sync — only for strong markers
 *      (SUPERSEDED by / ARCHIVED as / POSTPONED to / DEFERRED to /
 *      WON'T DO). Weak markers (NOT YET APPROVED) surface as
 *      MANUAL REVIEW.
 *   D. Add a `**possibly theoretical risk — review for migration to
 *      ideas.md**` note after items in `## Active` of known-issues.md
 *      that match risk markers.
 *
 * Idempotent: re-running on a conformant PM folder is a no-op.
 */
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import {
  introduceActivePlaceholder,
  introduceMvpPrioritiesPlaceholder,
  stripDeadWikiLinks,
  syncPlanStatusFromBodyMarker,
  flagTheoreticalRiskWording,
  ensureParentLinksToChild,
} from "../lib/content-semantic-fixers.mjs";
import { findVaultRoot } from "../lib/paths.mjs";

let ctx;

function readIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function applyFileFix(pmFolder, relPath, fixer) {
  const abs = join(pmFolder, relPath);
  const original = readIfExists(abs);
  if (original === null) return { changed: false, manualReview: [] };
  const result = fixer(original);
  if (result.updated === original) {
    return { changed: false, manualReview: result.manualReview ?? [] };
  }
  if (!ctx.dryRun) writeFileSync(abs, result.updated);
  return {
    changed: true,
    manualReview: result.manualReview ?? [],
    log: `${relPath}: ${result.changes.length} change(s)`,
  };
}

function walkAllMd(root) {
  const out = [];
  function rec(abs) {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const child = join(abs, entry.name);
      if (entry.isDirectory()) rec(child);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push({ abs: child, rel: child.slice(root.length + 1).split("\\").join("/") });
      }
    }
  }
  rec(root);
  return out;
}

function fileTargetSet(pmFolder) {
  return new Set(walkAllMd(pmFolder).map((f) => f.rel.replace(/\.md$/, "")));
}

function detect({ pmFolder }) {
  const known = readIfExists(join(pmFolder, "roadmap/known-issues.md"));
  const mvp = readIfExists(join(pmFolder, "roadmap/mvp-priorities.md"));
  const files = walkAllMd(pmFolder);
  const vaultRoot = findVaultRoot(pmFolder);
  const vaultFiles = walkAllMd(vaultRoot);
  const targets = new Set();
  for (const f of vaultFiles) {
    targets.add(relative(vaultRoot, f.abs).split("\\").join("/").replace(/\.md$/, ""));
  }
  for (const f of files) {
    targets.add(f.rel.split("\\").join("/").replace(/\.md$/, ""));
  }

  // A.1 + D
  const a1 = known !== null && introduceActivePlaceholder(known).changes.length > 0;
  const d = known !== null && flagTheoreticalRiskWording(known).changes.length > 0;
  // A.2
  const a2 = mvp !== null && introduceMvpPrioritiesPlaceholder(mvp).changes.length > 0;
  // B
  const b = files.some(({ abs }) => {
    const content = readIfExists(abs);
    if (content === null) return false;
    return stripDeadWikiLinks(content, targets, false).changes.length > 0;
  });
  // C
  const c = files.some(({ abs, rel }) => {
    if (!rel.startsWith("roadmap/plans/") || rel === "roadmap/plans/plans.md" || !rel.endsWith(".md")) return false;
    const content = readIfExists(abs);
    if (content === null) return false;
    return syncPlanStatusFromBodyMarker(content).changes.length > 0;
  });
  // E: parent-link drift — child folder notes that are not linked from their parent folder note.
  const e = (() => {
    const folderNotes = files.filter(({ rel }) => {
      const stem = rel.replace(/\.md$/, "");
      const parts = stem.split("/");
      return parts[parts.length - 1] === parts[parts.length - 2];
    });
    for (const { rel: childRel } of folderNotes) {
      const parts = childRel.split("/");
      if (parts.length < 2) continue;
      const parentRel = parts.slice(0, -1).join("/") + ".md";
      const parentContent = readIfExists(join(pmFolder, parentRel));
      if (parentContent === null) continue;
      const result = ensureParentLinksToChild(parentContent, childRel, { pmFolder, vaultRoot });
      if (result.changes.length > 0) return true;
    }
    return false;
  })();

  return a1 || a2 || b || c || d || e;
}

function plan({ pmFolder }) {
  return [
    `Apply the four content-semantic auto-fixers (A/B/C/D) to this PM folder.`,
    `Auto-fixed: A.1 introduce \`### Pending Triage\` H3 in \`## Active\` of \`roadmap/known-issues.md\` (D-009 grouping placeholder); A.2 introduce \`### All Priorities\` H3 in \`## MVP Priorities\` of \`roadmap/mvp-priorities.md\` (D-010 grouping placeholder); B strip dead wikilinks (preserves display text); C sync plan \`status:\` from strong body markers (SUPERSEDED by / ARCHIVED as / POSTPONED to / DEFERRED to / WON'T DO); D add risk-wording note after \`## Active\` items that match theoretical-risk markers.`,
    `Manual review: lane/domain rename (placeholder stays until the user picks names), weak status markers (NOT YET APPROVED without a target reference).`,
  ];
}

function apply({ pmFolder, ctx: c }) {
  ctx = c;
  const allManualReview = [];
  const log = [];

  // A.1 + D (same file: known-issues.md; chain the fixers)
  const knownPath = join(pmFolder, "roadmap/known-issues.md");
  const known = readIfExists(knownPath);
  if (known !== null) {
    const a1 = applyFileFix(pmFolder, "roadmap/known-issues.md", introduceActivePlaceholder);
    if (a1.changed) log.push(a1.log);
    for (const r of a1.manualReview) allManualReview.push(`roadmap/known-issues.md: A ${r}`);

    const d = applyFileFix(pmFolder, "roadmap/known-issues.md", flagTheoreticalRiskWording);
    if (d.changed) log.push(d.log);
    for (const r of d.manualReview) allManualReview.push(`roadmap/known-issues.md: D ${r}`);
  }

  // A.2
  const a2 = applyFileFix(pmFolder, "roadmap/mvp-priorities.md", introduceMvpPrioritiesPlaceholder);
  if (a2.changed) log.push(a2.log);
  for (const r of a2.manualReview) allManualReview.push(`roadmap/mvp-priorities.md: A ${r}`);

  // B + C: walk all .md files
  const files = walkAllMd(pmFolder);
  const vaultRoot = findVaultRoot(pmFolder);
  const vaultFiles = walkAllMd(vaultRoot);
  const targets = new Set();
  for (const f of vaultFiles) {
    targets.add(relative(vaultRoot, f.abs).split("\\").join("/").replace(/\.md$/, ""));
  }
  for (const f of files) {
    targets.add(f.rel.split("\\").join("/").replace(/\.md$/, ""));
  }

  for (const { abs, rel } of files) {
    const original = readIfExists(abs);
    if (original === null) continue;
    let working = original;

    // B
    const wb = stripDeadWikiLinks(working, targets, false);
    if (wb.changes.length > 0) {
      if (!ctx.dryRun) writeFileSync(abs, wb.updated);
      working = wb.updated;
      log.push(`${rel}: B ${wb.changes.length} dead wikilink(s) stripped`);
    }

    // C (only for plans)
    if (rel.startsWith("roadmap/plans/") && rel !== "roadmap/plans/plans.md" && rel.endsWith(".md")) {
      const r = syncPlanStatusFromBodyMarker(working);
      if (r.changes.length > 0) {
        if (!ctx.dryRun) writeFileSync(abs, r.updated);
        log.push(`${rel}: C \`status:\` -> ${r.changes.length} change(s)`);
      }
      for (const mr of r.manualReview) allManualReview.push(`${rel}: C ${mr}`);
    }
  }

  // E: parent subfolder link drift
  const folderNotes = files.filter(({ rel }) => {
    const stem = rel.replace(/\.md$/, "");
    const parts = stem.split("/");
    return parts[parts.length - 1] === parts[parts.length - 2];
  });
  for (const { rel: childRel } of folderNotes) {
    const parts = childRel.split("/");
    if (parts.length < 2) continue;
    const parentRel = parts.slice(0, -1).join("/") + ".md";
    const parentAbs = join(pmFolder, parentRel);
    const parentContent = readIfExists(parentAbs);
    if (parentContent === null) continue;
    const result = ensureParentLinksToChild(parentContent, childRel, { pmFolder, vaultRoot });
    if (result.changes.length > 0) {
      if (!ctx.dryRun) writeFileSync(parentAbs, result.updated);
      log.push(`${parentRel}: E added subfolder link to \`${childRel}\``);
    }
  }

  for (const l of log) c.log("info", l);

  if (allManualReview.length > 0) {
    c.log("manual-review", `${allManualReview.length} item(s) need human judgment`);
  } else {
    c.log("done", "all auto-fixable content-semantic drift applied");
  }

  return {
    suggestedHistory: [
      `- chore(pm): apply migration \`1.8.0-content-semantic-fixes\` — close the content-semantic auto-fix gap. Auto-fixed: ${log.length} file(s) across 5 categories (A: domain/lane grouping placeholder, B: dead wikilink strip, C: plan \`status:\` body-marker sync, D: theoretical-risk wording markers, E: parent folder-note subfolder links). Manual review: ${allManualReview.length} item(s).`,
    ],
    manualReview: allManualReview,
  };
}

export default {
  id: "1.8.0-content-semantic-fixes",
  from: "<1.8.0",
  to: "1.8.0",
  describe:
    "Apply the five content-semantic auto-fixers to existing PM folders: A.1 introduce `### Pending Triage` H3 in `## Active` (D-009 grouping placeholder); A.2 introduce `### All Priorities` H3 in `## MVP Priorities` (D-010 grouping placeholder); B strip dead wikilinks (preserves display text); C sync plan `status:` from strong body markers (`SUPERSEDED by` / `ARCHIVED as` / `POSTPONED to` / `DEFERRED to` / `WON'T DO`); D add a `**possibly theoretical risk**` marker after `## Active` items that match theoretical-risk wording; E ensure each parent folder note's `## Subfolders` section has a wikilink to its child folder note. Idempotent. Weak markers (e.g. `NOT YET APPROVED` without a target) surface as MANUAL REVIEW.",
  detect,
  plan,
  apply,
};
