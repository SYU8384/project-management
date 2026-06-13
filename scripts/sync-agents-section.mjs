#!/usr/bin/env node
/**
 * sync-agents-section.mjs
 *
 * Re-renders the `## PM folder` section of every registered code
 * repo's `AGENTS.md` from the latest portable project-management template
 * (`templates/AGENTS_PM_SECTION.md`). Replaces only the
 * `## PM folder` span (from the heading to the next `\n## ` heading);
 * preserves all other AGENTS.md content (project-specific commands,
 * architecture notes, conventions, etc.).
 *
 * Use this after any change to the AGENTS PM-section template to bring
 * drifted AGENTS.md files back into sync, without having to manually copy
 * the section over.
 *
 * Behavior:
 *   - Per project, read projects.json, validate access, then render the
 *     same portable template for every registered code repo.
 *   - Compare the existing AGENTS.md `## PM folder` section to the
 *     rendered template. If equal, skip with "already in sync".
 *   - Otherwise, write the new section in place. The script does not
 *     touch any other part of the AGENTS.md.
 *   - Optionally append a `chore(pm):` history bullet to the PM
 *     folder's `history/YYYY-MM/history-YYYY-MM-DD.md` (if the file
 *     exists). Use `--no-history` to skip this.
 *
 * Flags:
 *   --project <name>   sync one project (default: all)
 *   --config <path>    path to projects.json (default: ~/.config/project-management/projects.json)
 *   --dry-run          print what would change, do not write
 *   --no-history       skip the history bullet append
 *
 * Exit codes:
 *   0  all targets in sync (no changes, or changes applied)
 *   1  one or more targets failed to sync
 *   2  invalid arguments or missing config
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
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
  const out = { config: null, project: null, dryRun: false, noHistory: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--config" || a === "-c") out.config = args[++i];
    else if (a === "--project" || a === "-p") out.project = args[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--no-history") out.noHistory = true;
    else if (a === "--help" || a === "-h") {
      process.stdout.write(USAGE + "\n");
      process.exit(0);
    } else {
      process.stderr.write(`Unknown arg: ${a}\n${USAGE}\n`);
      process.exit(2);
    }
  }
  return out;
}

const USAGE = `Usage: node scripts/sync-agents-section.mjs [options]

Options:
  --project <name>   sync one project (default: all)
  --config <path>    path to projects.json (default: ~/.config/project-management/projects.json)
  --dry-run          print what would change, do not write
  --no-history       skip the history bullet append
  --help, -h         show this help
`;

const CLI = parseArgs(process.argv);

function loadConfigPath() {
  return resolveProjectsConfigPath(CLI.config ? resolve(CLI.config) : null);
}

function templateForAccess(access) {
  if (!isValidAccess(access)) return null;
  return "AGENTS_PM_SECTION.md";
}

function renderSection(templateFile, project) {
  if (!TEMPLATE_DIR) {
    throw new Error("skill_dir not resolved; cannot locate templates/");
  }
  return renderTemplateFile(TEMPLATE_DIR, templateFile, {
  });
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

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function appendHistoryBullet(pmFolder) {
  if (!pmFolder) return false;
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const monthDir = join(pmFolder, "history", `${yyyy}-${mm}`);
  const dayFile = join(monthDir, `history-${yyyy}-${mm}-${day}.md`);
  if (!existsSync(dayFile)) return false;   // don't create new history files
  const bullet = `\n- **chore(pm):** sync AGENTS.md \`## PM folder\` section with the latest portable template (sync-agents-section.mjs)\n`;
  appendFileSync(dayFile, bullet);
  return true;
}

function syncProject(name, project) {
  const result = { name, status: "skipped", detail: "" };
  if (!project.code_repo) {
    result.status = "skipped";
    result.detail = "no code_repo";
    return result;
  }
  if (!project.access || !isValidAccess(project.access)) {
    result.status = "skipped";
    result.detail = `unknown access '${project.access ?? ""}'`;
    return result;
  }
  const templateFile = templateForAccess(project.access);
  if (!templateFile) {
    result.status = "skipped";
    result.detail = `no template for access '${project.access}'`;
    return result;
  }
  const codeRepo = resolve(project.code_repo);
  const agentsPath = join(codeRepo, "AGENTS.md");
  if (!existsSync(agentsPath)) {
    result.status = "fail";
    result.detail = `AGENTS.md not found at ${agentsPath}`;
    return result;
  }
  const original = readFileSync(agentsPath, "utf8");
  const section = extractPmSection(original);
  if (!section) {
    result.status = "fail";
    result.detail = "no `## PM folder` section in AGENTS.md";
    return result;
  }
  let rendered;
  try {
    rendered = renderSection(templateFile, project);
  } catch (err) {
    result.status = "fail";
    result.detail = `template render failed: ${err.message}`;
    return result;
  }
  if (normalizeMarkdownSection(section.text) === normalizeMarkdownSection(rendered)) {
    result.status = "in-sync";
    result.detail = `${name}: ## PM folder is already in sync with ${templateFile}`;
    return result;
  }
  if (CLI.dryRun) {
    const oldLines = section.text.split("\n").length;
    const newLines = rendered.split("\n").length;
    result.status = "would-update";
    result.detail = `${name}: would rewrite ## PM folder in ${agentsPath} (${oldLines} lines → ${newLines} lines)`;
    return result;
  }
  const newContent = original.slice(0, section.start) + rendered + original.slice(section.end);
  writeFileSync(agentsPath, newContent);
  const oldLines = section.text.split("\n").length;
  const newLines = rendered.split("\n").length;
  let historyNote = "";
  if (!CLI.noHistory && project.pm_folder) {
    const wrote = appendHistoryBullet(project.pm_folder);
    historyNote = wrote ? `; appended history bullet` : `; no history file for today, skipped`;
  }
  result.status = "updated";
  result.detail = `${name}: rewrote ## PM folder in ${agentsPath} (${oldLines} lines → ${newLines} lines)${historyNote}`;
  return result;
}

const configPath = loadConfigPath();
if (!configPath) {
  console.error("ERROR: projects.json not found. Pass --config <path> or set up the skill first.");
  process.exit(2);
}
const cfg = JSON.parse(readFileSync(configPath, "utf8"));
const entries = CLI.project
  ? Object.entries(cfg.projects ?? {}).filter(([n]) => n === CLI.project)
  : Object.entries(cfg.projects ?? {});
if (CLI.project && entries.length === 0) {
  console.error(`ERROR: project '${CLI.project}' not found in ${configPath}`);
  process.exit(2);
}

const lines = [];
lines.push(`# AGENTS.md PM section sync`);
lines.push("");
lines.push(`Config: ${configPath}`);
lines.push(`Skill:  ${SKILL_DIR ?? "(unresolved)"}`);
lines.push(`Mode:   ${CLI.dryRun ? "dry-run" : "apply"}${CLI.noHistory ? " (no history)" : ""}`);
lines.push(`Scope:  ${CLI.project ?? "(all)"}`);
lines.push("");

let failures = 0;
for (const [name, project] of entries) {
  const r = syncProject(name, project);
  const marker = {
    "in-sync": "✓",
    "updated": "✓",
    "would-update": "·",
    "skipped": "·",
    "fail": "✗",
  }[r.status] ?? "?";
  lines.push(`${marker} ${r.detail}`);
  if (r.status === "fail") failures++;
}
lines.push("");
if (failures > 0) {
  lines.push(`# Sync failed (${failures} project(s))`);
  console.log(lines.join("\n"));
  process.exit(1);
}
lines.push(`# Sync complete (${entries.length} project(s))`);
console.log(lines.join("\n"));
process.exit(0);
