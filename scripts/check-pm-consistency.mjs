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

import { resolveProjectsConfigPath, findSkillDir } from "./lib/paths.mjs";

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
  if (!configPath) return [{ vault: resolve(CLI.vault ?? process.cwd()), label: resolve(CLI.vault ?? process.cwd()) }];
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  if (CLI.project) {
    const proj = cfg.projects?.[CLI.project];
    if (proj?.access === "unavailable") {
      console.log(`# PM Consistency Report — ${CLI.project}\n`);
      console.log(`**Status:** SKIP`);
      console.log("");
      console.log(`PM folder unavailable for this collaborator checkout; no consistency scan was run.`);
      return [];
    }
    if (!proj?.pm_folder) {
      const reason = proj
        ? `project '${CLI.project}' has no pm_folder`
        : `project '${CLI.project}' not found`;
      console.error(configSetupError(CLI.project, configPath, reason));
      process.exit(2);
    }
    return [{ vault: resolve(proj.pm_folder), label: `${CLI.project} (${proj.pm_folder})`, project: CLI.project }];
  }
  return Object.entries(cfg.projects ?? {})
    .filter(([project, proj]) => {
      if (proj.access !== "unavailable") return true;
      console.log(`\n# PM Consistency Report — ${project}\n`);
      console.log(`**Status:** SKIP`);
      console.log("");
      console.log(`PM folder unavailable for this collaborator checkout; no consistency scan was run.`);
      return false;
    })
    .filter(([, proj]) => proj.pm_folder)
    .map(([project, proj]) => ({ vault: resolve(proj.pm_folder), label: `${project} (${proj.pm_folder})`, project }));
}

function walk(root) {
  const out = [];
  function rec(abs) {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const child = join(abs, entry.name);
      if (entry.isDirectory()) rec(child);
      else if (entry.isFile() && entry.name.endsWith(".md")) out.push(child);
    }
  }
  rec(root);
  return out;
}

function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function stem(rel) {
  return basename(rel, ".md");
}

function isFolderNote(rel, project) {
  const parts = rel.split("/");
  const parent = parts.length === 1 ? project : parts[parts.length - 2];
  return stem(rel) === parent;
}

function expectedPageType(rel, project, existing) {
  if (isFolderNote(rel, project)) return "index";
  if (["README.md", "PRODUCT.md", "CURRENT_STATUS.md"].includes(rel)) return "index";
  if (rel.startsWith("history/")) return "history";
  if (rel.startsWith("decisions/D-")) return "decision";
  if (rel.startsWith("roadmap/plans/")) return "planning";
  if (rel.startsWith("roadmap/")) return rel === "roadmap/roadmap.md" ? "index" : "roadmap";
  if (rel.startsWith("features/")) return rel === "features/features.md" ? "index" : "feature";
  if (rel.startsWith("system/")) return rel === "system/system.md" ? "index" : "system";
  if (rel.startsWith("docs/")) return isFolderNote(rel, project) ? "index" : "note";
  if (rel.startsWith("archive/")) return existing || "note";
  return existing || "note";
}

function resolveLinkTarget(target, project) {
  if (target === "Home" || target === "Projects/Projects") return null;
  if (target.startsWith("Projects/") && !target.startsWith(`Projects/${project}/`)) return null;
  const prefix = `Projects/${project}/`;
  return (target.startsWith(prefix) ? target.slice(prefix.length) : target).replace(/\.md$/, "");
}

function checkTarget(targets, normalizedTarget) {
  if (!normalizedTarget) return true;
  return targets.has(normalizedTarget);
}

function runFor(target) {
  const project = target.project ?? basename(target.vault);
  const files = walk(target.vault);
  const targets = new Set(files.map((abs) => relative(target.vault, abs).split("\\").join("/").replace(/\.md$/, "")));
  const issues = [];
  const donePendingPath = join(target.vault, "roadmap/done-pending.md");
  const donePending = existsSync(donePendingPath) ? readFileSync(donePendingPath, "utf8") : "";

  for (const abs of files) {
    const rel = relative(target.vault, abs).split("\\").join("/");
    const content = readFileSync(abs, "utf8");
    const fm = parseFrontmatter(content);
    if (!fm) {
      issues.push(`${rel}: missing frontmatter`);
      continue;
    }
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
      issues.push(`${rel}: pageType ${fm.pageType}, expected ${expected}`);
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
    if (rel.startsWith("roadmap/plans/") && !isFolderNote(rel, project)) {
      if (!donePending.includes(`## ${stem(rel)}`)) issues.push(`${rel}: missing roadmap/done-pending mirror section`);
    }
    for (const match of content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)) {
      const normalized = resolveLinkTarget(match[1], project);
      if (!checkTarget(targets, normalized)) issues.push(`${rel}: unresolved link [[${match[1]}]]`);
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
