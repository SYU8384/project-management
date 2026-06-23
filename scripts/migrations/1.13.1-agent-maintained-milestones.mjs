#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { findVaultRoot } from "../lib/paths.mjs";
import {
  activeMilestoneInfo,
  ensureMilestonesIndexLink,
  ensureMilestoneUpdateTriggers,
  listMilestoneNoteRels,
  milestoneNoteContent,
  milestonesIndexContent,
  milestoneSlugFromRel,
} from "../lib/milestones.mjs";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function splitFrontmatter(content) {
  const normalized = String(content ?? "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return null;
  return { frontmatter: match[1], body: normalized.slice(match[0].length) };
}

function setFrontmatterValue(frontmatter, key, value) {
  const line = `${key}: ${value}`;
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*.*$`, "m");
  if (re.test(frontmatter)) return frontmatter.replace(re, line);
  return `${frontmatter.trimEnd()}\n${line}`;
}

function touchFrontmatter(content, date) {
  const split = splitFrontmatter(content);
  if (!split) return content;
  let fm = split.frontmatter;
  fm = setFrontmatterValue(fm, "updated", date);
  fm = setFrontmatterValue(fm, "last_reviewed", date);
  return `---\n${fm.trimEnd()}\n---\n${split.body.replace(/^\n+/, "")}`;
}

function milestoneNeedsUpdateTriggers(pmFolder) {
  return listMilestoneNoteRels(pmFolder).some((rel) => {
    const content = readFileSync(join(pmFolder, rel), "utf8");
    return ensureMilestoneUpdateTriggers(content).updated !== content;
  });
}

function detect({ pmFolder, ctx } = {}) {
  const project = basename(pmFolder);
  const active = activeMilestoneInfo({ pmFolder, project, configPath: ctx?.configPath });
  return Boolean(
    milestoneNeedsUpdateTriggers(pmFolder) ||
    (active && !existsSync(active.abs))
  );
}

function plan() {
  return [
    "Insert `## Update Triggers` into existing `roadmap/milestones/*.md` notes.",
    "Create the active milestone note from `CURRENT_STATUS.md ## Current Phase` or projects.json phase when it is missing.",
    "Update `roadmap/milestones/milestones.md` to link all milestone notes.",
  ];
}

function apply({ pmFolder, ctx }) {
  const date = today();
  const project = basename(pmFolder);
  const milestonesDir = join(pmFolder, "roadmap", "milestones");
  const indexPath = join(milestonesDir, "milestones.md");
  const vaultRoot = findVaultRoot(pmFolder, ctx.configPath);
  const linkOptions = { pmFolder, vaultRoot };
  const changed = [];

  if (!ctx.dryRun) mkdirSync(milestonesDir, { recursive: true });

  let indexOriginal = existsSync(indexPath)
    ? readFileSync(indexPath, "utf8")
    : milestonesIndexContent({ project, date, linkOptions });
  let indexUpdated = indexOriginal;

  for (const rel of listMilestoneNoteRels(pmFolder)) {
    const abs = join(pmFolder, rel);
    const original = readFileSync(abs, "utf8");
    const withTriggers = ensureMilestoneUpdateTriggers(original);
    if (withTriggers.updated !== original) {
      const updated = touchFrontmatter(withTriggers.updated, date);
      changed.push(rel);
      if (!ctx.dryRun) writeFileSync(abs, updated);
      ctx.log("done", `${rel}: inserted Update Triggers`);
    }
    indexUpdated = ensureMilestonesIndexLink(indexUpdated, {
      slug: milestoneSlugFromRel(rel),
      linkOptions,
      description: `${milestoneSlugFromRel(rel)} milestone`,
    }).updated;
  }

  const active = activeMilestoneInfo({ pmFolder, project, configPath: ctx.configPath });
  if (active && !existsSync(active.abs)) {
    const content = milestoneNoteContent({
      project,
      slug: active.slug,
      phase: active.phase,
      date,
      linkOptions,
    });
    changed.push(active.rel);
    if (!ctx.dryRun) writeFileSync(active.abs, content);
    ctx.log("done", `${active.rel}: created active milestone`);
    indexUpdated = ensureMilestonesIndexLink(indexUpdated, {
      slug: active.slug,
      linkOptions,
      description: `Active ${active.phase} milestone`,
    }).updated;
  }

  if (indexUpdated !== indexOriginal || !existsSync(indexPath)) {
    indexUpdated = touchFrontmatter(indexUpdated, date);
    if (!ctx.dryRun) writeFileSync(indexPath, indexUpdated);
    ctx.log("done", "roadmap/milestones/milestones.md: updated milestone index");
  }

  return {
    suggestedHistory: [
      `- **Milestones are now agent-maintained live PM state.** chore(pm): apply migration \`1.13.1-agent-maintained-milestones\` to add milestone update triggers, ensure the active milestone exists, and refresh the milestones index (${changed.length} milestone note(s) touched).`,
    ],
    manualReview: [],
  };
}

export default {
  id: "1.13.1-agent-maintained-milestones",
  from: "1.13.0",
  to: "1.13.1",
  describe:
    "Make milestone notes agent-maintained live PM state. Adds `## Update Triggers`, creates the active milestone note when missing, and updates the milestones index without touching history or archive notes.",
  detect,
  plan,
  apply,
};
