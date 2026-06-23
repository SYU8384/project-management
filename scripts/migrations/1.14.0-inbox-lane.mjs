#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { findVaultRoot } from "../lib/paths.mjs";
import { projectPathFromVault } from "../lib/obsidian-links.mjs";
import { parseFrontmatter } from "../lib/markdown.mjs";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function parseInboxFilename(filename) {
  const match = /^(\d{4}-\d{2}-\d{2})_([^_]+)_(.+)\.md$/.exec(filename);
  if (!match) return null;
  return {
    date: match[1],
    author: match[2],
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

function normalizeInboxNote(content, info, date = today()) {
  const split = splitFrontmatter(content);
  if (!split) return { updated: content, changes: [] };
  let fm = split.frontmatter;
  const parsed = parseFrontmatter(content) ?? {};
  const changes = [];
  const defaults = {
    title: JSON.stringify(titleFromInfo(info)),
    created: info.date,
    updated: date,
    last_reviewed: date,
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

function inboxIndexContent({ project, linkRoot, date }) {
  return `---
title: inbox
tags:
  - project-management
  - inbox
created: ${date}
updated: ${date}
last_reviewed: ${date}
pageType: index
status: active
owner: PM
icon: "LiInbox"
iconColor: "#0ea5e9"
---
# inbox

Raw owner/collaborator intake notes for ideas, discussions, rough requests, and untriaged context.

<!-- vault-maintain:index:start -->
## Subfolders

*(no items)*

## Notes

Do not maintain a complete note register here. Per-note frontmatter is the source of processing state.
<!-- vault-maintain:index:end -->

## Conventions

- **Purpose:** capture raw notes only. The owner later digests them into \`roadmap/ideas.md\`, \`roadmap/plans/\`, \`roadmap/done-pending.md\`, \`decisions/\`, \`system/\`, \`features/\`, docs, or known issues.
- **Filename:** \`YYYY-MM-DD_<name>_<title>.md\`. If no creator name is provided, agents must use \`NAME_PLACEHOLDER\` in the filename, title/H1, and \`author\`, then ask the user what name should replace it.
- **Frontmatter:** inbox notes use \`pageType: note\`, \`status: unprocessed | processed | rejected\`, \`author\`, \`resolution\`, and \`destination\`.
- **Routing state:** \`unprocessed\` requires \`resolution: pending\` and \`destination: none\`; \`processed\` requires a non-pending resolution; \`rejected\` uses \`resolution: no-action\` and \`destination: none\`.

## Navigation

- [[${linkRoot}/${project}|Back to ${project}]]
- [[${linkRoot}/README|README]]
`;
}

function listInboxNotePaths(pmFolder) {
  const inboxDir = join(pmFolder, "inbox");
  if (!existsSync(inboxDir)) return [];
  return readdirSync(inboxDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "inbox.md")
    .map((entry) => ({ abs: join(inboxDir, entry.name), filename: entry.name }));
}

function noteNeedsNormalization(pmFolder) {
  return listInboxNotePaths(pmFolder).some(({ abs, filename }) => {
    const info = parseInboxFilename(filename);
    if (!info) return false;
    const original = readFileSync(abs, "utf8");
    return normalizeInboxNote(original, info).updated !== original;
  });
}

function detect({ pmFolder }) {
  return Boolean(
    !existsSync(join(pmFolder, "inbox")) ||
    !existsSync(join(pmFolder, "inbox", "inbox.md")) ||
    noteNeedsNormalization(pmFolder)
  );
}

function plan() {
  return [
    "Create the required `inbox/` raw-intake lane and `inbox/inbox.md` conventions note when missing.",
    "Add deterministic frontmatter and H1 metadata to existing `inbox/*.md` notes that follow the canonical filename shape.",
    "Preserve existing inbox note bodies; do not promote raw notes into roadmap, decisions, docs, or system artifacts.",
  ];
}

function apply({ pmFolder, ctx }) {
  const date = today();
  const project = basename(pmFolder);
  const vaultRoot = findVaultRoot(pmFolder, ctx.configPath);
  const linkRoot = projectPathFromVault(vaultRoot, pmFolder);
  const inboxDir = join(pmFolder, "inbox");
  const inboxIndex = join(inboxDir, "inbox.md");
  let normalized = 0;
  let skipped = 0;

  if (!ctx.dryRun) mkdirSync(inboxDir, { recursive: true });
  if (!existsSync(inboxIndex)) {
    if (!ctx.dryRun) {
      mkdirSync(dirname(inboxIndex), { recursive: true });
      writeFileSync(inboxIndex, inboxIndexContent({ project, linkRoot, date }));
    }
    ctx.log("done", "inbox/inbox.md: created inbox conventions note");
  }

  for (const { abs, filename } of listInboxNotePaths(pmFolder)) {
    const info = parseInboxFilename(filename);
    if (!info) {
      skipped += 1;
      continue;
    }
    const original = readFileSync(abs, "utf8");
    const result = normalizeInboxNote(original, info, date);
    if (result.updated !== original) {
      normalized += 1;
      if (!ctx.dryRun) writeFileSync(abs, result.updated);
      ctx.log("done", `inbox/${filename}: ${result.changes.join(", ")}`);
    }
  }

  return {
    suggestedHistory: [
      `- **The raw intake lane is now canonical.** feat(pm): apply migration \`1.14.0-inbox-lane\` to create \`inbox/\`, add \`inbox/inbox.md\`, and normalize ${normalized} existing inbox note(s) without promoting raw content. Skipped ${skipped} non-canonical inbox filename(s) for manual review.`,
    ],
    manualReview: skipped > 0
      ? [`${skipped} inbox note filename(s) did not match \`YYYY-MM-DD_<name>_<title>.md\`; rename or leave them as project-specific exceptions.`]
      : [],
  };
}

export default {
  id: "1.14.0-inbox-lane",
  from: "<1.14.0",
  to: "1.14.0",
  describe:
    "Add the required `inbox/` raw-intake lane. Creates `inbox/inbox.md` and adds deterministic metadata to existing inbox notes while preserving raw bodies.",
  detect,
  plan,
  apply,
};

export const __test = {
  inboxIndexContent,
  normalizeInboxNote,
  parseInboxFilename,
};
