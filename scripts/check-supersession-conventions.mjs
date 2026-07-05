#!/usr/bin/env node
/**
 * check-supersession-conventions.mjs
 *
 * Deterministic checks for declared PM supersession links. This validator does
 * not infer semantic duplicates; it only verifies relationships the author
 * explicitly declared in frontmatter or body prose.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import { findVaultRoot, resolveProjectsConfigPath } from "./lib/paths.mjs";
import { parseFrontmatter } from "./lib/markdown.mjs";
import { projectPathFromVault } from "./lib/obsidian-links.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { vault: null, config: null, project: null, fix: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" || args[i] === "-c") out.config = args[++i];
    else if (args[i] === "--project" || args[i] === "-p") out.project = args[++i];
    else if (args[i] === "--fix") out.fix = true;
    else if (["--dry-run", "--force", "--strict", "--fix-strict"].includes(args[i])) {
      // Accepted for check-pm.mjs pass-through compatibility. No effect here.
    } else if (!args[i].startsWith("-")) out.vault = args[i];
  }
  return out;
}

const CLI = parseArgs(process.argv);
const today = new Date().toISOString().slice(0, 10);

function loadConfigPath() {
  if (CLI.vault) return null;
  return resolveProjectsConfigPath(CLI.config ? resolve(CLI.config) : null);
}

function resolveTargets() {
  const configPath = loadConfigPath();
  if (!configPath) return [{ vault: resolve(CLI.vault ?? process.cwd()), label: resolve(CLI.vault ?? process.cwd()), configPath: null }];
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  if (CLI.project) {
    const proj = cfg.projects?.[CLI.project];
    if (!proj?.pm_folder) {
      console.error(`ERROR: project '${CLI.project}' has no pm_folder in ${configPath}`);
      process.exit(2);
    }
    return [{ vault: resolve(proj.pm_folder), label: `${CLI.project} (${proj.pm_folder})`, project: CLI.project, configPath }];
  }
  return Object.entries(cfg.projects ?? {})
    .filter(([, proj]) => Boolean(proj.pm_folder))
    .map(([project, proj]) => ({ vault: resolve(proj.pm_folder), label: `${project} (${proj.pm_folder})`, project, configPath }));
}

function walk(root) {
  const out = [];
  function rec(abs) {
    if (!existsSync(abs)) return;
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

function relNoExt(rel) {
  return rel.replace(/\.md$/i, "");
}

function normalizeTarget(value, project, projectPath) {
  let target = String(value ?? "").trim();
  if (!target) return null;
  target = target.replace(/^["']|["']$/g, "");
  const wiki = target.match(/^\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/);
  if (wiki) target = wiki[1];
  target = target.split("#")[0].replace(/\.md$/i, "").replace(/\\/g, "/").trim();
  if (!target || target === "-" || /^none\b/i.test(target) || target.includes("<D-id>")) return null;
  const prefixes = [projectPath ? `${projectPath}/` : null, `Projects/${project}/`].filter(Boolean);
  const prefix = prefixes.find((p) => target.startsWith(p));
  if (prefix) target = target.slice(prefix.length);
  return target;
}

function decisionIdFromRel(rel) {
  return basename(rel, ".md").match(/^(D-\d{3})[_-]/i)?.[1].toUpperCase() ?? null;
}

function decisionIdFromValue(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.includes("<D-id>")) return null;
  const wiki = normalized.match(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/);
  const source = wiki ? wiki[1] : normalized;
  return source.match(/\b(D-\d{3})\b/i)?.[1].toUpperCase() ?? null;
}

function setFrontmatterScalar(content, key, value) {
  const normalized = String(content ?? "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return normalized;
  let raw = match[1];
  const line = `${key}: ${value}`;
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*.*$`, "m");
  raw = re.test(raw) ? raw.replace(re, line) : `${raw.trimEnd()}\n${line}`;
  return `---\n${raw.trimEnd()}\n---\n${normalized.slice(match[0].length).replace(/^\n+/, "")}`;
}

function touchAndSetStatus(content, status) {
  let updated = setFrontmatterScalar(content, "status", status);
  updated = setFrontmatterScalar(updated, "updated", today);
  updated = setFrontmatterScalar(updated, "last_reviewed", today);
  return updated;
}

function declaredSupersessionLinks(content) {
  const links = [];
  const re = /(?:Superseded by|Supersedes|Replaced by|Replacement):\s*\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/gi;
  let match;
  while ((match = re.exec(content))) links.push(match[1]);
  return links;
}

function runFor(target) {
  const project = target.project ?? basename(target.vault);
  const files = walk(target.vault);
  const vaultRoot = findVaultRoot(target.vault, target.configPath);
  const projectPath = projectPathFromVault(vaultRoot, target.vault);
  const targets = new Set();
  const frontmatterByRel = new Map();
  const contentByRel = new Map();
  const decisionById = new Map();
  const issues = [];
  const fixes = [];

  for (const abs of files) {
    const rel = relative(target.vault, abs).split("\\").join("/");
    targets.add(relNoExt(rel));
    const content = readFileSync(abs, "utf8");
    const fm = parseFrontmatter(content);
    contentByRel.set(rel, content);
    if (fm) frontmatterByRel.set(rel, fm);
    const decisionId = rel.startsWith("decisions/D-") ? decisionIdFromRel(rel) : null;
    if (decisionId) decisionById.set(decisionId, rel);
  }

  function targetExists(rawTarget) {
    const normalized = normalizeTarget(rawTarget, project, projectPath);
    if (!normalized) return true;
    return targets.has(normalized);
  }

  for (const [rel, fm] of frontmatterByRel.entries()) {
    const content = contentByRel.get(rel);

    for (const rawTarget of declaredSupersessionLinks(content)) {
      if (!targetExists(rawTarget)) {
        issues.push(`${rel}: declared supersession target [[${rawTarget}]] does not resolve`);
      }
    }

    if (rel.startsWith("decisions/D-") && fm.supersedes) {
      const id = decisionIdFromValue(fm.supersedes);
      if (!id) continue;
      const priorRel = decisionById.get(id);
      if (!priorRel) {
        issues.push(`${rel}: supersedes ${id}, but no matching decisions/${id}_*.md exists`);
        continue;
      }
      const priorFm = frontmatterByRel.get(priorRel);
      if (priorFm?.status !== "superseded") {
        if (CLI.fix) {
          const priorAbs = join(target.vault, priorRel);
          const updated = touchAndSetStatus(contentByRel.get(priorRel), "superseded");
          writeFileSync(priorAbs, updated);
          contentByRel.set(priorRel, updated);
          frontmatterByRel.set(priorRel, parseFrontmatter(updated));
          fixes.push(`${priorRel}: status -> superseded (${rel} declares supersedes: ${id})`);
        } else {
          issues.push(`${priorRel}: status must be superseded because ${rel} declares supersedes: ${id}`);
        }
      }
    }

    if (rel.startsWith("features/") && rel !== "features/features.md") {
      const replacementDeclared = /(?:Superseded by|Replaced by|Replacement):\s*\[\[/i.test(content);
      if (replacementDeclared && fm.status !== "deprecated") {
        issues.push(`${rel}: feature declares a replacement; set status: deprecated and link the replacement`);
      }
      const supersedes = [...content.matchAll(/Supersedes:\s*\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/gi)]
        .map((match) => normalizeTarget(match[1], project, projectPath))
        .filter(Boolean);
      for (const oldFeature of supersedes.filter((t) => t.startsWith("features/"))) {
        const oldRel = `${oldFeature}.md`;
        const oldFm = frontmatterByRel.get(oldRel);
        if (oldFm && oldFm.status !== "deprecated") {
          issues.push(`${oldRel}: status must be deprecated because ${rel} declares Supersedes: [[${oldFeature}]]`);
        }
      }
    }
  }

  console.log(`\n# Supersession Conventions Report — ${target.label}\n`);
  if (fixes.length > 0) {
    for (const fix of fixes) console.log(`fixed: ${fix}`);
    console.log("");
  }
  console.log(`**Status:** ${issues.length === 0 ? "PASS" : "FAIL"}`);
  console.log("");
  if (issues.length === 0) {
    console.log("Declared PM supersession links are internally consistent.");
  } else {
    for (const issue of issues) console.log(`- ${issue}`);
  }
  return issues.length;
}

let total = 0;
for (const target of resolveTargets()) total += runFor(target);
process.exit(total > 0 ? 1 : 0);
