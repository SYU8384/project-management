/**
 * migrations/1.4.1-unavailable-downgrade.mjs
 *
 * Downgrade legacy `access: "unavailable"` entries in
 * `~/.config/project-management/projects.json` to `access: "read-only"`.
 *
 * v1.4.1 narrowed the `access` enum to two values (`authoritative` /
 * `read-only`) and retired the `unavailable` mode. The v1.4.1 patch was
 * doc-only and did not include a migration to translate legacy entries.
 * New entries get the strict enum check; old entries with `unavailable`
 * fail validation under `check-agents.mjs` and `check-pm-consistency.mjs`.
 *
 * Idempotent: re-running on a projects.json that has already been
 * downgraded is a no-op (the `detect()` returns false).
 *
 * Conservative default: every `unavailable` entry becomes `read-only`.
 * Users who actually own the PM folder can re-run
 * `bootstrap-pm.mjs --access authoritative --project <name>` to upgrade.
 * The `manualReview` line in the result calls this out.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { resolveProjectsConfigPath } from "../lib/paths.mjs";

function loadProjectsConfig(ctx) {
  const configPath = ctx?.configPath ?? resolveProjectsConfigPath(null);
  if (!configPath || !existsSync(configPath)) return null;
  let raw;
  try {
    raw = readFileSync(configPath, "utf8");
  } catch {
    return null;
  }
  try {
    return { configPath, cfg: JSON.parse(raw) };
  } catch {
    return null;
  }
}

function findUnavailableEntries(cfg) {
  const projects = cfg?.projects ?? {};
  const out = [];
  for (const [name, proj] of Object.entries(projects)) {
    if (proj && proj.access === "unavailable") {
      out.push(name);
    }
  }
  return out;
}

function detect({ pmFolder, ctx }) {
  const loaded = loadProjectsConfig(ctx);
  if (!loaded) return false;
  return findUnavailableEntries(loaded.cfg).length > 0;
}

function plan({ pmFolder, ctx }) {
  const loaded = loadProjectsConfig(ctx);
  const lines = [
    `Read projects.json and downgrade every \`access: "unavailable"\` to \`access: "read-only"\`.`,
  ];
  if (!loaded) {
    lines.push(`(no projects.json found — nothing to do)`);
    return lines;
  }
  const unavailable = findUnavailableEntries(loaded.cfg);
  if (unavailable.length === 0) {
    lines.push(`(no \`access: "unavailable"\` entries found — nothing to do)`);
  } else {
    for (const name of unavailable) {
      lines.push(`Project: ${name} — access \`unavailable\` → \`read-only\``);
    }
    lines.push(
      `If any project was a pre-v1.4.1 authoritative project, re-run \`bootstrap-pm.mjs --access authoritative --project <name>\` to upgrade.`
    );
  }
  return lines;
}

function apply({ pmFolder, ctx }) {
  const loaded = loadProjectsConfig(ctx);
  if (!loaded) {
    ctx.log(`skip`, `no projects.json found`);
    return {};
  }
  const { configPath, cfg } = loaded;
  const unavailable = findUnavailableEntries(cfg);
  if (unavailable.length === 0) {
    ctx.log(`skip`, `no \`access: "unavailable"\` entries in ${configPath}`);
    return {};
  }

  for (const name of unavailable) {
    cfg.projects[name].access = "read-only";
    if (ctx.dryRun) {
      ctx.log(`rewrite`, `${name}: access \`unavailable\` → \`read-only\``);
    } else {
      ctx.log(`rewrite`, `${name}: access \`unavailable\` → \`read-only\``);
    }
  }

  if (!ctx.dryRun) {
    writeFileSync(configPath, `${JSON.stringify(cfg, null, 2)}\n`);
    ctx.log(`summary`, `wrote ${configPath} (${unavailable.length} entr${unavailable.length === 1 ? "y" : "ies"} downgraded)`);
  }

  return {
    suggestedHistory: [
      `- fix(pm): downgrade legacy \`access: "unavailable"\` entries to \`access: "read-only"\` (migration \`1.4.1-unavailable-downgrade\`). Downgraded ${unavailable.length} project entr${unavailable.length === 1 ? "y" : "ies"}: ${unavailable.join(", ")}.`,
    ],
    manualReview: [
      `Rewrote ${unavailable.length} project entr${unavailable.length === 1 ? "y" : "ies"}: ${unavailable.join(", ")}. If any was a pre-v1.4.1 authoritative project, re-run \`bootstrap-pm.mjs --access authoritative --project <name>\` to upgrade.`,
    ],
  };
}

export default {
  id: "1.4.1-unavailable-downgrade",
  from: "<1.4.1",
  to: "1.4.1",
  describe:
    "Downgrade legacy `access: \"unavailable\"` entries in projects.json to `access: \"read-only\"` (conservative default; users who actually own the PM folder can re-run `bootstrap-pm.mjs --access authoritative --project <name>` to upgrade). Closes the v1.4.1 enum-narrowing migration gap.",
  detect,
  plan,
  apply,
};
