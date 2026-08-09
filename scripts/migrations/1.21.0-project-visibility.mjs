#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { isValidVisibility } from "../lib/convention.mjs";

function readConfig(configPath) {
  if (!configPath || !existsSync(configPath)) return null;
  return JSON.parse(readFileSync(configPath, "utf8"));
}

function findProjectEntry(cfg, pmFolder) {
  const target = resolve(pmFolder);
  for (const [name, entry] of Object.entries(cfg?.projects ?? {})) {
    if (entry.pm_folder && resolve(entry.pm_folder) === target) {
      return { name, entry };
    }
  }
  return null;
}

function detect({ pmFolder, ctx }) {
  const cfg = readConfig(ctx.configPath);
  const found = cfg && findProjectEntry(cfg, pmFolder);
  if (!found) return false;
  return !isValidVisibility(found.entry.visibility);
}

function plan({ pmFolder, ctx }) {
  const cfg = readConfig(ctx.configPath);
  const found = cfg && findProjectEntry(cfg, pmFolder);
  return [
    `Set projects.json 'visibility' for project '${found?.name ?? "?"}' to "private" (safe default).`,
    "No PM folder notes are rewritten; only the local projects.json entry changes.",
  ];
}

function apply({ pmFolder, ctx }) {
  const cfg = readConfig(ctx.configPath);
  const found = cfg && findProjectEntry(cfg, pmFolder);
  if (!found) return { suggestedHistory: [], manualReview: [] };
  if (isValidVisibility(found.entry.visibility)) {
    return { suggestedHistory: [], manualReview: [] };
  }
  found.entry.visibility = "private";
  if (!ctx.dryRun) {
    writeFileSync(ctx.configPath, `${JSON.stringify(cfg, null, 2)}\n`);
  }
  ctx.log(
    "done",
    "projects.json",
    `set projects.${found.name}.visibility = "private" (safe default)`
  );
  return {
    suggestedHistory: [
      `- **Project visibility is now recorded in projects.json.** chore(pm): apply migration \`1.21.0-project-visibility\` to backfill \`visibility: "private"\` (safe default) for this project.`,
    ],
    manualReview: [
      `Review '${found.name}' visibility: if the code repo is open source, flip projects.json visibility to "public" and follow the Repository Visibility section in REFERENCE.md (repo-canonical ADR stubs, AGENTS.md repo-docs block).`,
    ],
  };
}

export default {
  id: "1.21.0-project-visibility",
  from: "<1.21.0",
  to: "1.21.0",
  describe:
    "Backfill the projects.json 'visibility' field (public | private) with the safe default 'private' so repo-canonical docs conventions can key off it.",
  detect,
  plan,
  apply,
};
