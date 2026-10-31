#!/usr/bin/env node
/**
 * check-pm-closeout.mjs
 *
 * Session/worktree guard for coding agents. This is intentionally not part
 * of the PM-folder structural validator registry: it answers "did this local
 * code-work session close out PM updates?" rather than "is the PM folder valid?"
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import { isAutoScopedCommitPolicy, isValidAccess } from "./lib/convention.mjs";
import { resolveProjectsConfigPath } from "./lib/paths.mjs";
import { activeMilestoneInfo } from "./lib/milestones.mjs";
import { historyDayRel } from "./lib/history-paths.mjs";
import { checkLiveNoteShape } from "./lib/live-state-shape.mjs";

const USAGE = `Usage: node scripts/check-pm-closeout.mjs [options]

Options:
  --config <path>              path to projects.json (default: ~/.config/project-management/projects.json)
  --project <name>             force a registered project instead of matching the current repo
  --repo <path>                repo to inspect (default: current git repo)
  --since <ISO datetime>       require PM files modified since this timestamp
  --implementation-commit <SHA> prove and require the implementation commit in PM records
  --priority-change            declare phase/top-priority/current-blocker changes; require CURRENT_STATUS.md
  --milestone-change           declare milestone scope/priority/step/exit-criteria changes; require milestone update
  --allow-no-impact <reason>   pass explicitly when changed files do not affect PM docs
  --help, -h                   show this help
`;

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = {
    config: null,
    project: null,
    repo: null,
    since: null,
    implementationCommit: null,
    priorityChange: false,
    milestoneChange: false,
    allowNoImpact: null,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--config" || a === "-c") out.config = args[++i];
    else if (a === "--project" || a === "-p") out.project = args[++i];
    else if (a === "--repo") out.repo = args[++i];
    else if (a === "--since") out.since = args[++i];
    else if (a === "--implementation-commit") out.implementationCommit = args[++i];
    else if (a === "--priority-change") out.priorityChange = true;
    else if (a === "--milestone-change") out.milestoneChange = true;
    else if (a === "--allow-no-impact") out.allowNoImpact = args[++i];
    else if (a === "--help" || a === "-h") {
      process.stdout.write(USAGE + "\n");
      process.exit(0);
    } else {
      process.stderr.write(`Unknown arg: ${a}\n${USAGE}\n`);
      process.exit(2);
    }
  }
  if (out.allowNoImpact !== null && out.allowNoImpact.trim() === "") {
    process.stderr.write("--allow-no-impact requires a non-empty reason.\n");
    process.exit(2);
  }
  if (out.implementationCommit !== null && out.implementationCommit.trim() === "") {
    process.stderr.write("--implementation-commit requires a non-empty SHA.\n");
    process.exit(2);
  }
  return out;
}

const CLI = parseArgs(process.argv);

function runGit(repo, args) {
  return spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
}

function resolveCommit(repo, ref) {
  if (!ref) return null;
  const rev = runGit(repo, ["rev-parse", "--verify", ref + "^{commit}"]);
  if (rev.status !== 0) return { error: (rev.stderr || rev.stdout || "unknown commit").trim() };
  const sha = rev.stdout.trim();
  const subject = runGit(repo, ["show", "-s", "--format=%s", sha]);
  return { sha, subject: subject.status === 0 ? subject.stdout.trim() : "" };
}

function canonicalPath(value) {
  if (!value) return null;
  const abs = resolve(value);
  try {
    return realpathSync(abs);
  } catch {
    return abs;
  }
}

function normalizeForCompare(value) {
  const normalized = canonicalPath(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function samePath(a, b) {
  return normalizeForCompare(a) === normalizeForCompare(b);
}

function resolveRepoRoot() {
  const startingPoint = CLI.repo ? resolve(CLI.repo) : process.cwd();
  const result = spawnSync("git", ["-C", startingPoint, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return {
      repo: canonicalPath(startingPoint),
      gitError: (result.stderr || result.stdout || "not a git worktree").trim(),
    };
  }
  return { repo: canonicalPath(result.stdout.trim()), gitError: null };
}

function loadConfig() {
  const configPath = resolveProjectsConfigPath(CLI.config ? resolve(CLI.config) : null);
  if (!configPath) return { configPath: null, config: null };
  return { configPath, config: JSON.parse(readFileSync(configPath, "utf8")) };
}

function resolveProject(config, configPath, repoRoot) {
  const projects = Object.entries(config?.projects ?? {});
  if (CLI.project) {
    const entry = config?.projects?.[CLI.project];
    if (!entry) {
      process.stderr.write(`ERROR: project '${CLI.project}' not found in ${configPath}\n`);
      process.exit(2);
    }
    return { name: CLI.project, entry, matchedBy: "project flag" };
  }
  for (const [name, entry] of projects) {
    if (entry.code_repo && samePath(entry.code_repo, repoRoot)) {
      return { name, entry, matchedBy: "code_repo" };
    }
  }
  return null;
}

function parseGitStatus(output) {
  const changes = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const status = line.slice(0, 2);
    let path = line.slice(3).trim();
    if (path.includes(" -> ")) path = path.split(" -> ").at(-1);
    path = path.replace(/^"|"$/g, "");
    changes.push({ status, path });
  }
  return changes;
}

function isUnderPath(child, parent) {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function meaningfulChanges(repoRoot, pmFolder) {
  const result = runGit(repoRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (result.status !== 0) {
    return { error: (result.stderr || result.stdout || "git status failed").trim(), changes: [] };
  }
  const allChanges = parseGitStatus(result.stdout);
  const pmRoot = pmFolder && existsSync(pmFolder) ? canonicalPath(pmFolder) : null;
  const changes = allChanges.filter((change) => {
    if (!pmRoot) return true;
    const abs = canonicalPath(join(repoRoot, change.path));
    return !isUnderPath(abs, pmRoot);
  });
  return { error: null, changes };
}

function todayParts() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return { yyyy, mm, dd, date: `${yyyy}-${mm}-${dd}` };
}

function defaultBaseline() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseBaseline() {
  if (!CLI.since) return defaultBaseline();
  const parsed = new Date(CLI.since);
  if (Number.isNaN(parsed.getTime())) {
    process.stderr.write(`Invalid --since timestamp: ${CLI.since}\n`);
    process.exit(2);
  }
  return parsed;
}

function walkMarkdown(root, rel = "", out = []) {
  const abs = join(root, rel);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === ".pm") continue;
    const childRel = rel ? join(rel, entry.name) : entry.name;
    if (entry.isDirectory()) walkMarkdown(root, childRel, out);
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(childRel.replaceAll("\\", "/"));
  }
  return out;
}

function isCurrentStatePmRel(relPath) {
  return (
    !relPath.startsWith("history/") &&
    !relPath.startsWith("archive/") &&
    !relPath.startsWith(".pm/")
  );
}

function isPriorityBearingPmRel(relPath) {
  return (
    relPath === "roadmap/done-pending.md" ||
    relPath === "roadmap/known-issues.md" ||
    relPath.startsWith("roadmap/plans/") ||
    relPath.startsWith("roadmap/milestones/") ||
    relPath.startsWith("decisions/") ||
    relPath.startsWith("features/")
  );
}

function recentlyModified(abs, baseline) {
  if (!existsSync(abs)) return false;
  return statSync(abs).mtimeMs >= baseline.getTime();
}

function milestoneRelFromWikiTarget(rawTarget) {
  const target = String(rawTarget ?? "")
    .split("|")[0]
    .split("#")[0]
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.md$/i, "");
  const match = target.match(/(?:^|\/)roadmap\/milestones\/([^/]+)$/);
  if (!match || match[1] === "milestones") return null;
  return `roadmap/milestones/${match[1]}.md`;
}

function linkedMilestoneRels(pmFolder, relPaths) {
  const out = new Set();
  for (const relPath of relPaths) {
    if (relPath.startsWith("roadmap/milestones/")) continue;
    const abs = join(pmFolder, relPath);
    if (!existsSync(abs)) continue;
    const content = readFileSync(abs, "utf8");
    for (const match of content.matchAll(/!?\[\[([^\]\n]+)\]\]/g)) {
      const rel = milestoneRelFromWikiTarget(match[1]);
      if (rel) out.add(rel);
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

// A current-state note modified this session must be linked from its folder
// index's `## Notes` list. Folder index notes themselves and root-level notes
// are exempt. Returns [{ note, index }] violations.
function folderIndexViolations(pmFolder, relPaths) {
  const violations = [];
  for (const relPath of relPaths) {
    const parts = relPath.split("/");
    if (parts.length < 2) continue;
    const dir = parts.slice(0, -1).join("/");
    const stem = parts.at(-1).replace(/\.md$/, "");
    if (stem === parts.at(-2)) continue;
    const indexRel = `${dir}/${parts.at(-2)}.md`;
    const indexAbs = join(pmFolder, indexRel);
    if (!existsSync(indexAbs)) continue;
    const content = readFileSync(indexAbs, "utf8");
    const relNoExt = relPath.replace(/\.md$/, "");
    const linked = [...content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)]
      .some((m) => {
        const target = m[1].replace(/\.md$/, "");
        return target === relNoExt || target.endsWith(`/${relNoExt}`) || target === stem || target.endsWith(`/${stem}`);
      });
    if (!linked) violations.push({ note: relPath, index: indexRel });
  }
  return violations;
}

function recentPmText(pmFolder, baseline) {
  return walkMarkdown(pmFolder)
    .filter((relPath) => recentlyModified(join(pmFolder, relPath), baseline))
    .map((relPath) => readFileSync(join(pmFolder, relPath), "utf8"))
    .join("\n");
}

function findPmEvidence(pmFolder, baseline, { projectName = null, configPath = null } = {}) {
  const modifiedCurrentState = walkMarkdown(pmFolder)
    .filter(isCurrentStatePmRel)
    .filter((relPath) => recentlyModified(join(pmFolder, relPath), baseline));
  const priorityBearing = modifiedCurrentState.filter(isPriorityBearingPmRel);
  const currentStatusUpdated = recentlyModified(join(pmFolder, "CURRENT_STATUS.md"), baseline);
  const activeMilestone = activeMilestoneInfo({ pmFolder, project: projectName, configPath });
  const activeMilestoneUpdated = activeMilestone
    ? recentlyModified(activeMilestone.abs, baseline)
    : false;
  const linkedMilestones = linkedMilestoneRels(pmFolder, priorityBearing);
  const linkedMilestonesUpdated = linkedMilestones.filter((relPath) =>
    recentlyModified(join(pmFolder, relPath), baseline)
  );
  const { date } = todayParts();
  const historyRel = `${historyDayRel(date)}.md`;
  const historyUpdated = recentlyModified(join(pmFolder, historyRel), baseline);
  return {
    currentState: modifiedCurrentState,
    priorityBearing,
    currentStatusUpdated,
    activeMilestone,
    activeMilestoneUpdated,
    linkedMilestones,
    linkedMilestonesUpdated,
    historyRel,
    historyUpdated,
  };
}

function suggestPmLanes(changes) {
  const suggestions = new Set();
  for (const { path } of changes) {
  if (
      path === "AGENTS.md" ||
      path === "templates/AGENTS_PM_SECTION.md" ||
      path === "templates/PR_BODY_TEMPLATE.md" ||
      path === "scripts/check-agents.mjs" ||
      path === "scripts/sync-agents-section.mjs"
    ) {
      suggestions.add("features/code-repo-integration.md");
      suggestions.add("system/overview.md");
    }
    if (
      path.startsWith("scripts/check-") ||
      path.startsWith("scripts/validators/") ||
      path.includes("fixers.mjs")
    ) {
      suggestions.add("features/validation-and-repair.md");
      suggestions.add("docs/Developer Guide/adding-a-validator.md");
      suggestions.add("system/overview.md");
    }
    if (path.startsWith("scripts/") || path.startsWith("test/")) {
      suggestions.add("docs/Developer Guide/");
    }
    if (
      path === "README.md" ||
      path === "SKILL.md" ||
      path === "REFERENCE.md" ||
      path.startsWith("templates/")
    ) {
      suggestions.add("docs/User Guide/trigger-phrases.md");
      suggestions.add("README.md");
      suggestions.add("CURRENT_STATUS.md");
    }
    if (path.startsWith("templates/")) {
      suggestions.add("features/pm-folder-bootstrap.md");
    }
    if (path === "CONTEXT.md" || path === "CONTEXT-MAP.md" || path.startsWith("docs/adr/")) {
      suggestions.add("decisions/ (ADR stub with repo_path on public projects)");
    }
    if (path.startsWith("docs/agents/")) {
      suggestions.add("system/ or README routing map (tracker/domain config changed)");
    }
    if (path.startsWith(".scratch/")) {
      suggestions.add("roadmap/plans/ + roadmap/done-pending.md (spec/tickets published to local tracker)");
    }
    if (path.startsWith(".out-of-scope/")) {
      suggestions.add("decisions/ (NEG) or the active plan's NOT-in-scope section");
    }
  }
  suggestions.add("history/YYYY/<Month>/history-YYYY-MM-DD.md");
  return [...suggestions];
}

function printHeader(lines, repoRoot, configPath, project) {
  lines.push("# PM close-out guard");
  lines.push("");
  lines.push(`Repo: ${repoRoot}`);
  lines.push(`Config: ${configPath ?? "(none found)"}`);
  lines.push(`Project: ${project ? `${project.name} (${project.matchedBy})` : "(no matching project)"}`);
  lines.push("");
}

const lines = [];
const { repo: repoRoot, gitError } = resolveRepoRoot();
const { configPath, config } = loadConfig();
const project = config ? resolveProject(config, configPath, repoRoot) : null;
printHeader(lines, repoRoot, configPath, project);

if (!project) {
  lines.push("**Status:** PASS");
  lines.push("");
  lines.push("No PM access resolved for this repo. The committed PM section is inactive locally.");
  console.log(lines.join("\n"));
  process.exit(0);
}

if (!isValidAccess(project.entry.access)) {
  lines.push("**Status:** PASS");
  lines.push("");
  lines.push(`No PM access resolved because access is '${project.entry.access ?? ""}'.`);
  console.log(lines.join("\n"));
  process.exit(0);
}

if (project.entry.access === "read-only") {
  lines.push("**Status:** PASS");
  lines.push("");
  lines.push("Read-only PM access: do not edit the PM folder. Fill the PR body's `PM folder impact` section with specific suggested updates.");
  console.log(lines.join("\n"));
  process.exit(0);
}

if (!project.entry.pm_folder || !existsSync(project.entry.pm_folder)) {
  lines.push("**Status:** PASS");
  lines.push("");
  lines.push("No PM access resolved because the registered pm_folder is missing or inaccessible.");
  console.log(lines.join("\n"));
  process.exit(0);
}

if (gitError) {
  lines.push("**Status:** FAIL");
  lines.push("");
  lines.push(`Cannot inspect git worktree: ${gitError}`);
  console.log(lines.join("\n"));
  process.exit(2);
}

const pmFolder = canonicalPath(project.entry.pm_folder);
const baseline = parseBaseline();
const autoScoped = isAutoScopedCommitPolicy(project.entry.commit_policy);
const commitInfo = resolveCommit(repoRoot, CLI.implementationCommit);
if (commitInfo?.error) {
  lines.push("**Status:** FAIL", "", "Cannot verify implementation commit: " + commitInfo.error);
  console.log(lines.join("\n"));
  process.exit(2);
}
const { error: statusError, changes } = meaningfulChanges(repoRoot, pmFolder);
if (statusError) {
  lines.push("**Status:** FAIL");
  lines.push("");
  lines.push(`Cannot inspect git worktree: ${statusError}`);
  console.log(lines.join("\n"));
  process.exit(2);
}

if (changes.length === 0 && !commitInfo && !CLI.allowNoImpact) {
  lines.push("**Status:** PASS");
  lines.push("");
  lines.push("No meaningful worktree changes found. PM close-out is not required.");
  console.log(lines.join("\n"));
  process.exit(0);
}

if (changes.length > 0) {
  lines.push("Changed repo files:");
  for (const change of changes) lines.push(`- ${change.status} ${change.path}`);
  lines.push("");
}
if (commitInfo) {
  lines.push("Implementation commit: " + commitInfo.sha + (commitInfo.subject ? " " + commitInfo.subject : ""));
  lines.push("");
}

if (CLI.allowNoImpact) {
  if (autoScoped && /no commit(?: was)? requested/i.test(CLI.allowNoImpact)) {
    lines.push("**Status:** FAIL", "", "auto-scoped does not accept no commit was requested as a no-impact reason.");
    console.log(lines.join("\n"));
    process.exit(1);
  }
  lines.push("**Status:** PASS");
  lines.push("");
  lines.push(`No PM impact asserted: ${CLI.allowNoImpact}`);
  lines.push("The agent must mention this reason in the final response.");
  console.log(lines.join("\n"));
  process.exit(0);
}

const evidence = findPmEvidence(pmFolder, baseline, { projectName: project.name, configPath });
const pmText = recentPmText(pmFolder, baseline);
const noRequestPending = autoScoped && /(?:uncommitted\s*\/\s*commit pending|uncommitted)[\s\S]{0,240}no commit(?: was)? requested/i.test(pmText);
const hasCommitReference = !commitInfo || pmText.includes(commitInfo.sha);
const hasCurrentState = evidence.currentState.length > 0;
const hasHistory = evidence.historyUpdated;
const needsCurrentStatus = CLI.priorityChange;
const needsMilestone = CLI.milestoneChange;
const shapeIssues = [];
if (CLI.priorityChange && existsSync(join(pmFolder, "CURRENT_STATUS.md"))) {
  const result = checkLiveNoteShape(readFileSync(join(pmFolder, "CURRENT_STATUS.md"), "utf8"), { kind: "status" });
  for (const item of result.issues) shapeIssues.push(`CURRENT_STATUS.md: ${item.message}`);
}
if (CLI.milestoneChange) {
  const rels = [...new Set([
    ...(evidence.activeMilestoneUpdated && evidence.activeMilestone ? [evidence.activeMilestone.rel] : []),
    ...evidence.linkedMilestonesUpdated,
  ])];
  for (const rel of rels) {
    const abs = join(pmFolder, rel);
    if (!existsSync(abs)) continue;
    const result = checkLiveNoteShape(readFileSync(abs, "utf8"), { kind: "milestone" });
    for (const item of result.issues) shapeIssues.push(`${rel}: ${item.message}`);
  }
}
const hasCurrentStatus = evidence.currentStatusUpdated && shapeIssues.every((issue) => !issue.startsWith("CURRENT_STATUS.md:"));
const hasMilestone = (evidence.activeMilestoneUpdated || evidence.linkedMilestonesUpdated.length > 0)
  && shapeIssues.every((issue) => !issue.startsWith("roadmap/milestones/"));
const indexViolations = folderIndexViolations(pmFolder, evidence.currentState);
if (autoScoped && changes.length > 0 && !commitInfo) {
  lines.push("**Status:** FAIL", "", "auto-scoped requires a verified implementation commit before PM close-out. Commit narrowly, then rerun with --implementation-commit <SHA>.");
  console.log(lines.join("\n"));
  process.exit(1);
}

lines.push(`Baseline: ${baseline.toISOString()}`);
lines.push("");
lines.push("Suggested PM lanes:");
for (const suggestion of suggestPmLanes(changes)) lines.push(`- ${suggestion}`);
lines.push("");

if (hasCurrentState) {
  lines.push("Current-state PM files updated:");
  for (const relPath of evidence.currentState.slice(0, 20)) lines.push(`- ${relPath}`);
  if (evidence.currentState.length > 20) lines.push(`- ... ${evidence.currentState.length - 20} more`);
} else {
  lines.push("Current-state PM files updated: none found since baseline.");
}
lines.push(`Current-day history log: ${hasHistory ? evidence.historyRel : `${evidence.historyRel} not updated since baseline`}`);
if (needsCurrentStatus || needsMilestone) {
  lines.push("Priority-bearing PM files updated:");
  for (const relPath of evidence.priorityBearing.slice(0, 20)) lines.push(`- ${relPath}`);
  if (evidence.priorityBearing.length > 20) lines.push(`- ... ${evidence.priorityBearing.length - 20} more`);
}
if (needsCurrentStatus) {
  lines.push(`CURRENT_STATUS.md freshness: ${hasCurrentStatus ? "updated since baseline" : "not updated since baseline"}`);
}
if (needsMilestone) {
  lines.push(
    `Active milestone freshness: ${
      evidence.activeMilestone
        ? `${evidence.activeMilestone.rel} ${evidence.activeMilestoneUpdated ? "updated since baseline" : "not updated since baseline"}`
        : "no active milestone resolved"
    }`
  );
  if (evidence.linkedMilestones.length > 0) {
    lines.push("Explicitly linked milestones:");
    for (const relPath of evidence.linkedMilestones) {
      lines.push(
        `- ${relPath}${evidence.linkedMilestonesUpdated.includes(relPath) ? " (updated since baseline)" : ""}`
      );
    }
  }
}
if (evidence.priorityBearing.length > 0 && !CLI.priorityChange && !CLI.milestoneChange) {
  lines.push("Semantic review: routine plan/feature/decision/issue edits do not require status or milestone touches. Use --priority-change or --milestone-change only for the corresponding top-level event.");
}
if (shapeIssues.length > 0) {
  lines.push("Declared live-state shape violations:");
  for (const issue of shapeIssues) lines.push(`- ${issue}`);
}
lines.push("");

if (indexViolations.length > 0) {
  lines.push("Folder index violations (modified notes missing from their folder index `## Notes`):");
  for (const v of indexViolations) lines.push(`- ${v.note} is not linked from ${v.index}`);
  lines.push("");
}

if (indexViolations.length === 0 && shapeIssues.length === 0 && hasCurrentState && hasHistory && hasCommitReference && !noRequestPending && (!needsCurrentStatus || hasCurrentStatus) && (!needsMilestone || hasMilestone)) {
  lines.push("**Status:** PASS");
  lines.push("");
  lines.push("PM close-out evidence found: current-state docs and current-day history were updated.");
  if (needsCurrentStatus) lines.push("Declared priority change also refreshed CURRENT_STATUS.md without live-state shape violations.");
  if (needsMilestone) lines.push("Declared milestone change also refreshed the active or explicitly linked milestone without live-state shape violations.");
  console.log(lines.join("\n"));
  process.exit(0);
}

lines.push("**Status:** FAIL");
lines.push("");
if (noRequestPending) {
  lines.push("PM close-out required. auto-scoped does not accept no commit was requested; commit or record a concrete blocker.");
} else if (!hasCommitReference) {
  lines.push("PM close-out required. The supplied implementation SHA is not referenced by current PM records.");
} else if (shapeIssues.length > 0) {
  lines.push("PM close-out required. Repair declared live-state shape violations; do not close out with implementation journals or duplicated commit ledgers.");
} else if (indexViolations.length > 0) {
  lines.push("PM close-out required. Notes changed this session are missing from their folder index `## Notes` list — update the index in the same session (see list above).");
} else if (needsCurrentStatus && !hasCurrentStatus) {
  lines.push("PM close-out required. --priority-change was declared, so update `CURRENT_STATUS.md` before history.");
} else if (needsMilestone && !hasMilestone) {
  lines.push("PM close-out required. --milestone-change was declared, so refresh the active or explicitly linked `roadmap/milestones/*.md` note before history.");
} else {
  lines.push("PM close-out required. Update affected current-state PM docs before history, or rerun with `--allow-no-impact \"<reason>\"` if this work truly has no PM impact.");
}
console.log(lines.join("\n"));
process.exit(1);
