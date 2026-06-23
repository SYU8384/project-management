#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import {
  listMilestoneNoteRels,
  milestoneRelatedNotesState,
  removeDeprecatedMilestoneRelatedNotes,
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

function relatedNotesMilestones(pmFolder) {
  return listMilestoneNoteRels(pmFolder).filter((rel) => {
    const content = readFileSync(join(pmFolder, rel), "utf8");
    return milestoneRelatedNotesState(content, rel).hasSection;
  });
}

function detect({ pmFolder }) {
  return existsSync(join(pmFolder, "roadmap", "milestones")) && relatedNotesMilestones(pmFolder).length > 0;
}

function plan() {
  return [
    "Remove empty or generic-index `## Related Notes` sections from live milestone notes.",
    "Preserve specific `## Related Notes` content and report manual review to integrate those links inline.",
    "Leave `history/` and `archive/` unchanged.",
  ];
}

function apply({ pmFolder, ctx }) {
  const date = today();
  const project = basename(pmFolder);
  const changed = [];
  const manualReview = [];

  for (const rel of listMilestoneNoteRels(pmFolder)) {
    const abs = join(pmFolder, rel);
    const original = readFileSync(abs, "utf8");
    const removal = removeDeprecatedMilestoneRelatedNotes(original, rel);
    manualReview.push(...removal.manualReview);
    if (removal.updated !== original) {
      changed.push(rel);
      if (!ctx.dryRun) writeFileSync(abs, touchFrontmatter(removal.updated, date));
      ctx.log("done", `${rel}: removed deprecated generic Related Notes`);
    }
  }

  return {
    suggestedHistory: [
      `- **Milestone notes now use inline evidence links.** chore(pm): apply migration \`1.13.2-inline-milestone-evidence-links\` to remove generic milestone related-note link dumps and require specific plan, decision, feature, issue, or docs links at the relevant priority, step, exit criterion, or deferred item (${changed.length} ${project} milestone note(s) updated).`,
    ],
    manualReview,
  };
}

export default {
  id: "1.13.2-inline-milestone-evidence-links",
  from: "1.13.1",
  to: "1.13.2",
  describe:
    "Deprecate milestone `## Related Notes` link dumps. Removes empty or generic index-link sections from live milestone notes and reports specific related-note content for manual inline integration without touching history or archive notes.",
  detect,
  plan,
  apply,
};
