#!/usr/bin/env node
/**
 * bootstrap-pm.mjs
 *
 * Deterministic owner setup for a project-management PM folder.
 * Creates the canonical PM scaffold, registers the project, and wires the
 * code repo AGENTS.md PM section when a code repo path is provided.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

import { ACCESS_VALUES } from "./lib/convention.mjs";
import { replaceSectionBody as replaceMarkdownSectionBody } from "./lib/markdown.mjs";
import { findVaultRoot } from "./lib/paths.mjs";
import { projectPathFromVault } from "./lib/obsidian-links.mjs";
import { renderTemplateFile } from "./lib/template-renderer.mjs";
import { summarizeScaffoldCounts } from "./lib/scaffold-plan.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const TEMPLATE_DIR = join(SKILL_DIR, "templates");

const VALID_ACCESS_VALUES = ACCESS_VALUES;

function usage() {
  console.error(`Usage:
  node scripts/bootstrap-pm.mjs \\
    --project <name> \\
    --pm-folder <path> \\
    --code-repo <path|null> \\
    --phase <phase> \\
    --notes <one-line description> \\
    --config <path> \\
    [--access authoritative|read-only] \\
    [--vault-root <path>] \\
    [--date YYYY-MM-DD] \\
    [--dry-run] \\
    [--yes] \\
    [--sync]

  --sync: re-read projects.json and rewrite the phase/notes lines in
  CURRENT_STATUS.md, PRODUCT.md, and <Project>.md to match. Idempotent.
  Use after editing phase/notes in projects.json so the documents stay
  in sync. Skips the scaffold (no new files; only edits existing ones).
`);
}

function parseArgs(argv) {
  const out = {
    project: null,
    pmFolder: null,
    codeRepo: null,
    phase: null,
    notes: "",
    config: null,
    access: "authoritative",
    vaultRoot: null,
    date: localDate(),
    dryRun: false,
    yes: false,
    sync: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      out.dryRun = true;
      continue;
    }
    if (arg === "--yes") {
      out.yes = true;
      continue;
    }
    if (arg === "--sync") {
      out.sync = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined) {
      usage();
      process.exit(2);
    }
    if (arg === "--project") out.project = value;
    else if (arg === "--pm-folder") out.pmFolder = value;
    else if (arg === "--code-repo") out.codeRepo = value === "null" ? null : value;
    else if (arg === "--phase") out.phase = value;
    else if (arg === "--notes") out.notes = value;
    else if (arg === "--config") out.config = value;
    else if (arg === "--access") out.access = value;
    else if (arg === "--vault-root") out.vaultRoot = value;
    else if (arg === "--date") out.date = value;
    else {
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(2);
    }
  }

  for (const key of ["project", "pmFolder", "phase"]) {
    if (!out[key]) {
      console.error(`Missing required --${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`);
      usage();
      process.exit(2);
    }
  }
  if (out.codeRepo === null && !argv.includes("--code-repo")) {
    console.error("Missing required --code-repo <path|null>");
    usage();
    process.exit(2);
  }
  if (!VALID_ACCESS_VALUES.includes(out.access)) {
    console.error(
      `Invalid --access: ${out.access}. Expected one of: ${VALID_ACCESS_VALUES.join(", ")}.`
    );
    process.exit(2);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.date)) {
    console.error(`Invalid --date: ${out.date}. Expected YYYY-MM-DD.`);
    process.exit(2);
  }
  return out;
}

function localDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthOf(date) {
  return date.slice(0, 7);
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "project";
}

function yamlScalar(value) {
  return JSON.stringify(String(value));
}

function rel(path) {
  return path.split("\\").join("/");
}

function folderGroup(abs) {
  return rel(dirname(abs));
}

const planEntries = [];
const operationCounts = {};

function log(action, target, detail = "") {
  operationCounts[action] = (operationCounts[action] ?? 0) + 1;
  if (cli.dryRun) {
    planEntries.push({ action, target, detail });
    return;
  }
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`${action}: ${target}${suffix}`);
}

const cli = parseArgs(process.argv);
const project = cli.project;
const projectSlug = slugify(project);
const pmFolder = resolve(cli.pmFolder);
const codeRepo = cli.codeRepo === null ? null : resolve(cli.codeRepo);
const configPath = cli.config
  ? resolve(cli.config)
  : join(homedir(), ".config", "project-management", "projects.json");
const discoveredVaultRoot = cli.vaultRoot ? resolve(cli.vaultRoot) : findVaultRoot(pmFolder, configPath);
const vaultRoot = discoveredVaultRoot === pmFolder ? dirname(pmFolder) : discoveredVaultRoot;
const date = cli.date;
const month = monthOf(date);
const notes = cli.notes || `${project} project.`;
const access = cli.access;
const linkRoot = projectPathFromVault(vaultRoot, pmFolder);

function ensureDir(abs) {
  if (existsSync(abs)) {
    log("exists", abs);
    return;
  }
  if (cli.dryRun) {
    planEntries.push({ action: "mkdir", target: abs });
    return;
  }
  mkdirSync(abs, { recursive: true });
  log("mkdir", abs);
}

function writeCreateOnly(abs, content) {
  if (existsSync(abs)) {
    skippedExistingCount += 1;
    log("skip", abs, "exists");
    return;
  }
  if (cli.dryRun) {
    planEntries.push({ action: "write", target: abs });
    return;
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  log("write", abs);
}

// Count of files that would be (or were) skipped because they already
// exist. Surfaced in the dry-run summary and the real-run final output
// so the user knows what wasn't written. Tracked separately from
// planEntries because planEntries only accumulates dry-run writes.
let skippedExistingCount = 0;

function countExistingFiles(dir) {
  let count = 0;
  function walk(abs) {
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = join(abs, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && entry.name.endsWith(".md")) count += 1;
    }
  }
  walk(dir);
  return count;
}

function emitExistingFilesNotice() {
  if (!existsSync(pmFolder)) return;
  const existing = countExistingFiles(pmFolder);
  if (existing > 0) {
    if (cli.dryRun) {
      console.log(`notice: target PM folder has ${existing} existing markdown file${existing === 1 ? "" : "s"}; bootstrap will skip them (idempotent re-run).`);
    } else {
      console.log(`notice: target PM folder has ${existing} existing markdown file${existing === 1 ? "" : "s"}; bootstrap is skipping them. Pass --dry-run to preview.`);
    }
    console.log("");
  }
}

// --sync: re-read projects.json and rewrite the phase/notes lines in
// CURRENT_STATUS.md, PRODUCT.md, and <Project>.md so they match the
// canonical value in projects.json. Idempotent: re-running on an
// already-synced folder is a no-op (no file is rewritten if the
// current value matches).
function syncPhaseAndNotes() {
  if (!existsSync(configPath)) {
    console.error(`ERROR: --sync requires an existing ${configPath}.`);
    process.exit(2);
  }
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  const proj = cfg.projects?.[project];
  if (!proj) {
    console.error(`ERROR: project '${project}' not found in ${configPath}.`);
    process.exit(2);
  }
  const phase = proj.phase;
  const notes = proj.notes ?? "";
  if (!phase) {
    console.error(`ERROR: project '${project}' has no phase in ${configPath}.`);
    process.exit(2);
  }

  const targets = [
    { rel: "CURRENT_STATUS.md", section: "Current Phase" },
    { rel: "PRODUCT.md", section: "Current Phase" },
  ];
  // Also the project's root file if it exists, e.g. "Project Management.md"
  // Skip — the root file is an index-style page; the "## Current Phase"
  // convention doesn't apply there.

  let rewritten = 0;
  let alreadyInSync = 0;
  for (const { rel, section } of targets) {
    const abs = join(pmFolder, rel);
    if (!existsSync(abs)) {
      console.log(`skip: ${rel} (not present in PM folder)`);
      continue;
    }
    const original = readFileSync(abs, "utf8");
    const updated = replaceSectionBody(original, section, phase);
    if (updated === original) {
      alreadyInSync += 1;
      continue;
    }
    if (cli.dryRun) {
      console.log(`would rewrite: ${rel} (## ${section} → "${phase}")`);
    } else {
      writeFileSync(abs, updated);
      console.log(`rewrote: ${rel} (## ${section} → "${phase}")`);
    }
    rewritten += 1;
  }

  // Notes: also rewrite the "Summary" / "## Summary" line in PRODUCT.md
  // if the user provided notes. The summary is the project's elevator pitch.
  if (notes) {
    const productAbs = join(pmFolder, "PRODUCT.md");
    if (existsSync(productAbs)) {
      const original = readFileSync(productAbs, "utf8");
      const updated = replaceSummaryLine(original, notes);
      if (updated !== original) {
        if (cli.dryRun) {
          console.log(`would rewrite: PRODUCT.md (## Summary → "${notes}")`);
        } else {
          writeFileSync(productAbs, updated);
          console.log(`rewrote: PRODUCT.md (## Summary → "${notes}")`);
        }
        rewritten += 1;
      }
    }
  }

  if (rewritten === 0) {
    console.log(`summary: phase/notes already in sync across ${alreadyInSync} file(s).`);
  } else {
    console.log(`summary: rewrote ${rewritten} file(s); ${alreadyInSync} already in sync.`);
  }
}

// Replace the body of a `## <Section>` heading (the lines between the
// heading and the next `## ` or end of file) with a single new value
// line. Used by --sync to update phase/notes lines in CURRENT_STATUS.md
// and PRODUCT.md to match projects.json.
function replaceSectionBody(content, section, newValue) {
  return replaceMarkdownSectionBody(content, section, newValue);
}

// Replace the single body line under `## Summary` in PRODUCT.md.
// Unlike `## Current Phase` (where the body is a single value), the
// `## Summary` body is a free-form description. The --sync contract is
// to overwrite it with the canonical `notes` value. Idempotent: if the
// current body matches the new value, the file is not rewritten.
function replaceSummaryLine(content, newValue) {
  const headingRe = /^## Summary\s*$/m;
  const m = content.match(headingRe);
  if (!m) return content;
  const start = m.index + m[0].length;
  const rest = content.slice(start);
  const nextH2 = rest.match(/\n## /);
  const end = start + (nextH2 ? nextH2.index : rest.length);
  // Current body trimmed
  const currentBody = rest.slice(0, nextH2 ? nextH2.index : rest.length).trim();
  if (currentBody === newValue.trim()) return content;
  const before = content.slice(0, start);
  const after = content.slice(end);
  return `${before}\n\n${newValue}\n${after}`.replace(/\n{3,}/g, "\n\n");
}

function writeReplace(abs, content, label = "write") {
  if (cli.dryRun) {
    planEntries.push({ action: label, target: abs });
    return;
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  log(label, abs);
}

function fm(fields, { history = false } = {}) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${item}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  if (!history && !fields.status) lines.push("status: active");
  lines.push("---");
  return `${lines.join("\n")}\n`;
}

function baseFm(title, pageType, owner = "PM", extra = {}) {
  return fm({
    title: yamlScalar(title),
    tags: [projectSlug],
    created: date,
    updated: date,
    last_reviewed: date,
    pageType,
    status: "active",
    owner,
    ...extra,
  });
}

function nav(...items) {
  return `## Navigation\n\n${items.map(([target, label]) => `- [[${target}|${label}]]`).join("\n")}\n`;
}

function folderNote({
  title,
  intro,
  subfolders = [],
  notes: noteLinks = [],
  conventions = "",
  navigation,
}) {
  const subfolderBody = subfolders.length
    ? subfolders.map(([target, label, desc]) => `- [[${target}|${label}]] - ${desc}`).join("\n")
    : "- *(no items)*";
  const notesBody = noteLinks.length
    ? noteLinks.map(([target, label, desc]) => `- [[${target}|${label}]] - ${desc}`).join("\n")
    : "- *(no items)*";
  const conventionsBlock = conventions ? `\n## Conventions\n\n${conventions}\n` : "";
  return `${baseFm(title, "index")}# ${title}\n\n${intro}\n\n<!-- vault-maintain:index:start -->\n## Subfolders\n\n${subfolderBody}\n\n## Notes\n\n${notesBody}\n<!-- vault-maintain:index:end -->${conventionsBlock}\n${navigation}`;
}

function page(title, pageType, body, owner = "PM", extra = {}) {
  return `${baseFm(title, pageType, owner, extra)}# ${title}\n\n${body}`;
}

function historyPage(title, body, extra = {}) {
  return `${fm({
    title: yamlScalar(title),
    tags: [projectSlug, "history"],
    created: date,
    updated: date,
    last_reviewed: date,
    pageType: "history",
    kind: "changelog",
    owner: "PM",
    ...extra,
  }, { history: true })}# ${title}\n\n${body}`;
}

function substituteTemplate(name, replacements) {
  return renderTemplateFile(TEMPLATE_DIR, name, replacements);
}

function loadConfig() {
  if (!existsSync(configPath)) {
    const starter = JSON.parse(readFileSync(join(TEMPLATE_DIR, "projects.template.json"), "utf8"));
    delete starter._comment;
    starter.skill_dir = SKILL_DIR;
    starter.vault_root = vaultRoot;
    return starter;
  }
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  if (!cfg.projects || typeof cfg.projects !== "object") cfg.projects = {};
  if (Object.prototype.hasOwnProperty.call(cfg.projects, "<ProjectName>")) {
    delete cfg.projects["<ProjectName>"];
  }
  if (!cfg.skill_dir) cfg.skill_dir = SKILL_DIR;
  if (!cfg.vault_root) cfg.vault_root = vaultRoot;
  return cfg;
}

function assertConfigCanUpdate(cfg) {
  const existing = cfg.projects?.[project];
  if (!existing) return;
  const expected = {
    code_repo: codeRepo,
    pm_folder: pmFolder,
    access,
  };
  for (const [key, value] of Object.entries(expected)) {
    const current = existing[key] ?? null;
    if (current !== value) {
      console.error(
        `ERROR: projects.${project}.${key} is already ${JSON.stringify(current)}, ` +
        `not ${JSON.stringify(value)}. Refusing to silently change an existing project entry.`
      );
      process.exit(1);
    }
  }
}

function writeConfig() {
  const cfg = loadConfig();
  const existingProjects = Object.entries(cfg.projects ?? {})
    .filter(([name]) => name !== "<ProjectName>")
    .map(([name]) => name);
  if (existingProjects.length > 0 && !cli.dryRun) {
    const isOwnReRun = cfg.projects?.[project] !== undefined;
    const otherCount = isOwnReRun ? existingProjects.length - 1 : existingProjects.length;
    if (otherCount > 0) {
      log("notice", configPath, `contains ${otherCount} other project entr${otherCount === 1 ? "y" : "ies"}: ${existingProjects.filter((n) => n !== project).join(", ")}. ${isOwnReRun ? "This run updates the existing '" + project + "' entry (idempotent)." : "This run will add '" + project + "' as an additional entry."}`);
    } else if (existingProjects.length > 0 && existingProjects[0] !== project) {
      log("notice", configPath, `contains 1 other project entry: ${existingProjects[0]}. This run will add '${project}' as an additional entry.`);
    }
  }
  assertConfigCanUpdate(cfg);
  cfg.skill_dir = SKILL_DIR;
  cfg.vault_root = cfg.vault_root || vaultRoot;
  cfg.projects[project] = {
    code_repo: codeRepo,
    pm_folder: pmFolder,
    phase: cli.phase,
    notes,
    access,
  };
  writeReplace(configPath, `${JSON.stringify(cfg, null, 2)}\n`, existsSync(configPath) ? "update" : "write");
}

function replacePmSection(existing, section) {
  const normalized = section.trimEnd();
  const match = existing.match(/^## PM folder\n[\s\S]*?(?=^## |\s*$)/m);
  if (match) {
    return `${existing.slice(0, match.index)}${normalized}\n\n${existing.slice(match.index + match[0].length).replace(/^\n+/, "")}`.trimEnd() + "\n";
  }
  const trimmed = existing.trimEnd();
  return `${trimmed}${trimmed ? "\n\n" : ""}${normalized}\n`;
}

function writeAgents() {
  if (!codeRepo) return;
  const agentsPath = join(codeRepo, "AGENTS.md");
  const section = substituteTemplate("AGENTS_PM_SECTION.md", {});
  const existing = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : "";
  const next = replacePmSection(existing, section);
  if (existing === next) {
    log("skip", agentsPath, "already current");
    return;
  }
  writeReplace(agentsPath, next, existsSync(agentsPath) ? "update" : "write");
}

function scaffold() {
  const dirs = [
    "",
    "archive",
    "decisions",
    "docs",
    "docs/Admin Guide",
    "docs/Developer Guide",
    "docs/Quick Commands",
    "docs/User Guide",
    "features",
    "history",
    `history/${month}`,
    "roadmap",
    "roadmap/plans",
    "system",
  ];
  for (const dir of dirs) ensureDir(join(pmFolder, dir));

  const rootNav = nav([`${linkRoot}/${project}`, `Back to ${project}`]);
  writeCreateOnly(join(pmFolder, `${project}.md`), page(project, "index",
    `${notes}\n\n## Start Here\n\n- [[${linkRoot}/README|README]] - PM folder routing map.\n- [[${linkRoot}/PRODUCT|PRODUCT]] - Product context.\n- [[${linkRoot}/CURRENT_STATUS|CURRENT_STATUS]] - Current snapshot.\n\n${nav([`${linkRoot}/README`, "README"])}`));

  writeCreateOnly(join(pmFolder, "README.md"), page(`${project} Project Docs`, "index",
    `This README is the routing map for ${project} project notes, PM logs, system docs, and product docs.\n\n## What Goes Where\n\n| File / Folder | What to write there |\n|---|---|\n| \`PRODUCT.md\` | Product vision, target users, current product shape, principles, boundaries, future goals |\n| \`system/\` | Current architecture, behavior, data flow, runtime, auth, database, integrations, deployment |\n| \`docs/User Guide/\` | End-user behavior and product reference |\n| \`docs/Admin Guide/\` | Live product operations and admin workflows |\n| \`docs/Developer Guide/\` | Engineering workflows, implementation notes, and known bugs |\n| \`docs/Quick Commands/\` | Copy-pasteable commands |\n| \`features/\` | Per-feature context indexes |\n| \`roadmap/\` | MVP priorities, known issues, done/pending, ideas, and scoped plans under \`roadmap/plans/\` |\n| \`roadmap/plans/\` | Concrete plans (mirrored into \`roadmap/done-pending.md\` when in flight) |\n| \`decisions/\` | Typed decision log (architecture, product, market, vendor, policy, rejection, experiment) |\n| \`history/\` | Completed work logs |\n| \`archive/\` | Superseded material |\n\n## Quick Rules

Update current-state docs first, then history. Update folder indexes whenever notes are added, moved, archived, or deleted. After meaningful code work in an authoritative repo, run \`check-pm-closeout.mjs\` if available, or explicitly record the no-impact reason.

> **Tip:** Expand this README using the full template at \`<skill_dir>/templates/README.md\` for additional sections (Folder Structure, Naming Conventions, Update Frequency, Conventions by Page Type).

${nav([`${linkRoot}/${project}`, `Back to ${project}`])}`));

  writeCreateOnly(join(pmFolder, "PRODUCT.md"), page(`${project} Product`, "index",
    `## Summary\n\n${notes}\n\n## Current Phase\n\n${cli.phase}\n\n## Product Notes\n\nUse this page for product vision, target users, current product shape, principles, boundaries, and future goals.\n\n${rootNav}`));

  writeCreateOnly(join(pmFolder, "CURRENT_STATUS.md"), page(`${project} Current Status`, "index",
    `## Current Phase\n\n${cli.phase}\n\n## Top Priorities\n\n*(no items)*\n\n## Blocked\n\n*(no items)*\n\n## Recent Wins\n\n- Initial PM folder scaffold created on ${date}.\n\n## Major Risks\n\n*(no items)*\n\n## Stale Docs\n\nRun \`node ${rel(join(SKILL_DIR, "scripts/check-pm.mjs"))} --project ${project} --config ${rel(configPath)}\` for the latest validation report.\n\n${nav([`${linkRoot}/${project}`, `Back to ${project}`], [`${linkRoot}/README`, "README"])}`));

  writeCreateOnly(join(pmFolder, "archive/archive.md"), folderNote({
    title: "archive",
    intro: "Superseded material replaced by current product, system, roadmap, or `roadmap/plans/` and `decisions/` docs.",
    navigation: nav([`${linkRoot}/${project}`, `Back to ${project}`]),
  }));

  writeCreateOnly(join(pmFolder, "docs/docs.md"), folderNote({
    title: "docs",
    intro: "User, admin, developer, and quick-command documentation for the project.",
    subfolders: [
      [`${linkRoot}/docs/Admin Guide/Admin Guide`, "Admin Guide/", "Live product operations and admin workflows"],
      [`${linkRoot}/docs/Developer Guide/Developer Guide`, "Developer Guide/", "Engineering workflows and implementation notes"],
      [`${linkRoot}/docs/Quick Commands/Quick Commands`, "Quick Commands/", "Copy-pasteable commands"],
      [`${linkRoot}/docs/User Guide/User Guide`, "User Guide/", "End-user behavior and product reference"],
    ],
    navigation: nav([`${linkRoot}/${project}`, `Back to ${project}`]),
  }));

  writeCreateOnly(join(pmFolder, "docs/Admin Guide/Admin Guide.md"), folderNote({
    title: "Admin Guide",
    intro: "Live product operations for admins and operators.",
    navigation: nav([`${linkRoot}/docs/docs`, "Back to docs"], [`${linkRoot}/${project}`, `Back to ${project}`]),
  }));

  writeCreateOnly(join(pmFolder, "docs/Developer Guide/Developer Guide.md"), folderNote({
    title: "Developer Guide",
    intro: "Coding-engineer workflows, implementation notes, and engineering bug knowledge.",
    notes: [[`${linkRoot}/docs/Developer Guide/known-bugs`, "known-bugs", "Engineering bug knowledge base"]],
    navigation: nav([`${linkRoot}/docs/docs`, "Back to docs"], [`${linkRoot}/${project}`, `Back to ${project}`]),
  }));

  writeCreateOnly(join(pmFolder, "docs/Developer Guide/known-bugs.md"), page("known-bugs", "note",
    `Engineering bug knowledge base for ${project}.\n\n## Recurring Root-Cause Patterns\n\n*(no items)*\n\n## Active Bugs\n\n*(no items)*\n\n## Fixed Bugs\n\n*(no items)*\n\n## Deferred / Monitoring\n\n*(no items)*\n\n${nav([`${linkRoot}/docs/Developer Guide/Developer Guide`, "Back to Developer Guide"], [`${linkRoot}/roadmap/known-issues`, "known-issues"], [`${linkRoot}/${project}`, `Back to ${project}`])}`,
    "Engineering"));

  writeCreateOnly(join(pmFolder, "docs/Quick Commands/Quick Commands.md"), folderNote({
    title: "Quick Commands",
    intro: "Copy-pasteable commands for project workflows.",
    navigation: nav([`${linkRoot}/docs/docs`, "Back to docs"], [`${linkRoot}/${project}`, `Back to ${project}`]),
  }));

  writeCreateOnly(join(pmFolder, "docs/User Guide/User Guide.md"), folderNote({
    title: "User Guide",
    intro: "End-user behavior, manuals, FAQs, and product reference.",
    navigation: nav([`${linkRoot}/docs/docs`, "Back to docs"], [`${linkRoot}/${project}`, `Back to ${project}`]),
  }));

  writeCreateOnly(join(pmFolder, "features/features.md"), folderNote({
    title: "features",
    intro: "Curated per-feature pages that point into system, decisions, and roadmap/plans docs.",
    conventions: `- **One feature per page.** A "feature" is a coherent user-facing capability (chat, memory, email) or a coherent technical pillar (runtime, isolation).
- **Body sections:** Status (alpha/beta/stable/deprecated), Current Behavior, Known Issues, Roadmap, Relevant Decisions, Source of Truth.
- **Frontmatter fields:** \`pageType: feature\`, \`status\` (alpha/beta/stable/deprecated), \`owner\`, \`source_of_truth\` (path to the system/ doc that is canonical for this feature), \`roadmap_source\` (path to the relevant roadmap section).
- **Don't duplicate content.** Feature pages *point* to system/, \`roadmap/plans/\`, and \`decisions/\`; they don't *replace* them. If a system/ doc changes, the feature page's \`source_of_truth\` link is still valid; no edit needed unless the feature itself changes.`,
    navigation: nav([`${linkRoot}/${project}`, `Back to ${project}`], [`${linkRoot}/README`, "README"]),
  }));

  writeCreateOnly(join(pmFolder, "history/history.md"), folderNote({
    title: "history",
    intro: "Chronological logs of completed meaningful work.",
    subfolders: [[`${linkRoot}/history/${month}/${month}`, `${month}/`, "History logs for this month"]],
    navigation: nav([`${linkRoot}/${project}`, `Back to ${project}`]),
  }));

  writeCreateOnly(join(pmFolder, `history/${month}/${month}.md`), folderNote({
    title: month,
    intro: `History logs for ${month}.`,
    notes: [[`${linkRoot}/history/${month}/history-${date}`, `history-${date}`, "Initial PM scaffold"]],
    navigation: nav([`${linkRoot}/history/history`, "Back to history"], [`${linkRoot}/${project}`, `Back to ${project}`]),
  }));

  writeCreateOnly(join(pmFolder, `history/${month}/history-${date}.md`), historyPage(`history-${date}`,
    `- **${project} now has a complete PM folder scaffold.** feat(pm): bootstrap the standard project-management folder structure, indexes, roadmap notes, docs guides, and initial history entry.\n\n${nav([`${linkRoot}/history/${month}/${month}`, `Back to ${month}`], [`${linkRoot}/${project}`, `Back to ${project}`])}`));

  writeCreateOnly(join(pmFolder, "roadmap/plans/plans.md"), folderNote({
    title: "plans",
    intro: "Concrete plans, implementation strategies, and design approaches. Active plans are mirrored in `roadmap/done-pending.md`; completed plans move to `archive/`. Significant decisions live in `decisions/` and are cited from the plan, not duplicated here.",
    conventions: `- **Filename:** \`YYYY-MM-DD_slug.md\` (date prefix from \`created:\` frontmatter). See \`templates/decision.md\` for decision filenames.
- **H1:** the slug only (no number, no date prefix).
- **Status:** five values, all from the planning lifecycle:
  - \`proposed\` — under discussion, not yet approved
  - \`active\` — in flight
  - \`shipped\` — work done, file kept for historical reference
  - \`rejected\` — proposal declined
  - \`superseded\` — replaced by a newer plan or decision
- **Archived field:** when a planning file moves to \`archive/\`, set \`archived: <date>\` in the frontmatter (the date of the move). The \`status\` field is **not** changed: a shipped-then-archived plan keeps \`status: shipped\`; a rejected-then-archived plan keeps \`status: rejected\`; a superseded-then-archived plan keeps \`status: superseded\`. \`archived:\` is the file-location marker; \`status:\` is the lifecycle marker. They are orthogonal.
- **Archive rename:** when retiring, rename to \`archive/<slug>-archived.md\` — drop the date prefix, preserve the slug, append \`-archived\`. This rename is mandatory.
- **Owner:** typically \`PM\`. Use \`Platform team\` or \`Operator\` for plans owned by another team.
- **Cross-link:** when a planning note is approved, add a slug-only \`## <slug>\` section to \`roadmap/done-pending.md\` with the date-prefixed planning note link. When it ships, distill durable current truth into \`system/\` and archive the file.
- **Decisions cited, not duplicated:** if the plan records a significant decision, write a typed \`decisions/D-NNN_<type>_<slug>.md\` and link it from the plan's Related section. Do not restate the decision's reasoning in the plan.
`,
    navigation: nav([`${linkRoot}/roadmap/roadmap`, "Back to roadmap"], [`${linkRoot}/${project}`, `Back to ${project}`], [`${linkRoot}/README`, "README"]),
  }));

  writeCreateOnly(join(pmFolder, "decisions/decisions.md"), folderNote({
    title: "decisions",
    intro: "Record of decisions made. Each file is one typed decision: architecture (`ADR`), product (`PRD`), market (`MKT`), vendor (`VND`), policy (`POL`), rejection (`NEG`), or experiment (`EXP`). Filenames follow `D-NNN_<type>_<slug>.md`. Bodies follow the standard shape: Context, Options Considered, Decision, Consequences, Realization Notes, Related, Navigation. (See `templates/decision.md` for the full template; see `templates/README.md` \"Conventions by Page Type → Decisions\" for the body shape reference.)",
    navigation: nav([`${linkRoot}/${project}`, `Back to ${project}`], [`${linkRoot}/README`, "README"]),
  }));

  writeCreateOnly(join(pmFolder, "roadmap/roadmap.md"), folderNote({
    title: "roadmap",
    intro: "MVP priorities, known issues, done/pending status, ideas, and scoped plans under `roadmap/plans/`.",
    notes: [
      [`${linkRoot}/roadmap/mvp-priorities`, "mvp-priorities", "MVP priority tracker"],
      [`${linkRoot}/roadmap/known-issues`, "known-issues", "Active bugs, risks, and blockers"],
      [`${linkRoot}/roadmap/done-pending`, "done-pending", "Planning mirrors and lightweight done/pending"],
      [`${linkRoot}/roadmap/ideas`, "ideas", "Idea register"],
      [`${linkRoot}/roadmap/plans/plans`, "plans/", "Concrete plans not fully shipped yet"],
    ],
    navigation: nav([`${linkRoot}/${project}`, `Back to ${project}`]),
  }));

  writeCreateOnly(join(pmFolder, "roadmap/mvp-priorities.md"), page("mvp-priorities", "roadmap",
    `## Contents\n\n- [[#Alpha Goal]]\n- [[#MVP Priorities]]\n- [[#Bootstrap]]\n- [[#Validations]]\n- [[#Migrations]]\n- [[#AGENTS.md integration]]\n- [[#CLI surface]]\n- [[#Documentation]]\n- [[#OpenClaw PM-agent integration]]\n- [[#Not Yet MVP]]\n- [[#Navigation]]\n\n## Alpha Goal\n\n${notes}\n\n## MVP Priorities\n\n### Bootstrap\n\n- [x] **DONE:** \`bootstrap-pm.mjs\` (and the \`pm-folder-bootstrap\` feature). Shipped v1.0.0. Idempotent scaffold; writes PM folder + \`AGENTS.md\` + \`projects.json\` entry.\n\n### Validations\n\n- [x] **DONE:** \`check-pm.mjs\` orchestrator + 4 focused validators (vault structure, stale docs, PM consistency, AGENTS.md integration). Shipped v1.0.0. Passes on a fresh scaffold.\n- [x] **DONE:** Reconcile workflow (validate + fix + migrate + re-validate in one trigger). Shipped v1.4.0. The \`reconcile this project\` phrase runs the orchestrator with \`--fix\`, applies pending migrations, and re-validates. Idempotent.\n\n### Migrations\n\n- [x] **DONE:** \`migrate.mjs\` runner + \`migrations/_index.mjs\` registry. Shipped v1.0.0. Per-project ledger at \`<pm_folder>/.pm/migrations.json\`; idempotent.\n\n### AGENTS.md integration\n\n- [x] **DONE:** \`check-agents.mjs\` + 2 AGENTS.md PM-section templates. Shipped v1.0.0. The convention is reachable from any coding agent via the project's \`AGENTS.md\`.\n\n### CLI surface\n\n- [x] **DONE:** \`install.sh\` curl-friendly installer with TTY-aware interactive menu. Shipped v1.4.0. No-TTY fallback to \`--target agents\`. The \`--ref\` and \`--channel\` flags support pinned installs and release channels.\n\n### Documentation\n\n- [x] **DONE:** Quick Start trigger table in \`README.md\`. Shipped v1.0.0; refined through v1.4.0. The table is ordered for new-user natural flow: setup → setup-as-collab → verify → reconcile → migrate → log.\n- [x] **DONE:** \`REFERENCE.md\` developer reference (validation and repair, migrations, setup intake, coding agent integration, contributor workflow, templates, bootstrap workflow, live management folder rule, project-specific configuration, pitfalls). Shipped v1.0.0; expanded through v1.4.1.\n\n### OpenClaw PM-agent integration\n\n- [x] **DONE:** \`openclaw-instruction.md\` copy-paste bootstrap prompt. Shipped v1.4.0. Wires an OpenClaw chat session into the skill.\n\n## Not Yet MVP\n\n- **More focused validators** — frontmatter \`pageType\` ↔ folder-name consistency, orphaned decisions, planning notes with no \`done-pending.md\` mirror, archive folder hygiene. *Not yet committed; tracked in \`roadmap/ideas.md\` "Brainstorming".*\n- **\`migrate --target <project>\` flag** — currently \`--pm-folder <path>\` is the primary interface. *Not yet implemented; tracked in \`roadmap/ideas.md\` "Brainstorming".*\n- **Self-skip rule for \`archive/archive.md\`** in the vault-structure validator. *Not yet implemented; tracked in \`roadmap/ideas.md\` "Brainstorming".*\n- **First real second user** — until at least one non-owner installs and uses the skill on a non-trivial project, the v1.x → v2.0 promotion is held back. *Tracked in \`CURRENT_STATUS.md\` "Top Priorities" item 3.*\n\n${nav([`${linkRoot}/roadmap/roadmap`, "Back to roadmap"], [`${linkRoot}/${project}`, `Back to ${project}`])}`));

  writeCreateOnly(join(pmFolder, "roadmap/known-issues.md"), page("known-issues", "roadmap",
    `Open bugs, risks, and blockers for ${project}.\n\n## Contents\n\n- [[#Active]]\n- [[#Migrations]]\n- [[#Validators]]\n- [[#AGENTS.md integration]]\n- [[#CLI surface]]\n- [[#Documentation]]\n- [[#Deferred]]\n- [[#Navigation]]\n\n## Active\n\nActive items are grouped by domain below. **Fixed items are migrated to \`docs/Developer Guide/known-bugs.md\`** (the engineering knowledge base) and removed from this file. A \`### <Domain>\` section that becomes fully fixed (no remaining active items) is archived to \`archive/known-issues-<domain>-archived.md\` per the planning-note archive convention. \`## Deferred\` items stay in this file until re-opened.\n\n### Migrations\n\n- [ ] **PENDING:** <one-line description of the bug/risk/blocker>. The migration gap. Tracked for v1.5.0.\n\n### Validators\n\n- [ ] **PENDING:** <one-line description of the validator gap>. The expected behavior. The actual behavior.\n\n### AGENTS.md integration\n\n- [ ] **PENDING:** <one-line description of the AGENTS.md gap>.\n\n### CLI surface\n\n*(no items)*\n\n### Documentation\n\n*(no items)*\n\n## Deferred\n\n### Validators\n\n- [ ] **DEFERRED:** <one-line description of the deferred validator item>.\n\n### CLI surface\n\n- [ ] **DEFERRED:** <one-line description of the deferred CLI item>.\n\n${nav([`${linkRoot}/roadmap/roadmap`, "Back to roadmap"], [`${linkRoot}/docs/Developer Guide/known-bugs`, "known-bugs"], [`${linkRoot}/${project}`, `Back to ${project}`])}`));

  writeCreateOnly(join(pmFolder, "roadmap/done-pending.md"), page("done-pending", "roadmap",
    `## Contents

- [[#example-plan-slug]]
- [[#General Done/Pending Without Dedicated Planning Note]]
- [[#Navigation]]

This file holds two kinds of entries: (a) **planning-note mirrors** — one H2 per active or proposed planning note from \`roadmap/plans/\`, with a DONE/PENDING checklist and relevant decisions/features/system/docs links; (b) **general done/pending items** without a dedicated planning note, organized by date. The two coexist; planning-note mirrors always take priority in the file's order.

Planning-note mirror H2 format: \`## <slug>\` (slug only, not the date-prefixed stem). Contents links must match the actual H2 headings in this note. Each mirror section starts with a \`Planning note:\` line linking to the plan, then a DONE/PENDING checklist, then \`Relevant decisions:\`, \`Relevant features:\`, and optional \`Relevant system:\` / \`Relevant docs:\` lines. Do not use \`Relevant ADRs:\`; decisions are the first-class lane.

## example-plan-slug

Planning note: [[${linkRoot}/roadmap/plans/YYYY-MM-DD_example-plan-slug|YYYY-MM-DD_example-plan-slug]]

- [x] DONE: <one-line description of what shipped>.
- [ ] PENDING: <one-line description of what's still open>.
- [ ] PENDING: <another pending item>.

- Relevant decisions: [[${linkRoot}/decisions/D-NNN_<type>_<slug>]] *(or \`*(none)*\` if there are no related decisions yet)*
- Relevant features: [[${linkRoot}/features/<feature-slug>]] *(or \`*(none)*\` if there are no related features yet)*
- Relevant system: [[${linkRoot}/system/<topic>]] *(optional; use \`*(none)*\` if not applicable)*
- Relevant docs: [[${linkRoot}/docs/<Guide>/<topic>]] *(optional; use \`*(none)*\` if not applicable)*

## General Done/Pending Without Dedicated Planning Note

### Pending

*(no items)*

### Done — YYYY-MM-DD

*(no items)*

${nav([`${linkRoot}/roadmap/roadmap`, "Back to roadmap"], [`${linkRoot}/${project}`, `Back to ${project}`])}`));

  writeCreateOnly(join(pmFolder, "roadmap/ideas.md"), page("ideas", "roadmap",
    `Ideas here are not commitments. Keep rough proposals here until they are approved and concrete enough to move into roadmap/plans/ and roadmap/done-pending.md.

**Status colors:** 🟣 Brainstorming · 🟡 Scoping · 🔵 Approved · 🟢 Implemented · 🔴 Declined. The colors appear in the Status Key, the Idea Register, and the Idea Details sections. This convention comes from the project-management skill policy for idea status colors.

## Contents

- [[#Status Key]]
- [[#Idea Register]]
- [[#Brainstorming]]
- [[#Scoping]]
- [[#Approved]]
- [[#Implemented]]
- [[#Declined]]
- [[#Idea Details]]
- [[#Navigation]]

## Status Key

| Status | Meaning |
|---|---|
| 🟣 Brainstorming | Rough idea, needs validation |
| 🟡 Scoping | Worth exploring, decisions being made |
| 🔵 Approved | Scoped, ready for implementation |
| 🟢 Implemented | Built and shipped |
| 🔴 Declined | Rejected or intentionally not pursued |

## Idea Register

| ID | Title | Status | One-line |
|---|---|---|---|
| IDEA-001 | Example idea | 🟣 Brainstorming | One-line description of the idea. |

## Brainstorming

- **IDEA-001** — Example idea. *Why brainstorming:* <why this is at this stage>.

## Scoping

*(no items)*

## Approved

*(no items)*

## Implemented

*(no items)*

## Declined

*(no items)*

## Idea Details

### IDEA-001 - Example idea

- **Summary:** TBD
- **Status:** 🟣 Brainstorming
- **Date:** YYYY-MM-DD
- **Owner / next step:** <who is responsible; what's the next concrete action>.
- **Differentiation:** <what makes this idea distinct from similar ones>.
- **Why valuable:** <the case for the idea>.
- **Open questions:** <what's still unresolved>.
- **References:** <links to related decisions/features/known-issues, or \`None yet\`>.

Replace \`TBD\` with a 2-4 sentence description before approving or implementing the idea. Auto-fix may insert \`TBD\`, but agents must not invent the missing prose.

## Navigation

${nav([`${linkRoot}/roadmap/roadmap`, "Back to roadmap"], [`${linkRoot}/${project}`, `Back to ${project}`])}`));

  writeCreateOnly(join(pmFolder, "system/system.md"), folderNote({
    title: "system",
    intro: "Current architecture, behavior, runtime, data flow, and integrations.",
    notes: [[`${linkRoot}/system/overview`, "overview", "Initial system overview"]],
    navigation: nav([`${linkRoot}/${project}`, `Back to ${project}`], [`${linkRoot}/README`, "README"]),
  }));

  writeCreateOnly(join(pmFolder, "system/overview.md"), page("overview", "system",
    `## Current Understanding\n\n${notes}\n\nNo code-derived architecture has been recorded yet.\n\n## Runtime\n\nUnknown until implementation starts.\n\n## Data Flow\n\nUnknown until implementation starts.\n\n${nav([`${linkRoot}/system/system`, "Back to system"], [`${linkRoot}/${project}`, `Back to ${project}`])}`,
    "Engineering"));
}

emitExistingFilesNotice();

if (cli.sync) {
  syncPhaseAndNotes();
  process.exit(0);
}

writeConfig();
scaffold();
writeAgents();

if (cli.dryRun) {
  const groups = new Map();
  for (const entry of planEntries) {
    const key = folderGroup(entry.target) || ".";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  console.log("");
  console.log("# Bootstrap dry run — grouped plan");
  const sortedKeys = [...groups.keys()].sort();
  for (const folder of sortedKeys) {
    const items = groups.get(folder);
    const verbs = items.map((i) => i.action);
    console.log("");
    console.log(`## ${folder} (${items.length})`);
    for (const item of items) {
      const label = item.action === "write" && item.detail ? `${item.action} — ${item.detail}` : item.action;
      const verb = item.action === "write" || item.action === "update" ? "write" :
                   item.action === "mkdir" ? "mkdir" :
                   item.action;
      const name = rel(item.target).split("/").pop();
      console.log(`- ${verb}: ${name}`);
    }
  }
  const counts = planEntries.reduce((acc, e) => {
    acc[e.action] = (acc[e.action] ?? 0) + 1;
    return acc;
  }, {});
  console.log("");
  console.log(summarizeScaffoldCounts(counts, skippedExistingCount));

  // Validate the plan is possible: each parent directory must exist or be in the plan.
  const planDirs = new Set(planEntries.filter((e) => e.action === "mkdir").map((e) => resolve(e.target)));
  const planWriteDirs = new Set(planEntries.filter((e) => e.action === "write" || e.action === "update").map((e) => resolve(dirname(e.target))));
  const missingParents = [];
  for (const dir of planWriteDirs) {
    if (planDirs.has(dir) || existsSync(dir)) continue;
    let parent = dirname(dir);
    let found = false;
    while (parent !== pmFolder && parent !== dirname(parent)) {
      if (planDirs.has(parent) || existsSync(parent)) { found = true; break; }
      parent = dirname(parent);
    }
    if (!found) missingParents.push(rel(dir));
  }
  if (missingParents.length > 0) {
    console.error("");
    console.error("ERROR: dry-run plan references directories that would not exist:");
    for (const m of missingParents) console.error(`  - ${m}`);
    console.error("Refusing to print a non-executable plan. Fix the scaffold and re-run.");
    process.exit(2);
  }

  console.log("");
  console.log("# Bootstrap dry run complete");
  console.log(`Project: ${project}`);
  console.log(`PM folder: ${pmFolder}`);
  console.log(`Code repo: ${codeRepo ?? "null"}`);
  console.log(`Config: ${configPath}`);
  process.exit(0);
}

console.log("");
console.log("# Bootstrap complete");
console.log(`Project: ${project}`);
console.log(`PM folder: ${pmFolder}`);
console.log(`Code repo: ${codeRepo ?? "null"}`);
console.log(`Config: ${configPath}`);

console.log(summarizeScaffoldCounts(operationCounts, skippedExistingCount));
