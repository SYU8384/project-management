import { basename } from "node:path";

export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const out = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

export function stripFrontmatter(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n?/);
  return match ? content.slice(match[0].length) : content;
}

export function countH2Sections(content) {
  const body = stripFrontmatter(content);
  return (body.match(/^## .+$/gm) ?? []).length;
}

export function hasH2(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^## ${escaped}$`, "m").test(stripFrontmatter(content));
}

export function replaceSectionBody(content, section, newValue) {
  const headingRe = new RegExp(`^## ${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
  const match = content.match(headingRe);
  if (!match) return content;
  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextH2 = rest.match(/\n## /);
  const end = start + (nextH2 ? nextH2.index : rest.length);
  return `${content.slice(0, start)}\n\n${newValue}\n${content.slice(end)}`.replace(/\n{3,}/g, "\n\n");
}

export function wikiLinks(content) {
  return [...content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)].map((match) => match[1]);
}

export function markdownStem(relPath) {
  return basename(relPath, ".md");
}

export function normalizeMarkdownSection(content) {
  return content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}
