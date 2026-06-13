/**
 * lib/paths.mjs
 *
 * Shared path-resolution helpers for project-management scripts.
 *
 * Path precedence for `projects.json`:
 *   1. Explicit `--config <path>` argument (highest priority).
 *   2. `~/.config/project-management/projects.json` (user-specific XDG path).
 *
 * The skill-root `projects.json` is **not** read. v1.3.0+ treats the
 * XDG user location as canonical. Existing users moving from a pre-v1.3.0
 * install should `mv <skill_dir>/projects.json ~/.config/project-management/projects.json`
 * once; see CHANGELOG.md [1.3.0] for details.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

/**
 * Resolve the directory containing this `paths.mjs` file. Used to find the
 * skill root when callers need it (e.g. to read `templates/`).
 */
function libDir() {
  return dirname(fileURLToPath(import.meta.url));
}

/**
 * Resolve the skill root (the directory containing SKILL.md).
 * Walks up from `scripts/lib/` until it finds SKILL.md, or returns null.
 */
export function findSkillDir() {
  let current = libDir();
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(current, "SKILL.md"))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

/**
 * The user-specific configuration directory.
 * XDG-conformant: `~/.config/project-management/` on all platforms.
 * (On macOS, this is non-standard; the canonical macOS location would be
 *  `~/Library/Application Support/project-management/`. We accept the XDG
 *  path everywhere for consistency.)
 */
export function getUserConfigDir() {
  return join(homedir(), ".config", "project-management");
}

/**
 * The user-specific `projects.json` path.
 */
export function getUserProjectsConfigPath() {
  return join(getUserConfigDir(), "projects.json");
}

/**
 * Resolve the `projects.json` path with strict precedence:
 *   1. `explicitConfigPath` (from `--config <path>` flag).
 *   2. The user-specific XDG location.
 *
 * Returns null if the resolved path does not exist on disk. Callers
 * should treat null as "no projects.json found" and surface a clear error.
 */
export function resolveProjectsConfigPath(explicitConfigPath) {
  const candidates = [];
  if (explicitConfigPath) {
    candidates.push(explicitConfigPath);
  }
  candidates.push(getUserProjectsConfigPath());
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

/**
 * Discover the Obsidian vault root for a PM folder.
 *
 * Priority:
 *   1. If `configPath` is provided and resolves, read `vault_root` from
 *      `projects.json`. Return it if the directory exists.
 *   2. Walk up from `pmFolder` looking for a `.obsidian` directory.
 *      The directory containing `.obsidian` is the vault root.
 *   3. Fall back to `pmFolder` itself.
 */
export function findVaultRoot(pmFolder, configPath = null) {
  if (configPath) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, "utf8"));
      if (cfg.vault_root && existsSync(cfg.vault_root)) {
        return cfg.vault_root;
      }
    } catch {
      // ignore malformed config
    }
  }
  let current = pmFolder;
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(current, ".obsidian"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return pmFolder;
}