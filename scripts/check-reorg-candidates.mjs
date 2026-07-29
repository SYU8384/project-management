#!/usr/bin/env node
/**
 * check-reorg-candidates.mjs
 *
 * Read-only detector for PM folder reorganization candidates. Scans a
 * project-management PM folder and emits a report of deterministic signals
 * an agent can use to propose merges, retirements, splits, supersession
 * declarations, and backlog digestion.
 *
 * This script NEVER merges, moves, or edits anything. Candidate detection
 * is deterministic; the merge/retire/supersede decision belongs to the
 * agent + human reorganization workflow (REFERENCE.md → PM Folder
 * Reorganization).
 *
 * Signals:
 *
 *   Features (features/*.md, excluding the folder note):
 *     tiny           — body prose under REORG_TINY_LINES meaningful lines
 *     stale          — `updated` (fallback `last_reviewed`) older than REORG_STALE_DAYS
 *     orphan         — zero inbound wikilinks from live lanes
 *     similar-pair   — title/heading token Jaccard ≥ REORG_SIMILARITY
 *
 *   Manuals (docs/**.md, excluding folder notes):
 *     orphan, stale, overlap-pair (same similarity rule)
 *
 *   Supersession hints (roadmap/plans/, decisions/, features/):
 *     similar pairs where neither file links to or declares a
 *     supersession relationship with the other
 *
 *   Backlog:
 *     stale inbox notes  — inbox/*.md with status: new (or missing)
 *                          and `created` (fallback mtime) older than REORG_INBOX_DAYS
 *     stale roadmap indexes — ideas.md / done-pending.md with `updated`
 *                          older than REORG_STALE_DAYS (TBD summaries noted)
 *
 * "Live lanes" for inbound-link counting means every .md file outside
 * history/, archive/, and inbox/ — links from those folders are historical
 * record or raw intake and do not keep a page live.
 *
 * Usage:
 *   node scripts/check-reorg-candidates.mjs                                # scan CWD
 *   node scripts/check-reorg-candidates.mjs /path/to/pm/folder             # scan explicit folder
 *   node scripts/check-reorg-candidates.mjs --project <name> --config <p>  # one project from config
 *   node scripts/check-reorg-candidates.mjs --config <p>                   # all projects in config
 *   node scripts/check-reorg-candidates.mjs --json                         # machine-readable output
 *
 * Configuration via env:
 *   REORG_STALE_DAYS   default 90
 *   REORG_TINY_LINES   default 40
 *   REORG_SIMILARITY   default 0.5
 *   REORG_INBOX_DAYS   default 30
 *
 * Exit code is always 0 (report, not a gate); 2 on argument/config errors.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import { resolveProjectsConfigPath } from "./lib/paths.mjs";
import { loadPmSkip, isSkipped } from "./lib/skip.mjs";
import { parseFrontmatter, stripFrontmatter, countMeaningfulLines, wikiLinks } from "./lib/markdown.mjs";
import { normalizeLinkPath } from "./lib/obsidian-links.mjs";

const STALE_DAYS = Number(process.env.REORG_STALE_DAYS ?? 90);
const TINY_LINES = Number(process.env.REORG_TINY_LINES ?? 40);
const SIMILARITY = Number(process.env.REORG_SIMILARITY ?? 0.5);
const INBOX_DAYS = Number(process.env.REORG_INBOX_DAYS ?? 30);

const today = new Date().toISOString().slice(0, 10);

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { vault: null, config: null, project: null, json: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" || args[i] === "-c") out.config = args[++i];
    else if (args[i] === "--project" || args[i] === "-p") out.project = args[++i];
    else if (args[i] === "--json") out.json = true;
    else if (!args[i].startsWith("-")) out.vault = args[i];
  }
  return out;
}

const CLI = parseArgs(process.argv);

function resolveTargets() {
  if (CLI.vault) {
    return [{ vault: resolve(CLI.vault), label: resolve(CLI.vault) }];
  }
  const configPath = resolveProjectsConfigPath(CLI.config ? resolve(CLI.config) : null);
  if (!configPath) {
    return [{ vault: process.cwd(), label: process.cwd() }];
  }
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  if (CLI.project) {
    const proj = cfg.projects?.[CLI.project];
    if (!proj?.pm_folder) {
      console.error(`ERROR: project '${CLI.project}' has no pm_folder in ${configPath}`);
      process.exit(2);
    }
    return [{ vault: resolve(proj.pm_folder), label: `${CLI.project} (${proj.pm_folder})` }];
  }
  return Object.entries(cfg.projects ?? {})
    .filter(([, proj]) => Boolean(proj.pm_folder))
    .map(([name, proj]) => ({ vault: resolve(proj.pm_folder), label: `${name} (${proj.pm_folder})` }));
}

const SKIP_DIRS = new Set([".obsidian", ".git", "node_modules", "scripts", ".workspace"]);
const SKIP_FILES = new Set(["README.md", "PRODUCT.md", "CURRENT_STATUS.md", "TEAM.md"]);
const HISTORICAL_LANES = new Set(["history", "archive", "inbox"]);

function walk(root, skipSet) {
  const out = [];
  function rec(abs) {
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const child = join(abs, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        rec(child);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const rel = relative(root, child).split("\\").join("/");
        if (isSkipped(skipSet, rel)) continue;
        out.push({ abs: child, rel });
      }
    }
  }
  rec(root);
  return out;
}

function topLane(rel) {
  return rel.split("/", 1)[0];
}

function isFolderNote(rel) {
  const parts = rel.split("/");
  const file = parts[parts.length - 1];
  const parent = parts.length > 1 ? parts[parts.length - 2] : null;
  if (file === `${topLane(rel)}.md`) return true;
  if (parent && file === `${parent}.md`) return true;
  return false;
}

function daysBetween(a, b) {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round((db - da) / 86_400_000);
}

const STOPWORDS = new Set([
  "the", "a", "an", "of", "for", "and", "to", "in", "on", "with", "how", "what",
  "md", "note", "notes", "doc", "docs", "guide", "page",
  // Generic PM section headings. Templated files share these, and without
  // filtering them every same-template pair looks "similar".
  "overview", "summary", "status", "related", "usage", "example", "examples",
  "details", "links", "background", "purpose", "scope", "description",
  "contents", "reference", "references", "conventions", "rules",
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function slugTokens(rel) {
  const slug = basename(rel, ".md")
    .replace(/^D-\d{3}[_-]*/i, " ")
    .replace(/^\s*(ADR|PRD|MKT|VND|POL|NEG|EXP)[_-]+/i, " ")
    .replace(/^\s*\d{4}-\d{2}-\d{2}[_-]*/, " ");
  return new Set(tokenize(slug));
}

function tokensFor(rel, content) {
  const body = stripFrontmatter(content);
  const headings = [...body.matchAll(/^#{1,3}\s+(.+)$/gm)].map((m) => m[1]).join(" ");
  return new Set([...slugTokens(rel), ...tokenize(headings)]);
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

// Pairs only qualify as merge/overlap/supersession candidates when their
// filename slugs share at least one meaningful token. Heading-only overlap
// is almost always template noise (every note has Overview/Summary/Related).
function sharesSlugToken(aRel, bRel) {
  const a = slugTokens(aRel);
  const b = slugTokens(bRel);
  for (const t of a) if (b.has(t)) return true;
  return false;
}

function declaresRelationshipWith(content, otherRel) {
  const otherBase = basename(otherRel, ".md");
  if (content.includes(otherBase)) return true;
  return /(?:supersedes|superseded by|replaced by|replacement|deprecated by):/i.test(content);
}

function collectInbound(files, contentByRel) {
  const inbound = new Map();
  for (const { rel } of files) inbound.set(rel, new Set());
  const known = new Set(files.map((f) => f.rel.replace(/\.md$/i, "")));
  const byBasename = new Map();
  for (const { rel } of files) {
    const key = basename(rel, ".md").toLowerCase();
    if (!byBasename.has(key)) byBasename.set(key, []);
    byBasename.get(key).push(rel);
  }
  for (const { rel } of files) {
    if (HISTORICAL_LANES.has(topLane(rel))) continue;
    const content = contentByRel.get(rel) ?? "";
    for (const rawTarget of wikiLinks(content)) {
      const target = normalizeLinkPath(rawTarget);
      if (!target) continue;
      let resolved = null;
      if (known.has(target)) {
        resolved = `${target}.md`;
      } else {
        const suffix = known.has(target.split("/").slice(-2).join("/"))
          ? target.split("/").slice(-2).join("/")
          : null;
        if (suffix) resolved = `${suffix}.md`;
      }
      if (!resolved) {
        const candidates = byBasename.get(basename(target).toLowerCase()) ?? [];
        if (candidates.length === 1) resolved = candidates[0];
      }
      if (resolved && resolved !== rel && inbound.has(resolved)) {
        inbound.get(resolved).add(rel);
      }
    }
  }
  return inbound;
}

function runFor(target) {
  const skipSet = loadPmSkip(target.vault);
  const files = walk(target.vault, skipSet).filter(({ rel }) => {
    if (SKIP_FILES.has(basename(rel))) return false;
    return true;
  });
  const contentByRel = new Map();
  const fmByRel = new Map();
  for (const { abs, rel } of files) {
    let content = "";
    try {
      content = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    contentByRel.set(rel, content);
    fmByRel.set(rel, parseFrontmatter(content) ?? {});
  }
  const inbound = collectInbound(files, contentByRel);

  const report = {
    label: target.label,
    vault: target.vault,
    generated: today,
    thresholds: { staleDays: STALE_DAYS, tinyLines: TINY_LINES, similarity: SIMILARITY, inboxDays: INBOX_DAYS },
    features: { tiny: [], stale: [], orphan: [], similarPairs: [] },
    manuals: { stale: [], orphan: [], overlapPairs: [] },
    supersessionHints: [],
    backlog: { staleInbox: [], staleRoadmapIndexes: [] },
  };

  const featureRels = files
    .map((f) => f.rel)
    .filter((rel) => topLane(rel) === "features" && !isFolderNote(rel) && !HISTORICAL_LANES.has(topLane(rel)));
  const manualRels = files
    .map((f) => f.rel)
    .filter((rel) => topLane(rel) === "docs" && !isFolderNote(rel));

  function dateOf(rel, fields) {
    const fm = fmByRel.get(rel) ?? {};
    for (const field of fields) {
      if (fm[field] && daysBetween(fm[field], today) != null) return fm[field];
    }
    return null;
  }

  for (const rel of featureRels) {
    const content = contentByRel.get(rel) ?? "";
    const fm = fmByRel.get(rel) ?? {};
    if (["deprecated", "superseded", "archived"].includes(fm.status)) continue;
    const bodyLines = countMeaningfulLines(stripFrontmatter(content).split("\n"));
    if (bodyLines < TINY_LINES) {
      report.features.tiny.push({ path: rel, bodyLines, updated: dateOf(rel, ["updated", "last_reviewed"]) });
    }
    const date = dateOf(rel, ["updated", "last_reviewed"]);
    if (date) {
      const age = daysBetween(date, today);
      if (age != null && age > STALE_DAYS) report.features.stale.push({ path: rel, ageDays: age, date });
    }
    if ((inbound.get(rel)?.size ?? 0) === 0) {
      report.features.orphan.push({ path: rel });
    }
  }

  const tokenCache = new Map();
  function tokens(rel) {
    if (!tokenCache.has(rel)) tokenCache.set(rel, tokensFor(rel, contentByRel.get(rel) ?? ""));
    return tokenCache.get(rel);
  }

  for (let i = 0; i < featureRels.length; i++) {
    for (let j = i + 1; j < featureRels.length; j++) {
      if (!sharesSlugToken(featureRels[i], featureRels[j])) continue;
      const score = jaccard(tokens(featureRels[i]), tokens(featureRels[j]));
      if (score >= SIMILARITY) {
        report.features.similarPairs.push({ a: featureRels[i], b: featureRels[j], score: Number(score.toFixed(2)) });
      }
    }
  }

  for (const rel of manualRels) {
    const date = dateOf(rel, ["updated", "last_reviewed"]);
    if (date) {
      const age = daysBetween(date, today);
      if (age != null && age > STALE_DAYS) report.manuals.stale.push({ path: rel, ageDays: age, date });
    }
    if ((inbound.get(rel)?.size ?? 0) === 0) {
      report.manuals.orphan.push({ path: rel });
    }
  }

  for (let i = 0; i < manualRels.length; i++) {
    for (let j = i + 1; j < manualRels.length; j++) {
      if (!sharesSlugToken(manualRels[i], manualRels[j])) continue;
      const score = jaccard(tokens(manualRels[i]), tokens(manualRels[j]));
      if (score >= SIMILARITY) {
        report.manuals.overlapPairs.push({ a: manualRels[i], b: manualRels[j], score: Number(score.toFixed(2)) });
      }
    }
  }

  const supersessionRels = files
    .map((f) => f.rel)
    .filter((rel) => {
      const lane = topLane(rel);
      if (rel.startsWith("roadmap/plans/")) return true;
      if (lane === "decisions" && /^D-\d{3}[_-]/i.test(basename(rel))) return true;
      if (lane === "features" && !isFolderNote(rel)) return true;
      return false;
    })
    .filter((rel) => !["deprecated", "superseded", "archived"].includes(fmByRel.get(rel)?.status));

  for (let i = 0; i < supersessionRels.length; i++) {
    for (let j = i + 1; j < supersessionRels.length; j++) {
      const a = supersessionRels[i];
      const b = supersessionRels[j];
      if (!sharesSlugToken(a, b)) continue;
      const score = jaccard(tokens(a), tokens(b));
      if (score < SIMILARITY) continue;
      const aContent = contentByRel.get(a) ?? "";
      const bContent = contentByRel.get(b) ?? "";
      if (declaresRelationshipWith(aContent, b) || declaresRelationshipWith(bContent, a)) continue;
      report.supersessionHints.push({ a, b, score: Number(score.toFixed(2)) });
    }
  }

  for (const { abs, rel } of files) {
    if (topLane(rel) !== "inbox") continue;
    const fm = fmByRel.get(rel) ?? {};
    const status = (fm.status ?? "new").trim() || "new";
    if (status !== "new") continue;
    let date = dateOf(rel, ["created"]);
    if (!date) {
      try {
        date = statSync(abs).mtime.toISOString().slice(0, 10);
      } catch {
        date = null;
      }
    }
    if (!date) continue;
    const age = daysBetween(date, today);
    if (age != null && age > INBOX_DAYS) {
      report.backlog.staleInbox.push({ path: rel, ageDays: age, date });
    }
  }

  for (const indexRel of ["roadmap/ideas.md", "roadmap/done-pending.md", "roadmap/known-issues.md"]) {
    if (!contentByRel.has(indexRel)) continue;
    const date = dateOf(indexRel, ["updated", "last_reviewed"]);
    if (!date) continue;
    const age = daysBetween(date, today);
    if (age == null || age <= STALE_DAYS) continue;
    const content = contentByRel.get(indexRel) ?? "";
    report.backlog.staleRoadmapIndexes.push({
      path: indexRel,
      ageDays: age,
      date,
      hasTbd: /\bTBD\b/.test(content),
    });
  }

  return report;
}

function countCandidates(report) {
  return (
    report.features.tiny.length +
    report.features.stale.length +
    report.features.orphan.length +
    report.features.similarPairs.length +
    report.manuals.stale.length +
    report.manuals.orphan.length +
    report.manuals.overlapPairs.length +
    report.supersessionHints.length +
    report.backlog.staleInbox.length +
    report.backlog.staleRoadmapIndexes.length
  );
}

function emitHuman(report) {
  const lines = [];
  lines.push(`\n# Reorganization Candidates — ${report.label}\n`);
  lines.push(`Generated: ${report.generated}`);
  lines.push(
    `Thresholds: stale > ${report.thresholds.staleDays}d, tiny < ${report.thresholds.tinyLines} body lines, ` +
      `similarity >= ${report.thresholds.similarity}, inbox new > ${report.thresholds.inboxDays}d`
  );
  lines.push("");

  function section(title, items, format) {
    if (items.length === 0) return;
    lines.push(`## ${title} (${items.length})`);
    lines.push("");
    for (const item of items) lines.push(format(item));
    lines.push("");
  }

  section("Tiny Feature Pages", report.features.tiny, (i) => `- \`${i.path}\` — ${i.bodyLines} body lines, updated ${i.updated ?? "unknown"}`);
  section("Stale Feature Pages", report.features.stale, (i) => `- \`${i.path}\` — ${i.ageDays} days since ${i.date}`);
  section("Orphaned Feature Pages (no live inbound links)", report.features.orphan, (i) => `- \`${i.path}\``);
  section("Similar Feature Pairs (merge/split candidates)", report.features.similarPairs, (i) => `- \`${i.a}\` ↔ \`${i.b}\` — token overlap ${i.score}`);
  section("Stale Manuals", report.manuals.stale, (i) => `- \`${i.path}\` — ${i.ageDays} days since ${i.date}`);
  section("Orphaned Manuals (no live inbound links)", report.manuals.orphan, (i) => `- \`${i.path}\``);
  section("Overlapping Manual Pairs (combine candidates)", report.manuals.overlapPairs, (i) => `- \`${i.a}\` ↔ \`${i.b}\` — token overlap ${i.score}`);
  section(
    "Possible Undeclared Supersessions",
    report.supersessionHints,
    (i) => `- \`${i.a}\` ↔ \`${i.b}\` — token overlap ${i.score}; neither declares a supersession link`
  );
  section("Stale Inbox Notes (untriaged)", report.backlog.staleInbox, (i) => `- \`${i.path}\` — status new for ${i.ageDays} days`);
  section(
    "Stale Roadmap Indexes",
    report.backlog.staleRoadmapIndexes,
    (i) => `- \`${i.path}\` — ${i.ageDays} days since ${i.date}${i.hasTbd ? "; contains TBD placeholders" : ""}`
  );

  const total = countCandidates(report);
  if (total === 0) {
    lines.push("No reorganization candidates found above the current thresholds.");
  } else {
    lines.push(`**Summary:** ${total} candidate signal(s).`);
    lines.push("");
    lines.push(
      "This report lists candidates only. Merging, retiring, splitting, and supersession decisions belong to the " +
        "agent + human reorganization workflow (REFERENCE.md → PM Folder Reorganization); nothing here is auto-fixed."
    );
  }
  console.log(lines.join("\n"));
}

const reports = [];
for (const target of resolveTargets()) {
  reports.push(runFor(target));
}

if (CLI.json) {
  console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
} else {
  for (const report of reports) emitHuman(report);
}

process.exit(0);
