import { resolve } from "node:path";

import { parseProjectTargetArgs, resolveConfigPath, resolveTargets } from "./targets.mjs";

function readOption(args, names) {
  for (let i = 0; i < args.length; i++) {
    if (names.includes(args[i])) return args[i + 1] ?? null;
  }
  return null;
}

function findPositionalVault(args) {
  const valueFlags = new Set([
    "--config",
    "-c",
    "--project",
    "-p",
    "--pm-folder",
    "--migration",
    "--allow-no-impact",
    "--since",
  ]);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (valueFlags.has(arg)) {
      i++;
      continue;
    }
    if (!arg.startsWith("-")) return arg;
  }
  return null;
}

function resolvedConfigArgs(cli) {
  const configPath = resolveConfigPath(cli);
  return configPath ? ["--config", configPath] : [];
}

export function expandMigrationTargetArgs(args) {
  const cli = parseProjectTargetArgs(["node", "check-pm.mjs", ...args], {
    allowFix: true,
    allowStrict: true,
  });

  const pmFolder = readOption(args, ["--pm-folder"]);
  if (pmFolder) {
    return [
      {
        label: resolve(pmFolder),
        args: ["--pm-folder", resolve(pmFolder), ...resolvedConfigArgs(cli)],
      },
    ];
  }

  const positionalVault = findPositionalVault(args);
  if (positionalVault) {
    return [
      {
        label: resolve(positionalVault),
        args: ["--pm-folder", resolve(positionalVault), ...resolvedConfigArgs(cli)],
      },
    ];
  }

  const targets = resolveTargets(cli, { fallbackToCwd: false });
  return targets.map((target) => {
    if (target.configPath) {
      return {
        label: target.project,
        args: ["--project", target.project, "--config", target.configPath],
      };
    }
    return {
      label: target.vault,
      args: ["--pm-folder", target.vault],
    };
  });
}

export function buildMigrationArgs(migrationId, targetArgs, { dryRun = false, force = false } = {}) {
  const args = ["--migration", migrationId, "--yes", ...targetArgs];
  if (dryRun) args.push("--dry-run");
  if (force) args.push("--force");
  return args;
}
