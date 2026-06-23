import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const MIGRATE = join(SKILL_DIR, "scripts", "migrate.mjs");
const ROADMAP_CONVENTIONS = join(SKILL_DIR, "scripts", "check-roadmap-conventions.mjs");
const BOOTSTRAP = join(SKILL_DIR, "scripts", "bootstrap-pm.mjs");
const PM_CONSISTENCY = join(SKILL_DIR, "scripts", "check-pm-consistency.mjs");

function freshDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function writeLegacyMvp(pm) {
  mkdirSync(join(pm, "roadmap"), { recursive: true });
  writeFileSync(join(pm, "Project.md"), "# Project\n");
  writeFileSync(join(pm, "roadmap", "roadmap.md"), `# roadmap

## Subfolders

*(no items)*

## Notes

- [[Project/roadmap/mvp-priorities|mvp-priorities]] - MVP priority tracker
`);
  writeFileSync(join(pm, "CURRENT_STATUS.md"), `# current

## Top Priorities

- [[Project/roadmap/mvp-priorities|mvp-priorities]]
`);
  mkdirSync(join(pm, "roadmap", "plans"), { recursive: true });
  writeFileSync(join(pm, "roadmap", "plans", "legacy-plan.md"), `# legacy plan

Keep the literal legacy path \`roadmap/mvp-priorities.md\` in prose.

Move the live link: [[Project/roadmap/mvp-priorities|mvp-priorities]].
`);
  writeFileSync(join(pm, "roadmap", "mvp-priorities.md"), `---
title: MVP priorities
created: 2026-06-12
updated: 2026-06-12
last_reviewed: 2026-06-12
pageType: roadmap
status: active
owner: PM
---
# mvp-priorities

## Alpha Goal

Prove the project can be used by its owner.

## MVP Priorities

### Bootstrap

- [x] **DONE:** Initial scaffold.

## Not Yet MVP

- **Second user** - Deferred until the owner workflow is stable.
`);
}

test("1.13.0 migration moves legacy mvp-priorities into milestones", () => {
  const dir = freshDir("pm-milestones-");
  try {
    const vault = join(dir, "vault");
    const pm = join(vault, "Project");
    mkdirSync(join(vault, ".obsidian"), { recursive: true });
    mkdirSync(pm, { recursive: true });
    writeLegacyMvp(pm);

    const result = spawnSync(process.execPath, [
      MIGRATE,
      "--pm-folder",
      pm,
      "--migration",
      "1.13.0-roadmap-milestones",
      "--yes",
    ], { encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.equal(existsSync(join(pm, "roadmap", "mvp-priorities.md")), false);
    const migrated = readFileSync(join(pm, "roadmap", "milestones", "mvp.md"), "utf8");
    assert.match(migrated, /## Goal/);
    assert.match(migrated, /Prove the project can be used by its owner/);
    assert.match(migrated, /## Priorities/);
    assert.match(migrated, /Initial scaffold/);
    assert.match(migrated, /## Deferred/);
    assert.match(migrated, /Second user/);
    assert.doesNotMatch(migrated, /## Related Notes/);
    const roadmap = readFileSync(join(pm, "roadmap", "roadmap.md"), "utf8");
    assert.match(roadmap, /roadmap\/milestones\/milestones/);
    assert.doesNotMatch(roadmap, /roadmap\/mvp-priorities/);
    const status = readFileSync(join(pm, "CURRENT_STATUS.md"), "utf8");
    assert.match(status, /roadmap\/milestones\/mvp/);
    const plan = readFileSync(join(pm, "roadmap", "plans", "legacy-plan.md"), "utf8");
    assert.match(plan, /`roadmap\/mvp-priorities\.md`/);
    assert.match(plan, /\[\[Project\/roadmap\/milestones\/mvp\|mvp-priorities\]\]/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check-roadmap-conventions enforces milestone note sections", () => {
  const pm = freshDir("pm-milestone-shape-");
  try {
    mkdirSync(join(pm, "roadmap", "milestones"), { recursive: true });
    writeFileSync(join(pm, "roadmap", "milestones", "alpha.md"), "# alpha\n\n## Goal\n\nShip alpha.\n");

    const failing = spawnSync(process.execPath, [ROADMAP_CONVENTIONS, pm], { encoding: "utf8" });
    assert.equal(failing.status, 1, failing.stderr + failing.stdout);
    assert.match(failing.stdout, /D-015/);
    assert.match(failing.stdout, /missing `## Priorities`/);

    writeFileSync(join(pm, "roadmap", "milestones", "alpha.md"), `# alpha

## Goal

Ship alpha.

## Priorities

*(none)*

## Major Steps

*(none)*

## Exit Criteria

*(none)*

## Deferred

*(none)*

## Update Triggers

Agents must review and update this milestone before history whenever priorities change.

## Navigation

*(none)*
`);
    const passing = spawnSync(process.execPath, [ROADMAP_CONVENTIONS, pm], { encoding: "utf8" });
    assert.equal(passing.status, 0, passing.stderr + passing.stdout);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("check-roadmap-conventions handles deprecated milestone Related Notes", () => {
  const pm = freshDir("pm-milestone-related-");
  try {
    mkdirSync(join(pm, "roadmap", "milestones"), { recursive: true });
    writeFileSync(join(pm, "roadmap", "milestones", "alpha.md"), `# alpha

## Goal

Ship alpha.

## Priorities

*(none)*

## Major Steps

*(none)*

## Exit Criteria

*(none)*

## Related Notes

- Plans: [[roadmap/plans/plans|plans]]
- Done/pending: [[roadmap/done-pending|done-pending]]
- Known issues: [[roadmap/known-issues|known-issues]]
- Decisions: [[decisions/decisions|decisions]]
- Features: [[features/features|features]]

## Deferred

*(none)*

## Update Triggers

Agents must review and update this milestone before history whenever priorities change.

## Navigation

*(none)*
`);
    const failing = spawnSync(process.execPath, [ROADMAP_CONVENTIONS, pm], { encoding: "utf8" });
    assert.equal(failing.status, 1, failing.stderr + failing.stdout);
    assert.match(failing.stdout, /D-016/);
    assert.match(failing.stdout, /deprecated generic `## Related Notes`/);

    const fixed = spawnSync(process.execPath, [ROADMAP_CONVENTIONS, "--fix", pm], { encoding: "utf8" });
    assert.equal(fixed.status, 0, fixed.stderr + fixed.stdout);
    const alpha = readFileSync(join(pm, "roadmap", "milestones", "alpha.md"), "utf8");
    assert.doesNotMatch(alpha, /## Related Notes/);

    writeFileSync(join(pm, "roadmap", "milestones", "beta.md"), `# beta

## Goal

Ship beta.

## Priorities

*(none)*

## Major Steps

*(none)*

## Exit Criteria

*(none)*

## Related Notes

- Launch plan: [[roadmap/plans/2026-06-20_launch-plan|launch plan]]

## Deferred

*(none)*

## Update Triggers

Agents must review and update this milestone before history whenever priorities change.

## Navigation

*(none)*
`);
    const specific = spawnSync(process.execPath, [ROADMAP_CONVENTIONS, "--fix", pm], { encoding: "utf8" });
    assert.equal(specific.status, 1, specific.stderr + specific.stdout);
    assert.match(specific.stdout, /specific links or prose/);
    const beta = readFileSync(join(pm, "roadmap", "milestones", "beta.md"), "utf8");
    assert.match(beta, /## Related Notes/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("bootstrap creates milestone lane instead of mvp-priorities", () => {
  const dir = freshDir("pm-bootstrap-milestones-");
  try {
    const vault = join(dir, "vault");
    const repo = join(dir, "repo");
    const pm = join(vault, "Project");
    const config = join(dir, "projects.json");
    mkdirSync(join(vault, ".obsidian"), { recursive: true });
    mkdirSync(repo, { recursive: true });

    const result = spawnSync(process.execPath, [
      BOOTSTRAP,
      "--project",
      "Project",
      "--pm-folder",
      pm,
      "--code-repo",
      repo,
      "--phase",
      "alpha",
      "--notes",
      "A test project.",
      "--config",
      config,
      "--vault-root",
      vault,
      "--date",
      "2026-06-20",
    ], { encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.equal(existsSync(join(pm, "roadmap", "mvp-priorities.md")), false);
    assert.equal(existsSync(join(pm, "roadmap", "milestones", "milestones.md")), true);
    assert.equal(existsSync(join(pm, "roadmap", "milestones", "alpha.md")), true);
    const alpha = readFileSync(join(pm, "roadmap", "milestones", "alpha.md"), "utf8");
    assert.match(alpha, /## Exit Criteria/);
    assert.match(alpha, /## Update Triggers/);
    assert.doesNotMatch(alpha, /## Related Notes/);
    assert.match(alpha, /Link the specific plan, decision, feature, known issue, or doc inline/);
    const roadmap = readFileSync(join(pm, "roadmap", "roadmap.md"), "utf8");
    assert.match(roadmap, /roadmap\/milestones\/milestones/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check-roadmap-conventions --fix inserts Update Triggers and creates active milestone", () => {
  const pm = freshDir("pm-milestone-fix-");
  try {
    mkdirSync(join(pm, "roadmap", "milestones"), { recursive: true });
    writeFileSync(join(pm, "CURRENT_STATUS.md"), `# current

## Current Phase

launch
`);
    writeFileSync(join(pm, "roadmap", "milestones", "mvp.md"), `# mvp

## Goal

Ship MVP.

## Priorities

*(none)*

## Major Steps

*(none)*

## Exit Criteria

*(none)*

## Deferred

*(none)*

## Navigation

*(none)*
`);

    const fixed = spawnSync(process.execPath, [ROADMAP_CONVENTIONS, "--fix", pm], { encoding: "utf8" });
    assert.equal(fixed.status, 0, fixed.stderr + fixed.stdout);
    const mvp = readFileSync(join(pm, "roadmap", "milestones", "mvp.md"), "utf8");
    assert.match(mvp, /## Update Triggers[\s\S]*## Navigation/);
    assert.doesNotMatch(mvp, /## Related Notes/);
    const launch = readFileSync(join(pm, "roadmap", "milestones", "launch.md"), "utf8");
    assert.match(launch, /## Update Triggers/);
    assert.doesNotMatch(launch, /## Related Notes/);
    const index = readFileSync(join(pm, "roadmap", "milestones", "milestones.md"), "utf8");
    assert.match(index, /roadmap\/milestones\/launch/);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});

test("1.13.1 migration makes milestones agent-maintained without touching history or archive", () => {
  const dir = freshDir("pm-milestones-agent-");
  try {
    const vault = join(dir, "vault");
    const pm = join(vault, "Project");
    mkdirSync(join(vault, ".obsidian"), { recursive: true });
    mkdirSync(join(pm, "roadmap", "milestones"), { recursive: true });
    mkdirSync(join(pm, "history"), { recursive: true });
    mkdirSync(join(pm, "archive"), { recursive: true });
    writeFileSync(join(pm, "CURRENT_STATUS.md"), `# current

## Current Phase

launch
`);
    writeFileSync(join(pm, "roadmap", "milestones", "mvp.md"), `---
title: mvp
created: 2026-06-19
updated: 2026-06-19
last_reviewed: 2026-06-19
pageType: roadmap
status: active
owner: PM
---
# mvp

## Goal

Ship MVP.

## Priorities

*(none)*

## Major Steps

*(none)*

## Exit Criteria

*(none)*

## Deferred

*(none)*

## Navigation

*(none)*
`);
    const historyPath = join(pm, "history", "history.md");
    const archivePath = join(pm, "archive", "archive.md");
    writeFileSync(historyPath, "# history\n");
    writeFileSync(archivePath, "# archive\n");
    const historyBefore = readFileSync(historyPath, "utf8");
    const archiveBefore = readFileSync(archivePath, "utf8");

    const result = spawnSync(process.execPath, [
      MIGRATE,
      "--pm-folder",
      pm,
      "--migration",
      "1.13.1-agent-maintained-milestones",
      "--yes",
    ], { encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr + result.stdout);
    const mvp = readFileSync(join(pm, "roadmap", "milestones", "mvp.md"), "utf8");
    assert.match(mvp, /## Update Triggers[\s\S]*## Navigation/);
    assert.equal(existsSync(join(pm, "roadmap", "milestones", "launch.md")), true);
    const launch = readFileSync(join(pm, "roadmap", "milestones", "launch.md"), "utf8");
    assert.match(launch, /Agent-created active milestone for phase `launch`/);
    const index = readFileSync(join(pm, "roadmap", "milestones", "milestones.md"), "utf8");
    assert.match(index, /roadmap\/milestones\/mvp/);
    assert.match(index, /roadmap\/milestones\/launch/);
    assert.equal(readFileSync(historyPath, "utf8"), historyBefore);
    assert.equal(readFileSync(archivePath, "utf8"), archiveBefore);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("1.13.2 migration removes generic milestone Related Notes and preserves specific links for review", () => {
  const dir = freshDir("pm-milestones-inline-evidence-");
  try {
    const vault = join(dir, "vault");
    const pm = join(vault, "Project");
    mkdirSync(join(vault, ".obsidian"), { recursive: true });
    mkdirSync(join(pm, "roadmap", "milestones"), { recursive: true });
    mkdirSync(join(pm, "history"), { recursive: true });
    mkdirSync(join(pm, "archive"), { recursive: true });
    writeFileSync(join(pm, "roadmap", "milestones", "alpha.md"), `${noteFrontmatter({ title: "alpha", date: "2026-06-19", pageType: "roadmap" })}# alpha

## Goal

Ship alpha.

## Priorities

*(none)*

## Major Steps

*(none)*

## Exit Criteria

*(none)*

## Related Notes

- Plans: [[Project/roadmap/plans/plans|plans]]
- Done/pending: [[Project/roadmap/done-pending|done-pending]]
- Known issues: [[Project/roadmap/known-issues|known-issues]]
- Decisions: [[Project/decisions/decisions|decisions]]
- Features: [[Project/features/features|features]]

## Deferred

*(none)*

## Update Triggers

Agents must review and update this milestone before history whenever priorities change.

## Navigation

*(none)*
`);
    writeFileSync(join(pm, "roadmap", "milestones", "beta.md"), `${noteFrontmatter({ title: "beta", date: "2026-06-19", pageType: "roadmap" })}# beta

## Goal

Ship beta.

## Priorities

*(none)*

## Major Steps

*(none)*

## Exit Criteria

*(none)*

## Related Notes

- Launch plan: [[Project/roadmap/plans/2026-06-20_launch-plan|launch plan]]

## Deferred

*(none)*

## Update Triggers

Agents must review and update this milestone before history whenever priorities change.

## Navigation

*(none)*
`);
    const historyPath = join(pm, "history", "history.md");
    const archivePath = join(pm, "archive", "archive.md");
    writeFileSync(historyPath, "# history\n");
    writeFileSync(archivePath, "# archive\n");
    const historyBefore = readFileSync(historyPath, "utf8");
    const archiveBefore = readFileSync(archivePath, "utf8");

    const result = spawnSync(process.execPath, [
      MIGRATE,
      "--pm-folder",
      pm,
      "--migration",
      "1.13.2-inline-milestone-evidence-links",
      "--yes",
    ], { encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /Manual review required/);
    const alpha = readFileSync(join(pm, "roadmap", "milestones", "alpha.md"), "utf8");
    assert.doesNotMatch(alpha, /## Related Notes/);
    const beta = readFileSync(join(pm, "roadmap", "milestones", "beta.md"), "utf8");
    assert.match(beta, /## Related Notes/);
    assert.match(beta, /Launch plan/);
    assert.equal(readFileSync(historyPath, "utf8"), historyBefore);
    assert.equal(readFileSync(archivePath, "utf8"), archiveBefore);

    const second = spawnSync(process.execPath, [
      MIGRATE,
      "--pm-folder",
      pm,
      "--migration",
      "1.13.2-inline-milestone-evidence-links",
      "--yes",
    ], { encoding: "utf8" });
    assert.equal(second.status, 0, second.stderr + second.stdout);
    assert.match(second.stdout, /No applicable migrations/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function noteFrontmatter({ title, date, pageType, status = "active" }) {
  return `---
title: ${title}
created: ${date}
updated: ${date}
last_reviewed: ${date}
pageType: ${pageType}
status: ${status}
owner: PM
---
`;
}

test("check-pm-consistency flags active milestone stale relative to priority-bearing files", () => {
  const pm = freshDir("pm-milestone-consistency-");
  try {
    mkdirSync(join(pm, "roadmap", "milestones"), { recursive: true });
    mkdirSync(join(pm, "decisions"), { recursive: true });
    writeFileSync(join(pm, "CURRENT_STATUS.md"), `${noteFrontmatter({ title: "current", date: "2026-06-21", pageType: "index" })}# current

## Current Phase

beta

Active milestone: [[roadmap/milestones/beta|beta]]
`);
    writeFileSync(join(pm, "roadmap", "milestones", "beta.md"), `${noteFrontmatter({ title: "beta", date: "2026-06-20", pageType: "roadmap" })}# beta

## Goal

Ship beta.
`);
    writeFileSync(join(pm, "decisions", "D-001_POL_scope.md"), `${noteFrontmatter({ title: "D-001", date: "2026-06-21", pageType: "decision", status: "accepted" })}# D-001
`);

    const failing = spawnSync(process.execPath, [PM_CONSISTENCY, pm], { encoding: "utf8" });
    assert.equal(failing.status, 1, failing.stderr + failing.stdout);
    assert.match(failing.stdout, /roadmap\/milestones\/beta\.md: stale relative to decisions\/D-001_POL_scope\.md/);

    writeFileSync(join(pm, "roadmap", "milestones", "beta.md"), `${noteFrontmatter({ title: "beta", date: "2026-06-21", pageType: "roadmap" })}# beta

## Goal

Ship beta.
`);
    const passing = spawnSync(process.execPath, [PM_CONSISTENCY, pm], { encoding: "utf8" });
    assert.equal(passing.status, 0, passing.stderr + passing.stdout);
  } finally {
    rmSync(pm, { recursive: true, force: true });
  }
});
