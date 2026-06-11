#!/usr/bin/env node
/**
 * check-agents.mjs
 *
 * Validates registered code repo AGENTS.md PM folder sections against the
 * project-management templates and projects.json access settings.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveProjectsConfigPath, findSkillDir } from "./lib/paths.mjs";

const SKILL_DIR = findSkillDir();
const TEMPLATE_DIR = SKILL_DIR ? join(SKILL_DIR, "templates") : null;

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { config: null, project: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" || args[i] === "-c") out.config = args[++i];
    else if (args[i] === "--project" || args[i] === "-p") out.project = args[++i];
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
  if (access === "authoritative") return "AGENTS_PM_SECTION_AUTHORITATIVE.md";
  if (access === "read-only") return "AGENTS_PM_SECTION_READONLY.md";
  return null;
}

function substituteTemplate(filename, project) {
  let content = readFileSync(join(TEMPLATE_DIR, filename), "utf8");
  const replacements = {
    "<pm_folder>": project.pm_folder ?? "",
    "<skill_dir>": SKILL_DIR ?? "",
  };
  for (const [from, to] of Object.entries(replacements)) {
    content = content.split(from).join(to);
  }
  return content;
}

function extractPmSection(content) {
  const startMatch = content.match(/^## PM folder\s*$/m);
  if (!startMatch) return null;
  const start = startMatch.index;
  const afterHeading = start + startMatch[0].length;
  const rest = content.slice(afterHeading);
  const nextMatch = rest.match(/\n## /);
  const end = nextMatch ? afterHeading + nextMatch.index : content.length;
  return content.slice(start, end);
}

function normalizeSection(content) {
  return content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

function validateProject(name, project) {
  const issues = [];

  if (!project.code_repo) {
    return { name, status: "SKIP", detail: "code_repo is null; no code repo AGENTS.md to validate.", issues };
  }

  const templateName = templateForAccess(project.access);
  if (!templateName) {
    issues.push(`invalid access '${project.access ?? ""}' in projects.json`);
    return { name, status: "FAIL", detail: "", issues };
  }

  if ((project.access === "authoritative" || project.access === "read-only") && !project.pm_folder) {
    issues.push(`access '${project.access}' requires pm_folder for AGENTS.md validation`);
  }

  const repoPath = resolve(project.code_repo);
  if (!existsSync(repoPath)) {
    issues.push(`code_repo path does not exist: ${repoPath}`);
    return { name, status: "FAIL", detail: "", issues };
  }

  const agentsPath = join(repoPath, "AGENTS.md");
  if (!existsSync(agentsPath)) {
    issues.push(`missing AGENTS.md at ${agentsPath}`);
    return { name, status: "FAIL", detail: "", issues };
  }

  const content = readFileSync(agentsPath, "utf8");
  const section = extractPmSection(content);
  if (!section) {
    issues.push(`missing ## PM folder section in ${agentsPath}`);
    return { name, status: "FAIL", detail: "", issues };
  }

  for (const placeholder of ["<pm_folder>", "<skill_dir>"]) {
    if (section.includes(placeholder)) {
      issues.push(`${agentsPath} contains unresolved ${placeholder} placeholder`);
    }
  }

  const expected = substituteTemplate(templateName, project);
  if (normalizeSection(section) !== normalizeSection(expected)) {
    issues.push(`## PM folder section does not match ${templateName} for access '${project.access}'`);
  }

  return {
    name,
    status: issues.length > 0 ? "FAIL" : "PASS",
    detail: agentsPath,
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
