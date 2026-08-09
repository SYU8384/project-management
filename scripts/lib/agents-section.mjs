/**
 * Shared rendering inputs for the portable AGENTS.md `## PM folder`
 * section. The template (`templates/AGENTS_PM_SECTION.md`) carries a
 * `{{PUBLIC_REPO_BLOCK}}` placeholder that expands only for projects
 * registered with `visibility: "public"` in projects.json; for private
 * or unset visibility it renders to an empty string.
 */

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
