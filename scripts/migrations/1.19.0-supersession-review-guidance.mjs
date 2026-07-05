#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REVIEW_SENTENCE =
  "Before creating or materially changing a durable plan, decision, or feature page, add `## Supersession Review` and record whether it supersedes existing PM state, is related but does not supersede it, or has no predecessor.";

function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function writeIfChanged(path, content, ctx, label) {
  const original = readIfExists(path);
  if (original === null || original === content) return false;
  if (!ctx.dryRun) writeFileSync(path, content);
  ctx.log("done", label, "added supersession review guidance");
  return true;
}

function insertAfterHeading(content, heading, text) {
  if (/supersession review/i.test(content)) return content;
  const re = new RegExp(`(^## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$\\n)`, "m");
  if (!re.test(content)) return content;
  return content.replace(re, `$1\n${text}\n\n`);
}

function appendConvention(content, bullet) {
  if (/supersession review/i.test(content)) return content;
  if (/^## Conventions\s*$/m.test(content)) {
    return content.replace(/^## Conventions\s*$/m, `## Conventions\n\n${bullet}`);
  }
  if (/^## Navigation\s*$/m.test(content)) {
    return content.replace(/^## Navigation\s*$/m, `## Conventions\n\n${bullet}\n\n## Navigation`);
  }
  return `${content.replace(/\s+$/g, "")}\n\n## Conventions\n\n${bullet}\n`;
}

function updateReadme(content) {
  const note = `> **Supersession review:** ${REVIEW_SENTENCE}`;
  return insertAfterHeading(content, "Quick Rules", note);
}

function updatePlans(content) {
  return appendConvention(
    content,
    `- **Supersession review:** ${REVIEW_SENTENCE} If the new plan absorbs older plan scope, apply the superseded-by pattern and mark the older plan \`status: superseded\`.`
  );
}

function updateDecisions(content) {
  return appendConvention(
    content,
    "- **Supersession review:** decisions include `## Supersession Review`. If a new decision changes an existing accepted/active decision, set `supersedes: D-NNN` and mark the prior decision `status: superseded`."
  );
}

function updateFeatures(content) {
  return appendConvention(
    content,
    "- **Supersession review:** feature pages include `## Supersession Review`. If a new feature page replaces an older feature page, mark the older page `status: deprecated` and link the replacement."
  );
}

const TARGETS = [
  ["README.md", updateReadme],
  ["roadmap/plans/plans.md", updatePlans],
  ["decisions/decisions.md", updateDecisions],
  ["features/features.md", updateFeatures],
];

function detect({ pmFolder }) {
  return TARGETS.some(([rel, update]) => {
    const content = readIfExists(join(pmFolder, rel));
    return content !== null && update(content) !== content;
  });
}

function plan({ pmFolder }) {
  const targets = TARGETS
    .filter(([rel, update]) => {
      const content = readIfExists(join(pmFolder, rel));
      return content !== null && update(content) !== content;
    })
    .map(([rel]) => rel);
  return [
    `Add supersession-review guidance to ${targets.length} live PM folder guide note(s).`,
    "No user-authored planning, decision, feature, history, or archive bodies are rewritten.",
  ];
}

function apply({ pmFolder, ctx }) {
  const changed = [];
  for (const [rel, update] of TARGETS) {
    const abs = join(pmFolder, rel);
    const content = readIfExists(abs);
    if (content === null) continue;
    const updated = update(content);
    if (writeIfChanged(abs, updated, ctx, rel)) changed.push(rel);
  }

  return {
    suggestedHistory: [
      `- **PM guides now ask agents to check supersession before filing durable artifacts.** docs(pm): apply migration \`1.19.0-supersession-review-guidance\` to refresh ${changed.length} live PM folder guide note(s) with plan/decision/feature supersession-review guidance.`,
    ],
  };
}

export default {
  id: "1.19.0-supersession-review-guidance",
  from: "<1.19.0",
  to: "1.19.0",
  describe:
    "Refresh live PM folder guide notes so plans, decisions, and feature pages include a supersession review before durable artifact changes.",
  detect,
  plan,
  apply,
};

export const __test = {
  updateReadme,
  updatePlans,
  updateDecisions,
  updateFeatures,
};
