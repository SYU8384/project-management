/**
 * migrations/1.8.0-parent-subfolder-links.mjs
 *
 * One-shot repair: for each folder note, ensure its parent folder
 * note's `## Subfolders` section has a wikilink to it. Closes the
 * "Folder Note Parent Link Violations" finding in
 * `check-vault-structure.mjs`.
 *
 * Idempotent: re-running on a project where every parent already has
 * the wikilink is a no-op.
 */
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { ensureParentLinksToChild } from "../lib/content-semantic-fixers.mjs";
import { findVaultRoot } from "../lib/paths.mjs";

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

function isFolderNote(rel) {
  const stem = rel.replace(/\.md$/, "");
  const parts = stem.split("/");
  return parts[parts.length - 1] === parts[parts.length - 2];
}

function detect({ pmFolder }) {
  const files = walkAllMd(pmFolder);
  const vaultRoot = findVaultRoot(pmFolder);
  for (const { rel: childRel } of files) {
    if (!isFolderNote(childRel)) continue;
    const parts = childRel.split("/");
    if (parts.length < 3) continue;  // top-level folder note, no parent
    const ancestorParts = parts.slice(0, -2);  // e.g. ['archive'] for 'archive/handoffs/handoffs.md'
    const parentRel = [...ancestorParts, ancestorParts[ancestorParts.length - 1] + ".md"].join("/");
    const parentContent = existsSync(join(pmFolder, parentRel))
      ? readFileSync(join(pmFolder, parentRel), "utf8")
      : null;
    if (parentContent === null) continue;
    const result = ensureParentLinksToChild(parentContent, childRel, { pmFolder, vaultRoot });
    if (result.changes.length > 0) return true;
  }
  return false;
}

function plan({ pmFolder }) {
  return [
    `For each child folder note, ensure its parent folder note's \`## Subfolders\` section has a wikilink to it.`,
    `Closes the "Folder Note Parent Link Violations" finding in \`check-vault-structure.mjs\`.`,
  ];
}

function apply({ pmFolder, ctx: c }) {
  ctx = c;
  const files = walkAllMd(pmFolder);
  const vaultRoot = findVaultRoot(pmFolder);
  const log = [];
  let totalChanges = 0;
  for (const { rel: childRel } of files) {
    if (!isFolderNote(childRel)) continue;
    const parts = childRel.split("/");
    if (parts.length < 3) continue;  // top-level folder note, no parent
    const ancestorParts = parts.slice(0, -2);
    const parentRel = [...ancestorParts, ancestorParts[ancestorParts.length - 1] + ".md"].join("/");
    const parentAbs = join(pmFolder, parentRel);
    if (!existsSync(parentAbs)) continue;
    const parentContent = readFileSync(parentAbs, "utf8");
    const result = ensureParentLinksToChild(parentContent, childRel, { pmFolder, vaultRoot });
    if (result.changes.length > 0) {
      if (!ctx.dryRun) writeFileSync(parentAbs, result.updated);
      log.push(`${parentRel}: ${result.changes[0]}`);
      totalChanges += 1;
    }
  }
  if (totalChanges > 0) {
    c.log("done", `${totalChanges} parent link(s) added`);
  } else {
    c.log("skip", "no parent-link drift found");
  }
  return {
    suggestedHistory: [
      `- chore(pm): apply migration \`1.8.0-parent-subfolder-links\` — added ${totalChanges} parent subfolder link(s) to bring every folder note's parent index in line with the "Folder Note Parent Link Violations" check.`,
    ],
    manualReview: [],
  };
}

export default {
  id: "1.8.0-parent-subfolder-links",
  from: "<1.8.0",
  to: "1.8.0",
  describe:
    "For each folder note, ensure its parent folder note's `## Subfolders` section has a wikilink to it. Closes the `check-vault-structure.mjs` \"Folder Note Parent Link Violations\" finding. Idempotent.",
  detect,
  plan,
  apply,
};
