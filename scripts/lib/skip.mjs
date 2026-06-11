/**
 * lib/skip.mjs
 *
 * Shared `.pm/skip` parser for the project-management skill's validators.
 *
 * A `.pm/skip` file in a project's PM folder lists relative paths
 * (typically filenames) that the validators should ignore. Format:
 *
 *   - One entry per line.
 *   - Blank lines are ignored.
 *   - Lines starting with `#` are comments (the first non-comment line is
 *     the file's effective contents; lines starting with `#` anywhere in
 *     the file are comments).
 *   - Entries are matched against either the relative path from the PM
 *     folder root, or just the basename. Both forms are checked so a user
 *     can write `OpenManager.md` to skip a single file or
 *     `history/scratch.md` to scope a skip to a subfolder.
 *   - The `.pm/skip` file itself is always implicitly skipped by the
 *     validators (it's a tooling artifact, not a project doc).
 *
 * Returns an empty list if the file is absent. No error is raised for
 * missing files; this is a per-project customization knob, and most
 * projects will not have one.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SKIP_REL = join(".pm", "skip");

export function getPmSkipPath(pmFolder) {
  return join(pmFolder, SKIP_REL);
}

export function loadPmSkip(pmFolder) {
  const path = getPmSkipPath(pmFolder);
  if (!existsSync(path)) return new Set();
  const raw = readFileSync(path, "utf8");
  const out = new Set();
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    out.add(trimmed);
  }
  return out;
}

/**
 * Return true if `relPath` (relative to pmFolder) should be skipped.
 * Matches both the full relative path and the basename against the
 * loaded skip set.
 */
export function isSkipped(skipSet, relPath) {
  if (skipSet.size === 0) return false;
  if (skipSet.has(relPath)) return true;
  const parts = relPath.split("/");
  const base = parts[parts.length - 1];
  if (skipSet.has(base)) return true;
  return false;
}
