#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { findVaultRoot } from "../lib/paths.mjs";
import {
  fixSimpleMalformedWikiSyntax,
  normalizePmRelativeWikiLinks,
  syncMarkedH2Toc,
} from "../lib/obsidian-links.mjs";

function collectMarkdownFiles(pmFolder) {
  const files = [];
  function walk(abs) {
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const child = join(abs, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push({ abs: child, rel: relative(pmFolder, child).split("\\").join("/") });
      }
    }
  }
  walk(pmFolder);
  return files;
}

function repair(content, { pmFolder, vaultRoot }) {
  const changes = [];
  let working = content;

  for (const fixer of [
    (value) => fixSimpleMalformedWikiSyntax(value),
    (value) => syncMarkedH2Toc(value),
    (value) => normalizePmRelativeWikiLinks(value, { pmFolder, vaultRoot }),
  ]) {
    const result = fixer(working);
    working = result.updated;
    changes.push(...(result.changes ?? []));
  }

  return { updated: working, changes };
}

function detect({ pmFolder, ctx = {} }) {
  const vaultRoot = findVaultRoot(pmFolder, ctx.configPath);
  for (const file of collectMarkdownFiles(pmFolder)) {
    const original = readFileSync(file.abs, "utf8");
    if (repair(original, { pmFolder, vaultRoot }).updated !== original) return true;
  }
  return false;
}

function plan() {
  return [
    "Apply vault-relative Obsidian link normalization (D-014).",
    "Auto-fixed: simple malformed wikilinks, marked H2 Contents TOCs, and PM-root-relative slash wikilinks when the target exists under the PM folder.",
    "Manual review: missing, ambiguous, or semantically stale links are left for the Obsidian link validator and maintainer judgment.",
  ];
}

function apply({ pmFolder, ctx }) {
  const vaultRoot = findVaultRoot(pmFolder, ctx.configPath);
  const log = [];

  for (const file of collectMarkdownFiles(pmFolder)) {
    const original = readFileSync(file.abs, "utf8");
    const result = repair(original, { pmFolder, vaultRoot });
    if (result.updated !== original) {
      if (!ctx.dryRun) writeFileSync(file.abs, result.updated);
      log.push(`${file.rel}: ${result.changes.length} deterministic Obsidian link change(s)`);
    }
  }

  for (const item of log) ctx.log("info", item);
  if (log.length > 0) ctx.log("done", "vault-relative Obsidian links normalized");
  else ctx.log("skip", "no vault-relative Obsidian link drift found");

  return {
    suggestedHistory: [
      `- **PM wikilinks now follow Obsidian's vault model.** chore(pm): apply migration \`1.12.0-vault-relative-obsidian-links\` to normalize deterministic PM links and marked TOCs. Auto-fixed: ${log.length} file(s).`,
    ],
    manualReview: [],
  };
}

export default {
  id: "1.12.0-vault-relative-obsidian-links",
  from: "<1.12.0",
  to: "1.12.0",
  describe:
    "Normalize deterministic Obsidian link shape for PM folders: close simple malformed wikilinks, regenerate marked H2 TOCs, and convert PM-root-relative slash wikilinks to derived vault-relative wikilinks when targets exist. History and archive may receive syntax-only target-preserving repairs; historical meaning is not rewritten.",
  detect,
  plan,
  apply,
};
