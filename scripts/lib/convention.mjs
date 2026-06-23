/**
 * Canonical project-management convention model.
 *
 * Keep hard-coded PM vocabulary here first. Scripts, tests, generated checks,
 * and docs should import this model instead of copying lane/status lists.
 */

export const ACCESS_VALUES = Object.freeze(["authoritative", "read-only"]);

export const DECISION_TYPES = Object.freeze([
  "ADR",
  "PRD",
  "MKT",
  "VND",
  "POL",
  "NEG",
  "EXP",
]);

export const DECISION_STATUSES = Object.freeze([
  "proposed",
  "accepted",
  "active",
  "superseded",
  "deprecated",
]);

export const PLANNING_STATUSES = Object.freeze([
  "proposed",
  "active",
  "shipped",
  "rejected",
  "superseded",
]);

export const FEATURE_STATUSES = Object.freeze([
  "alpha",
  "beta",
  "stable",
  "deprecated",
]);

export const IDEA_STATUSES = Object.freeze([
  "Brainstorming",
  "Scoping",
  "Approved",
  "Implemented",
  "Declined",
]);

export const INBOX_STATUSES = Object.freeze([
  "unprocessed",
  "processed",
  "rejected",
]);

export const INBOX_RESOLUTIONS = Object.freeze([
  "pending",
  "idea",
  "planning",
  "done-pending",
  "decision",
  "feature",
  "system",
  "docs",
  "known-issue",
  "addressed-directly",
  "no-action",
  "multiple",
]);

export const TOP_LEVEL_LANES = Object.freeze([
  "archive",
  "decisions",
  "docs",
  "features",
  "history",
  "inbox",
  "roadmap",
  "system",
]);

export const REQUIRED_DIRS = Object.freeze([
  "roadmap",
  "roadmap/milestones",
  "system",
  "history",
  "inbox",
  "archive",
  "docs",
  "features",
]);

export const OPTIONAL_DIRS = Object.freeze([
  "decisions",
]);

export const DOCS_GUIDES = Object.freeze([
  {
    dir: "Admin Guide",
    index: "docs/Admin Guide/Admin Guide.md",
    purpose: "Live product operations and admin workflows",
  },
  {
    dir: "Developer Guide",
    index: "docs/Developer Guide/Developer Guide.md",
    purpose: "Engineering workflows, implementation notes, and known bugs",
  },
  {
    dir: "Quick Commands",
    index: "docs/Quick Commands/Quick Commands.md",
    purpose: "Copy-pasteable commands",
  },
  {
    dir: "User Guide",
    index: "docs/User Guide/User Guide.md",
    purpose: "End-user behavior and product reference",
  },
]);

export const REQUIRED_ROOT_FILES = Object.freeze([
  "README.md",
  "PRODUCT.md",
  "CURRENT_STATUS.md",
]);

export const REQUIRED_ROADMAP_FILES = Object.freeze([
  "roadmap/known-issues.md",
  "roadmap/done-pending.md",
  "roadmap/ideas.md",
]);

export const REQUIRED_INDEX_FILES = Object.freeze([
  "system/system.md",
  "inbox/inbox.md",
  "archive/archive.md",
  "history/history.md",
  "roadmap/milestones/milestones.md",
  "docs/docs.md",
  ...DOCS_GUIDES.map((guide) => guide.index),
  "docs/Developer Guide/known-bugs.md",
]);

export const ROADMAP_REQUIRED_SECTIONS = Object.freeze({
  "roadmap/ideas.md": Object.freeze([
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
  ]),
  "roadmap/known-issues.md": Object.freeze([
    "Contents",
    "Active",
    "Deferred",
    "Navigation",
  ]),
  "roadmap/done-pending.md": Object.freeze([
    "Contents",
    "General Done/Pending Without Dedicated Planning Note",
    "Navigation",
  ]),
});

export const MILESTONE_REQUIRED_SECTIONS = Object.freeze([
  "Goal",
  "Priorities",
  "Major Steps",
  "Exit Criteria",
  "Deferred",
  "Update Triggers",
  "Navigation",
]);

export const PAGE_TYPE_BY_PREFIX = Object.freeze([
  ["decisions/D-", "decision"],
  ["roadmap/plans/", "planning"],
  ["history/", "history"],
  ["features/", "feature"],
  ["system/", "system"],
  ["docs/", "note"],
  ["inbox/", "note"],
  ["roadmap/", "roadmap"],
]);

export function isValidAccess(value) {
  return ACCESS_VALUES.includes(value);
}

export function docsGuideDirMap() {
  return new Map(DOCS_GUIDES.map((guide) => [guide.dir.toLowerCase(), guide.dir]));
}

export function isCanonicalTopLevelLane(name) {
  return TOP_LEVEL_LANES.includes(name);
}

export function expectedPageTypeForPath(relPath, projectName, existing = null) {
  if (isFolderNotePath(relPath, projectName)) return "index";
  if (["README.md", "PRODUCT.md", "CURRENT_STATUS.md"].includes(relPath)) return "index";
  if (relPath === "roadmap/roadmap.md") return "index";
  if (relPath === "roadmap/milestones/milestones.md") return "index";
  if (relPath === "features/features.md") return "index";
  if (relPath === "system/system.md") return "index";
  for (const [prefix, pageType] of PAGE_TYPE_BY_PREFIX) {
    if (relPath.startsWith(prefix)) return pageType;
  }
  if (relPath.startsWith("archive/")) return existing || "note";
  return existing || "note";
}

export function isFolderNotePath(relPath, projectName) {
  const parts = relPath.split("/");
  const filename = parts.at(-1) ?? "";
  const stem = filename.replace(/\.md$/, "");
  const parent = parts.length === 1 ? projectName : parts.at(-2);
  return stem === parent;
}

export function routeRows() {
  return [
    ["PRODUCT.md", "Product vision, target users, current product shape, principles, boundaries, future goals"],
    ["system/", "Current architecture, behavior, data flow, runtime, auth, database, integrations, deployment"],
    ["docs/User Guide/", "End-user behavior and product reference"],
    ["docs/Admin Guide/", "Live product operations and admin workflows"],
    ["docs/Developer Guide/", "Engineering workflows, implementation notes, and known bugs"],
    ["docs/Quick Commands/", "Copy-pasteable commands"],
    ["features/", "Per-feature context indexes"],
    ["inbox/", "Raw owner/collaborator intake notes for ideas, discussions, and rough requests before owner triage"],
    ["roadmap/", "Milestones, known issues, done/pending, ideas, and scoped plans under `roadmap/plans/`"],
    ["roadmap/milestones/", "Agent-maintained phase-level milestone strategy, priorities, major steps, exit criteria, update triggers, and links to decisions/plans/features"],
    ["roadmap/plans/", "Concrete plans (mirrored into `roadmap/done-pending.md` when in flight)"],
    ["decisions/", "Typed decision log (architecture, product, market, vendor, policy, rejection, experiment)"],
    ["history/", "Completed work logs"],
    ["archive/", "Superseded material"],
  ];
}
