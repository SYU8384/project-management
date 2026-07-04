#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import {
  historyMonthIndexRel,
  historyMonthRel,
  historyYearIndexRel,
  legacyHistoryMonthRel,
  MONTH_NAMES,
} from "../lib/history-paths.mjs";
import { findVaultRoot } from "../lib/paths.mjs";
import { projectPathFromVault } from "../lib/obsidian-links.mjs";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function legacyMonthParts(name) {
  const match = String(name).match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex >= MONTH_NAMES.length) return null;
  return {
    year: match[1],
    month: match[2],
    yearMonth: name,
    monthName: MONTH_NAMES[monthIndex],
    sampleDate: `${match[1]}-${match[2]}-01`,
  };
}

function listLegacyMonths(pmFolder) {
  const historyRoot = join(pmFolder, "history");
  if (!existsSync(historyRoot)) return [];
  return readdirSync(historyRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => legacyMonthParts(entry.name))
    .filter(Boolean)
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
}

function listLegacyLinkMonths(pmFolder) {
  const byYearMonth = new Map();
  const re = /history[\/\\](\d{4}-\d{2})[\/\\]/g;
  for (const file of walkMarkdown(pmFolder)) {
    const content = readFileSync(file, "utf8");
    let match;
    while ((match = re.exec(content))) {
      const parts = legacyMonthParts(match[1]);
      if (parts) byYearMonth.set(parts.yearMonth, parts);
    }
  }
  return [...byYearMonth.values()].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
}

function listMigrationMonths(pmFolder) {
  const byYearMonth = new Map();
  for (const month of [...listLegacyMonths(pmFolder), ...listLegacyLinkMonths(pmFolder)]) {
    byYearMonth.set(month.yearMonth, month);
  }
  return [...byYearMonth.values()].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
}

function walkMarkdown(root) {
  const files = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(abs);
    }
  }
  walk(root);
  return files;
}

function normalizeSlashes(value) {
  return String(value).replace(/\\/g, "/");
}

function relNoExt(pmFolder, abs) {
  return normalizeSlashes(relative(pmFolder, abs)).replace(/\.md$/i, "");
}

function replaceAllLiteral(content, from, to) {
  return String(content).split(from).join(to);
}

function buildLinkReplacements(months) {
  const replacements = [];
  for (const month of months) {
    const monthIndexRel = historyMonthIndexRel(month.sampleDate);
    replacements.push([`history/${month.yearMonth}/${month.yearMonth}`, monthIndexRel]);
    replacements.push([`history/${month.yearMonth}/`, `${historyMonthRel(month.sampleDate)}/`]);
    replacements.push([`history\\${month.yearMonth}\\${month.yearMonth}`, monthIndexRel.replaceAll("/", "\\")]);
    replacements.push([`history\\${month.yearMonth}\\`, `${historyMonthRel(month.sampleDate).replaceAll("/", "\\")}\\`]);
  }
  return replacements;
}

function rewriteMovedHistoryLinks(pmFolder, months, ctx) {
  const replacements = buildLinkReplacements(months);
  let changedFiles = 0;
  let changedLinks = 0;
  for (const file of walkMarkdown(pmFolder)) {
    const original = readFileSync(file, "utf8");
    let updated = original;
    for (const [from, to] of replacements) {
      const before = updated;
      updated = replaceAllLiteral(updated, from, to);
      if (updated !== before) {
        changedLinks += before.split(from).length - 1;
      }
    }
    if (updated !== original) {
      changedFiles += 1;
      if (!ctx.dryRun) writeFileSync(file, updated);
      ctx.log("done", relNoExt(pmFolder, file), "updated legacy history links");
    }
  }
  return { changedFiles, changedLinks };
}

function splitFrontmatter(content) {
  const normalized = String(content ?? "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return null;
  return { frontmatter: match[1], body: normalized.slice(match[0].length) };
}

function setFrontmatterValue(frontmatter, key, value) {
  const line = `${key}: ${value}`;
  const re = new RegExp(`^${key}:\\s*.*$`, "m");
  if (re.test(frontmatter)) return frontmatter.replace(re, line);
  return `${frontmatter.trimEnd()}\n${line}`;
}

function touchFrontmatter(content, date) {
  const split = splitFrontmatter(content);
  if (!split) return content;
  let fm = split.frontmatter;
  fm = setFrontmatterValue(fm, "updated", date);
  fm = setFrontmatterValue(fm, "last_reviewed", date);
  return `---\n${fm.trimEnd()}\n---\n${split.body.replace(/^\n+/, "")}`;
}

function wiki(target, display) {
  return `[[${target}|${display}]]`;
}

function defaultIndex({ title, intro, date, projectRel, backTarget = null, backLabel = null }) {
  const back = backTarget ? `- ${wiki(backTarget, backLabel)}\n` : "";
  const projectName = normalizeSlashes(projectRel).split("/").at(-1);
  return `---\ntitle: "${title}"\ntags:\n  - project-management\ncreated: ${date}\nupdated: ${date}\nlast_reviewed: ${date}\npageType: index\nstatus: active\nowner: PM\nicon: "LiCalendar"\niconColor: "#8b5cf6"\n---\n# ${title}\n\n${intro}\n\n<!-- vault-maintain:index:start -->\n## Subfolders\n\n*(no items)*\n\n## Notes\n\n*(no items)*\n<!-- vault-maintain:index:end -->\n\n## Navigation\n\n${back}- ${wiki(`${projectRel}/${projectName}`, `Back to ${projectName}`)}\n- [[Projects/Projects|Back to Projects]]\n- [[Home|Back to Home]]\n`;
}

function linkTargetsInLine(line) {
  const targets = [];
  const re = /!?\[\[([^\]\n]+)\]\]/g;
  let match;
  while ((match = re.exec(line))) {
    targets.push(match[1].split("|")[0].split("#")[0].trim().replace(/\.md$/i, ""));
  }
  return targets;
}

function targetMatchesRel(target, rel) {
  const normalized = normalizeSlashes(target);
  const normalizedRel = normalizeSlashes(rel);
  return normalized === normalizedRel || normalized.endsWith(`/${normalizedRel}`);
}

function updateIndexSection(content, { section, addRel, addDisplay, removeRels = [], matchRel = addRel, date }) {
  const re = new RegExp(
    `(<!--\\s*vault-maintain:index:start\\s*-->[\\s\\S]*?^## ${section}\\s*$\\n)([\\s\\S]*?)(\\n(?:## |<!--\\s*vault-maintain:index:end\\s*-->))`,
    "m"
  );
  const match = content.match(re);
  if (!match) return touchFrontmatter(content, date);
  const lines = match[2].split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "*(no items)*") return false;
    return !linkTargetsInLine(line).some((target) =>
      removeRels.some((rel) => targetMatchesRel(target, rel))
    );
  });
  const present = lines.some((line) =>
    linkTargetsInLine(line).some((target) => targetMatchesRel(target, matchRel))
  );
  if (!present) lines.push(`- ${wiki(addRel, addDisplay)}`);
  const body = lines.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })).join("\n") || "*(no items)*";
  return touchFrontmatter(content.replace(re, `${match[1]}${body}${match[3]}`), date);
}

function writeIfChanged(abs, content, ctx, label) {
  const original = existsSync(abs) ? readFileSync(abs, "utf8") : null;
  if (original === content) return false;
  if (!ctx.dryRun) {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  ctx.log("done", label, original === null ? "created index" : "updated index");
  return true;
}

function ensureHistoryIndexes(pmFolder, months, ctx) {
  const date = today();
  const vaultRoot = findVaultRoot(pmFolder, ctx.configPath);
  const projectRel = projectPathFromVault(vaultRoot, pmFolder);
  const byYear = new Map();
  for (const month of months) {
    if (!byYear.has(month.year)) byYear.set(month.year, []);
    byYear.get(month.year).push(month);
  }

  const historyIndexAbs = join(pmFolder, "history", "history.md");
  let historyIndex = existsSync(historyIndexAbs)
    ? readFileSync(historyIndexAbs, "utf8")
    : defaultIndex({
        title: "history",
        intro: "Chronological logs of completed meaningful work.",
        date,
        projectRel,
      });

  for (const [year, yearMonths] of byYear.entries()) {
    const yearRel = historyYearIndexRel(`${year}-01-01`);
    historyIndex = updateIndexSection(historyIndex, {
      section: "Subfolders",
      addRel: `${projectRel}/${yearRel}`,
      addDisplay: `${year}/`,
      removeRels: yearMonths.flatMap((month) => [
        `${legacyHistoryMonthRel(month.sampleDate)}/${month.yearMonth}`,
        historyMonthIndexRel(month.sampleDate),
      ]),
      matchRel: yearRel,
      date,
    });

    const yearIndexAbs = join(pmFolder, `${yearRel}.md`);
    let yearIndex = existsSync(yearIndexAbs)
      ? readFileSync(yearIndexAbs, "utf8")
      : defaultIndex({
          title: year,
          intro: `History logs for ${year}.`,
          date,
          projectRel,
          backTarget: `${projectRel}/history/history`,
          backLabel: "Back to history",
        });

    for (const month of yearMonths) {
      const monthRel = historyMonthIndexRel(month.sampleDate);
      yearIndex = updateIndexSection(yearIndex, {
        section: "Subfolders",
        addRel: `${projectRel}/${monthRel}`,
        addDisplay: `${month.monthName}/`,
        matchRel: monthRel,
        date,
      });
      ensureMonthIndex(pmFolder, month, ctx, { date, projectRel });
    }
    writeIfChanged(yearIndexAbs, yearIndex, ctx, yearRel);
  }
  writeIfChanged(historyIndexAbs, historyIndex, ctx, "history/history");
}

function listMonthNotes(pmFolder, month) {
  const dir = join(pmFolder, historyMonthRel(month.sampleDate));
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== `${month.monthName}.md`)
    .map((entry) => `${historyMonthRel(month.sampleDate)}/${entry.name.replace(/\.md$/i, "")}`)
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

function ensureMonthIndex(pmFolder, month, ctx, { date, projectRel }) {
  const monthRel = historyMonthIndexRel(month.sampleDate);
  const monthAbs = join(pmFolder, `${monthRel}.md`);
  let content = existsSync(monthAbs)
    ? readFileSync(monthAbs, "utf8")
    : defaultIndex({
        title: month.monthName,
        intro: `History logs for ${month.monthName} ${month.year}.`,
        date,
        projectRel,
        backTarget: `${projectRel}/${historyYearIndexRel(month.sampleDate)}`,
        backLabel: `Back to ${month.year}`,
      });
  content = content.replace(new RegExp(`#\\s+${month.yearMonth}\\s*\\n`), `# ${month.monthName}\n`);
  content = content.replace(new RegExp(`title:\\s*"?${month.yearMonth}"?`), `title: "${month.monthName}"`);
  for (const noteRel of listMonthNotes(pmFolder, month)) {
    content = updateIndexSection(content, {
      section: "Notes",
      addRel: `${projectRel}/${noteRel}`,
      addDisplay: basename(noteRel),
      matchRel: noteRel,
      date,
    });
  }
  writeIfChanged(monthAbs, content, ctx, monthRel);
}

function moveLegacyFolders(pmFolder, months, ctx) {
  const moved = [];
  const manualReview = [];
  for (const month of months) {
    const legacyDir = join(pmFolder, legacyHistoryMonthRel(month.sampleDate));
    if (!existsSync(legacyDir)) continue;
    const monthDir = join(pmFolder, historyMonthRel(month.sampleDate));
    if (!ctx.dryRun) mkdirSync(monthDir, { recursive: true });
    for (const entry of readdirSync(legacyDir, { withFileTypes: true })) {
      const src = join(legacyDir, entry.name);
      if (!entry.isFile()) {
        manualReview.push(`${normalizeSlashes(relative(pmFolder, src))}: nested legacy history entry not moved automatically`);
        continue;
      }
      let dstName = entry.name;
      if (entry.name === `${month.yearMonth}.md`) dstName = `${month.monthName}.md`;
      const dst = join(monthDir, dstName);
      if (existsSync(dst)) {
        manualReview.push(`${normalizeSlashes(relative(pmFolder, src))}: target already exists at ${normalizeSlashes(relative(pmFolder, dst))}`);
        continue;
      }
      moved.push([src, dst]);
      if (!ctx.dryRun) renameSync(src, dst);
      ctx.log("done", normalizeSlashes(relative(pmFolder, src)), `moved to ${normalizeSlashes(relative(pmFolder, dst))}`);
    }
    if (!ctx.dryRun) {
      try {
        if (existsSync(legacyDir) && readdirSync(legacyDir).length === 0) rmSync(legacyDir, { recursive: true });
      } catch {
        manualReview.push(`${normalizeSlashes(relative(pmFolder, legacyDir))}: legacy folder was not empty after migration`);
      }
    }
  }
  return { moved, manualReview };
}

function detect({ pmFolder }) {
  if (listLegacyLinkMonths(pmFolder).length > 0) return true;
  return listLegacyMonths(pmFolder).some((month) => {
    const dir = join(pmFolder, legacyHistoryMonthRel(month.sampleDate));
    return existsSync(dir) && statSync(dir).isDirectory();
  });
}

function plan({ pmFolder }) {
  const months = listMigrationMonths(pmFolder);
  return [
    `Move ${months.length} legacy history month folder(s) from history/YYYY-MM to history/YYYY/<Month>.`,
    "Rename legacy month indexes from YYYY-MM.md to <Month>.md and create/update year indexes.",
    "Rewrite vault-relative links that target moved history files.",
  ];
}

function apply({ pmFolder, ctx }) {
  const months = listMigrationMonths(pmFolder);
  const moved = moveLegacyFolders(pmFolder, months, ctx);
  ensureHistoryIndexes(pmFolder, months, ctx);
  const links = rewriteMovedHistoryLinks(pmFolder, months, ctx);

  return {
    suggestedHistory: [
      `- **History folders now use Journal-style year/month organization.** chore(pm): apply migration \`1.18.0-history-year-month-layout\` to move ${moved.moved.length} history file(s), refresh year/month indexes, and rewrite ${links.changedLinks} legacy history link(s).`,
    ],
    manualReview: moved.manualReview,
  };
}

export default {
  id: "1.18.0-history-year-month-layout",
  from: "<1.18.0",
  to: "1.18.0",
  describe:
    "Move history logs from history/YYYY-MM/ into Journal-style history/YYYY/<Month>/ folders, with year/month folder notes and rewritten history links.",
  detect,
  plan,
  apply,
};

export const __test = {
  listLegacyMonths,
  listLegacyLinkMonths,
  listMigrationMonths,
  buildLinkReplacements,
};
