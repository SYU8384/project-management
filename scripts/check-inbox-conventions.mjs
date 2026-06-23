#!/usr/bin/env node
/**
 * check-inbox-conventions.mjs
 *
 * Validates the canonical `inbox/` raw-intake lane. Inbox notes are
 * intentionally lightweight; this check enforces only metadata and routing
 * state, not the note body.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import { INBOX_RESOLUTIONS, INBOX_STATUSES } from "./lib/convention.mjs";
import { parseFrontmatter, stripFrontmatter } from "./lib/markdown.mjs";
import { parseProjectTargetArgs, resolveTargets } from "./lib/targets.mjs";

const CLI = parseProjectTargetArgs(process.argv, { allowFix: true });
const today = new Date().toISOString().slice(0, 10);
const DIRECT_RESOLUTIONS = new Set(["addressed-directly", "no-action", "multiple"]);

function parseInboxFilename(filename) {
  const match = /^(\d{4}-\d{2}-\d{2})_([^_]+)_(.+)\.md$/.exec(filename);
  if (!match) return null;
  return {
    date: match[1],
    author: match[2],
    rawTitle: match[3],
    stem: filename.replace(/\.md$/, ""),
  };
}

function splitFrontmatter(content) {
  const normalized = String(content ?? "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return null;
  return { frontmatter: match[1], body: normalized.slice(match[0].length) };
}

function setScalarLine(raw, key, value) {
  const line = `${key}: ${value}`;
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*.*$`, "m");
  if (re.test(raw)) return raw.replace(re, line);
  return `${raw.trimEnd()}\n${line}`;
}

function titleFromInfo(info) {
  return info.stem.replace(/_/g, " ");
}

function normalizeInboxNote(content, info) {
  const split = splitFrontmatter(content);
  if (!split) return { updated: content, changes: [] };
  let fm = split.frontmatter;
  const parsed = parseFrontmatter(content) ?? {};
  const changes = [];

  const defaults = {
    title: JSON.stringify(titleFromInfo(info)),
    created: info.date,
    updated: today,
    last_reviewed: today,
    pageType: "note",
    status: "unprocessed",
    author: info.author,
    resolution: "pending",
    destination: "none",
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (!parsed[key]) {
      fm = setScalarLine(fm, key, value);
      changes.push(`added ${key}`);
    }
  }

  let body = split.body.replace(/^\n+/, "");
  if (!/^#\s+.+$/m.test(body)) {
    body = `# ${titleFromInfo(info)}\n\n${body}`;
    changes.push("added H1");
  }

  return {
    updated: `---\n${fm.trimEnd()}\n---\n${body}`,
    changes,
  };
}

function collectInboxNotes(pmFolder) {
  const inboxDir = join(pmFolder, "inbox");
  if (!existsSync(inboxDir)) return [];
  return readdirSync(inboxDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "inbox.md")
    .map((entry) => ({
      abs: join(inboxDir, entry.name),
      rel: `inbox/${entry.name}`,
      filename: entry.name,
    }));
}

function validateDestinationValue(destination) {
  if (!destination) return "missing destination";
  if (destination === "none") return null;
  if (!destination.includes("[[")) return "destination must be `none` or vault-relative wikilink(s)";
  if (/^[A-Za-z]:\\|^\\\\|^\//.test(destination)) return "destination must not be an OS-absolute path";
  return null;
}

function validateNote({ rel, filename, content, info }) {
  const issues = [];
  if (!info) {
    issues.push(`${rel}: filename must be YYYY-MM-DD_<name>_<title>.md`);
    return issues;
  }

  const fm = parseFrontmatter(content);
  if (!fm) {
    issues.push(`${rel}: missing frontmatter`);
    return issues;
  }

  for (const field of ["title", "created", "updated", "last_reviewed", "pageType", "status", "author", "resolution", "destination"]) {
    if (!fm[field]) issues.push(`${rel}: missing ${field}`);
  }

  if (fm.pageType && fm.pageType !== "note") {
    issues.push(`${rel}: pageType ${fm.pageType}, expected note`);
  }
  if (fm.status && !INBOX_STATUSES.includes(fm.status)) {
    issues.push(`${rel}: unsupported status \`${fm.status}\`; expected ${INBOX_STATUSES.join(" | ")}`);
  }
  if (fm.resolution && !INBOX_RESOLUTIONS.includes(fm.resolution)) {
    issues.push(`${rel}: unsupported resolution \`${fm.resolution}\`; expected ${INBOX_RESOLUTIONS.join(" | ")}`);
  }

  const destinationIssue = validateDestinationValue(fm.destination);
  if (destinationIssue) issues.push(`${rel}: ${destinationIssue}`);

  if (fm.status === "unprocessed") {
    if (fm.resolution !== "pending") issues.push(`${rel}: unprocessed notes require resolution: pending`);
    if (fm.destination !== "none") issues.push(`${rel}: unprocessed notes require destination: none`);
  }
  if (fm.status === "processed") {
    if (fm.resolution === "pending") issues.push(`${rel}: processed notes require a non-pending resolution`);
    if (!DIRECT_RESOLUTIONS.has(fm.resolution) && fm.destination === "none") {
      issues.push(`${rel}: processed notes with resolution ${fm.resolution} require destination wikilink(s)`);
    }
  }
  if (fm.status === "rejected") {
    if (fm.resolution !== "no-action") issues.push(`${rel}: rejected notes require resolution: no-action`);
    if (fm.destination !== "none") issues.push(`${rel}: rejected notes require destination: none`);
  }

  const usesPlaceholder = filename.includes("NAME_PLACEHOLDER") || fm.author === "NAME_PLACEHOLDER";
  if (usesPlaceholder) {
    const body = stripFrontmatter(content);
    const h1 = body.match(/^#\s+(.+)$/m)?.[1] ?? "";
    if (!filename.includes("NAME_PLACEHOLDER")) issues.push(`${rel}: NAME_PLACEHOLDER author requires filename placeholder`);
    if (fm.author !== "NAME_PLACEHOLDER") issues.push(`${rel}: filename placeholder requires author: NAME_PLACEHOLDER`);
    if (!String(fm.title ?? "").includes("NAME_PLACEHOLDER")) issues.push(`${rel}: placeholder notes require NAME_PLACEHOLDER in title`);
    if (!h1.includes("NAME_PLACEHOLDER")) issues.push(`${rel}: placeholder notes require NAME_PLACEHOLDER in H1`);
  }

  return issues;
}

function runFor(target) {
  const pmFolder = resolve(target.vault);
  const label = target.label ?? `${target.project ?? basename(pmFolder)} (${pmFolder})`;
  const issues = [];
  const fixed = [];
  const inboxDir = join(pmFolder, "inbox");

  console.log(`\n# Inbox conventions report: ${label}\n`);

  if (!existsSync(inboxDir)) {
    issues.push("inbox/: missing required inbox lane");
  }

  for (const note of collectInboxNotes(pmFolder)) {
    let content = readFileSync(note.abs, "utf8");
    const info = parseInboxFilename(note.filename);
    if (CLI.fix && info && splitFrontmatter(content)) {
      const normalized = normalizeInboxNote(content, info);
      if (normalized.updated !== content) {
        writeFileSync(note.abs, normalized.updated);
        content = normalized.updated;
        fixed.push(`${note.rel}: ${normalized.changes.join(", ")}`);
      }
    }
    issues.push(...validateNote({ ...note, content, info }));
  }

  if (fixed.length > 0) {
    console.log("## Fixed\n");
    for (const item of fixed) console.log(`- ${item}`);
    console.log("");
  }

  console.log(`**Status:** ${issues.length === 0 ? "PASS" : "FAIL"}\n`);
  if (issues.length === 0) {
    console.log("Inbox notes follow the raw-intake metadata convention.");
  } else {
    console.log("## Findings\n");
    for (const issue of issues) console.log(`- ${issue}`);
  }

  return issues.length;
}

let total = 0;
try {
  for (const target of resolveTargets(CLI)) total += runFor(target);
} catch (err) {
  console.error(err.message);
  process.exit(2);
}

process.exit(total > 0 ? 1 : 0);

export const __test = {
  parseInboxFilename,
  normalizeInboxNote,
  validateNote,
};
