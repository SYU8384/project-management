#!/usr/bin/env node
/**
 * check-backticked-wikilinks.mjs
 *
 * Detects wikilinks that are wrapped in single-backtick inline code
 * (e.g. `[[target]]`). Obsidian does not render such wikilinks as
 * clickable links — they appear as literal text. The standard
 * `check-obsidian-links.mjs` validator strips inline code before
 * scanning, so this failure mode slips through.
 *
 * Scope: every non-archive, non-history `.md` file in the PM folder.
 *
 * Skip rules:
 *   - Lines inside ``` code fences.
 *   - Files that are clearly documenting wikilink syntax: any
 *     `^#` heading matching /wikilink|obsidian\s+link|link\s+syntax/i.
 *
 * Modes:
 *   --check   report findings; exit 1 if any, else 0
 *   --fix     strip the wrapping backticks; write the file; report count
 *
 * Exit codes:
 *   0  no findings (or fixes applied)
 *   1  drift detected and not fixed
 *   2  invalid arguments or missing config
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { findVaultRoot } from "./lib/paths.mjs";
import { loadPmSkip, isSkipped } from "./lib/skip.mjs";
import { parseProjectTargetArgs, resolveTargets } from "./lib/targets.mjs";

const BACKTICK_SPAN_RE = /`[^`\n]*`/g;
const WIKILINK_INSIDE_RE = /\[\[[^\]]+\]\]/;
const CODE_FENCE_RE = /^\s*```/;
const WIKILINK_SYNTAX_DOC_HEADING_RE = /(?:wikilink|obsidian\s+link|link\s+syntax)/i;
const HEADING_RE = /^#{1,6}\s/;
const SKIP_DIRS = new Set(["archive", "history", "node_modules", ".obsidian", ".git"]);

function spanIsJustWikilink(span) {
  // Strip the wrapping backticks; if only whitespace remains besides the wikilink, the span is "just a wikilink".
  const inner = span.slice(1, -1);
  const withoutWikilink = inner.replace(WIKILINK_INSIDE_RE, "").trim();
  return withoutWikilink.length === 0;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { mode: "check", vault: null, config: null, project: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--check") out.mode = "check";
    else if (args[i] === "--fix") out.mode = "fix";
    else if (args[i] === "--config" || args[i] === "-c") out.config = args[++i];
    else if (args[i] === "--project" || args[i] === "-p") out.project = args[++i];
    else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`Usage: node check-backticked-wikilinks.mjs [--check | --fix] [--project <name>] [--config <path>]`);
      process.exit(0);
    } else if (!args[i].startsWith("-")) {
      out.vault = args[i];
    } else {
      console.error(`ERROR: unknown argument: ${args[i]}`);
      process.exit(2);
    }
  }
  return out;
}

function collectMarkdownFiles(root, skipSet) {
  const files = [];
  function walk(abs) {
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const child = join(abs, entry.name);
      const rel = relative(root, child);
      if (skipSet && isSkipped(skipSet, rel)) continue;
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push({ abs: child, rel });
    }
  }
  walk(root);
  return files;
}

function isWikilinkSyntaxDoc(content) {
  for (const line of content.split("\n")) {
    if (HEADING_RE.test(line) && WIKILINK_SYNTAX_DOC_HEADING_RE.test(line)) return true;
  }
  return false;
}

function findBacktickedWikilinks(content) {
  const findings = [];
  const lines = content.split("\n");
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (CODE_FENCE_RE.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    BACKTICK_SPAN_RE.lastIndex = 0;
    let m;
    while ((m = BACKTICK_SPAN_RE.exec(line)) !== null) {
      if (WIKILINK_INSIDE_RE.test(m[0])) {
        const fixable = spanIsJustWikilink(m[0]);
        findings.push({ line: i + 1, snippet: m[0], fixable });
      }
    }
  }
  return findings;
}

function fixBacktickedWikilinks(content) {
  const lines = content.split("\n");
  let inFence = false;
  let count = 0;
  const newLines = lines.map((line) => {
    if (CODE_FENCE_RE.test(line)) { inFence = !inFence; return line; }
    if (inFence) return line;
    return line.replace(BACKTICK_SPAN_RE, (match) => {
      if (WIKILINK_INSIDE_RE.test(match) && spanIsJustWikilink(match)) {
        count++;
        return match.slice(1, -1);
      }
      return match;
    });
  });
  return { updated: newLines.join("\n"), count };
}

const CLI = parseArgs(process.argv);
const TARGETS = resolveTargets(CLI, { fallbackToCwd: false });
if (TARGETS.length === 0) {
  console.error("No projects found. Pass --project <name> or check projects.json.");
  process.exit(2);
}

let totalFindings = 0;
let totalFixable = 0;
let totalFixed = 0;
let totalFilesChanged = 0;
const summaryByProject = [];

for (const target of TARGETS) {
  const pmFolder = resolve(target.vault);
  const configPath = target.configPath ?? null;
  const vaultRoot = findVaultRoot(pmFolder, configPath);
  const skipSet = loadPmSkip(pmFolder);
  const files = collectMarkdownFiles(pmFolder, skipSet);

  const projectFindings = [];
  let projectFixed = 0;
  let projectFilesChanged = 0;

  for (const file of files) {
    let content;
    try {
      content = readFileSync(file.abs, "utf8");
    } catch {
      continue;
    }
    if (isWikilinkSyntaxDoc(content)) continue;
    const findings = findBacktickedWikilinks(content);
    if (findings.length === 0) continue;

    if (CLI.mode === "check") {
      for (const f of findings) {
        projectFindings.push({ file, finding: f });
      }
    } else if (CLI.mode === "fix") {
      const fixableFindings = findings.filter((f) => f.fixable);
      if (fixableFindings.length === 0) continue;
      const { updated, count } = fixBacktickedWikilinks(content);
      if (count > 0 && updated !== content) {
        writeFileSync(file.abs, updated);
        projectFixed += count;
        projectFilesChanged += 1;
      }
    }
  }

  if (CLI.mode === "check") {
    totalFindings += projectFindings.length;
    totalFixable += projectFindings.filter((p) => p.finding.fixable).length;
    summaryByProject.push({ name: target.project ?? target.label ?? "?", findings: projectFindings });
  } else {
    totalFixed += projectFixed;
    totalFilesChanged += projectFilesChanged;
    summaryByProject.push({ name: target.project ?? target.label ?? "?", fixed: projectFixed, filesChanged: projectFilesChanged });
  }
}

if (CLI.mode === "check") {
  console.log(`# Backticked wikilinks report\n`);
  for (const sp of summaryByProject) {
    console.log(`## ${sp.name}`);
    console.log("");
    if (sp.findings.length === 0) {
      console.log("clean.");
    } else {
      for (const { file, finding } of sp.findings) {
        const shortPath = relative(process.cwd(), file.abs).split("\\").join("/");
        const tag = finding.fixable ? "" : " (intentional example — not auto-fixed)";
        console.log(`- ${shortPath}:${finding.line}: \`${finding.snippet}\`${tag}`);
      }
    }
    console.log("");
  }
  console.log(`**Status:** ${totalFixable === 0 ? "PASS" : "FAIL"}`);
  if (totalFindings === 0) {
    console.log("No backticked wikilinks found.");
  } else if (totalFixable === 0) {
    console.log(`${totalFindings} backticked wikilink(s) found, all intentional examples — no auto-fix needed.`);
  } else {
    console.log(`${totalFixable} auto-fixable backticked wikilink(s) and ${totalFindings - totalFixable} intentional example(s). Run with --fix to strip the wrapping backticks on the auto-fixable ones.`);
  }
  process.exit(totalFixable === 0 ? 0 : 1);
}

if (CLI.mode === "fix") {
  console.log(`# Backticked wikilinks fix\n`);
  for (const sp of summaryByProject) {
    console.log(`## ${sp.name}`);
    console.log("");
    if (sp.fixed === 0) {
      console.log("clean.");
    } else {
      console.log(`fixed: ${sp.fixed} backticked wikilink(s) across ${sp.filesChanged} file(s)`);
    }
    console.log("");
  }
  console.log(`**Status:** ${totalFixed === 0 ? "PASS" : "PASS (fixes applied)"}`);
  console.log(`Total: ${totalFixed} backticked wikilink(s) stripped across ${totalFilesChanged} file(s).`);
  process.exit(0);
}
