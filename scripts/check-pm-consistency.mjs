#!/usr/bin/env node
/**
 * check-pm-consistency.mjs
 *
 * Strict visible-file consistency check for project-management PM folders.
 * Hidden dot-directories are ignored as sync/tooling state.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { findVaultRoot, resolveProjectsConfigPath, findSkillDir } from "./lib/paths.mjs";
import { loadPmSkip, isSkipped } from "./lib/skip.mjs";
import { expectedPageTypeForPath, isFolderNotePath } from "./lib/convention.mjs";
import { parseFrontmatter, markdownStem, wikiLinks } from "./lib/markdown.mjs";
import { projectPathFromVault } from "./lib/obsidian-links.mjs";
import { normalizePmFrontmatter } from "./lib/frontmatter-fixers.mjs";
import { activeMilestoneInfo, phaseFromCurrentStatusContent } from "./lib/milestones.mjs";

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
const today = new Date().toISOString().slice(0, 10);

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
    .filter(([project, proj]) => Boolean(proj.pm_folder))
    .map(([project, proj]) => ({ vault: resolve(proj.pm_folder), label: `${project} (${proj.pm_folder})`, project, configPath }));
}

function walk(root, skipSet) {
  const out = [];
  function rec(abs) {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const child = join(abs, entry.name);
      if (entry.isDirectory()) rec(child);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        const rel = relative(root, child).split("\\").join("/");
        if (skipSet && isSkipped(skipSet, rel)) continue;
        out.push(child);
      }
    }
  }
  rec(root);
  return out;
}

function stem(rel) {
  return markdownStem(rel);
}

function isFolderNote(rel, project) {
  return isFolderNotePath(rel, project);
}

function expectedPageType(rel, project, existing) {
  return expectedPageTypeForPath(rel, project, existing);
}

function resolveLinkTarget(target, project, projectPath) {
  if (target === "Home" || target === "Projects/Projects") return null;
  const legacyPrefix = `Projects/${project}/`;
  const prefixes = [projectPath ? `${projectPath}/` : null, legacyPrefix].filter(Boolean);
  const matchedPrefix = prefixes.find((prefix) => target.startsWith(prefix));
  if (matchedPrefix) return target.slice(matchedPrefix.length).replace(/\.md$/, "");
  if (target.startsWith("Projects/")) return null;
  return target.replace(/\.md$/, "");
}

function checkTarget(targets, normalizedTarget) {
  if (!normalizedTarget) return true;
  return targets.has(normalizedTarget);
}

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function maxFrontmatterDate(fm) {
  const dates = [fm?.updated, fm?.last_reviewed].filter(isIsoDate).sort();
  return dates.at(-1) ?? null;
}

function isPriorityBearingRel(rel) {
  return (
    rel === "roadmap/done-pending.md" ||
    rel === "roadmap/known-issues.md" ||
    rel.startsWith("roadmap/plans/") ||
    rel.startsWith("roadmap/milestones/") ||
    rel.startsWith("decisions/") ||
    rel.startsWith("features/")
  );
}

function runFor(target) {
  const project = target.project ?? basename(target.vault);
  const skipSet = loadPmSkip(target.vault);
  const files = walk(target.vault, skipSet);
  // Load projects.json (if any) to read the canonical phase. Used by
  // the phase-consistency rule below. Cached here so we read the file
  // once per run, not once per file.
  let expectedPhase = null;
  const configPath = resolveProjectsConfigPath(CLI.config ? resolve(CLI.config) : null);
  const projectPath = projectPathFromVault(findVaultRoot(target.vault, target.configPath ?? configPath), target.vault);
  if (configPath && existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, "utf8"));
      const proj = cfg.projects?.[project];
      if (proj?.phase) expectedPhase = String(proj.phase);
    } catch {
      // malformed projects.json: skip the rule rather than fail the run
    }
  }
  const targets = new Set(files.map((abs) => relative(target.vault, abs).split("\\").join("/").replace(/\.md$/, "")));
  const issues = [];
  const frontmatterByRel = new Map();
  const donePendingPath = join(target.vault, "roadmap/done-pending.md");
  const donePending = existsSync(donePendingPath) ? readFileSync(donePendingPath, "utf8") : "";

  for (const abs of files) {
    const rel = relative(target.vault, abs).split("\\").join("/");
    let content = readFileSync(abs, "utf8");
    if (CLI.fix) {
      const fixed = normalizePmFrontmatter(content, { rel, project, date: today });
      if (fixed.changes.length > 0 && fixed.updated !== content) {
        try {
          writeFileSync(abs, fixed.updated);
          content = fixed.updated;
          process.stdout.write(`fixed: ${rel}: ${fixed.changes.join(", ")}\n`);
        } catch (err) {
          process.stderr.write(`--fix failed for ${rel}: ${err.message}\n`);
        }
      }
    }
    const fm = parseFrontmatter(content);
    if (!fm) {
      issues.push(`${rel}: missing frontmatter`);
      continue;
    }
    frontmatterByRel.set(rel, fm);
    for (const key of ["title", "created", "updated", "last_reviewed", "pageType"]) {
      if (!fm[key]) issues.push(`${rel}: missing ${key}`);
    }
    const expected = expectedPageType(rel, project, fm.pageType);
    if (fm.pageType !== expected) {
      if (CLI.fix) {
        // --fix: rewrite pageType in the file's frontmatter
        const abs = join(target.vault, rel);
        try {
          const original = readFileSync(abs, "utf8");
          let updated;
          if (/^pageType:\s*.+$/m.test(original)) {
            updated = original.replace(/^pageType:\s*.+$/m, `pageType: ${expected}`);
          } else {
            // pageType missing entirely; insert it after the `title:` line in frontmatter
            updated = original.replace(/^(title:\s*.+)$/m, `$1\npageType: ${expected}`);
          }
          if (updated !== original) {
            writeFileSync(abs, updated);
            process.stdout.write(`fixed: ${rel} pageType → ${expected}\n`);
            continue;
          }
        } catch (err) {
          process.stderr.write(`--fix failed for ${rel}: ${err.message}\n`);
        }
      }
      let msg = `${rel}: pageType ${fm.pageType}, expected ${expected}`;
      if (!fm.pageType) {
        if (rel.startsWith("decisions/D-")) {
          msg = `${rel}: missing pageType. Did you mean \`pageType: decision\`? (Decision files live under \`decisions/D-*\`.)`;
        } else if (rel.startsWith("roadmap/plans/")) {
          msg = `${rel}: missing pageType. Did you mean \`pageType: planning\`? (Planning files live under \`roadmap/plans/\`.)`;
        } else if (rel.startsWith("features/") && rel !== "features/features.md") {
          msg = `${rel}: missing pageType. Did you mean \`pageType: feature\`? (Feature files live under \`features/<slug>.md\`.)`;
        } else if (rel.startsWith("system/") && rel !== "system/system.md") {
          msg = `${rel}: missing pageType. Did you mean \`pageType: system\`? (System files live under \`system/<topic>.md\`.)`;
        } else if (rel.startsWith("history/")) {
          msg = `${rel}: missing pageType. Did you mean \`pageType: history\`? (History logs live under \`history/YYYY-MM/history-YYYY-MM-DD.md\`.)`;
        } else if (rel.startsWith("docs/") && rel !== "docs/docs.md") {
          msg = `${rel}: missing pageType. Did you mean \`pageType: note\`? (Doc files live under \`docs/<Guide>/<topic>.md\`.)`;
        } else if (rel.startsWith("roadmap/") && rel !== "roadmap/roadmap.md") {
          msg = `${rel}: missing pageType. Did you mean \`pageType: roadmap\`? (Roadmap files live under \`roadmap/<lane>.md\`.)`;
        }
      }
      issues.push(msg);
    }
    if (fm.status === "archived") issues.push(`${rel}: status must not be archived; use archived: date`);
    if (fm.pageType === "history") {
      if (/^history\/\d{4}-\d{2}\/history-\d{4}-\d{2}-\d{2}/.test(rel) && !fm.kind) {
        issues.push(`${rel}: history log missing kind`);
      }
      if (fm.status) issues.push(`${rel}: history file should omit status`);
    } else if (!fm.status) {
      issues.push(`${rel}: missing status`);
    }
    if (rel.startsWith("archive/") && rel.endsWith("-archived.md") && !fm.archived) {
      issues.push(`${rel}: archived file missing archived date`);
    }
    if (fm.archived && !(rel.startsWith("archive/") && rel.endsWith("-archived.md"))) {
      issues.push(`${rel}: archived field is only valid on moved archive files matching archive/*-archived.md`);
    }
    if (rel.includes("sync-conflict")) issues.push(`${rel}: sync-conflict file should be resolved or removed`);
    if (rel.startsWith("archive/") && !isFolderNote(rel, project) && rel !== "archive/archive.md" && !rel.endsWith("-archived.md")) {
      issues.push(`${rel}: visible archive file should use *-archived.md`);
    }
    // Phase consistency: if projects.json is loadable and has a
    // `phase` for this project, the body of `## Current Phase` in
    // CURRENT_STATUS.md and PRODUCT.md must match. Drift means the
    // user edited the value in one place but not the other; the fix
    // is `bootstrap-pm.mjs --sync`.
    if ((rel === "CURRENT_STATUS.md" || rel === "PRODUCT.md") && expectedPhase) {
      const phaseBody = phaseFromCurrentStatusContent(content);
      if (phaseBody) {
        if (phaseBody !== expectedPhase) {
          issues.push(
            `${rel}: ## Current Phase body is "${phaseBody}" but projects.json has phase "${expectedPhase}". Run \`bootstrap-pm.mjs --project <name> --sync\` to fix.`
          );
        }
      }
    }
    if (rel.startsWith("roadmap/plans/") && !isFolderNote(rel, project)) {
      const stem_ = stem(rel);
      const date = stem_.match(/^\d{4}-\d{2}-\d{2}/)?.[1];
      const slug = stem_.replace(/^\d{4}-\d{2}-\d{2}_?/, "");
      const slugSpaced = slug.replace(/-/g, " ");
      const slugTokens = slug.split(/[-_.]/).filter((t) => t.length > 1);
      const h2s = donePending.match(/^## [^\n]+$/gm) ?? [];
      const ok = h2s.some((h2) => {
        if (h2.includes(stem_)) return true;
        if (h2.includes(slug)) return true;
        if (h2.includes(slugSpaced)) return true;
        if (date && h2.includes(date)) return true;
        const h2Lower = h2.toLowerCase();
        const matches = slugTokens.filter((t) => h2Lower.includes(t.toLowerCase()));
        return matches.length >= 2;
      });
      if (!ok) issues.push(`${rel}: missing roadmap/done-pending mirror section`);
    }
    for (const link of wikiLinks(content)) {
      const normalized = resolveLinkTarget(link, project, projectPath);
      if (!checkTarget(targets, normalized)) issues.push(`${rel}: unresolved link [[${link}]]`);
    }
  }

  const currentStatusDate = maxFrontmatterDate(frontmatterByRel.get("CURRENT_STATUS.md"));
  for (const [rel, fm] of frontmatterByRel.entries()) {
    if (!isPriorityBearingRel(rel)) continue;
    const priorityDate = maxFrontmatterDate(fm);
    if (!priorityDate) continue;
    if (!currentStatusDate) {
      issues.push(`CURRENT_STATUS.md: cannot compare freshness because updated/last_reviewed is missing or invalid`);
      break;
    }
    if (priorityDate > currentStatusDate) {
      issues.push(
        `CURRENT_STATUS.md: stale relative to ${rel} (${priorityDate}); refresh current priorities/blockers/risks before history`
      );
    }
  }

  const activeMilestone = activeMilestoneInfo({
    pmFolder: target.vault,
    project,
    configPath: target.configPath ?? configPath,
    fallbackPhase: expectedPhase,
  });
  if (activeMilestone) {
    const activeFm = frontmatterByRel.get(activeMilestone.rel);
    const activeDate = maxFrontmatterDate(activeFm);
    if (!existsSync(activeMilestone.abs)) {
      issues.push(`${activeMilestone.rel}: active milestone for phase "${activeMilestone.phase}" is missing`);
    } else if (!activeDate) {
      issues.push(`${activeMilestone.rel}: cannot compare freshness because updated/last_reviewed is missing or invalid`);
    } else {
      for (const [rel, fm] of frontmatterByRel.entries()) {
        if (!isPriorityBearingRel(rel) || rel === activeMilestone.rel) continue;
        const priorityDate = maxFrontmatterDate(fm);
        if (!priorityDate) continue;
        if (priorityDate > activeDate) {
          issues.push(
            `${activeMilestone.rel}: stale relative to ${rel} (${priorityDate}); review/update active milestone before history`
          );
        }
      }
    }
  }

  console.log(`\n# PM Consistency Report — ${target.label}\n`);
  console.log(`**Status:** ${issues.length === 0 ? "PASS" : "FAIL"}`);
  console.log("");
  if (issues.length === 0) {
    console.log(`All ${files.length} visible markdown files pass the strict PM consistency check.`);
  } else {
    for (const issue of issues) console.log(`- ${issue}`);
  }
  return issues.length;
}

let total = 0;
for (const target of resolveTargets()) total += runFor(target);
process.exit(total > 0 ? 1 : 0);
