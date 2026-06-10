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
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const TEMPLATE_DIR = join(SKILL_DIR, "templates");

function usage() {
  console.error(`Usage:
  node scripts/bootstrap-pm.mjs \\
    --project <name> \\
    --pm-folder <path> \\
    --code-repo <path|null> \\
    --phase <phase> \\
    --notes <one-line description> \\
    --config <path> \\
    [--vault-root <path>] \\
    [--date YYYY-MM-DD] \\
    [--dry-run]
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
    vaultRoot: null,
    date: localDate(),
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      out.dryRun = true;
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
    else if (arg === "--vault-root") out.vaultRoot = value;
    else if (arg === "--date") out.date = value;
    else {
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(2);
    }
  }

  for (const key of ["project", "pmFolder", "phase", "config"]) {
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

function log(action, target, detail = "") {
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`${action}: ${target}${suffix}`);
}

const cli = parseArgs(process.argv);
const project = cli.project;
const projectSlug = slugify(project);
const pmFolder = resolve(cli.pmFolder);
const codeRepo = cli.codeRepo === null ? null : resolve(cli.codeRepo);
const configPath = resolve(cli.config);
const vaultRoot = cli.vaultRoot ? resolve(cli.vaultRoot) : dirname(pmFolder);
const date = cli.date;
const month = monthOf(date);
const notes = cli.notes || `${project} project.`;
const linkRoot = `Projects/${project}`;

const plannedWrites = [];
const plannedDirs = [];

function ensureDir(abs) {
  if (existsSync(abs)) {
    log("exists", abs);
    return;
  }
  if (cli.dryRun) {
    plannedDirs.push(abs);
    log("would mkdir", abs);
    return;
  }
  mkdirSync(abs, { recursive: true });
  log("mkdir", abs);
}

function writeCreateOnly(abs, content) {
  if (existsSync(abs)) {
    log("skip", abs, "exists");
    return;
  }
  if (cli.dryRun) {
    plannedWrites.push(abs);
    log("would write", abs);
    return;
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  log("write", abs);
}

function writeReplace(abs, content, label = "write") {
  if (cli.dryRun) {
    plannedWrites.push(abs);
    log(`would ${label}`, abs);
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
  let content = readFileSync(join(TEMPLATE_DIR, name), "utf8");
  for (const [from, to] of Object.entries(replacements)) {
    content = content.split(from).join(to);
  }
  return content;
}

function loadConfig() {
  if (!existsSync(configPath)) {
    const starter = JSON.parse(readFileSync(join(TEMPLATE_DIR, "projects.template.json"), "utf8"));
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
    access: "authoritative",
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
  assertConfigCanUpdate(cfg);
  cfg.skill_dir = SKILL_DIR;
  cfg.vault_root = cfg.vault_root || vaultRoot;
  cfg.projects[project] = {
    code_repo: codeRepo,
    pm_folder: pmFolder,
    phase: cli.phase,
    notes,
    access: "authoritative",
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
  const section = substituteTemplate("AGENTS_PM_SECTION_AUTHORITATIVE.md", {
    "<pm_folder>": pmFolder,
    "<skill_dir>": SKILL_DIR,
  });
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
    `This README is the routing map for ${project} project notes, PM logs, system docs, and product docs.\n\n## What Goes Where\n\n| File / Folder | What to write there |\n|---|---|\n| \`PRODUCT.md\` | Product vision, target users, current product shape, principles, boundaries, future goals |\n| \`system/\` | Current architecture, behavior, data flow, runtime, auth, database, integrations, deployment |\n| \`docs/User Guide/\` | End-user behavior and product reference |\n| \`docs/Admin Guide/\` | Live product operations and admin workflows |\n| \`docs/Developer Guide/\` | Engineering workflows, implementation notes, and known bugs |\n| \`docs/Quick Commands/\` | Copy-pasteable commands |\n| \`features/\` | Per-feature context indexes |\n| \`roadmap/\` | MVP priorities, known issues, done/pending, ideas, and scoped plans under \`roadmap/plans/\` |\n| \`roadmap/plans/\` | Concrete plans (mirrored into \`roadmap/done-pending.md\` when in flight) |\n| \`decisions/\` | Typed decision log (architecture, product, market, vendor, policy, rejection, experiment) |\n| \`history/\` | Completed work logs |\n| \`archive/\` | Superseded material |\n\n## Quick Rules\n\nUpdate current-state docs first, then history. Update folder indexes whenever notes are added, moved, archived, or deleted.\n\n${nav([`${linkRoot}/${project}`, `Back to ${project}`])}`));

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
    `- feat: bootstrap PM folder scaffold for ${project}.\n\n${nav([`${linkRoot}/history/${month}/${month}`, `Back to ${month}`], [`${linkRoot}/${project}`, `Back to ${project}`])}`));

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
- **Cross-link:** when a planning note is approved, add a \`## YYYY-MM-DD_slug\` section to \`roadmap/done-pending.md\` with the planning note link. When it ships, distill durable current truth into \`system/\` and archive the file.
- **Decisions cited, not duplicated:** if the plan records a significant decision, write a typed \`decisions/D-NNN_<type>_<slug>.md\` and link it from the plan's Related section. Do not restate the decision's reasoning in the plan.`,
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
    `## Contents\n\n- [[#Alpha Goal]]\n- [[#MVP Priorities]]\n- [[#Not Yet MVP]]\n- [[#Navigation]]\n\n## Alpha Goal\n\n${notes}\n\n## MVP Priorities\n\n*(no items)*\n\n## Not Yet MVP\n\n*(no items)*\n\n${nav([`${linkRoot}/roadmap/roadmap`, "Back to roadmap"], [`${linkRoot}/${project}`, `Back to ${project}`])}`));

  writeCreateOnly(join(pmFolder, "roadmap/known-issues.md"), page("known-issues", "roadmap",
    `Open bugs, risks, and blockers for ${project}.\n\n## Contents\n\n- [[#Active]]\n- [[#Fixed]]\n- [[#Deferred]]\n- [[#Navigation]]\n\n## Active\n\n*(no items)*\n\n## Fixed\n\n*(no items)*\n\n## Deferred\n\n*(no items)*\n\n${nav([`${linkRoot}/roadmap/roadmap`, "Back to roadmap"], [`${linkRoot}/docs/Developer Guide/known-bugs`, "known-bugs"], [`${linkRoot}/${project}`, `Back to ${project}`])}`));

  writeCreateOnly(join(pmFolder, "roadmap/done-pending.md"), page("done-pending", "roadmap",
    `## Contents\n\n- [[#General Done/Pending Without Dedicated Planning Note]]\n- [[#Navigation]]\n\nThis file mirrors concrete planning notes first.\n\n## General Done/Pending Without Dedicated Planning Note\n\n*(no items)*\n\n${nav([`${linkRoot}/roadmap/roadmap`, "Back to roadmap"], [`${linkRoot}/${project}`, `Back to ${project}`])}`));

  writeCreateOnly(join(pmFolder, "roadmap/ideas.md"), page("ideas", "roadmap",
    `Ideas here are not commitments. Keep rough proposals here until they are approved and concrete enough to move into planning.\n\n## Contents\n\n- [[#Status Key]]\n- [[#Idea Register]]\n- [[#Brainstorming]]\n- [[#Scoping]]\n- [[#Approved]]\n- [[#Implemented]]\n- [[#Declined]]\n- [[#Idea Details]]\n- [[#Navigation]]\n\n## Status Key\n\n| Status | Meaning |\n|---|---|\n| Brainstorming | Rough idea, needs validation |\n| Scoping | Worth exploring, decisions being made |\n| Approved | Scoped, ready for implementation |\n| Implemented | Built and shipped |\n| Declined | Rejected or intentionally not pursued |\n\n## Idea Register\n\n*(no items)*\n\n## Brainstorming\n\n*(no items)*\n\n## Scoping\n\n*(no items)*\n\n## Approved\n\n*(no items)*\n\n## Implemented\n\n*(no items)*\n\n## Declined\n\n*(no items)*\n\n## Idea Details\n\n*(no items)*\n\n${nav([`${linkRoot}/roadmap/roadmap`, "Back to roadmap"], [`${linkRoot}/${project}`, `Back to ${project}`])}`));

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

writeConfig();
scaffold();
writeAgents();

console.log("");
console.log(cli.dryRun ? "# Bootstrap dry run complete" : "# Bootstrap complete");
console.log(`Project: ${project}`);
console.log(`PM folder: ${pmFolder}`);
console.log(`Code repo: ${codeRepo ?? "null"}`);
console.log(`Config: ${configPath}`);
