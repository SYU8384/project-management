import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import { resolveProjectsConfigPath } from "./paths.mjs";

export function parseProjectTargetArgs(argv, { allowFix = false, allowStrict = false } = {}) {
  const args = argv.slice(2);
  const out = { vault: null, config: null, project: null, fix: false, strict: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" || args[i] === "-c") out.config = args[++i];
    else if (args[i] === "--project" || args[i] === "-p") out.project = args[++i];
    else if (allowFix && args[i] === "--fix") out.fix = true;
    else if (allowStrict && args[i] === "--strict") out.strict = true;
    else if (!args[i].startsWith("-")) out.vault = args[i];
  }
  return out;
}

export function isTemplateConfig(cfg) {
  const projects = cfg.projects ?? {};
  return Object.keys(projects).length === 0 || Object.prototype.hasOwnProperty.call(projects, "<ProjectName>");
}

export function configSetupError(project, configPath, cfg, reason) {
  const setupHint = isTemplateConfig(cfg)
    ? "This looks like the default empty projects.json template. "
    : "";
  return (
    `ERROR: ${reason} in ${configPath}\n` +
    `${setupHint}Run the project-management skill and say "setup as collaborator" or "setup this repo", ` +
    `or add a real projects.${project} entry with access and pm_folder.`
  );
}

export function resolveConfigPath(cli) {
  if (cli.vault) return null;
  return resolveProjectsConfigPath(cli.config ? resolve(cli.config) : null);
}

export function resolveTargets(cli, { fallbackToCwd = true } = {}) {
  const configPath = resolveConfigPath(cli);
  if (!configPath) {
    const target = resolve(cli.vault ?? process.cwd());
    return [{ vault: target, label: target, project: basename(target) }];
  }
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  if (cli.project) {
    const proj = cfg.projects?.[cli.project];
    if (!proj) throw new Error(configSetupError(cli.project, configPath, cfg, `project '${cli.project}' not found`));
    if (!proj.pm_folder) throw new Error(configSetupError(cli.project, configPath, cfg, `project '${cli.project}' has no pm_folder`));
    return [{ vault: resolve(proj.pm_folder), label: `${cli.project} (${proj.pm_folder})`, project: cli.project, configPath, config: cfg, entry: proj }];
  }
  const targets = Object.entries(cfg.projects ?? {})
    .filter(([, proj]) => Boolean(proj.pm_folder))
    .map(([project, proj]) => ({
      vault: resolve(proj.pm_folder),
      label: `${project} (${proj.pm_folder})`,
      project,
      configPath,
      config: cfg,
      entry: proj,
    }));
  if (!fallbackToCwd && targets.length === 0) return [];
  return targets;
}

export function requireExistingConfig(configPath) {
  if (!configPath || !existsSync(configPath)) {
    throw new Error(`projects.json not found. Expected ${configPath ?? "~/.config/project-management/projects.json"}.`);
  }
  return JSON.parse(readFileSync(configPath, "utf8"));
}
