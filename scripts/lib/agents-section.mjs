/**
 * Shared portable AGENTS.md `## PM folder` section operations.
 *
 * Keep the section mechanics here so bootstrap, validation, and sync agree
 * on what they render and where the managed section begins and ends. Callers
 * retain their own write, missing-file, and newline policies.
 */

import { isValidAccess } from "./convention.mjs";
import { normalizeMarkdownSection } from "./markdown.mjs";
import { renderTemplateFile } from "./template-renderer.mjs";

export const PUBLIC_REPO_BLOCK = `Repo-canonical docs (this repository is public):
- \`docs/adr/\` (ADRs), \`CONTEXT.md\` (domain glossary), and contributor-facing architecture docs under \`docs/\` are canonical in this repository. Update them in the same change as the code they describe.
- With \`authoritative\` PM access, also record the change in the PM folder: each repo ADR gets a stub in \`decisions/\` (\`decision_type: ADR\`, frontmatter \`repo_path:\` pointing at the repo file) so the PM folder stays the complete decision registry.
- Never copy PM-private content into this repository: PRD/MKT/VND/POL/NEG/EXP decisions, roadmap plans and priorities, history, TEAM.md, inbox, and known-issues stay in the PM folder.`;

export function agentsSectionReplacements(project = {}) {
  return {
    "{{PUBLIC_REPO_BLOCK}}":
      project.visibility === "public" ? `\n${PUBLIC_REPO_BLOCK}\n` : "",
  };
}

export function portablePmSectionTemplate(access) {
  return isValidAccess(access) ? "AGENTS_PM_SECTION.md" : null;
}

export function renderPortablePmSection(templateDir, project = {}) {
  const template = portablePmSectionTemplate(project.access);
  if (!template) return null;
  if (!templateDir) throw new Error("template directory is required to render the portable PM section");
  return renderTemplateFile(templateDir, template, agentsSectionReplacements(project));
}

export function findPortablePmSection(content) {
  const startMatch = content.match(/^## PM folder\s*$/m);
  if (!startMatch) return null;
  const start = startMatch.index;
  const afterHeading = start + startMatch[0].length;
  const rest = content.slice(afterHeading);
  const nextMatch = rest.match(/\n## /);
  const end = nextMatch ? afterHeading + nextMatch.index : content.length;
  return { start, end, text: content.slice(start, end) };
}

export function portablePmSectionMatches(section, expected) {
  return normalizeMarkdownSection(section.text) === normalizeMarkdownSection(expected);
}

export function replacePortablePmSection(content, section, replacement) {
  return content.slice(0, section.start) + replacement + content.slice(section.end);
}
