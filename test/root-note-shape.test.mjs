import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const BOOTSTRAP = join(SKILL_DIR, "scripts", "bootstrap-pm.mjs");

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function runBootstrap({
  vault,
  pmFolder,
  config,
  notes = "A project for root note shape tests.",
  icon,
  iconColor,
}) {
  const args = [
    BOOTSTRAP,
    "--project", "Shape Project",
    "--pm-folder", pmFolder,
    "--code-repo", "null",
    "--phase", "alpha",
    "--notes", notes,
    "--config", config,
    "--vault-root", vault,
    "--date", "2026-07-25",
  ];
  if (icon) args.push("--icon", icon);
  if (iconColor) args.push("--icon-color", iconColor);
  return spawnSync(process.execPath, args, { encoding: "utf8" });
}

function bootstrapRootNote({ parentIndex = false, home = false } = {}) {
  const vault = tempDir("pm-root-shape-");
  // Mirror real-vault layout: PM folder lives under Projects/ so that
  // adaptive nav can detect the parent index note.
  const projectsParent = join(vault, "Projects");
  const pmFolder = join(projectsParent, "Shape Project");
  const config = join(vault, "projects.json");
  // Ensure parent dir exists before bootstrap (mkdirSync recursive
  // happens during bootstrap, but our helper writes parent index first).
  mkdirSync(projectsParent, { recursive: true });
  if (parentIndex) {
    writeFileSync(join(projectsParent, "Projects.md"), "# Projects\n");
  }
  if (home) {
    writeFileSync(join(vault, "Home.md"), "# Home\n");
  }
  const result = runBootstrap({ vault, pmFolder, config });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return { vault, pmFolder, root: readFileSync(join(pmFolder, "Shape Project.md"), "utf8") };
}

test("bootstrap root note uses canonical frontmatter order and tags", () => {
  const { vault, pmFolder, root } = bootstrapRootNote();
  try {
    // Canonical field order: title, tags, pageType, created, owner, [icon, iconColor], updated, last_reviewed, status
    assert.match(
      root,
      /^---\ntitle: "Shape Project"\ntags:\n  - project\n  - folder-note\n  - shape-project\npageType: index\ncreated: 2026-07-25\nowner: PM\n/,
    );
    assert.match(root, /updated: 2026-07-25\nlast_reviewed: 2026-07-25\nstatus: active\n---/);
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
});

test("bootstrap root note has blockquote description and vault-maintain index", () => {
  const { vault, pmFolder, root } = bootstrapRootNote();
  try {
    assert.match(root, /# Shape Project\n\n> A project for root note shape tests\.\n\n/);
    assert.match(root, /<!-- vault-maintain:index:start -->\n## Subfolders/);
    assert.match(root, /## Notes\n\n- \[\[Projects\/Shape Project\/CURRENT_STATUS\|CURRENT_STATUS\]\]/);
    assert.match(root, /<!-- vault-maintain:index:end -->/);
    // Standard scaffold lanes
    for (const lane of ["archive", "decisions", "docs", "features", "history", "inbox", "roadmap", "system"]) {
      assert.match(root, new RegExp(`## Subfolders[\\s\\S]*- \\[\\[Projects\\/Shape Project\\/${lane}\\/${lane}\\|${lane}\\]\\]`));
    }
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
});

test("bootstrap root note omits Start Here and includes canonical README/CURRENT_STATUS/PRODUCT notes", () => {
  const { vault, pmFolder, root } = bootstrapRootNote();
  try {
    assert.doesNotMatch(root, /## Start Here/);
    assert.match(root, /- \[\[Projects\/Shape Project\/README\|README\]\]/);
    assert.match(root, /- \[\[Projects\/Shape Project\/PRODUCT\|PRODUCT\]\]/);
    assert.match(root, /- \[\[Projects\/Shape Project\/CURRENT_STATUS\|CURRENT_STATUS\]\]/);
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
});

test("bootstrap root note adaptive nav adds parent index and Home when present", () => {
  const { vault, pmFolder, root } = bootstrapRootNote({ parentIndex: true, home: true });
  try {
    assert.match(root, /- \[\[Projects\/Projects\|Back to Projects\]\]/);
    assert.match(root, /- \[\[Home\|Back to Home\]\]/);
    assert.match(root, /- \[\[Projects\/Shape Project\/README\|README\]\]/);
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
});

test("bootstrap root note adaptive nav omits parent index and Home when missing", () => {
  const { vault, pmFolder, root } = bootstrapRootNote();
  try {
    assert.doesNotMatch(root, /Back to Projects/);
    assert.doesNotMatch(root, /Back to Home/);
    assert.match(root, /## Navigation\n\n- \[\[Projects\/Shape Project\/README\|README\]\]\n$/);
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
});

test("bootstrap root note omits Features section at bootstrap and omits icon when unset", () => {
  const { vault, pmFolder, root } = bootstrapRootNote();
  try {
    assert.doesNotMatch(root, /## Features/);
    assert.doesNotMatch(root, /\nicon: /);
    assert.doesNotMatch(root, /\niconColor: /);
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
});

test("bootstrap root note accepts --icon and --icon-color flags", () => {
  const vault = tempDir("pm-root-shape-icon-");
  try {
    const projectsParent = join(vault, "Projects");
    const pmFolder = join(projectsParent, "Shape Project");
    const config = join(vault, "projects.json");
    const result = runBootstrap({
      vault,
      pmFolder,
      config,
      icon: "LiMusic",
      iconColor: "#14b8a6",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const root = readFileSync(join(pmFolder, "Shape Project.md"), "utf8");
    // Icons sit between owner and updated (canonical slot)
    assert.match(root, /\nicon: "LiMusic"\niconColor: "#14b8a6"\n/);
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
});

test("canonical root-note template mirrors what bootstrap emits", () => {
  const { vault, pmFolder, root } = bootstrapRootNote({ parentIndex: true, home: true });
  try {
    // Sanity: count H2 sections. Canonical: Subfolders, Notes, Navigation = 3 (Features omitted at bootstrap).
    const h2s = (root.match(/^## /gm) ?? []).length;
    assert.equal(h2s, 3);
    // The exported template should exist and parse as a markdown doc with frontmatter.
    const template = readFileSync(join(SKILL_DIR, "templates", "root-note.md"), "utf8");
    assert.match(template, /^---\ntitle: <Project>\ntags:\n  - project\n  - folder-note\n  - <project-slug>\npageType: index\n/);
    assert.match(template, /## Subfolders/);
    assert.match(template, /## Notes/);
    assert.match(template, /## Navigation/);
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
});

test("check-vault-structure limits Features section under root note", () => {
  const vault = tempDir("pm-root-features-bloat-");
  try {
    const projectsParent = join(vault, "Projects");
    const pmFolder = join(projectsParent, "Shape Project");
    const config = join(vault, "projects.json");
    const result = runBootstrap({ vault, pmFolder, config });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    // Inject an oversized Features section by appending to the root note.
    const rootPath = join(pmFolder, "Shape Project.md");
    const root = readFileSync(rootPath, "utf8");
    const lines = Array.from({ length: 80 }, (_, i) => `  - l${i} — long feature line ${i}`).join("\n");
    writeFileSync(rootPath, `${root}\n## Features\n\n${lines}\n`);
    const check = spawnSync(
      process.execPath,
      [join(SKILL_DIR, "scripts", "check-vault-structure.mjs"), vault],
      { encoding: "utf8" },
    );
    // Validator may FAIL or exit 0 depending on count semantics — we want a finding that mentions Features body bloat.
    const output = `${check.stdout ?? ""}${check.stderr ?? ""}`;
    assert.match(
      output,
      /## Features in a folder note exceeded \d+ meaningful lines/,
      `expected Features body-bloat finding; got: ${output}`,
    );
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
});