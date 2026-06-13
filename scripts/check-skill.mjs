#!/usr/bin/env node
/**
 * Skill-level quality gate.
 *
 * This checks the reusable skill repository itself, not a user's PM folder.
 * It catches stale public-doc phrases, unresolved placeholders in shipped
 * docs, and convention drift between scripts and the canonical model.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ACCESS_VALUES,
  REQUIRED_DIRS,
  REQUIRED_ROADMAP_FILES,
  REQUIRED_INDEX_FILES,
  DOCS_GUIDES,
  routeRows,
} from "./lib/convention.mjs";
import { finding, renderFindings } from "./lib/findings.mjs";
import { unresolvedPlaceholders } from "./lib/template-renderer.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);

const PUBLIC_DOCS = [
  "README.md",
  "SKILL.md",
  "REFERENCE.md",
  "openclaw-instruction.md",
  "templates/AGENTS_PM_SECTION.md",
  "templates/README.md",
  "templates/CURRENT_STATUS.md",
  "templates/done-pending.md",
  "templates/feature.md",
  "templates/planning.md",
];

const ALLOWED_PLACEHOLDERS = new Set([
  "<Project>",
  "<ProjectName>",
  "<Project Name>",
  "<Project README>",
  "<YYYY-MM-DD>",
  "<date>",
  "<topic-slug>",
  "<feature>",
  "<feature-slug>",
  "<planning-slug>",
  "<slug>",
  "<name>",
  "<path>",
  "<pm_folder>",
  "<skill_dir>",
  "<ACCESS>",
  "<user-facing impact>",
  "<admin/operator impact>",
  "<developer impact>",
  "<one-line description of the bug/risk/blocker>",
  "<one-line description of the deferred validator item>",
  "<one-line description of the deferred CLI item>",
  "<one-line description of what shipped>",
  "<one-line description of what's still open>",
  "<another pending item>",
  "<who is responsible; what's the next concrete action>",
  "<what makes this idea distinct from similar ones>",
  "<the case for the idea>",
  "<what's still unresolved>",
  "<links to related decisions/features/known-issues, or `None yet`>",
  "<decision-title>",
  "<Decision Title>",
  "<type>",
  "<ProjectName>",
  "<Blocked item 1>",
  "<Blocked item 2>",
  "<D-id>",
  "<Decision Title>",
  "<Domain>",
  "<Feature Name>",
  "<Guide>",
  "<Issue 1>",
  "<Issue 2>",
  "<Lane>",
  "<NewGuide>",
  "<Priority 1>",
  "<Priority 2>",
  "<Priority 3>",
  "<Risk 1>",
  "<Risk 2>",
  "<Roadmap item 1>",
  "<Roadmap item 2>",
  "<Win 1>",
  "<Win 2>",
  "<Win 3>",
  "<YYYY-MM>",
  "<area>",
  "<brief description>",
  "<chosen project-management install path>",
  "<code_repo>",
  "<code_repo_or_null>",
  "<component 1>",
  "<component 2>",
  "<current-month>",
  "<description>",
  "<domain>",
  "<feature name>",
  "<folder name>",
  "<id>",
  "<one-line description>",
  "<one-line summary>",
  "<one-sentence description>",
  "<one-sentence description and current mitigation>",
  "<phase>",
  "<project>",
  "<projects_json>",
  "<reason or upstream>",
  "<section name>",
  "<short alias>",
  "<skills-dir>",
  "<symptom>",
  "<title>",
  "<topic>",
  "<vault_root>",
  "<version>",
  "<workspace>",
]);

const STALE_PUBLIC_PATTERNS = [
  {
    code: "stale.access-unavailable",
    pattern: /\baccess:\s*["`']?unavailable["`']?|\bunavailable\b PM access/i,
    files: ["README.md", "SKILL.md", "openclaw-instruction.md", "templates/README.md"],
    remedy: "Use the two-value access model: authoritative or read-only. No-PM-access contributors are not registered.",
  },
  {
    code: "stale.skill-root-projects-json",
    pattern: /projects\.json (?:lives|is stored|is read) (?:at|from|in) (?:the )?skill(?:-| )root|skill directory/i,
    files: ["README.md", "SKILL.md", "openclaw-instruction.md", "templates/README.md"],
    remedy: "Refer to ~/.config/project-management/projects.json as the canonical registry.",
  },
  {
    code: "stale.planning-lane",
    pattern: /(^|[^/`])planning\/(?!plans)/,
    files: ["README.md", "SKILL.md", "openclaw-instruction.md", "templates/README.md"],
    remedy: "Use roadmap/plans/ for planning notes.",
  },
];

function read(rel) {
  return readFileSync(join(SKILL_DIR, rel), "utf8");
}

function existingPublicDocs() {
  return PUBLIC_DOCS.filter((rel) => existsSync(join(SKILL_DIR, rel)));
}

function checkStalePhrases(findings) {
  for (const rel of existingPublicDocs()) {
    const content = read(rel);
    for (const stale of STALE_PUBLIC_PATTERNS) {
      if (stale.files && !stale.files.includes(rel)) continue;
      if (stale.pattern.test(content)) {
        findings.push(finding({
          code: stale.code,
          path: rel,
          message: "public docs contain a retired phrase or convention",
          remedy: stale.remedy,
        }));
      }
    }
  }
}

function checkPlaceholders(findings) {
  for (const rel of existingPublicDocs()) {
    for (const placeholder of unresolvedPlaceholders(read(rel))) {
      if (ALLOWED_PLACEHOLDERS.has(placeholder)) continue;
      findings.push(finding({
        code: "template.unresolved-placeholder",
        path: rel,
        message: `unexpected placeholder ${placeholder}`,
        remedy: "Either render it during bootstrap or add it to the explicit allowlist if it is intentional template syntax.",
      }));
    }
  }
}

function checkConventionCoverage(findings) {
  const conventionText = read("scripts/lib/convention.mjs");
  for (const access of ACCESS_VALUES) {
    if (!conventionText.includes(`"${access}"`)) {
      findings.push(finding({
        code: "convention.access-missing",
        path: "scripts/lib/convention.mjs",
        message: `missing access value ${access}`,
      }));
    }
  }
  for (const rel of [...REQUIRED_DIRS, ...REQUIRED_ROADMAP_FILES, ...REQUIRED_INDEX_FILES]) {
    if (!conventionText.includes(`"${rel}"`)) {
      findings.push(finding({
        code: "convention.required-path-missing",
        path: "scripts/lib/convention.mjs",
        message: `missing canonical path ${rel}`,
      }));
    }
  }
  for (const guide of DOCS_GUIDES) {
    if (!conventionText.includes(`"${guide.dir}"`)) {
      findings.push(finding({
        code: "convention.docs-guide-missing",
        path: "scripts/lib/convention.mjs",
        message: `missing docs guide ${guide.dir}`,
      }));
    }
  }
}

function checkReadmeRouteRows(findings) {
  const readme = read("README.md");
  for (const [lane] of routeRows()) {
    if (!readme.includes(`\`${lane}\``)) {
      findings.push(finding({
        code: "docs.route-row-missing",
        path: "README.md",
        message: `README route table does not mention ${lane}`,
        remedy: "Update README's PM Folder Model from the convention model.",
      }));
    }
  }
}

function walkScripts(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walkScripts(abs, out);
    else if (entry.isFile() && entry.name.endsWith(".mjs")) out.push(abs);
  }
  return out;
}

function checkNoRetiredTemplate(findings) {
  const retiredTemplates = [
    ["templates/AGENTS_PM_SECTION_UNAVAILABLE.md", "retired no-PM-access AGENTS template still exists"],
    ["templates/AGENTS_PM_SECTION_AUTHORITATIVE.md", "retired authoritative AGENTS template still exists"],
    ["templates/AGENTS_PM_SECTION_READONLY.md", "retired read-only AGENTS template still exists"],
  ];
  for (const [rel, message] of retiredTemplates) {
    const retired = join(SKILL_DIR, rel);
    if (existsSync(retired)) {
      findings.push(finding({
        code: "template.retired-agents-present",
        path: relative(SKILL_DIR, retired),
        message,
        remedy: "Delete it; committed AGENTS.md now uses templates/AGENTS_PM_SECTION.md and resolves access from local projects.json.",
      }));
    }
  }
}

function checkPortableAgentsTemplate(findings) {
  const rel = "templates/AGENTS_PM_SECTION.md";
  const abs = join(SKILL_DIR, rel);
  if (!existsSync(abs)) {
    findings.push(finding({
      code: "template.portable-agents-missing",
      path: rel,
      message: "portable AGENTS PM section template is missing",
    }));
    return;
  }
  const content = read(rel);
  const forbidden = [
    ["<pm_folder>", "local PM folder placeholder"],
    ["<skill_dir>", "local skill directory placeholder"],
    ["/home/", "Unix home path"],
    ["/mnt/", "WSL mount path"],
    ["C:\\", "Windows absolute path"],
  ];
  for (const [needle, label] of forbidden) {
    if (content.includes(needle)) {
      findings.push(finding({
        code: "template.portable-agents-local-path",
        path: rel,
        message: `portable AGENTS template contains ${label}`,
        remedy: "Keep committed AGENTS instructions path-agnostic; resolve local identity from projects.json at runtime.",
      }));
    }
  }
}

const findings = [];
checkStalePhrases(findings);
checkPlaceholders(findings);
checkConventionCoverage(findings);
checkReadmeRouteRows(findings);
checkNoRetiredTemplate(findings);
checkPortableAgentsTemplate(findings);

console.log(renderFindings("Skill Quality Report", findings, {
  okMessage: `Checked ${existingPublicDocs().length} public docs and ${walkScripts(join(SKILL_DIR, "scripts")).length} scripts.`,
}));

process.exit(findings.length > 0 ? 1 : 0);
