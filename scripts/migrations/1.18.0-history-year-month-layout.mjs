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
  isMigrationCompatibilityLine,
  legacyHistoryMonthRel,
  MONTH_NAMES,
  rewriteStaleHistoryGuidance,
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
    for (const line of content.split(/\r?\n/)) {
      if (isMigrationCompatibilityLine(line)) continue;
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(line))) {
        const parts = legacyMonthParts(match[1]);
        if (parts) byYearMonth.set(parts.yearMonth, parts);
      }
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

function walkLiveMarkdown(pmFolder) {
  return walkMarkdown(pmFolder).filter((file) => {
    const rel = normalizeSlashes(relative(pmFolder, file));
    return !rel.startsWith("history/") && !rel.startsWith("archive/");
  });
}

function listStaleGuidanceFiles(pmFolder) {
  return walkLiveMarkdown(pmFolder).filter((file) => {
    const original = readFileSync(file, "utf8");
    return rewriteStaleHistoryGuidance(original) !== original;
  });
}

function rewriteLegacyHistoryGuidance(pmFolder, ctx) {
  let changedFiles = 0;
  for (const file of listStaleGuidanceFiles(pmFolder)) {
    const original = readFileSync(file, "utf8");
    const updated = rewriteStaleHistoryGuidance(original);
    if (updated === original) continue;
    changedFiles += 1;
    if (!ctx.dryRun) writeFileSync(file, updated);
    ctx.log("done", relNoExt(pmFolder, file), "updated prescriptive legacy history guidance");
  }
  return { changedFiles };
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
    const eol = original.includes("\r\n") ? "\r\n" : "\n";
    const updated = original
      .split(/\r?\n/)
      .map((line) => {
        if (isMigrationCompatibilityLine(line)) return line;
        let rewritten = line;
        for (const [from, to] of replacements) {
          const before = rewritten;
          rewritten = replaceAllLiteral(rewritten, from, to);
          if (rewritten !== before) {
            changedLinks += before.split(from).length - 1;
          }
        }
        return rewritten;
      })
      .join(eol);
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

function headingRanges(lines, level, start = 0, end = lines.length) {
  const headingRe = new RegExp(`^#{${level}}\\s+(.+?)\\s*$`);
  const boundaryRe = new RegExp(`^#{1,${level}}\\s+`);
  const ranges = [];
  for (let i = start; i < end; i++) {
    const match = lines[i].match(headingRe);
    if (!match) continue;
    let sectionEnd = end;
    for (let j = i + 1; j < end; j++) {
      if (boundaryRe.test(lines[j])) {
        sectionEnd = j;
        break;
      }
    }
    ranges.push({ title: match[1].trim(), start: i, end: sectionEnd });
  }
  return ranges;
}

function findUniqueHeading(lines, level, title, start = 0, end = lines.length) {
  const matches = headingRanges(lines, level, start, end).filter((range) => range.title === title);
  if (matches.length !== 1) return { range: null, ambiguous: matches.length > 1 };
  return { range: matches[0], ambiguous: false };
}

function substantiveLines(lines) {
  return lines.map((line) => line.trim()).filter((line) => line && !/^#{1,6}\s+/.test(line));
}

function isMergeableListLine(line) {
  return /^[-*+]\s+(?:\[[ xX]\]\s+)?/.test(line);
}

function insertBlock(lines, index, block) {
  const insert = [...block];
  if (index > 0 && lines[index - 1].trim() && insert[0]?.trim()) insert.unshift("");
  if (index < lines.length && lines[index]?.trim() && insert.at(-1)?.trim()) insert.push("");
  lines.splice(index, 0, ...insert);
}

function mergeMissingListLines(targetLines, targetStart, targetEnd, sourceLines, label) {
  const targetValues = new Set(substantiveLines(targetLines.slice(targetStart, targetEnd)));
  const missing = substantiveLines(sourceLines).filter((line) => !targetValues.has(line));
  const ambiguous = missing.filter((line) => !isMergeableListLine(line));
  if (ambiguous.length > 0) {
    return { ok: false, message: `${label}: non-list prose differs: ${ambiguous[0]}` };
  }
  if (missing.length === 0) return { ok: true, changed: false };
  insertBlock(targetLines, targetEnd, missing);
  return { ok: true, changed: true };
}

function mergeHistoryLogCollision(sourceContent, targetContent) {
  const targetEol = String(targetContent).includes("\r\n") ? "\r\n" : "\n";
  const sourceSplit = splitFrontmatter(sourceContent);
  const targetSplit = splitFrontmatter(targetContent);
  if (!sourceSplit || !targetSplit) {
    return { ok: false, message: "both colliding history logs need parseable frontmatter" };
  }

  const sourceLines = sourceSplit.body.replace(/^\n+/, "").split("\n");
  const targetLines = targetSplit.body.replace(/^\n+/, "").split("\n");
  const sourceH2 = headingRanges(sourceLines, 2).filter((range) => range.title !== "Navigation");
  const sourcePrefixEnd = sourceH2[0]?.start ?? sourceLines.length;
  const unexpectedPrefix = substantiveLines(sourceLines.slice(0, sourcePrefixEnd)).filter(
    (line) => !/^#\s+(?:history-)?\d{4}-\d{2}-\d{2}$/.test(line)
  );
  if (unexpectedPrefix.length > 0) {
    return { ok: false, message: `unstructured content before the first H2: ${unexpectedPrefix[0]}` };
  }

  let changed = false;
  for (const sourceSection of sourceH2) {
    let targetMatch = findUniqueHeading(targetLines, 2, sourceSection.title);
    if (targetMatch.ambiguous) {
      return { ok: false, message: `duplicate target H2: ${sourceSection.title}` };
    }
    if (!targetMatch.range) {
      const navigation = findUniqueHeading(targetLines, 2, "Navigation");
      insertBlock(
        targetLines,
        navigation.range?.start ?? targetLines.length,
        sourceLines.slice(sourceSection.start, sourceSection.end)
      );
      changed = true;
      continue;
    }

    const sourceH3 = headingRanges(sourceLines, 3, sourceSection.start + 1, sourceSection.end);
    if (sourceH3.length === 0) {
      const merged = mergeMissingListLines(
        targetLines,
        targetMatch.range.start + 1,
        targetMatch.range.end,
        sourceLines.slice(sourceSection.start + 1, sourceSection.end),
        `H2 ${sourceSection.title}`
      );
      if (!merged.ok) return merged;
      changed ||= merged.changed;
      continue;
    }

    const sourcePreambleEnd = sourceH3[0].start;
    const targetH3 = headingRanges(
      targetLines,
      3,
      targetMatch.range.start + 1,
      targetMatch.range.end
    );
    const targetPreambleEnd = targetH3[0]?.start ?? targetMatch.range.end;
    const preamble = mergeMissingListLines(
      targetLines,
      targetMatch.range.start + 1,
      targetPreambleEnd,
      sourceLines.slice(sourceSection.start + 1, sourcePreambleEnd),
      `H2 ${sourceSection.title} preamble`
    );
    if (!preamble.ok) return preamble;
    changed ||= preamble.changed;

    for (const sourceSubsection of sourceH3) {
      targetMatch = findUniqueHeading(targetLines, 2, sourceSection.title);
      const targetSubsection = findUniqueHeading(
        targetLines,
        3,
        sourceSubsection.title,
        targetMatch.range.start + 1,
        targetMatch.range.end
      );
      if (targetSubsection.ambiguous) {
        return { ok: false, message: `duplicate target H3: ${sourceSubsection.title}` };
      }
      if (!targetSubsection.range) {
        insertBlock(
          targetLines,
          targetMatch.range.end,
          sourceLines.slice(sourceSubsection.start, sourceSubsection.end)
        );
        changed = true;
        continue;
      }
      const merged = mergeMissingListLines(
        targetLines,
        targetSubsection.range.start + 1,
        targetSubsection.range.end,
        sourceLines.slice(sourceSubsection.start + 1, sourceSubsection.end),
        `H3 ${sourceSubsection.title}`
      );
      if (!merged.ok) return merged;
      changed ||= merged.changed;
    }
  }

  const body = targetLines.join("\n").replace(/\n+$/, "\n");
  const mergedContent = `---\n${targetSplit.frontmatter.trimEnd()}\n---\n${body}`;
  return {
    ok: true,
    changed,
    content: targetEol === "\r\n" ? mergedContent.replace(/\n/g, "\r\n") : mergedContent,
  };
}

function frontmatterScalar(frontmatter, key) {
  const match = String(frontmatter).match(new RegExp(`^${key}:\\s*(.*?)\\s*$`, "m"));
  if (!match) return null;
  return match[1].trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
}

function isGeneratedIndexSection(content) {
  const lines = String(content)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 && lines.every((line) => (
    line === "*(no items)*"
    || line === "- *(no items)*"
    || /^-\s+\[\[[^\]\n]+\]\](?:\s+-\s+[^\n]+)?$/.test(line)
  ));
}

function isSafeLegacyMonthIndex(content, expectedTitle = null) {
  const normalized = String(content).replace(/\r\n?/g, "\n");
  const split = splitFrontmatter(normalized);
  if (!split || frontmatterScalar(split.frontmatter, "pageType") !== "index") return false;

  const startMarker = "<!-- vault-maintain:index:start -->";
  const endMarker = "<!-- vault-maintain:index:end -->";
  const start = split.body.indexOf(startMarker);
  const end = split.body.indexOf(endMarker);
  if (start < 0 || end < start || split.body.indexOf(startMarker, start + startMarker.length) >= 0
    || split.body.indexOf(endMarker, end + endMarker.length) >= 0) return false;

  const beforeIndex = split.body.slice(0, start).trim();
  if (!/^#\s+[^\n]+$/.test(beforeIndex)) return false;
  if (expectedTitle && beforeIndex !== `# ${expectedTitle}`) return false;

  const indexBody = split.body.slice(start + startMarker.length, end);
  const sections = indexBody.match(/^\s*## Subfolders\s*\n([\s\S]*?)\n## Notes\s*\n([\s\S]*?)\s*$/);
  if (!sections || !isGeneratedIndexSection(sections[1]) || !isGeneratedIndexSection(sections[2])) {
    return false;
  }

  const navigation = split.body.slice(end + endMarker.length).trim();
  const navigationLines = navigation.split("\n").map((line) => line.trim()).filter(Boolean);
  return navigationLines.length > 1
    && navigationLines[0] === "## Navigation"
    && navigationLines.slice(1).every((line) => /^-\s+\[\[[^\]\n]+\]\]$/.test(line));
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
        const srcRel = normalizeSlashes(relative(pmFolder, src));
        const dstRel = normalizeSlashes(relative(pmFolder, dst));
        const sourceContent = readFileSync(src, "utf8");
        if (entry.name === `${month.yearMonth}.md`) {
          if (isSafeLegacyMonthIndex(sourceContent, month.yearMonth)) {
            if (!ctx.dryRun) rmSync(src);
            ctx.log("done", srcRel, `removed redundant legacy month index; canonical index remains at ${dstRel}`);
            continue;
          }
          manualReview.push(`${srcRel}: canonical index already exists at ${dstRel}, but this legacy index contains content outside the generated index structure`);
          continue;
        }
        if (/^history-\d{4}-\d{2}-\d{2}(?:-archived-sections)?\.md$/.test(entry.name)) {
          const targetContent = readFileSync(dst, "utf8");
          const merged = mergeHistoryLogCollision(sourceContent, targetContent);
          if (merged.ok) {
            if (!ctx.dryRun) {
              if (merged.changed) writeFileSync(dst, merged.content);
              rmSync(src);
            }
            ctx.log(
              "done",
              srcRel,
              merged.changed
                ? `merged deterministic history sections into ${dstRel}`
                : `removed duplicate history log already contained by ${dstRel}`
            );
            continue;
          }
          manualReview.push(`${srcRel}: cannot merge safely into ${dstRel}: ${merged.message}`);
          continue;
        }
        manualReview.push(`${srcRel}: target already exists at ${dstRel}`);
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
  if (listStaleGuidanceFiles(pmFolder).length > 0) return true;
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
    "Rewrite prescriptive live guidance that still teaches history/YYYY-MM while preserving explicit migration-compatibility prose.",
    "Merge colliding daily logs only when H2/H3 sections and exact list items can be preserved deterministically.",
  ];
}

function apply({ pmFolder, ctx }) {
  const months = listMigrationMonths(pmFolder);
  const moved = moveLegacyFolders(pmFolder, months, ctx);
  ensureHistoryIndexes(pmFolder, months, ctx);
  const links = rewriteMovedHistoryLinks(pmFolder, months, ctx);
  const guidance = rewriteLegacyHistoryGuidance(pmFolder, ctx);

  return {
    suggestedHistory: [
      `- **History folders now use Journal-style year/month organization.** chore(pm): apply migration \`1.18.0-history-year-month-layout\` to move ${moved.moved.length} history file(s), refresh year/month indexes, rewrite ${links.changedLinks} legacy history link(s), and repair ${guidance.changedFiles} live guidance file(s).`,
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
  reconcileOnDrift: true,
  detect,
  plan,
  apply,
};

export const __test = {
  listLegacyMonths,
  listLegacyLinkMonths,
  listMigrationMonths,
  buildLinkReplacements,
  listStaleGuidanceFiles,
  frontmatterScalar,
  isGeneratedIndexSection,
  isSafeLegacyMonthIndex,
  mergeHistoryLogCollision,
  rewriteLegacyHistoryGuidance,
};
