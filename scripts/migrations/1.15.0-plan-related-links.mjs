#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { findVaultRoot } from "../lib/paths.mjs";
import { parseFrontmatter } from "../lib/markdown.mjs";
import { ensurePlanRelatedLinks } from "../lib/roadmap-fixers.mjs";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function listPlanRels(pmFolder) {
  const root = join(pmFolder, "roadmap", "plans");
  const rels = [];
  function walk(abs) {
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const child = join(abs, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "plans.md") {
        rels.push(relative(pmFolder, child).split("\\").join("/").replace(/\.md$/, ""));
      }
    }
  }
  walk(root);
  return rels.sort();
}

function isActivePlan(content) {
  const status = parseFrontmatter(content)?.status;
  return status === "active" || status === "proposed";
}

function setScalarLine(raw, key, value) {
  const line = `${key}: ${value}`;
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*.*$`, "m");
  if (re.test(raw)) return raw.replace(re, line);
  return `${raw.trimEnd()}\n${line}`;
}

function touchFrontmatter(content, date = today()) {
  const normalized = String(content ?? "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return content;
  let fm = match[1];
  fm = setScalarLine(fm, "updated", date);
  fm = setScalarLine(fm, "last_reviewed", date);
  return `---\n${fm.trimEnd()}\n---\n${normalized.slice(match[0].length).replace(/^\n+/, "")}`;
}

function planTraceabilityChanges(pmFolder, ctx = {}) {
  const donePending = readIfExists(join(pmFolder, "roadmap", "done-pending.md"));
  if (donePending === null) return [];
  const linkOptions = { pmFolder, vaultRoot: findVaultRoot(pmFolder, ctx.configPath) };
  const changes = [];
  for (const rel of listPlanRels(pmFolder)) {
    const abs = join(pmFolder, `${rel}.md`);
    const original = readIfExists(abs);
    if (original === null || !isActivePlan(original)) continue;
    const result = ensurePlanRelatedLinks(original, {
      planRel: rel,
      donePendingContent: donePending,
      linkOptions,
    });
    if (result.updated !== original) {
      changes.push({ rel, abs, original, updated: touchFrontmatter(result.updated), changes: result.changes });
    }
  }
  return changes;
}

function detect({ pmFolder, ctx = {} }) {
  return planTraceabilityChanges(pmFolder, ctx).length > 0;
}

function plan() {
  return [
    "Add bidirectional traceability from active/proposed planning notes to their matching done-pending mirror sections.",
    "Only use existing `roadmap/done-pending.md` mirror sections and their relevant decision/feature/system/docs links.",
    "Skip shipped, rejected, superseded, archived, or missing-mirror plans; validators report unresolved mirrors separately.",
  ];
}

function apply({ pmFolder, ctx }) {
  const changes = planTraceabilityChanges(pmFolder, ctx);
  for (const item of changes) {
    if (!ctx.dryRun) writeFileSync(item.abs, item.updated);
    ctx.log("done", `${item.rel}.md`, item.changes.join("; "));
  }
  if (changes.length === 0) ctx.log("skip", "no active/proposed planning notes needed related-link repair");

  return {
    suggestedHistory: [
      `- **Planning notes now link back to their active done-pending mirrors.** chore(pm): apply migration \`1.15.0-plan-related-links\` to add deterministic \`## Related\` done-pending mirror and relevant-link entries to ${changes.length} active/proposed planning note(s).`,
    ],
    manualReview: [],
  };
}

export default {
  id: "1.15.0-plan-related-links",
  from: "<1.15.0",
  to: "1.15.0",
  describe:
    "Add deterministic plan-to-mirror traceability: active/proposed planning notes link to their matching done-pending section and copy existing relevant decision/feature/system/docs links from that mirror.",
  detect,
  plan,
  apply,
};

export const __test = {
  isActivePlan,
  listPlanRels,
  planTraceabilityChanges,
};
