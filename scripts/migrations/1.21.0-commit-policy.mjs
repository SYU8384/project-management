#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { isValidCommitPolicy } from "../lib/convention.mjs";

function readConfig(configPath) {
  if (!configPath || !existsSync(configPath)) return null;
  return JSON.parse(readFileSync(configPath, "utf8"));
}

function findProjectEntry(cfg, pmFolder) {
  const target = resolve(pmFolder);
  for (const [name, entry] of Object.entries(cfg?.projects ?? {})) {
    if (entry.pm_folder && resolve(entry.pm_folder) === target) return { name, entry };
  }
  return null;
}

function detect({ pmFolder, ctx }) {
  const found = findProjectEntry(readConfig(ctx.configPath), pmFolder);
  return Boolean(found && !isValidCommitPolicy(found.entry.commit_policy));
}

function plan({ pmFolder, ctx }) {
  const found = findProjectEntry(readConfig(ctx.configPath), pmFolder);
  return [
    "Set projects.json commit_policy for project " + (found?.name ?? "?") + " to requires-explicit (safe legacy default).",
    "No PM folder notes are rewritten; choose scoped-by-default explicitly during setup or later policy configuration.",
  ];
}

function apply({ pmFolder, ctx }) {
  const cfg = readConfig(ctx.configPath);
  const found = findProjectEntry(cfg, pmFolder);
  if (!found || isValidCommitPolicy(found.entry.commit_policy)) return { suggestedHistory: [], manualReview: [] };
  found.entry.commit_policy = "requires-explicit";
  if (!ctx.dryRun) writeFileSync(ctx.configPath, JSON.stringify(cfg, null, 2) + "\n");
  ctx.log("done", "projects.json", "set projects." + found.name + ".commit_policy = requires-explicit (safe legacy default)");
  return { suggestedHistory: [], manualReview: ["Review " + found.name + " commit policy: set projects.json commit_policy to scoped-by-default only when agents may create verified, narrow, separate implementation and PM-documentation commits without asking."] };
}

export default {
  id: "1.21.0-commit-policy",
  from: "<1.21.0",
  to: "1.21.0",
  describe: "Backfill projects.json commit_policy with the conservative requires-explicit default.",
  detect,
  plan,
  apply,
};
