#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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
  return findProjectEntry(readConfig(ctx.configPath), pmFolder)?.entry.commit_policy === "scoped-by-default";
}

function plan({ pmFolder, ctx }) {
  const found = findProjectEntry(readConfig(ctx.configPath), pmFolder);
  return ["Rename projects." + (found?.name ?? "?") + ".commit_policy from scoped-by-default to auto-scoped."];
}

function apply({ pmFolder, ctx }) {
  const cfg = readConfig(ctx.configPath);
  const found = findProjectEntry(cfg, pmFolder);
  if (!found || found.entry.commit_policy !== "scoped-by-default") return { suggestedHistory: [], manualReview: [] };
  found.entry.commit_policy = "auto-scoped";
  if (!ctx.dryRun) writeFileSync(ctx.configPath, JSON.stringify(cfg, null, 2) + "\n");
  ctx.log("done", "projects.json", "set projects." + found.name + ".commit_policy = auto-scoped");
  return { suggestedHistory: [], manualReview: [] };
}

export default {
  id: "1.22.0-auto-scoped-commit-policy",
  from: "<1.22.0",
  to: "1.22.0",
  describe: "Rename scoped-by-default to the mandatory auto-scoped commit policy.",
  detect,
  plan,
  apply,
};
