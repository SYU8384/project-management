#!/usr/bin/env node
/**
 * check-vault-structure.mjs
 *
 * Walks a project-management PM folder and verifies the required
 * folder + file structure is in place. Emits a pass/fail report.
 *
 * Required:
 *   - Folders: roadmap/, system/, history/, archive/, docs/, features/
 *   - Root files: README.md, PRODUCT.md, <Project>.md, CURRENT_STATUS.md
 *   - Roadmap standard notes: mvp-priorities.md, known-issues.md,
 *     done-pending.md, ideas.md
 *   - System index: system/system.md (or at least one system/*.md)
 *   - Developer bug knowledge base: docs/Developer Guide/known-bugs.md
 *   - Archive index: archive/archive.md
 *   - History index: history/history.md
 *
 * Optional but recommended:
 *   - decisions/ subfolder (typed decision log; required once any decision exists)
 *
 * Usage:
 *   node scripts/check-vault-structure.mjs                                # scan CWD
 *   node scripts/check-vault-structure.mjs /path/to/vault/root            # scan explicit root
 *   node scripts/check-vault-structure.mjs                                # auto-discover ~/.config/project-management/projects.json
 *   node scripts/check-vault-structure.mjs --config <path>                # read projects from config; iterates
 *   node scripts/check-vault-structure.mjs --project <name> --config <p> # scan a single project from config
 *
 * The `--config` flag expects a path to `projects.json` from the
 * project-management skill (at the skill root, alongside SKILL.md). The script
 * reads `vault_root` and the project's `pm_folder` from the config. When
 * `--config` is set without `--project`, the script iterates over all
 * projects in the config and prints one report per project.
 *
 * If a <vault> path is provided, that folder is scanned directly. If no
 * <vault> path or `--config` is given, the script walks up from its own
 * location looking for a sibling SKILL.md; the projects.json next to that
 * SKILL.md is used as the default config. Explicit `--config` always wins.
 *
 * Exit codes:
 *   0 = all required present
 *   1 = at least one required missing
 *
 * AGENTS.md integration is validated by check-agents.mjs, which is run by
 * the primary check-pm.mjs wrapper.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolveProjectsConfigPath, findSkillDir } from "./lib/paths.mjs";
import { loadPmSkip, isSkipped } from "./lib/skip.mjs";

const SKILL_DIR = findSkillDir();

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { vault: null, config: null, project: null, fix: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" || args[i] === "-c") {
      out.config = args[++i];
    } else if (args[i] === "--project" || args[i] === "-p") {
      out.project = args[++i];
    } else if (args[i] === "--fix") {
      out.fix = true;
    } else if (!args[i].startsWith("-")) {
      out.vault = args[i];
    }
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

function configSetupError(project, configPath, cfg, reason) {
  const setupHint = isTemplateConfig(cfg)
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
  if (!configPath) {
    if (!CLI.vault) {
      console.error(
        `NOTE: no projects.json auto-discovered and no <vault> argument given.\n` +
        `      projects.json lives at ~/.config/project-management/projects.json (v1.3.0+).\n` +
        `      or pass an explicit <vault> path to scan a single directory.\n` +
        `      Falling back to CWD scan (${process.cwd()}).\n`
      );
    }
    return [{ vault: resolve(CLI.vault ?? process.cwd()), label: resolve(CLI.vault ?? process.cwd()) }];
  }
  const cfgRaw = readFileSync(configPath, "utf8");
  const cfg = JSON.parse(cfgRaw);
  if (CLI.project) {
    const proj = cfg.projects?.[CLI.project];
    if (!proj) {
      console.error(configSetupError(CLI.project, configPath, cfg, `project '${CLI.project}' not found`));
      process.exit(2);
    }
    if (!proj.pm_folder) {
      console.error(configSetupError(CLI.project, configPath, cfg, `project '${CLI.project}' has no pm_folder`));
      process.exit(2);
    }
    return [{ vault: resolve(proj.pm_folder), label: `${CLI.project} (${proj.pm_folder})` }];
  }
  const projects = cfg.projects ?? {};
  const targets = [];
  for (const [name, proj] of Object.entries(projects)) {
    if (!proj.pm_folder) continue;
    targets.push({ vault: resolve(proj.pm_folder), label: `${name} (${proj.pm_folder})` });
  }
  if (targets.length === 0) {
    console.log(`\nNo projects with available pm_folder entries in ${configPath}.`);
  }
  return targets;
}

// Per-target state (mutated by check()/emit() before each runFor call)
let vaultRoot = null;
let skipSet = new Set();

const REQUIRED_DIRS = [
  "roadmap",
  "system",
  "history",
  "archive",
  "docs",
  "features",
];

const CANONICAL_TOP_LEVEL_DIRS = new Set(REQUIRED_DIRS);
const CANONICAL_DOCS_GUIDE_DIRS = new Map([
  ["admin guide", "Admin Guide"],
  ["developer guide", "Developer Guide"],
  ["quick commands", "Quick Commands"],
  ["user guide", "User Guide"],
]);

const REQUIRED_ROOT_FILES = [
  "README.md",
  "PRODUCT.md",
  "CURRENT_STATUS.md",
  // <Project>.md is checked separately: any single additional .md at root
];

const REQUIRED_ROADMAP_FILES = [
  "roadmap/mvp-priorities.md",
  "roadmap/known-issues.md",
  "roadmap/done-pending.md",
  "roadmap/ideas.md",
];

const REQUIRED_INDEX_FILES = [
  "system/system.md",
  "archive/archive.md",
  "history/history.md",
  "docs/docs.md",
  "docs/Admin Guide/Admin Guide.md",
  "docs/Developer Guide/Developer Guide.md",
  "docs/Developer Guide/known-bugs.md",
  "docs/Quick Commands/Quick Commands.md",
  "docs/User Guide/User Guide.md",
];

const OPTIONAL_DIRS = [
  "decisions",
];

// Migration-debt warnings are sourced from the registry at
// `scripts/migrations/_index.mjs` so they stay in sync as new migrations
// are added. See checkMigrations() below.

// Folder notes (one .md at the top of each visible PM folder serving as
// its index) are governed by `templates/folder-note.md`. Hidden sync/tooling
// folders such as `.stfolder`, `.stversions`, and `.workspace` are ignored.
// The body may hold the index block plus a small set of optional `##`
// sections: a per-lane `## Conventions` block is allowed (and recommended
// for lanes with lane-specific rules, e.g. `roadmap/plans/`, `features/`,
// `decisions/`). The shape check counts `##` headings outside frontmatter
// and fails if a folder note has accumulated more than 4.
const IGNORED_DIR_NAMES = new Set([".git", ".obsidian", "node_modules"]);
const FOLDER_NOTE_MAX_SECTIONS = 4;

const findings = {
  required: { missing: [], present: [] },
  project: { found: null, present: false },
  system: { hasSystemMd: false, hasAnySystemDoc: false },
  optional: { missing: [], present: [] },
  unappliedMigrations: [],
  folderNames: { violations: [] },
  folderNotes: { present: [], missing: [], violations: [], parentLinkViolations: [] },
  docsNames: { violations: [] },
  docsNameWarnings: { warnings: [] },
  historyNames: { violations: [] },
  roadmapShape: { violations: [] },
};

function exists(rel) {
  return existsSync(join(vaultRoot, rel));
}

function isDir(rel) {
  if (!exists(rel)) return false;
  return statSync(join(vaultRoot, rel)).isDirectory();
}

function isFile(rel) {
  if (!exists(rel)) return false;
  return statSync(join(vaultRoot, rel)).isFile();
}

function listRootMds() {
  if (!existsSync(vaultRoot)) return [];
  return readdirSync(vaultRoot).filter((f) => f.endsWith(".md"));
}

function listSystemDocs() {
  const dir = join(vaultRoot, "system");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md"));
}

function checkRequired() {
  for (const dir of REQUIRED_DIRS) {
    if (isDir(dir)) {
      findings.required.present.push(`dir: ${dir}/`);
    } else {
      findings.required.missing.push(`dir: ${dir}/`);
    }
  }

  for (const file of REQUIRED_ROOT_FILES) {
    if (isFile(file)) {
      findings.required.present.push(`file: ${file}`);
    } else {
      findings.required.missing.push(`file: ${file}`);
    }
  }

  // <Project>.md: any single .md at root beyond the four standard ones
  const rootMds = listRootMds();
  const standardRootMds = new Set(["README.md", "PRODUCT.md", "CURRENT_STATUS.md"]);
  const projectFile = rootMds.find((f) => !standardRootMds.has(f));
  if (projectFile) {
    findings.project.found = projectFile;
    findings.project.present = true;
  } else {
    findings.required.missing.push(`file: <Project>.md (one .md at root beyond README/PRODUCT/CURRENT_STATUS)`);
  }

  for (const file of REQUIRED_ROADMAP_FILES) {
    if (isFile(file)) {
      findings.required.present.push(`file: ${file}`);
    } else {
      findings.required.missing.push(`file: ${file}`);
    }
  }

  for (const file of REQUIRED_INDEX_FILES) {
    if (isFile(file)) {
      findings.required.present.push(`file: ${file}`);
    } else {
      findings.required.missing.push(`file: ${file}`);
    }
  }

  if (isFile("system/system.md")) {
    findings.system.hasSystemMd = true;
  }
  if (listSystemDocs().length > 0) {
    findings.system.hasAnySystemDoc = true;
  }
  if (!findings.system.hasSystemMd && !findings.system.hasAnySystemDoc) {
    findings.required.missing.push("file: system/system.md (or at least one system/*.md)");
  }
}

function checkOptional() {
  for (const dir of OPTIONAL_DIRS) {
    if (isDir(dir)) {
      findings.optional.present.push(`dir: ${dir}/`);
    } else {
      findings.optional.missing.push(`dir: ${dir}/`);
    }
  }
}

function scriptDir() {
  return dirname(fileURLToPath(import.meta.url));
}

async function checkMigrations() {
  const skillDir = dirname(scriptDir());
  const indexPath = join(scriptDir(), "migrations", "_index.mjs");
  let registry;
  try {
    registry = await import(pathToFileURL(indexPath).href);
  } catch {
    process.stderr.write(
      `note: migration registry unavailable; skipping migration-debt check\n`
    );
    return;
  }
  if (!registry || !Array.isArray(registry.default)) return;
  for (const spec of registry.default) {
    const filePath = join(scriptDir(), "migrations", spec);
    let mod;
    try {
      mod = await import(pathToFileURL(filePath).href);
    } catch {
      continue;
    }
    const m = mod && mod.default;
    if (!m || typeof m.detect !== "function") continue;
    let needed;
    try {
      needed = await m.detect({ pmFolder: vaultRoot });
    } catch {
      continue;
    }
    if (!needed) continue;
    const describe = typeof m.describe === "string" ? m.describe : "";
    const firstLine = describe.split("\n")[0].trim();
    const runHint = `Run \`node ${skillDir}/scripts/migrate.mjs --pm-folder ${vaultRoot}\` (or pass --project <name> --config <configPath> if applicable) to apply it.`;
    findings.unappliedMigrations.push(
      `Migration \`${m.id}\` is unapplied. ${runHint} ${firstLine}`
    );
  }
}

function listVisibleDirectoriesUnder(relDir) {
  const root = relDir ? join(vaultRoot, relDir) : vaultRoot;
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !isIgnoredDirectory(entry.name))
    .map((entry) => entry.name);
}

function checkFolderNames() {
  for (const name of listVisibleDirectoriesUnder("")) {
    const lower = name.toLowerCase();
    if (CANONICAL_TOP_LEVEL_DIRS.has(lower) && name !== lower) {
      findings.folderNames.violations.push({
        path: `${name}/`,
        expected: `${lower}/`,
        reason: "top-level PM lanes use lowercase",
      });
    }
  }

  for (const name of listVisibleDirectoriesUnder("docs")) {
    const expected = CANONICAL_DOCS_GUIDE_DIRS.get(name.toLowerCase());
    if (expected && name !== expected) {
      findings.folderNames.violations.push({
        path: `docs/${name}/`,
        expected: `docs/${expected}/`,
        reason: "docs guide folders use Title Case",
      });
    }
  }
}

function countBodySections(content) {
  // Drop frontmatter (between the first pair of `---` lines)
  const fmEnd = content.indexOf("\n---", content.indexOf("---") + 3);
  const body = fmEnd === -1 ? content : content.slice(fmEnd + 4);
  // Count `## ` headings at line start; `## ` only (not `# ` or `### `)
  const matches = body.match(/^## .+$/gm);
  return matches ? matches.length : 0;
}

function stripFrontmatter(content) {
  const fmEnd = content.indexOf("\n---", content.indexOf("---") + 3);
  return fmEnd === -1 ? content : content.slice(fmEnd + 4);
}

function checkFolderNotes() {
  for (const { indexRel, parentIndexRel } of listVisibleFolderNotes()) {
    if (!isFile(indexRel)) {
      findings.folderNotes.missing.push(indexRel);
      continue;
    }
    const content = readFileSync(join(vaultRoot, indexRel), "utf8");
    const sections = countBodySections(content);
    const entry = { path: indexRel, sections };
    if (sections > FOLDER_NOTE_MAX_SECTIONS) {
      findings.folderNotes.violations.push(entry);
    } else {
      findings.folderNotes.present.push(entry);
    }
    if (parentIndexRel && isFile(parentIndexRel)) {
      const parentContent = readFileSync(join(vaultRoot, parentIndexRel), "utf8");
      if (!containsObsidianLinkTo(parentContent, indexRel)) {
        findings.folderNotes.parentLinkViolations.push({ parent: parentIndexRel, child: indexRel });
      }
    }
  }
}

function isIgnoredDirectory(entryName) {
  return entryName.startsWith(".") || IGNORED_DIR_NAMES.has(entryName);
}

function listVisibleFolderNotes() {
  if (!existsSync(vaultRoot)) return [];
  const out = [];
  function walk(abs, relParent) {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (isIgnoredDirectory(entry.name)) continue;
      const child = join(abs, entry.name);
      const relDir = relParent ? `${relParent}/${entry.name}` : entry.name;
      const parentName = relParent?.split("/").pop();
      out.push({
        relDir,
        indexRel: `${relDir}/${entry.name}.md`,
        parentIndexRel: relParent && parentName ? `${relParent}/${parentName}.md` : null,
      });
      walk(child, relDir);
    }
  }
  walk(vaultRoot, "");
  return out;
}

function containsObsidianLinkTo(content, indexRel) {
  const target = indexRel.replace(/\.md$/, "");
  const projectTarget = `Projects/${basename(vaultRoot)}/${target}`;
  const links = [...content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)].map((match) => match[1]);
  return links.some((link) => link === target || link === projectTarget);
}

function listMarkdownFilesUnder(relDir) {
  const root = join(vaultRoot, relDir);
  if (!existsSync(root)) return [];
  const out = [];
  function walk(abs) {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = join(abs, entry.name);
      if (entry.isDirectory()) {
        walk(child);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const rel = relative(vaultRoot, child).split("\\").join("/");
        if (isSkipped(skipSet, rel)) continue;
        out.push(rel);
      }
    }
  }
  walk(root);
  return out;
}

function checkDocsNames() {
  for (const rel of listMarkdownFilesUnder("docs")) {
    const filename = rel.split("/").pop();
    const stem = filename.replace(/\.md$/, "");
    const parent = rel.split("/").slice(-2, -1)[0];
    if (stem === parent || filename === "docs.md") continue;
    if (/^\d+[_ -]/.test(filename)) {
      findings.docsNames.violations.push(rel);
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stem)) {
      findings.docsNameWarnings.warnings.push(rel);
    }
  }
}

function checkHistoryNames() {
  for (const rel of listMarkdownFilesUnder("history")) {
    const filename = rel.split("/").pop();
    if (/^HISTORY-/.test(filename)) {
      findings.historyNames.violations.push(rel);
    }
  }
}

function checkRoadmapShape() {
  const requiredSectionsByFile = new Map([
    ["roadmap/ideas.md", [
      "Contents",
      "Status Key",
      "Idea Register",
      "Brainstorming",
      "Scoping",
      "Approved",
      "Implemented",
      "Declined",
      "Idea Details",
      "Navigation",
    ]],
    ["roadmap/known-issues.md", [
      "Contents",
      "Active",
      "Deferred",
      "Navigation",
    ]],
    ["roadmap/mvp-priorities.md", [
      "Contents",
      "Alpha Goal",
      "MVP Priorities",
      "Not Yet MVP",
      "Navigation",
    ]],
    ["roadmap/done-pending.md", [
      "Contents",
      "General Done/Pending Without Dedicated Planning Note",
      "Navigation",
    ]],
  ]);

  for (const [rel, requiredSections] of requiredSectionsByFile.entries()) {
    if (!isFile(rel)) continue;
    const body = stripFrontmatter(readFileSync(join(vaultRoot, rel), "utf8"));
    for (const section of requiredSections) {
      if (!hasHeading(body, section)) {
        findings.roadmapShape.violations.push({ path: rel, reason: `missing ## ${section}` });
      }
    }
  }
}

function hasHeading(body, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^## ${escaped}$`, "m").test(body);
}

function emit() {
  const lines = [];
  lines.push(`# Vault Structure Report`);
  lines.push("");
  lines.push(`Vault root: \`${vaultRoot}\``);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  const issueCount = issueTotal();
  lines.push(`**Status:** ${issueCount === 0 ? "PASS" : "FAIL"}`);
  lines.push("");
  lines.push(`**Summary:** ${findings.required.present.length} required present, ${findings.required.missing.length} required missing, ${findings.optional.present.length} optional present, ${findings.optional.missing.length} optional missing.`);
  lines.push("");

  if (findings.project.present) {
    lines.push(`**Project file:** \`${findings.project.found}\``);
  }
  lines.push("");

  if (findings.required.missing.length > 0) {
    lines.push("## Missing Required");
    lines.push("");
    for (const m of findings.required.missing) {
      lines.push(`- ${m}`);
    }
    lines.push("");
  }

  if (findings.required.present.length > 0) {
    lines.push("## Present Required");
    lines.push("");
    for (const p of findings.required.present) {
      lines.push(`- ${p}`);
    }
    lines.push("");
  }

  if (findings.optional.missing.length > 0) {
    lines.push("## Missing Optional (recommended)");
    lines.push("");
    for (const m of findings.optional.missing) {
      lines.push(`- ${m}`);
    }
    lines.push("");
  }

  if (findings.optional.present.length > 0) {
    lines.push("## Present Optional");
    lines.push("");
    for (const p of findings.optional.present) {
      lines.push(`- ${p}`);
    }
    lines.push("");
  }

  if (findings.unappliedMigrations.length > 0) {
    lines.push("## Unapplied Migrations");
    lines.push("");
    lines.push("The following registered migrations are needed by this project:");
    lines.push("");
    for (const m of findings.unappliedMigrations) {
      lines.push(`- ${m}`);
      lines.push("");
    }
  }

  if (findings.required.missing.length === 0 && findings.optional.missing.length === 0) {
    lines.push("All required and optional items are in place.");
  }

  if (findings.folderNames.violations.length > 0) {
    lines.push("## Folder Naming Violations");
    lines.push("");
    lines.push("Folder casing is semantic: lowercase PM lanes, Title Case docs guide folders, lowercase content slugs, uppercase only for root artifacts and ADR prefixes.");
    lines.push("");
    for (const v of findings.folderNames.violations) {
      lines.push(`- \`${v.path}\`: expected \`${v.expected}\` — ${v.reason}.`);
    }
    lines.push("");
  }

  // --fix: create missing folder notes from templates/folder-note.md
  if (CLI.fix && findings.folderNotes.missing.length > 0) {
    const tmplPath = SKILL_DIR ? join(SKILL_DIR, "templates", "folder-note.md") : null;
    if (!tmplPath || !existsSync(tmplPath)) {
      process.stderr.write(`--fix requested but template not found at ${tmplPath}\n`);
    } else {
      const tmpl = readFileSync(tmplPath, "utf8");
      let fixedCount = 0;
      for (const indexRel of findings.folderNotes.missing) {
        const abs = join(vaultRoot, indexRel);
        if (existsSync(abs)) continue;
        mkdirSync(dirname(abs), { recursive: true });
        const title = basename(indexRel, ".md");
        // Substitute placeholders so the template is ready to use
        const content = tmpl
          .replace(/<Project>/g, basename(vaultRoot))
          .replace(/<YYYY-MM-DD>/g, new Date().toISOString().slice(0, 10))
          .replace(/title: [^\n]+/, `title: ${title}`);
        writeFileSync(abs, content);
        fixedCount++;
        process.stdout.write(`fixed: created ${indexRel}\n`);
      }
      if (fixedCount > 0) {
        findings.folderNotes.missing = [];
        process.stdout.write(`--fix: created ${fixedCount} folder note(s)\n`);
      }
    }
  }

  // Folder note coverage and shape checks
  if (findings.folderNotes.missing.length > 0) {
    lines.push("## Missing Folder Notes");
    lines.push("");
    lines.push("Every visible PM folder must have a matching folder note named after the folder. Hidden dot-folders are ignored.");
    lines.push("");
    for (const rel of findings.folderNotes.missing) {
      lines.push(`- \`${rel}\`: create this folder-note index from \`templates/folder-note.md\`.`);
    }
    lines.push("");
  }

  if (findings.folderNotes.violations.length > 0) {
    lines.push("## Folder Note Shape Violations");
    lines.push("");
    lines.push(`Folder notes follow \`templates/folder-note.md\`: at most ${FOLDER_NOTE_MAX_SECTIONS} \`##\` sections (Subfolders, Notes, Navigation, + optional 1 extra such as a per-lane \`## Conventions\` block).`);
    lines.push("");
    for (const v of findings.folderNotes.violations) {
      lines.push(`- \`${v.path}\`: ${v.sections} sections — strip non-essential sections.`);
    }
    lines.push("");
  } else if (findings.folderNotes.present.length > 0) {
    lines.push(`**Folder notes:** all ${findings.folderNotes.present.length} present pass the shape check.`);
    lines.push("");
  }

  if (findings.folderNotes.parentLinkViolations.length > 0) {
    lines.push("## Folder Note Parent Link Violations");
    lines.push("");
    lines.push("Nested folder notes must be listed in the parent folder note's `## Subfolders` index.");
    lines.push("");
    for (const v of findings.folderNotes.parentLinkViolations) {
      lines.push(`- \`${v.parent}\`: add a subfolder link to \`${v.child}\`.`);
    }
    lines.push("");
  }

  if (findings.docsNames.violations.length > 0) {
    lines.push("## Docs Filename Violations");
    lines.push("");
    lines.push("Active docs-guide notes use lowercase slug filenames with no numeric prefixes.");
    lines.push("");
    for (const rel of findings.docsNames.violations) {
      lines.push(`- \`${rel}\`: remove the numeric prefix and update wiki links.`);
    }
    lines.push("");
  }

  if (findings.docsNameWarnings.warnings.length > 0) {
    lines.push("## Docs Filename Warnings");
    lines.push("");
    lines.push("Canonical docs-guide content notes should use neutral lowercase kebab-case slugs. Personal/collaborator prefixes such as `haoyou_` are discouraged but do not fail validation.");
    lines.push("");
    for (const rel of findings.docsNameWarnings.warnings) {
      lines.push(`- \`${rel}\`: consider renaming to a neutral lowercase kebab-case slug and updating wiki links.`);
    }
    lines.push("");
  }

  if (findings.historyNames.violations.length > 0) {
    lines.push("## History Filename Violations");
    lines.push("");
    lines.push("History log filenames use lowercase `history-YYYY-MM-DD.md` and `history-YYYY-MM-DD-archived-sections.md`.");
    lines.push("");
    for (const rel of findings.historyNames.violations) {
      lines.push(`- \`${rel}\`: rename \`HISTORY-\` to \`history-\` and update links.`);
    }
    lines.push("");
  }

  if (findings.roadmapShape.violations.length > 0) {
    lines.push("## Roadmap Shape Violations");
    lines.push("");
    lines.push("Standard roadmap notes must follow their templates: ideas, known issues, MVP priorities, and done/pending each have required scan sections.");
    lines.push("");
    for (const v of findings.roadmapShape.violations) {
      lines.push(`- \`${v.path}\`: ${v.reason}`);
    }
    lines.push("");
  }

  console.log(lines.join("\n"));
}

const findingsRef = findings;

function issueTotal() {
  return findingsRef.required.missing.length
    + findingsRef.folderNames.violations.length
    + findingsRef.folderNotes.missing.length
    + findingsRef.folderNotes.violations.length
    + findingsRef.folderNotes.parentLinkViolations.length
    + findingsRef.docsNames.violations.length
    + findingsRef.historyNames.violations.length
    + findingsRef.roadmapShape.violations.length;
}

async function runFor(target) {
  vaultRoot = target.vault;
  skipSet = loadPmSkip(target.vault);
  if (skipSet.size > 0) {
    console.log(`(Honoring .pm/skip: ${[...skipSet].join(", ")})\n`);
  }
  findings.required = { missing: [], present: [] };
  findings.project = { found: null, present: false };
  findings.system = { hasSystemMd: false, hasAnySystemDoc: false };
  findings.optional = { missing: [], present: [] };
  findings.unappliedMigrations = [];
  findings.folderNames = { violations: [] };
  findings.folderNotes = { present: [], missing: [], violations: [], parentLinkViolations: [] };
  findings.docsNames = { violations: [] };
  findings.docsNameWarnings = { warnings: [] };
  findings.historyNames = { violations: [] };
  findings.roadmapShape = { violations: [] };

  checkRequired();
  checkOptional();
  await checkMigrations();
  checkFolderNames();
  checkFolderNotes();
  checkDocsNames();
  checkHistoryNames();
  checkRoadmapShape();
  emit();

  return issueTotal();
}

const targets = resolveTargets();
let totalIssues = 0;
for (const target of targets) {
  console.log(`\n# Vault Structure Report — ${target.label}\n`);
  totalIssues += await runFor(target);
}

process.exit(totalIssues > 0 ? 1 : 0);
