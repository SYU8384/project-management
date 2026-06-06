#!/usr/bin/env node
/**
 * render-openclaw-pm-agent-prompt.mjs
 *
 * Prints a copy-paste prompt for bootstrapping an OpenClaw PM agent.
 * This script is intentionally read-only: it does not edit AGENTS.md or
 * projects.json.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_SKILL_DIR = resolve(SCRIPT_DIR, "..");
const DEFAULT_SKILL_DIR = resolve(homedir(), ".openclaw", "shared-skills", "project-management");
const DEFAULT_PROJECTS_JSON = resolve(DEFAULT_SKILL_DIR, "projects.json");
const TEMPLATE_PATH = resolve(TEMPLATE_SKILL_DIR, "templates", "OPENCLAW_PM_AGENT_BOOTSTRAP.md");

function printHelp() {
  console.log(`Usage:
  node scripts/render-openclaw-pm-agent-prompt.mjs [options]

Options:
  --agent-name <name>       OpenClaw PM agent name. Default: "OpenClaw PM agent"
  --project-scope <scope>   Project scope phrase. Default: inferred from projects.json, or "all registered projects"
  --skill-dir <path>        OpenClaw skill directory. Default: ~/.openclaw/shared-skills/project-management
  --projects-json <path>    Project registry path. Default: <skill-dir>/projects.json
  --help                    Show this help
`);
}

function parseArgs(argv) {
  const options = {
    agentName: "OpenClaw PM agent",
    projectScope: null,
    skillDir: null,
    projectsJson: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--agent-name") {
      if (!next) throw new Error("--agent-name requires a value");
      options.agentName = next;
      index += 1;
      continue;
    }

    if (arg === "--project-scope") {
      if (!next) throw new Error("--project-scope requires a value");
      options.projectScope = next;
      index += 1;
      continue;
    }

    if (arg === "--skill-dir") {
      if (!next) throw new Error("--skill-dir requires a value");
      options.skillDir = resolve(next);
      index += 1;
      continue;
    }

    if (arg === "--projects-json") {
      if (!next) throw new Error("--projects-json requires a value");
      options.projectsJson = resolve(next);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  options.skillDir = options.skillDir ?? DEFAULT_SKILL_DIR;
  options.projectsJson = options.projectsJson ?? resolve(options.skillDir, "projects.json");

  return options;
}

function inferProjectScope(projectsJsonPath) {
  if (!existsSync(projectsJsonPath)) return "all registered projects";

  try {
    const config = JSON.parse(readFileSync(projectsJsonPath, "utf8"));
    const names = Object.keys(config.projects ?? {});
    if (names.length === 0) return "all registered projects";
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
  } catch {
    return "all registered projects";
  }
}

function renderTemplate(template, replacements) {
  return Object.entries(replacements).reduce((result, [key, value]) => {
    return result.replaceAll(`{{${key}}}`, value);
  }, template);
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (!existsSync(TEMPLATE_PATH)) {
    throw new Error(`Template not found: ${TEMPLATE_PATH}`);
  }

  const projectScope = options.projectScope ?? inferProjectScope(options.projectsJson);
  const template = readFileSync(TEMPLATE_PATH, "utf8");

  const output = renderTemplate(template, {
    AGENT_NAME: options.agentName,
    PROJECT_SCOPE: projectScope,
    SKILL_DIR: options.skillDir,
    PROJECTS_JSON: options.projectsJson,
  });

  process.stdout.write(output);
  if (!output.endsWith("\n")) process.stdout.write("\n");
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
