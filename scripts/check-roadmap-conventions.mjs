#!/usr/bin/env node
/**
 * check-roadmap-conventions.mjs
 *
 * Content-level convention check for the four roadmap files:
 *   - D-007: `roadmap/done-pending.md` planning-note mirror H2s use
 *     slug-only text (not the date-prefixed stem). Soft warning.
 *   - D-008: `roadmap/ideas.md` carries the 🟣/🟡/🔵/🟢/🔴 status-color
 *     scheme in the Status Key, the Idea Register Status column, and
 *     the Idea Details `**Status:**` lines.
 *   - D-009: `roadmap/known-issues.md` has no top-level `## Fixed`
 *     section (fixed items live in `docs/Developer Guide/known-bugs.md`
 *     per the D-009 lifecycle). When `## Active` has multiple items, it
 *     uses `### <Domain>` H3 subsections.
 *   - D-012: human-readable PM notes conventions: done-pending Contents
 *     links match actual H2s, planning/relevant links point to existing
 *     notes when deterministic, and each idea detail has a Summary field.
 *   - D-015: `roadmap/milestones/*.md` notes have the milestone scan
 *     sections (`Goal`, `Priorities`, `Major Steps`, `Exit Criteria`,
 *     `Deferred`, `Update Triggers`, `Navigation`) and the active phase
 *     has an agent-maintained milestone note. D-016 deprecates generic
 *     `Related Notes` link dumps in favor of inline evidence links.
 *   - D-018: active/proposed planning notes link back to their exact
 *     `roadmap/done-pending.md#<section>` mirror from `## Related`.
 *   - Planning mirrors in `roadmap/done-pending.md` carry a human
 *     archive-confirmation checkbox. Completed mirrors fail in report-only
 *     mode and auto-archive under `--fix` only after that checkbox is done.
 *
 * Run with `--fix` to auto-apply the deterministic fixes (D-008
 * emoji insertion, D-009 empty-`## Fixed` removal, D-007 H2 rename,
 * D-012 TOC/link repair, D-018 plan-side mirror traceability repair,
 * missing idea Summary insertion, missing human
 * archive-confirmation insertion, and completed-mirror archive close-out
 * when the linked plan target is unique).
 * The auto-fixer cannot pick project-specific domain/lane names or infer
 * missing human prose, so those checks surface as MANUAL REVIEW findings.
 *
 * Exits 1 on FAIL, 0 on PASS. Hidden directories are skipped (same
 * convention as `check-pm-consistency.mjs`).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import { findVaultRoot, resolveProjectsConfigPath } from "./lib/paths.mjs";
import {
  basenameNoExt,
  normalizeLinkPath,
  parseWikiLinkBody,
  pmRelToVaultTarget,
  pmWikiLink,
  renderWikiLinkBody,
} from "./lib/obsidian-links.mjs";
import {
  activeMilestoneInfo,
  ensureMilestonesIndexLink,
  ensureMilestoneUpdateTriggers,
  listMilestoneNoteRels,
  milestoneNoteContent,
  milestonesIndexContent,
  milestoneSlugFromRel,
  removeDeprecatedMilestoneRelatedNotes,
} from "./lib/milestones.mjs";
import {
  insertStatusEmojisInIdeas,
  insertIdeasStatusColorsLeadNote,
  dropEmptyFixedSection,
  checkDomainGroupingInActive,
  checkMilestoneNoteShape,
  renameDatePrefixedH2s,
  syncDonePendingContents,
  linkDonePendingPlanningNotes,
  normalizeDonePendingRelevantLinks,
  ensureIdeaDetailSummaries,
  findArchiveReadyDonePendingSections,
  findPlanningMirrorsMissingHumanArchiveConfirmation,
  ensureHumanArchiveConfirmation,
  ensurePlanRelatedLinks,
  planArchiveReadyDonePendingSections,
  removeDonePendingSections,
} from "./lib/roadmap-fixers.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { vault: null, config: null, project: null, fix: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" || args[i] === "-c") out.config = args[++i];
    else if (args[i] === "--project" || args[i] === "-p") out.project = args[++i];
    else if (args[i] === "--fix") out.fix = true;
    else if (!args[i].startsWith("-")) out.vault = args[i];
  }
  return out;
}

const CLI = parseArgs(process.argv);

function loadConfigPath() {
  if (CLI.vault) return null;
  return resolveProjectsConfigPath(CLI.config ? resolve(CLI.config) : null);
}

function isTemplateConfig(cfg) {
  const projects = cfg.projects ?? {};
  return Object.keys(projects).length === 0 || Object.prototype.hasOwnProperty.call(projects, "<ProjectName>");
}

function configSetupError(project, configPath, reason) {
  const setupHint = isTemplateConfig(JSON.parse(readFileSync(configPath, "utf8")))
    ? "This looks like the default empty projects.json template. "
    : "";
  return (
    `ERROR: ${reason} in ${configPath}\n` +
    `${setupHint}Run the project-management skill and say "setup as collaborator" or "setup this repo", ` +
    `or add a real projects.${project} entry with access and pm_folder.`
  );
}

function resolveTargets() {
  const configPath = loadConfigPath();
  if (!configPath) return [{ vault: resolve(CLI.vault ?? process.cwd()), label: resolve(CLI.vault ?? process.cwd()), configPath: null }];
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  if (CLI.project) {
    const proj = cfg.projects?.[CLI.project];
    if (!proj?.pm_folder) {
      const reason = proj
        ? `project '${CLI.project}' has no pm_folder`
        : `project '${CLI.project}' not found`;
      console.error(configSetupError(CLI.project, configPath, reason));
      process.exit(2);
    }
    return [{ vault: resolve(proj.pm_folder), label: `${CLI.project} (${proj.pm_folder})`, project: CLI.project, configPath }];
  }
  return Object.entries(cfg.projects ?? {})
    .filter(([, proj]) => Boolean(proj.pm_folder))
    .map(([project, proj]) => ({ vault: resolve(proj.pm_folder), label: `${project} (${proj.pm_folder})`, project, configPath }));
}

function readIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function collectMarkdownTargets(root) {
  const targets = [];
  function walk(abs) {
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const child = join(abs, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        targets.push(relative(root, child).split("\\").join("/").replace(/\.md$/, ""));
      }
    }
  }
  walk(root);
  return targets;
}

function planningNoteStatus(content) {
  const split = splitFrontmatter(content);
  if (!split) return null;
  return frontmatterValue(split.frontmatter, "status");
}

function writeIfChanged(path, original, updated, rel) {
  if (updated === original) return 0;
  if (CLI.fix) {
    try {
      writeFileSync(path, updated);
      process.stdout.write(`fixed: ${rel}\n`);
      return 1;
    } catch (err) {
      process.stderr.write(`--fix failed for ${rel}: ${err.message}\n`);
      return 0;
    }
  }
  return 0;
}

function writeNewFile(path, content, rel) {
  if (!CLI.fix) return 0;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    process.stdout.write(`fixed: ${rel}\n`);
    return 1;
  } catch (err) {
    process.stderr.write(`--fix failed for ${rel}: ${err.message}\n`);
    return 0;
  }
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitFrontmatter(content) {
  const normalized = String(content ?? "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return null;
  return {
    frontmatter: match[1],
    body: normalized.slice(match[0].length),
  };
}

function frontmatterValue(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${escapeRegExp(key)}:\\s*(.*)$`, "m"));
  if (!match) return null;
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function setFrontmatterValue(frontmatter, key, value) {
  const line = `${key}: ${value}`;
  const re = new RegExp(`^${escapeRegExp(key)}:\\s*.*$`, "m");
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

function replaceNavigationSection(body, navigation) {
  const normalized = String(body ?? "").replace(/\r\n/g, "\n").trimEnd();
  const match = normalized.match(/^## Navigation\s*$/m);
  if (!match) return `${normalized}\n\n${navigation}\n`;
  const start = match.index;
  const rest = normalized.slice(start + match[0].length);
  const next = rest.match(/\n##\s+/);
  const end = next ? start + match[0].length + next.index : normalized.length;
  return `${normalized.slice(0, start).replace(/\n+$/, "\n\n")}${navigation}${normalized.slice(end).replace(/^\n+/, "\n\n")}\n`;
}

function archiveNavigation(project, linkOptions) {
  return [
    "## Navigation",
    "",
    `- ${pmWikiLink("archive/archive", "Back to archive", linkOptions)}`,
    `- ${pmWikiLink(project, `Back to ${project}`, linkOptions)}`,
    "- [[Projects/Projects|Back to Projects]]",
    "- [[Home|Back to Home]]",
  ].join("\n");
}

function archivedPlanContent(original, { project, linkOptions, date }) {
  const split = splitFrontmatter(original);
  if (!split) return { issue: "linked planning note has unparseable frontmatter" };

  let fm = split.frontmatter;
  const status = frontmatterValue(fm, "status");
  const terminal = new Set(["shipped", "rejected", "superseded"]);
  if (!status || status === "active" || status === "proposed") {
    fm = setFrontmatterValue(fm, "status", "shipped");
  } else if (!terminal.has(status)) {
    return { issue: `linked planning note has unsupported status \`${status}\`` };
  }

  fm = setFrontmatterValue(fm, "updated", date);
  fm = setFrontmatterValue(fm, "last_reviewed", date);
  fm = setFrontmatterValue(fm, "icon", "\"LiArchive\"");
  fm = setFrontmatterValue(fm, "iconColor", "\"#64748b\"");
  fm = setFrontmatterValue(fm, "archived", date);

  let body = split.body.replace(/^\n+/, "");
  if (!/^#\s+/m.test(body)) {
    body = "# archived planning note\n\n" + body;
  }
  if (!/^> \*\*Archived\b/m.test(body)) {
    body = body.replace(/^#\s+(.+?)\s*$/m, (line) =>
      `${line}\n\n> **Archived ${date}.** Automatically moved from active roadmap/plans because the mirrored done-pending checklist is complete.`
    );
  }
  body = replaceNavigationSection(body, archiveNavigation(project, linkOptions));

  return {
    updated: `---\n${fm.trimEnd()}\n---\n${body.replace(/^\n+/, "")}`,
  };
}

function linkTargetsInLine(line) {
  const targets = [];
  const re = /!?\[\[([^\]\n]+)\]\]/g;
  let match;
  while ((match = re.exec(line))) {
    targets.push(parseWikiLinkBody(match[1]).target);
  }
  return targets;
}

function targetMatchesRel(target, rel) {
  const normalized = normalizeLinkPath(target);
  const normalizedRel = normalizeLinkPath(rel);
  return (
    normalized === normalizedRel ||
    normalized.endsWith(`/${normalizedRel}`) ||
    (!normalized.includes("/") && normalized === basenameNoExt(normalizedRel))
  );
}

function updateIndexNotes(content, { removeRels = [], addRel = null, addDisplay = null, linkOptions = {}, date }) {
  const markerRe = /(<!--\s*vault-maintain:index:start\s*-->[\s\S]*?^## Notes\s*$\n)([\s\S]*?)(\n<!--\s*vault-maintain:index:end\s*-->)/m;
  const match = content.match(markerRe);
  if (!match) return touchFrontmatter(content, date);

  const existingLines = match[2].split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "*(no items)*") return false;
    const targets = linkTargetsInLine(line);
    return !targets.some((target) => removeRels.some((rel) => targetMatchesRel(target, rel)));
  });

  if (addRel) {
    const alreadyPresent = existingLines.some((line) =>
      linkTargetsInLine(line).some((target) => targetMatchesRel(target, addRel))
    );
    if (!alreadyPresent) {
      existingLines.push(`- ${pmWikiLink(addRel, addDisplay ?? basenameNoExt(addRel), linkOptions)}`);
    }
  }

  const noteLines = existingLines
    .filter((line) => line.trim())
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  const notesBody = noteLines.length > 0 ? noteLines.join("\n") : "*(no items)*";
  const updated = content.replace(markerRe, `${match[1]}${notesBody}${match[3]}`);
  return touchFrontmatter(updated, date);
}

function defaultFolderIndex(project, page, body, icon, iconColor, date, linkOptions) {
  return `---\ntitle: "${page}"\ntags:\n  - project-management\ncreated: ${date}\nupdated: ${date}\nlast_reviewed: ${date}\npageType: index\nstatus: active\nowner: PM\nicon: "${icon}"\niconColor: "${iconColor}"\n---\n# ${page}\n\n${body}\n\n<!-- vault-maintain:index:start -->\n## Subfolders\n\n*(no items)*\n\n## Notes\n\n*(no items)*\n<!-- vault-maintain:index:end -->\n\n## Navigation\n\n- ${pmWikiLink(project, `Back to ${project}`, linkOptions)}\n- [[Projects/Projects|Back to Projects]]\n- [[Home|Back to Home]]\n`;
}

function ensureIndexLink(filePath, { project, page, body, icon, iconColor, addRel, addDisplay, linkOptions, date }) {
  const original = existsSync(filePath)
    ? readFileSync(filePath, "utf8")
    : defaultFolderIndex(project, page, body, icon, iconColor, date, linkOptions);
  const updated = updateIndexNotes(original, { addRel, addDisplay, linkOptions, date });
  if (updated !== original || !existsSync(filePath)) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, updated);
    process.stdout.write(`fixed: ${relative(process.cwd(), filePath)}\n`);
  }
}

function removeIndexLink(filePath, { removeRel, date }) {
  if (!existsSync(filePath)) return;
  const original = readFileSync(filePath, "utf8");
  const updated = updateIndexNotes(original, { removeRels: [removeRel], date });
  if (updated !== original) {
    writeFileSync(filePath, updated);
    process.stdout.write(`fixed: ${relative(process.cwd(), filePath)}\n`);
  }
}

function archivedHistoryNote(project, month, date, linkOptions) {
  return `---\ntitle: history-${date}-archived-sections\naliases: [${project} archived sections ${date}]\ntags:\n  - project-management\n  - history\n  - archive\nkind: mixed\ncreated: ${date}\nupdated: ${date}\nlast_reviewed: ${date}\npageType: history\nicon: "LiCalendar"\niconColor: "#8b5cf6"\nowner: PM\n---\n# history-${date}-archived-sections\n\nCompleted \`roadmap/done-pending.md\` sections archived on ${date}.\n\n## Navigation\n\n- ${pmWikiLink(`history/${month}/${month}`, `Back to ${month}`, linkOptions)}\n- ${pmWikiLink("history/history", "Back to history", linkOptions)}\n- ${pmWikiLink(project, `Back to ${project}`, linkOptions)}\n- [[Projects/Projects|Back to Projects]]\n- [[Home|Back to Home]]\n`;
}

function archivedSectionEntry(item, linkOptions) {
  const sectionBody = item.body
    .replace(/^Planning note:\s*.+\n?/m, "")
    .trim();
  return [
    `## ${item.heading}`,
    "",
    `Planning note archived to: ${pmWikiLink(item.archiveRel, basenameNoExt(item.archiveRel), linkOptions)}`,
    "",
    "Archived roadmap checklist:",
    "",
    sectionBody || "*(no checklist body captured)*",
    "",
  ].join("\n");
}

function appendArchivedSectionHistory(filePath, { project, month, date, item, linkOptions }) {
  const original = existsSync(filePath)
    ? readFileSync(filePath, "utf8")
    : archivedHistoryNote(project, month, date, linkOptions);
  if (new RegExp(`^##\\s+${escapeRegExp(item.heading)}\\s*$`, "m").test(original)) return;
  const navigation = original.match(/^## Navigation\s*$/m);
  const entry = archivedSectionEntry(item, linkOptions);
  const updated = navigation
    ? `${original.slice(0, navigation.index).replace(/\n+$/, "\n\n")}${entry}\n${original.slice(navigation.index)}`
    : `${original.replace(/\n+$/, "\n\n")}${entry}`;
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, touchFrontmatter(updated, date));
  process.stdout.write(`fixed: ${relative(process.cwd(), filePath)}\n`);
}

function rewriteExactPlanningLinks(pmFolder, items, linkOptions) {
  const files = [];
  function walk(abs) {
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const child = join(abs, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(child);
    }
  }
  walk(pmFolder);

  for (const file of files) {
    const original = readFileSync(file, "utf8");
    let changed = false;
    const updated = original.replace(/(!?)\[\[([^\]\n]+)\]\]/g, (match, imagePrefix, body) => {
      const parsed = parseWikiLinkBody(body);
      const item = items.find((candidate) => targetMatchesRel(parsed.target, candidate.planRel));
      if (!item) return match;
      const oldBase = basenameNoExt(item.planRel);
      const archiveTarget = pmRelToVaultTarget(item.archiveRel, linkOptions);
      const archiveBase = basenameNoExt(item.archiveRel);
      const display = parsed.display && parsed.display !== oldBase ? parsed.display : archiveBase;
      changed = true;
      return `${imagePrefix}[[${renderWikiLinkBody({ target: archiveTarget, heading: parsed.heading, display })}]]`;
    });
    if (changed) {
      writeFileSync(file, updated);
      process.stdout.write(`fixed: ${relative(pmFolder, file).split("\\").join("/")} links to archived plan\n`);
    }
  }
}

function archiveCompletedPlanningMirrors({ target, project, donePendingContent, markdownTargets, linkOptions, date }) {
  const planned = planArchiveReadyDonePendingSections(donePendingContent, markdownTargets);
  const issues = [...planned.manualReview.map((item) => `roadmap/done-pending.md: ${item}`)];
  const archived = [];
  if (planned.archives.length === 0) {
    return { updated: donePendingContent, issues, archived };
  }

  const ready = [];
  for (const item of planned.archives) {
    const planPath = join(target.vault, `${item.planRel}.md`);
    const archivePath = join(target.vault, `${item.archiveRel}.md`);
    if (!existsSync(planPath)) {
      issues.push(`roadmap/done-pending.md: completed planning mirror \`## ${item.heading}\` planning file disappeared before archive: ${item.planRel}.md`);
      continue;
    }
    if (existsSync(archivePath)) {
      issues.push(`roadmap/done-pending.md: completed planning mirror \`## ${item.heading}\` archive target already exists: ${item.archiveRel}.md`);
      continue;
    }
    const planContent = readFileSync(planPath, "utf8");
    const archivedContent = archivedPlanContent(planContent, { project, linkOptions, date });
    if (archivedContent.issue) {
      issues.push(`roadmap/done-pending.md: completed planning mirror \`## ${item.heading}\` ${archivedContent.issue}`);
      continue;
    }
    ready.push({ ...item, planPath, archivePath, archivedContent: archivedContent.updated });
  }

  if (ready.length === 0) {
    return { updated: donePendingContent, issues, archived };
  }

  const month = date.slice(0, 7);
  const archivedHistoryPath = join(target.vault, "history", month, `history-${date}-archived-sections.md`);

  for (const item of ready) {
    mkdirSync(dirname(item.archivePath), { recursive: true });
    writeFileSync(item.archivePath, item.archivedContent);
    unlinkSync(item.planPath);
    process.stdout.write(`fixed: ${item.planRel}.md -> ${item.archiveRel}.md\n`);

    removeIndexLink(join(target.vault, "roadmap", "plans", "plans.md"), { removeRel: item.planRel, date });
    ensureIndexLink(join(target.vault, "archive", "archive.md"), {
      project,
      page: "archive",
      body: "Superseded material replaced by current product, system, roadmap, or `roadmap/plans/` and `decisions/` docs.",
      icon: "LiArchive",
      iconColor: "#64748b",
      addRel: item.archiveRel,
      addDisplay: basenameNoExt(item.archiveRel),
      linkOptions,
      date,
    });
    appendArchivedSectionHistory(archivedHistoryPath, { project, month, date, item, linkOptions });
    ensureIndexLink(join(target.vault, "history", month, `${month}.md`), {
      project,
      page: month,
      body: `History entries for ${month}.`,
      icon: "LiCalendar",
      iconColor: "#8b5cf6",
      addRel: `history/${month}/history-${date}-archived-sections`,
      addDisplay: `history-${date}-archived-sections`,
      linkOptions,
      date,
    });
    archived.push(item);
  }

  const withoutArchived = removeDonePendingSections(donePendingContent, ready);
  const toc = syncDonePendingContents(withoutArchived);
  return { updated: toc.updated, issues, archived };
}

function runFor(target) {
  const project = target.project ?? basename(target.vault);
  const issues = [];
  const manualReview = [];
  const markdownTargets = collectMarkdownTargets(target.vault);
  const linkOptions = { pmFolder: target.vault, vaultRoot: findVaultRoot(target.vault, target.configPath) };
  const activeMilestone = activeMilestoneInfo({ pmFolder: target.vault, project, configPath: target.configPath });

  const ideasPath = join(target.vault, "roadmap/ideas.md");
  const knownIssuesPath = join(target.vault, "roadmap/known-issues.md");
  const milestonesDir = join(target.vault, "roadmap/milestones");
  const milestonesIndexPath = join(milestonesDir, "milestones.md");
  const donePendingPath = join(target.vault, "roadmap/done-pending.md");
  let donePendingForPlanTraceability = null;

  // ---- D-008: ideas.md status colors ----
  const ideasContent = readIfExists(ideasPath);
  if (ideasContent !== null) {
    let working = ideasContent;
    const lead = insertIdeasStatusColorsLeadNote(ideasContent);
    working = lead.updated;
    const emoji = insertStatusEmojisInIdeas(working);
    working = emoji.updated;
    const summary = ensureIdeaDetailSummaries(working);
    working = summary.updated;
    if (CLI.fix) writeIfChanged(ideasPath, ideasContent, working, "roadmap/ideas.md");
    if (lead.changes.length > 0 || emoji.changes.length > 0 || summary.changes.length > 0) {
      // The fix is about to be applied; we won't re-report the same
      // items as FAIL when --fix is on, but we will still note them.
      if (!CLI.fix) {
        for (const c of lead.changes) issues.push(`roadmap/ideas.md: D-008 ${c}`);
        for (const c of emoji.changes) issues.push(`roadmap/ideas.md: D-008 ${c}`);
        for (const c of summary.changes) issues.push(`roadmap/ideas.md: D-012 ${c}`);
      }
    }
    // If the Status Key has a status name that is NOT in the canonical
    // list, flag it.
    const statusKeyMatch = working.match(/^## Status Key[\s\S]*?\n([\s\S]*?)\n## /m);
    if (statusKeyMatch) {
      const statusKeyBody = statusKeyMatch[1];
      const hasBrainstorming = /Brainstorming/.test(statusKeyBody);
      if (!hasBrainstorming) {
        issues.push(`roadmap/ideas.md: D-008 ## Status Key has no "Brainstorming" row; convention may be diverged.`);
      }
    }
    for (const r of lead.manualReview) manualReview.push(r);
    for (const r of emoji.manualReview) manualReview.push(r);
    for (const r of summary.manualReview) manualReview.push(r);
  }

  // ---- D-009: known-issues.md (no `## Fixed`, domain grouping) ----
  const knownIssuesContent = readIfExists(knownIssuesPath);
  if (knownIssuesContent !== null) {
    const drop = dropEmptyFixedSection(knownIssuesContent);
    if (CLI.fix) writeIfChanged(knownIssuesPath, knownIssuesContent, drop.updated, "roadmap/known-issues.md (drop `## Fixed`)");
    if (drop.changes.length > 0 && !CLI.fix) {
      for (const c of drop.changes) issues.push(`roadmap/known-issues.md: D-009 ${c}`);
    }
    const domain = checkDomainGroupingInActive(drop.updated);
    for (const r of domain.manualReview) manualReview.push(r);
    if (drop.manualReview.length > 0) {
      for (const r of drop.manualReview) manualReview.push(r);
      if (!CLI.fix) {
        for (const r of drop.manualReview) issues.push(`roadmap/known-issues.md: D-009 ${r}`);
      }
    }
  }

  // ---- D-015: milestone note shape ----
  if (activeMilestone && !existsSync(activeMilestone.abs)) {
    if (CLI.fix) {
      mkdirSync(milestonesDir, { recursive: true });
      const indexOriginal = existsSync(milestonesIndexPath)
        ? readFileSync(milestonesIndexPath, "utf8")
        : milestonesIndexContent({ project, date: todayIsoDate(), linkOptions });
      const indexUpdated = ensureMilestonesIndexLink(indexOriginal, {
        slug: activeMilestone.slug,
        linkOptions,
        description: `Active ${activeMilestone.phase} milestone`,
      }).updated;
      writeIfChanged(
        milestonesIndexPath,
        existsSync(milestonesIndexPath) ? indexOriginal : "",
        indexUpdated !== indexOriginal ? touchFrontmatter(indexUpdated, todayIsoDate()) : indexUpdated,
        "roadmap/milestones/milestones.md"
      );
      writeNewFile(activeMilestone.abs, milestoneNoteContent({
        project,
        slug: activeMilestone.slug,
        phase: activeMilestone.phase,
        date: todayIsoDate(),
        linkOptions,
      }), activeMilestone.rel);
    } else {
      issues.push(`${activeMilestone.rel}: D-015 active milestone for phase \`${activeMilestone.phase}\` is missing`);
    }
  }

  if (existsSync(milestonesDir)) {
    const milestoneFiles = listMilestoneNoteRels(target.vault);
    if (milestoneFiles.length === 0) {
      issues.push("roadmap/milestones/: D-015 missing at least one milestone note such as mvp.md, alpha.md, beta.md, or launch.md");
    }
    for (const rel of milestoneFiles) {
      const abs = join(target.vault, rel);
      const content = readIfExists(abs);
      if (content === null) continue;
      const withoutRelatedNotes = CLI.fix
        ? removeDeprecatedMilestoneRelatedNotes(content, rel)
        : { updated: content, changes: [], manualReview: [] };
      const triggers = ensureMilestoneUpdateTriggers(withoutRelatedNotes.updated);
      const working = CLI.fix && (triggers.updated !== withoutRelatedNotes.updated || withoutRelatedNotes.updated !== content)
        ? touchFrontmatter(triggers.updated, todayIsoDate())
        : triggers.updated;
      if (CLI.fix) {
        writeIfChanged(abs, content, working, rel);
        const indexOriginal = existsSync(milestonesIndexPath)
          ? readFileSync(milestonesIndexPath, "utf8")
          : milestonesIndexContent({ project, date: todayIsoDate(), linkOptions });
        const indexUpdated = ensureMilestonesIndexLink(indexOriginal, {
          slug: milestoneSlugFromRel(rel),
          linkOptions,
          description: `${milestoneSlugFromRel(rel)} milestone`,
        }).updated;
        writeIfChanged(
          milestonesIndexPath,
          existsSync(milestonesIndexPath) ? indexOriginal : "",
          indexUpdated !== indexOriginal ? touchFrontmatter(indexUpdated, todayIsoDate()) : indexUpdated,
          "roadmap/milestones/milestones.md"
        );
      }
      const shape = checkMilestoneNoteShape(working, rel);
      for (const r of shape.manualReview) {
        manualReview.push(r);
        issues.push(r.includes("Related Notes") ? `D-016 ${r}` : `D-015 ${r}`);
      }
    }
  }

  // ---- D-007: done-pending.md slug-only H2 ----
  const donePendingContent = readIfExists(donePendingPath);
  if (donePendingContent !== null) {
    let working = donePendingContent;
    const rename = renameDatePrefixedH2s(donePendingContent);
    working = rename.updated;
    const planningLinks = linkDonePendingPlanningNotes(working, markdownTargets, linkOptions);
    working = planningLinks.updated;
    const relevantLinks = normalizeDonePendingRelevantLinks(working, markdownTargets, linkOptions);
    working = relevantLinks.updated;
    const missingConfirmation = findPlanningMirrorsMissingHumanArchiveConfirmation(working);
    const confirmation = ensureHumanArchiveConfirmation(working);
    working = confirmation.updated;
    const toc = syncDonePendingContents(working);
    working = toc.updated;
    let archiveFix = { updated: working, issues: [], archived: [] };
    if (CLI.fix) writeIfChanged(donePendingPath, donePendingContent, working, "roadmap/done-pending.md");
    if (CLI.fix) {
      archiveFix = archiveCompletedPlanningMirrors({
        target,
        project,
        donePendingContent: working,
        markdownTargets,
        linkOptions,
        date: todayIsoDate(),
      });
      working = archiveFix.updated;
      issues.push(...archiveFix.issues);
      if (archiveFix.archived.length > 0) {
        writeIfChanged(donePendingPath, readIfExists(donePendingPath) ?? donePendingContent, working, "roadmap/done-pending.md");
        rewriteExactPlanningLinks(target.vault, archiveFix.archived, linkOptions);
      }
    } else {
      for (const heading of missingConfirmation) {
        issues.push(
          `roadmap/done-pending.md: planning mirror \`## ${heading}\` missing human archive confirmation checkbox`
        );
      }
      const archiveReady = findArchiveReadyDonePendingSections(working);
      for (const heading of archiveReady) {
        issues.push(
          `roadmap/done-pending.md: completed planning mirror \`## ${heading}\` should be archived to history and its linked planning note moved to archive/`
        );
      }
    }
    if ((rename.changes.length > 0 || planningLinks.changes.length > 0 || relevantLinks.changes.length > 0 || toc.changes.length > 0) && !CLI.fix) {
      for (const c of rename.changes) issues.push(`roadmap/done-pending.md: D-007 ${c}`);
      for (const c of planningLinks.changes) issues.push(`roadmap/done-pending.md: D-012 ${c}`);
      for (const c of relevantLinks.changes) issues.push(`roadmap/done-pending.md: D-012 ${c}`);
      for (const c of toc.changes) issues.push(`roadmap/done-pending.md: D-012 ${c}`);
    }
    for (const r of rename.manualReview) manualReview.push(r);
    for (const r of planningLinks.manualReview) manualReview.push(r);
    for (const r of relevantLinks.manualReview) manualReview.push(r);
    for (const r of confirmation.manualReview) manualReview.push(r);
    for (const r of toc.manualReview) manualReview.push(r);
    donePendingForPlanTraceability = working;
  }

  // ---- D-018: planning notes link back to their done-pending mirror ----
  if (donePendingForPlanTraceability !== null) {
    const planRels = markdownTargets
      .filter((rel) => rel.startsWith("roadmap/plans/") && rel !== "roadmap/plans/plans")
      .sort();
    for (const rel of planRels) {
      const abs = join(target.vault, `${rel}.md`);
      const content = readIfExists(abs);
      if (content === null) continue;
      const status = planningNoteStatus(content);
      if (status !== "active" && status !== "proposed") continue;

      const trace = ensurePlanRelatedLinks(content, {
        planRel: rel,
        donePendingContent: donePendingForPlanTraceability,
        linkOptions,
      });
      const working = CLI.fix && trace.updated !== content
        ? touchFrontmatter(trace.updated, todayIsoDate())
        : trace.updated;
      if (CLI.fix) writeIfChanged(abs, content, working, rel);
      if (trace.changes.length > 0 && !CLI.fix) {
        for (const c of trace.changes) issues.push(`D-018 ${c}`);
      }
      for (const r of trace.manualReview) {
        manualReview.push(r);
        issues.push(`D-018 ${r}`);
      }
    }
  }

  // Report
  console.log(`\n# Roadmap Conventions Report — ${target.label}\n`);
  console.log(`**Status:** ${issues.length === 0 ? "PASS" : "FAIL"}`);
  console.log("");
  if (issues.length === 0) {
    console.log("All content-level conventions (D-007 / D-008 / D-009 / D-012 / D-015 / D-016 / D-018) hold for the project's roadmap files.");
  } else {
    for (const issue of issues) console.log(`- ${issue}`);
  }
  if (manualReview.length > 0) {
    console.log("\n## Manual Review\n");
    for (const r of manualReview) console.log(`- ${r}`);
  }
  return { fail: issues.length, manualReview };
}

let totalFail = 0;
const allManualReview = [];
for (const target of resolveTargets()) {
  const r = runFor(target);
  totalFail += r.fail;
  allManualReview.push(...r.manualReview);
}
if (allManualReview.length > 0) {
  console.log("\n# Manual Review Summary\n");
  console.log("The following items need human judgment (the auto-fixer cannot pick project-specific names). Address them by hand, then re-run the validator to confirm PASS:\n");
  for (const r of allManualReview) console.log(`- ${r}`);
}
process.exit(totalFail > 0 ? 1 : 0);
