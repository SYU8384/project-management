#!/usr/bin/env node
/**
 * check-obsidian-links.mjs
 *
 * Validates rendered Obsidian wikilinks against the vault model, not just
 * the PM folder model. With --fix it applies deterministic syntax/path/TOC
 * repairs and reports unresolved or ambiguous targets for manual review.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import { findVaultRoot } from "./lib/paths.mjs";
import { loadPmSkip, isSkipped } from "./lib/skip.mjs";
import { parseProjectTargetArgs, resolveTargets } from "./lib/targets.mjs";
import {
  basenameNoExt,
  extractRenderedWikiLinks,
  findMalformedWikiSyntax,
  fixSimpleMalformedWikiSyntax,
  headingMatches,
  markdownHeadings,
  normalizePmRelativeWikiLinks,
  parseWikiLinkBody,
  syncMarkedH2Toc,
  vaultRelativeTarget,
} from "./lib/obsidian-links.mjs";

const CLI = parseProjectTargetArgs(process.argv, { allowFix: true, allowStrict: true });

function collectMarkdownFiles(root, skipSet = null) {
  const files = [];
  function walk(abs) {
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const child = join(abs, entry.name);
      const rel = relative(root, child).split("\\").join("/");
      if (skipSet && isSkipped(skipSet, rel)) continue;
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push({ abs: child, rel });
    }
  }
  walk(root);
  return files;
}

function buildVaultIndex(vaultRoot) {
  const files = collectMarkdownFiles(vaultRoot);
  const byVaultTarget = new Map();
  const byBase = new Map();
  for (const file of files) {
    const target = vaultRelativeTarget(vaultRoot, file.abs);
    byVaultTarget.set(target, file.abs);
    const base = basenameNoExt(target);
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(file.abs);
  }
  return { files, byVaultTarget, byBase };
}

function resolveLink({ link, srcAbs, pmFolder, vaultRoot, index }) {
  const parsed = parseWikiLinkBody(link.body);
  const target = parsed.target;
  const heading = parsed.heading;

  if (!target && !heading) return { status: "skip" };
  if (/^(https?:|mailto:|file:)/i.test(target)) return { status: "skip" };

  let candidates = [];
  let status = "ok";

  if (!target) {
    candidates = [srcAbs];
  } else if (index.byVaultTarget.has(target)) {
    candidates = [index.byVaultTarget.get(target)];
  } else if (!target.includes("/")) {
    const matches = index.byBase.get(target) ?? [];
    if (matches.length === 1) candidates = matches;
    else if (matches.length > 1) return { status: "manual", message: `line ${link.line}: [[${link.body}]] matches multiple notes named ${target}` };
    else return { status: "issue", message: `line ${link.line}: missing target [[${link.body}]]` };
  } else {
    const pmCandidate = join(pmFolder, `${target}.md`);
    if (existsSync(pmCandidate)) {
      candidates = [pmCandidate];
      status = "pm-relative";
    } else {
      return { status: "issue", message: `line ${link.line}: missing target [[${link.body}]]` };
    }
  }

  if (heading) {
    const headingOk = candidates.some((candidate) =>
      headingMatches(markdownHeadings(readFileSync(candidate, "utf8")), heading),
    );
    if (!headingOk) {
      return { status: "issue", message: `line ${link.line}: missing heading [[${link.body}]]` };
    }
  }

  if (status === "pm-relative") {
    return { status: "issue", message: `line ${link.line}: PM-relative slash link should be vault-relative [[${link.body}]]` };
  }
  return { status: "ok" };
}

function repairContent(content, { pmFolder, vaultRoot }) {
  const changes = [];
  let working = content;

  const malformed = fixSimpleMalformedWikiSyntax(working);
  working = malformed.updated;
  changes.push(...malformed.changes);

  const toc = syncMarkedH2Toc(working);
  working = toc.updated;
  changes.push(...toc.changes);

  const links = normalizePmRelativeWikiLinks(working, { pmFolder, vaultRoot });
  working = links.updated;
  changes.push(...links.changes);

  return { updated: working, changes };
}

function runFor(target) {
  const pmFolder = resolve(target.vault);
  const configPath = target.configPath ?? null;
  const vaultRoot = findVaultRoot(pmFolder, configPath);
  const skipSet = loadPmSkip(pmFolder);
  const files = collectMarkdownFiles(pmFolder, skipSet);
  const index = buildVaultIndex(vaultRoot);
  const issues = [];
  const manualReview = [];
  const fixed = [];

  console.log(`\n# Obsidian link report: ${target.label ?? `${target.project ?? basename(pmFolder)} (${pmFolder})`}\n`);
  if (vaultRoot === pmFolder && !existsSync(join(vaultRoot, ".obsidian"))) {
    console.log(`Note: vault root resolved to ${vaultRoot}; PM-relative fallback may limit Obsidian validation.\n`);
  }

  for (const file of files) {
    const original = readFileSync(file.abs, "utf8");
    let working = original;
    if (CLI.fix) {
      const repair = repairContent(original, { pmFolder, vaultRoot });
      working = repair.updated;
      if (working !== original) {
        writeFileSync(file.abs, working);
        fixed.push(`${file.rel}: ${repair.changes.length} deterministic change(s)`);
      }
    }

    for (const malformed of findMalformedWikiSyntax(working)) {
      issues.push(`${file.rel}: line ${malformed.line}: malformed wikilink syntax`);
    }

    for (const link of extractRenderedWikiLinks(working)) {
      const result = resolveLink({ link, srcAbs: file.abs, pmFolder, vaultRoot, index });
      if (result.status === "issue") issues.push(`${file.rel}: ${result.message}`);
      else if (result.status === "manual") manualReview.push(`${file.rel}: ${result.message}`);
    }
  }

  if (fixed.length > 0) {
    console.log("## Fixed\n");
    for (const item of fixed) console.log(`- ${item}`);
    console.log("");
  }

  console.log(`**Status:** ${issues.length === 0 ? "PASS" : "FAIL"}\n`);
  if (issues.length === 0) {
    console.log("Rendered Obsidian wikilinks resolve under the vault model.");
  } else {
    console.log("## Findings\n");
    for (const issue of issues) console.log(`- ${issue}`);
  }

  if (manualReview.length > 0) {
    console.log("\n## Manual Review\n");
    for (const item of manualReview) console.log(`- ${item}`);
  }

  return { fail: issues.length, manualReview };
}

let totalFail = 0;
const manual = [];
try {
  for (const target of resolveTargets(CLI)) {
    const result = runFor(target);
    totalFail += result.fail;
    manual.push(...result.manualReview);
  }
} catch (err) {
  console.error(err.message);
  process.exit(2);
}

if (manual.length > 0) {
  console.log("\n# Manual Review Summary\n");
  for (const item of manual) console.log(`- ${item}`);
}

process.exit(totalFail > 0 ? 1 : 0);
