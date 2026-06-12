import { readFileSync } from "node:fs";
import { join } from "node:path";

export function renderTemplateFile(templateDir, filename, replacements = {}) {
  let content = readFileSync(join(templateDir, filename), "utf8");
  return renderTemplate(content, replacements);
}

export function renderTemplate(content, replacements = {}) {
  let rendered = content;
  for (const [from, to] of Object.entries(replacements)) {
    rendered = rendered.split(from).join(String(to ?? ""));
  }
  return rendered;
}

export function unresolvedPlaceholders(content) {
  return [...content.matchAll(/<([A-Za-z][A-Za-z0-9_ -]*)>/g)]
    .map((match) => match[0])
    .filter((value, index, all) => all.indexOf(value) === index)
    .sort();
}
