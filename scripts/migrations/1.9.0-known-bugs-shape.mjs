#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  removeH3LinksFromContents,
  normalizePlaceholders,
  ensureRequiredFields,
  checkKnownBugsShape,
} from "../lib/known-bugs-fixers.mjs";

let ctx;

function readIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function detect({ pmFolder }) {
  const relPath = "docs/Developer Guide/known-bugs.md";
  const content = readIfExists(join(pmFolder, relPath));
  if (content === null) return false;

  if (removeH3LinksFromContents(content).changes.length > 0) return true;
  let working = normalizePlaceholders(content).updated;
  if (ensureRequiredFields(working).changes.length > 0) return true;
  const { issues } = checkKnownBugsShape(ensureRequiredFields(working).updated);
  return issues.length > 0;
}

function plan({ pmFolder }) {
  return [
    `Apply the known-bugs shape convention (D-011) to \`docs/Developer Guide/known-bugs.md\`.`,
    `Auto-fixed: remove H3 bug links from Contents TOC, normalize \`<to be filled in by maintainer\` placeholders to \`TBD\`, add missing required fields with \`TBD\`.`,
    `Manual review: fields marked \`TBD\` need maintainer-supplied root cause, solution, or verification details.`,
  ];
}

function apply({ pmFolder, ctx: c }) {
  ctx = c;
  const relPath = "docs/Developer Guide/known-bugs.md";
  const abs = join(pmFolder, relPath);
  const allManualReview = [];
  const log = [];

  let working = readIfExists(abs);
  if (working === null) {
    c.log("info", `${relPath} not found; nothing to do`);
    return { suggestedHistory: [], manualReview: [] };
  }

  const h3 = removeH3LinksFromContents(working);
  if (h3.changes.length > 0) {
    if (!ctx.dryRun) writeFileSync(abs, h3.updated);
    working = h3.updated;
    log.push(`${relPath}: ${h3.changes.length} H3 link(s) removed from Contents`);
  }
  for (const r of h3.manualReview) allManualReview.push(`${relPath}: ${r}`);

  const ph = normalizePlaceholders(working);
  if (ph.changes.length > 0) {
    if (!ctx.dryRun) writeFileSync(abs, ph.updated);
    working = ph.updated;
    log.push(`${relPath}: ${ph.changes.length} placeholder(s) normalized to TBD`);
  }
  for (const r of ph.manualReview) allManualReview.push(`${relPath}: ${r}`);

  const req = ensureRequiredFields(working);
  if (req.changes.length > 0) {
    if (!ctx.dryRun) writeFileSync(abs, req.updated);
    working = req.updated;
    log.push(`${relPath}: ${req.changes.length} missing field(s) added as TBD`);
  }
  for (const r of req.manualReview) allManualReview.push(`${relPath}: ${r}`);

  const { issues, manualReview } = checkKnownBugsShape(working);
  for (const issue of issues) allManualReview.push(`${relPath}: ${issue}`);
  for (const r of manualReview) allManualReview.push(`${relPath}: ${r}`);

  for (const l of log) c.log("info", l);

  if (allManualReview.length > 0) {
    c.log("manual-review", `${allManualReview.length} item(s) need human judgment`);
  } else {
    c.log("done", "known-bugs shape convention applied");
  }

  return {
    suggestedHistory: [
      `- chore(pm): apply migration \`1.9.0-known-bugs-shape\` — bring \`docs/Developer Guide/known-bugs.md\` up to the D-011 shape convention. Auto-fixed: ${log.length} change(s). Manual review: ${allManualReview.length} item(s).`,
    ],
    manualReview: allManualReview,
  };
}

export default {
  id: "1.9.0-known-bugs-shape",
  from: "<1.9.0",
  to: "1.9.0",
  describe:
    "Apply the known-bugs shape convention (D-011) to `docs/Developer Guide/known-bugs.md`: remove H3 bug links from the Contents TOC, normalize `<to be filled in by maintainer` placeholders to `TBD`, and add missing required fields with `TBD`. Idempotent. TBD fields surface as MANUAL REVIEW.",
  detect,
  plan,
  apply,
};
