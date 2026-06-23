import { basename } from "node:path";

import { expectedPageTypeForPath } from "./convention.mjs";

function parseScalarFields(block) {
  const fields = {};
  for (const line of block.split("\n")) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return fields;
}

function leadingFrontmatterBlocks(content) {
  const blocks = [];
  let offset = 0;
  while (content.slice(offset).startsWith("---\n")) {
    const rest = content.slice(offset + 4);
    const close = rest.indexOf("\n---");
    if (close === -1) break;
    const raw = rest.slice(0, close);
    const end = offset + 4 + close + 4;
    blocks.push({ raw, start: offset, end, fields: parseScalarFields(raw) });
    offset = end;
    while (true) {
      if (content[offset] === "\r" && content[offset + 1] === "\n") {
        offset += 2;
      } else if (content[offset] === "\n" || content[offset] === "\ufeff") {
        offset += 1;
      } else {
        break;
      }
    }
  }
  return blocks;
}

function fieldCount(fields) {
  return Object.keys(fields).length;
}

function chooseFrontmatterBlock(blocks) {
  if (blocks.length === 0) return null;
  if (blocks.length === 1) return blocks[0];
  const sorted = [...blocks].sort((a, b) => fieldCount(b.fields) - fieldCount(a.fields));
  return sorted[0];
}

function setScalarLine(raw, key, value) {
  const line = `${key}: ${value}`;
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*.*$`, "m");
  if (re.test(raw)) return raw.replace(re, line);
  return `${raw.replace(/\s+$/g, "")}\n${line}`;
}

function removeScalarLine(raw, key) {
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*.*\\n?`, "m");
  return raw.replace(re, "").replace(/\n{3,}/g, "\n\n").trimEnd();
}

function titleForPath(rel, project) {
  if (rel === `${project}.md`) return project;
  return basename(rel, ".md");
}

function createdForPath(rel, date) {
  const fileDate = basename(rel).match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  const historyDate = basename(rel, ".md").match(/^history-(\d{4}-\d{2}-\d{2})/)?.[1];
  return fileDate ?? historyDate ?? date;
}

function defaultStatus(pageType) {
  if (pageType === "history") return null;
  return "active";
}

export function normalizePmFrontmatter(content, { rel, project, date }) {
  const normalized = String(content ?? "").replace(/\r\n/g, "\n");
  const blocks = leadingFrontmatterBlocks(normalized);
  if (blocks.length === 0) return { updated: content, changes: [], fixedFields: new Set() };

  const chosen = chooseFrontmatterBlock(blocks);
  let raw = chosen.raw;
  const originalFields = { ...chosen.fields };
  const changes = [];
  const fixedFields = new Set();
  const body = normalized.slice(blocks.at(-1).end).replace(/^\n+/, "");
  const expectedPageType = expectedPageTypeForPath(rel, project, originalFields.pageType);

  if (blocks.length > 1) changes.push("collapsed duplicate leading frontmatter blocks");

  const defaults = {
    title: `"${titleForPath(rel, project)}"`,
    created: createdForPath(rel, date),
    updated: date,
    last_reviewed: date,
    pageType: expectedPageType,
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (!originalFields[key]) {
      raw = setScalarLine(raw, key, value);
      changes.push(`added ${key}`);
      fixedFields.add(key);
    }
  }

  const pageType = expectedPageType;
  if (originalFields.pageType && originalFields.pageType !== expectedPageType) {
    raw = setScalarLine(raw, "pageType", expectedPageType);
    changes.push(`pageType ${originalFields.pageType} -> ${expectedPageType}`);
    fixedFields.add("pageType");
  }

  if (pageType === "history") {
    if (!originalFields.kind) {
      raw = setScalarLine(raw, "kind", "mixed");
      changes.push("added kind");
      fixedFields.add("kind");
    }
    if (originalFields.status) {
      raw = removeScalarLine(raw, "status");
      changes.push("removed status from history file");
      fixedFields.add("status");
    }
  } else if (!originalFields.status) {
    const status = defaultStatus(pageType);
    if (status) {
      raw = setScalarLine(raw, "status", status);
      changes.push("added status");
      fixedFields.add("status");
    }
  }

  if (rel.startsWith("archive/") && rel.endsWith("-archived.md") && !originalFields.archived) {
    raw = setScalarLine(raw, "archived", date);
    changes.push("added archived");
    fixedFields.add("archived");
  }

  const updated = `---\n${raw.trimEnd()}\n---\n${body}`;
  return { updated, changes, fixedFields };
}

export function touchLastReviewed(content, date) {
  const normalized = String(content ?? "").replace(/\r\n/g, "\n");
  const blocks = leadingFrontmatterBlocks(normalized);
  if (blocks.length === 0) return { updated: content, changed: false };
  const chosen = chooseFrontmatterBlock(blocks);
  let raw = chosen.raw;
  const current = chosen.fields.last_reviewed;
  if (current === date) return { updated: content, changed: false };
  raw = setScalarLine(raw, "last_reviewed", date);
  raw = setScalarLine(raw, "updated", date);
  const body = normalized.slice(blocks.at(-1).end).replace(/^\n+/, "");
  return { updated: `---\n${raw.trimEnd()}\n---\n${body}`, changed: true };
}

export const __test = {
  leadingFrontmatterBlocks,
  parseScalarFields,
};
