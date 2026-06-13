#!/usr/bin/env node
/**
 * check-agents.mjs
 *
 * Validates registered code repo AGENTS.md PM folder sections against the
 * portable project-management template and local projects.json access settings.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveProjectsConfigPath, findSkillDir } from "./lib/paths.mjs";
import { isValidAccess } from "./lib/convention.mjs";
import { normalizeMarkdownSection } from "./lib/markdown.mjs";
import { renderTemplateFile } from "./lib/template-renderer.mjs";

const SKILL_DIR = findSkillDir();
const TEMPLATE_DIR = SKILL_DIR ? join(SKILL_DIR, "templates") : null;

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { config: null, project: null, fix: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" || args[i] === "-c") out.config = args[++i];
    else if (args[i] === "--project" || args[i] === "-p") out.project = args[++i];
    else if (args[i] === "--fix") out.fix = true;
  }
  return out;
}

const CLI = parseArgs(process.argv);

function loadConfigPath() {
  return resolveProjectsConfigPath(CLI.config ? resolve(CLI.config) : null);
}

function isTemplateConfig(cfg) {
  const projects = cfg.projects ?? {};
  return Object.keys(projects).length === 0 || Object.prototype.hasOwnProperty.call(projects, "<ProjectName>");
}

function setupHint(configPath, cfg) {
  return isTemplateConfig(cfg)
    ? `This looks like the default empty projects.json template. Run setup before AGENTS.md validation.`
    : `Check ${configPath} and run setup if this project has not been registered.`;
}

function resolveProjects() {
  const configPath = loadConfigPath();
  if (!configPath) {
    return { configPath: null, projects: [] };
  }
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  if (CLI.project) {
    const proj = cfg.projects?.[CLI.project];
    if (!proj) {
      console.error(`ERROR: project '${CLI.project}' not found in ${configPath}\n${setupHint(configPath, cfg)}`);
      process.exit(2);
    }
    return { configPath, projects: [[CLI.project, proj]], cfg };
  }
  return { configPath, projects: Object.entries(cfg.projects ?? {}), cfg };
}

function templateForAccess(access) {
  if (!isValidAccess(access)) return null;
  return "AGENTS_PM_SECTION.md";
}

function substituteTemplate(filename, project) {
  return renderTemplateFile(TEMPLATE_DIR, filename, {});
}

function extractPmSection(content) {
  const startMatch = content.match(/^## PM folder\s*$/m);
  if (!startMatch) return null;
  const start = startMatch.index;
  const afterHeading = start + startMatch[0].length;
  const rest = content.slice(afterHeading);
  const nextMatch = rest.match(/\n## /);
  const end = nextMatch ? afterHeading + nextMatch.index : content.length;
  return { start, end, text: content.slice(start, end) };
}

function upsertPmSection(existing, section) {
  const normalized = section.trimEnd();
  const current = extractPmSection(existing);
  if (current) {
    return `${existing.slice(0, current.start)}${normalized}${existing.slice(current.end)}`.trimEnd() + "\n";
  }
  const trimmed = existing.trimEnd();
  return `${trimmed}${trimmed ? "\n\n" : ""}${normalized}\n`;
}

function validateProject(name, project) {
  const issues = [];

  // Validate access first. An unknown access value is always a FAIL —
  // we cannot pick a template, and the access enum is a strict 2-value list.
  const templateName = templateForAccess(project.access);
  if (!templateName) {
    issues.push(`invalid access '${project.access ?? ""}' in projects.json`);
    return { name, status: "FAIL", detail: "", issues };
  }

  // code_repo is required for authoritative projects (the AGENTS.md lives
  // in the code repo). For read-only projects, code_repo is optional —
  // a read-only collaborator may have access to the PM folder but not
  // to a code repo. SKIP is appropriate in that case.
  if (!project.code_repo) {
    if (project.access === "authoritative") {
      issues.push(
        `authoritative project '${name}' has no code_repo; AGENTS.md cannot be validated. ` +
        `Set code_repo to the code repo path, or downgrade to access: read-only if this is a project-only setup.`
      );
      return { name, status: "FAIL", detail: "", issues };
    }
    return {
      name,
      status: "SKIP",
      detail: "code_repo is null; no code repo AGENTS.md to validate (read-only project).",
      issues,
    };
  }

  if (!project.pm_folder) {
    issues.push(`access '${project.access}' requires pm_folder for AGENTS.md validation`);
    return { name, status: "FAIL", detail: "", issues };
  }

  const repoPath = resolve(project.code_repo);
  if (!existsSync(repoPath)) {
    issues.push(`code_repo path does not exist: ${repoPath}`);
    return { name, status: "FAIL", detail: "", issues };
  }

  const agentsPath = join(repoPath, "AGENTS.md");
  const expected = substituteTemplate(templateName, project);
  let fixed = false;
  let content = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : null;

  if (content === null) {
    if (!CLI.fix) {
      issues.push(`missing AGENTS.md at ${agentsPath}`);
      return { name, status: "FAIL", detail: "", issues };
    }
    writeFileSync(agentsPath, expected.trimEnd() + "\n");
    fixed = true;
    content = readFileSync(agentsPath, "utf8");
  }

  let section = extractPmSection(content);
  if (!section) {
    if (!CLI.fix) {
      issues.push(`missing ## PM folder section in ${agentsPath}`);
      return { name, status: "FAIL", detail: "", issues };
    }
    writeFileSync(agentsPath, upsertPmSection(content, expected));
    fixed = true;
    content = readFileSync(agentsPath, "utf8");
    section = extractPmSection(content);
  }

  for (const placeholder of ["<pm_folder>", "<skill_dir>"]) {
    if (section.text.includes(placeholder)) {
      issues.push(`${agentsPath} contains unresolved ${placeholder} placeholder`);
    }
  }

  if (normalizeMarkdownSection(section.text) !== normalizeMarkdownSection(expected)) {
    if (CLI.fix) {
      writeFileSync(agentsPath, upsertPmSection(content, expected));
      fixed = true;
      content = readFileSync(agentsPath, "utf8");
      section = extractPmSection(content);
      issues.length = 0;
      for (const placeholder of ["<pm_folder>", "<skill_dir>"]) {
        if (section.text.includes(placeholder)) {
          issues.push(`${agentsPath} contains unresolved ${placeholder} placeholder`);
        }
      }
      if (normalizeMarkdownSection(section.text) !== normalizeMarkdownSection(expected)) {
        issues.push(`## PM folder section does not match ${templateName}`);
      }
    } else {
      issues.push(`## PM folder section does not match ${templateName}`);
    }
  }

  return {
    name,
    status: issues.length > 0 ? "FAIL" : "PASS",
    detail: fixed ? `fixed: ${agentsPath}` : agentsPath,
    issues,
  };
}

const { configPath, projects } = resolveProjects();

console.log(`# AGENTS.md Integration Report\n`);
if (!configPath) {
  console.log(`**Status:** SKIP`);
  console.log("");
  console.log(`AGENTS.md validation requires projects.json so code_repo, pm_folder, and access can be resolved.`);
  process.exit(0);
}

let totalIssues = 0;
for (const [name, project] of projects) {
  const result = validateProject(name, project);
  console.log(`## ${name}`);
  console.log("");
  console.log(`**Status:** ${result.status}`);
  if (result.detail) {
    console.log(``);
    console.log(result.detail);
  }
  if (result.issues.length > 0) {
    console.log("");
    for (const issue of result.issues) console.log(`- ${issue}`);
    totalIssues += result.issues.length;
  }
  console.log("");
}

if (projects.length === 0) {
  console.log(`No registered projects found in ${configPath}.`);
}

process.exit(totalIssues > 0 ? 1 : 0);
