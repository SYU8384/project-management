import { existsSync } from "node:fs";
import { basename, join, relative } from "node:path";

export function normalizeFsPath(value) {
  return String(value ?? "").replace(/\\/g, "/");
}

export function normalizeLinkPath(value) {
  return normalizeFsPath(value)
    .replace(/\.md$/i, "")
    .replace(/^\/+/, "")
    .trim();
}

export function basenameNoExt(relPath) {
  const normalized = normalizeLinkPath(relPath);
  return basename(normalized, ".md");
}

export function vaultRelativeTarget(vaultRoot, absPath) {
  return normalizeLinkPath(relative(vaultRoot, absPath));
}

export function projectPathFromVault(vaultRoot, pmFolder) {
  return vaultRelativeTarget(vaultRoot, pmFolder);
}

export function pmRelToVaultTarget(pmRel, { pmFolder = null, vaultRoot = null, linkRoot = null } = {}) {
  const rel = normalizeLinkPath(pmRel);
  if (!rel) return rel;
  if (pmFolder && vaultRoot) return vaultRelativeTarget(vaultRoot, join(pmFolder, `${rel}.md`));
  if (linkRoot) return `${normalizeLinkPath(linkRoot)}/${rel}`;
  return rel;
}

export function wikiLink(target, display = null, heading = "") {
  const normalizedTarget = normalizeLinkPath(target);
  const headingPart = heading ? `#${heading.trim()}` : "";
  const displayPart = display ? `|${display}` : "";
  return `[[${normalizedTarget}${headingPart}${displayPart}]]`;
}

export function pmWikiLink(pmRel, display = null, options = {}) {
  return wikiLink(pmRelToVaultTarget(pmRel, options), display ?? basenameNoExt(pmRel));
}

export function parseWikiLinkBody(body) {
  const raw = String(body ?? "").trim();
  const pipe = raw.indexOf("|");
  const targetAndHeading = pipe === -1 ? raw : raw.slice(0, pipe);
  const display = pipe === -1 ? null : raw.slice(pipe + 1);
  const hash = targetAndHeading.indexOf("#");
  return {
    raw,
    target: normalizeLinkPath(hash === -1 ? targetAndHeading : targetAndHeading.slice(0, hash)),
    heading: hash === -1 ? "" : targetAndHeading.slice(hash + 1).trim(),
    display,
  };
}

export function renderWikiLinkBody({ target, heading = "", display = null }) {
  const targetPart = normalizeLinkPath(target);
  const headingPart = heading ? `#${heading}` : "";
  const displayPart = display ? `|${display}` : "";
  return `${targetPart}${headingPart}${displayPart}`;
}

export function replaceOutsideInlineCode(line, replacer) {
  const parts = String(line).split(/(`[^`]*`)/g);
  return parts
    .map((part) => (part.startsWith("`") && part.endsWith("`") ? part : replacer(part)))
    .join("");
}

export function stripInlineCode(line) {
  const value = String(line);
  let out = "";
  let inWiki = false;
  for (let i = 0; i < value.length; i++) {
    if (!inWiki && value.startsWith("[[", i)) {
      inWiki = true;
      out += "[[";
      i += 1;
      continue;
    }
    if (inWiki && value.startsWith("]]", i)) {
      inWiki = false;
      out += "]]";
      i += 1;
      continue;
    }
    if (!inWiki && value[i] === "`") {
      const next = value.indexOf("`", i + 1);
      if (next === -1) continue;
      i = next;
      continue;
    }
    out += value[i];
  }
  return out;
}

export function renderedMarkdownLines(content) {
  const rawLines = String(content ?? "").split(/\r?\n/);
  const out = [];
  let inFence = false;
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    if (/^\s*```/.test(raw)) {
      out.push({ line: i + 1, raw, rendered: "" });
      inFence = !inFence;
      continue;
    }
    out.push({
      line: i + 1,
      raw,
      rendered: inFence ? "" : stripInlineCode(raw),
    });
  }
  return out;
}

export function extractRenderedWikiLinks(content) {
  const links = [];
  for (const line of renderedMarkdownLines(content)) {
    const re = /!?\[\[([^\]\n]+)\]\]/g;
    let match;
    while ((match = re.exec(line.rendered))) {
      links.push({ line: line.line, body: match[1], raw: match[0] });
    }
  }
  return links;
}

export function findMalformedWikiSyntax(content) {
  const findings = [];
  for (const line of renderedMarkdownLines(content)) {
    const opens = (line.rendered.match(/\[\[/g) ?? []).length;
    const closes = (line.rendered.match(/\]\]/g) ?? []).length;
    if (opens !== closes) {
      findings.push({
        line: line.line,
        opens,
        closes,
        text: line.raw.trim(),
      });
    }
  }
  return findings;
}

export function fixSimpleMalformedWikiSyntax(content) {
  const changes = [];
  const lines = String(content ?? "").split(/\r?\n/);
  let inFence = false;
  const updatedLines = lines.map((line, index) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    let changed = false;
    const updated = replaceOutsideInlineCode(line, (segment) =>
      segment.replace(/\[\[([^\]\n]+?)\](?!\])/g, (match, body) => {
        changed = true;
        return `[[${body}]]`;
      }),
    );
    if (changed) changes.push(`line ${index + 1}: closed malformed wikilink`);
    return updated;
  });
  return { updated: updatedLines.join("\n"), changes };
}

export function markdownHeadings(content) {
  const headings = [];
  for (const line of String(content ?? "").split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    headings.push(match[2].replace(/\s+#+\s*$/, "").trim());
  }
  return headings;
}

export function headingMatches(headings, heading) {
  const wanted = String(heading ?? "").trim().toLowerCase();
  if (!wanted) return true;
  return headings.some((candidate) => {
    const normalized = candidate.trim().toLowerCase();
    return normalized === wanted || normalized.startsWith(wanted);
  });
}

export function h2HeadingsOutsideMarkedToc(content) {
  const withoutToc = String(content ?? "").replace(
    /<!--\s*vault-maintain:toc:start\s*-->[\s\S]*?<!--\s*vault-maintain:toc:end\s*-->/gm,
    "",
  );
  return [...withoutToc.matchAll(/^##\s+(.+?)\s*$/gm)]
    .map((match) => match[1].trim())
    .filter((heading) => heading !== "Contents");
}

export function syncMarkedH2Toc(content) {
  const changes = [];
  const markerRe = /<!--\s*vault-maintain:toc:start\s*-->[\s\S]*?<!--\s*vault-maintain:toc:end\s*-->/m;
  if (!markerRe.test(content)) return { updated: content, changes };

  const headings = h2HeadingsOutsideMarkedToc(content);
  const toc = [
    "<!-- vault-maintain:toc:start -->",
    "## Contents",
    "",
    ...headings.map((heading) => `- [[#${heading}]]`),
    "<!-- vault-maintain:toc:end -->",
  ].join("\n");
  const updated = content.replace(markerRe, toc);
  if (updated !== content) changes.push("regenerated marked TOC from actual H2 headings");
  return { updated, changes };
}

export function normalizePmRelativeWikiLinks(content, { pmFolder, vaultRoot }) {
  const changes = [];
  const lines = String(content ?? "").split(/\r?\n/);
  let inFence = false;

  const updatedLines = lines.map((line, index) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    return replaceOutsideInlineCode(line, (segment) =>
      segment.replace(/(!?)\[\[([^\]\n]+)\]\]/g, (match, embed, body) => {
        const parsed = parseWikiLinkBody(body);
        if (!parsed.target.includes("/") || !pmFolder || !vaultRoot) return match;
        const candidateAbs = join(pmFolder, `${parsed.target}.md`);
        if (!existsSync(candidateAbs)) return match;
        const target = pmRelToVaultTarget(parsed.target, { pmFolder, vaultRoot });
        if (target === parsed.target) return match;
        const rewritten = `${embed}[[${renderWikiLinkBody({ ...parsed, target })}]]`;
        if (rewritten !== match) {
          changes.push(`line ${index + 1}: rewrote ${parsed.target} -> ${target}`);
        }
        return rewritten;
      }),
    );
  });

  return { updated: updatedLines.join("\n"), changes };
}
