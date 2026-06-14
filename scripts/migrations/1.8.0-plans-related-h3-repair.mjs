/**
 * migrations/1.8.0-plans-related-h3-repair.mjs
 *
 * One-shot repair migration: demote any existing `## Related` H2 in a
 * folder note (e.g. `roadmap/plans/plans.md`) to `### Related` H3. This
 * closes the v1.7.0 migration-quirk where the
 * `1.0.2-v0-content-rewrite.mjs` migration emitted `## Conventions` +
 * `## Related` as a single H2 block, pushing folder notes over the
 * 4-section limit enforced by `check-vault-structure.mjs`.
 *
 * The v1.8.0 patch to `1.0.2-v0-content-rewrite.mjs` emits `### Related`
 * for future applications. This migration brings existing files into
 * the corrected shape.
 *
 * Idempotent: re-running on a file that already has H3 `### Related` is
 * a no-op.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";

let ctx;

function walkAllMd(root) {
  const out = [];
  function rec(abs) {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const child = join(abs, entry.name);
      if (entry.isDirectory()) rec(child);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push({ abs: child, rel: child.slice(root.length + 1).split("\\").join("/") });
      }
    }
  }
  rec(root);
  return out;
}

function demoteRelatedH2(content) {
  // Match `## Related` only when it's an H2 (not preceded by another `#`).
  const re = /\n## Related\s*\n/g;
  if (!re.test(content)) {
    return { updated: content, changes: [] };
  }
  const updated = content.replace(re, "\n### Related\n");
  // Update the Contents TOC if it references `[[#Related]]`.
  let afterToc = updated;
  if (afterToc.includes("[[#Related]]")) {
    // `[[#Related]]` is an H2 anchor. The anchor is the slugified heading
    // text, so we have to rewrite it to `[[#Related]]` against the H3.
    // Obsidian resolves anchors case-insensitively, but for the wiki
    // link to still work, the literal `[[#Related]]` is sufficient for
    // H3 headings (the `#` link prefix still works).
    // No edit needed.
  }
  return {
    updated: afterToc,
    changes: ["demoted `## Related` H2 to `### Related` H3"],
  };
}

function detect({ pmFolder }) {
  const files = walkAllMd(pmFolder);
  for (const { abs } of files) {
    const content = readFileSync(abs, "utf8");
    if (/\n## Related\s*\n/.test(content)) return true;
  }
  return false;
}

function plan({ pmFolder }) {
  return [
    `Demote any \`## Related\` H2 to \`### Related\` H3 across all .md files in this PM folder.`,
    `Closes the v1.7.0 folder-note shape violation caused by the 1.0.2-v0-content-rewrite.mjs migration emitting \`## Conventions\` + \`## Related\` as a single H2 block.`,
  ];
}

function apply({ pmFolder, ctx: c }) {
  ctx = c;
  const files = walkAllMd(pmFolder);
  const log = [];
  let totalChanges = 0;
  for (const { abs, rel } of files) {
    if (!existsSync(abs)) continue;
    const original = readFileSync(abs, "utf8");
    const result = demoteRelatedH2(original);
    if (result.changes.length > 0) {
      if (!ctx.dryRun) writeFileSync(abs, result.updated);
      log.push(`${rel}: ${result.changes[0]}`);
      totalChanges += 1;
    }
  }
  if (totalChanges > 0) {
    c.log("done", `${totalChanges} file(s) had \`## Related\` demoted to H3`);
  } else {
    c.log("skip", "no `## Related` H2 found in PM folder");
  }
  return {
    suggestedHistory: [
      `- **Folder notes no longer exceed the H2 shape limit because of Related sections.** chore(pm): apply migration \`1.8.0-plans-related-h3-repair\` and demote \`## Related\` H2 to \`### Related\` H3 in ${totalChanges} file(s). Closes the v1.7.0 folder-note shape violation introduced by the 1.0.2-v0-content-rewrite.mjs migration.`,
    ],
    manualReview: [],
  };
}

export default {
  id: "1.8.0-plans-related-h3-repair",
  from: "<1.8.0",
  to: "1.8.0",
  describe:
    "One-shot repair: demote `## Related` H2 to `### Related` H3 in any folder note. Closes the v1.7.0 folder-note shape violation (5 H2s > 4-section limit) caused by the `1.0.2-v0-content-rewrite.mjs` migration emitting `## Conventions` + `## Related` as a single H2 block. Idempotent. Companion to the v1.8.0 patch that makes the `1.0.2-v0-content-rewrite.mjs` migration emit `### Related` for future applications.",
  detect,
  plan,
  apply,
};
