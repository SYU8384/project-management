/**
 * lib/live-routing-fixers.mjs
 *
 * Conservative auto-fixers for live PM navigation drift. These fixers update
 * retired lane paths, normalize `Relevant ADRs:` labels, and link bare
 * decision identifiers only when a unique decision note already exists.
 *
 * History and archive records are intentionally skipped.
 */

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function normalizeRelPath(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/\.md$/i, "")
    .replace(/^\/+/, "")
    .trim();
}

export function basenameNoExt(relPath) {
  const normalized = normalizeRelPath(relPath);
  return normalized.split("/").pop() ?? normalized;
}

export function isHistoricalRel(relPath) {
  const rel = normalizeRelPath(relPath);
  return rel.startsWith("history/") || rel.startsWith("archive/") || rel.startsWith(".pm/");
}

function splitFrontmatter(content) {
  if (!content.startsWith("---\n")) return { frontmatter: "", body: content };
  const end = content.indexOf("\n---", 4);
  if (end === -1) return { frontmatter: "", body: content };
  return {
    frontmatter: content.slice(0, end + 4),
    body: content.slice(end + 4),
  };
}

function decisionRefFromToken(rawToken) {
  const token = String(rawToken ?? "")
    .replace(/\.md$/i, "")
    .replace(/^`|`$/g, "")
    .replace(/[).,;:]+$/g, "")
    .trim();
  const base = basenameNoExt(token);

  const modern = base.match(/^D-(\d{3})(?:[_-]([A-Za-z]+))?(?:[_-](.+))?$/i);
  if (modern) {
    return {
      raw: base,
      display: `D-${modern[1]}`,
      number: modern[1],
      type: modern[2]?.toUpperCase() ?? null,
      slug: modern[3] ?? null,
    };
  }

  const legacyAdr = base.match(/^ADR-(\d{3})(?:[_-](.+))?$/i);
  if (legacyAdr) {
    return {
      raw: base,
      display: `ADR-${legacyAdr[1]}`,
      number: legacyAdr[1],
      type: "ADR",
      slug: legacyAdr[2] ?? null,
    };
  }

  return null;
}

function slugMatches(targetBase, slug) {
  if (!slug) return true;
  const lowerBase = targetBase.toLowerCase();
  const normalizedSlug = String(slug).toLowerCase();
  const underscoreSlug = normalizedSlug.replace(/-/g, "_");
  const hyphenSlug = normalizedSlug.replace(/_/g, "-");
  return (
    lowerBase.includes(normalizedSlug) ||
    lowerBase.includes(underscoreSlug) ||
    lowerBase.includes(hyphenSlug)
  );
}

export function buildDecisionTargets(targets = []) {
  return unique(targets.map(normalizeRelPath))
    .filter((rel) => rel.startsWith("decisions/"))
    .map((rel) => ({
      rel,
      base: basenameNoExt(rel),
      lowerBase: basenameNoExt(rel).toLowerCase(),
    }))
    .filter((target) => /^d-\d{3}(?:_|$)/i.test(target.base));
}

export function findUniqueDecisionTarget(rawToken, targets = []) {
  const ref = decisionRefFromToken(rawToken);
  if (!ref) return { status: "skip", token: rawToken };

  const candidates = buildDecisionTargets(targets).filter((target) => {
    const prefix = `d-${ref.number}`;
    if (!target.lowerBase.startsWith(prefix)) return false;
    if (ref.type && !target.lowerBase.startsWith(`${prefix}_${ref.type.toLowerCase()}`)) return false;
    return slugMatches(target.lowerBase, ref.slug);
  });

  if (candidates.length === 1) return { status: "found", ref, target: candidates[0] };
  if (candidates.length > 1) return { status: "ambiguous", ref, matches: candidates };
  return { status: "missing", ref };
}

function linkForDecision(target, display) {
  return `[[${target.rel}|${display}]]`;
}

function repairDecisionPathReferences(text, targets) {
  const changes = [];
  const manualReview = [];
  let updated = text;

  const decisionPathRe =
    /\b(?:roadmap\/plans\/decisions|planning\/decisions)\/(ADR-\d{3}[A-Za-z0-9_-]*|D-\d{3}[A-Za-z0-9_-]*)/g;
  updated = updated.replace(decisionPathRe, (match, token) => {
    const result = findUniqueDecisionTarget(token, targets);
    if (result.status === "found") {
      const next = result.target.rel;
      if (next !== match) changes.push(`rewrote ${match} -> ${next}`);
      return next;
    }
    if (result.status === "ambiguous") {
      manualReview.push(
        `${match} matched multiple decision targets: ${result.matches.map((m) => m.rel).join(", ")}`,
      );
    } else if (result.status === "missing") {
      manualReview.push(`${match} references a decision target that does not exist`);
    }
    return match;
  });

  return { updated, changes, manualReview };
}

function repairLanePaths(text) {
  const changes = [];
  let updated = text;
  const replacements = [
    [
      /\bplanning\/decisions\/(?!ADR-\d{3}|D-\d{3})/g,
      "decisions/",
      "rewrote planning/decisions/ -> decisions/",
    ],
    [/\bplanning\/decisions\b/g, "decisions", "rewrote planning/decisions -> decisions"],
    [
      /\bplanning\/planning(\.md)?\b/g,
      (_match, ext = "") => `roadmap/plans/plans${ext ?? ""}`,
      "rewrote planning/planning -> roadmap/plans/plans",
    ],
    [/\bplanning\/(?!decisions\/)/g, "roadmap/plans/", "rewrote planning/ -> roadmap/plans/"],
  ];

  for (const [pattern, replacement, label] of replacements) {
    const before = updated;
    updated = updated.replace(pattern, replacement);
    if (updated !== before) changes.push(label);
  }

  return { updated, changes };
}

function repairRelevantAdrLabels(text) {
  const before = text;
  const updated = text.replace(/Relevant ADRs?:/g, "Relevant decisions:");
  return {
    updated,
    changes: updated === before ? [] : ["renamed Relevant ADRs label to Relevant decisions"],
  };
}

function isLikelyFrontmatterLine(line) {
  return /^(title|aliases|tags|created|updated|last_reviewed|pageType|status|owner|source_of_truth|roadmap_source|related|decision_type|date|supersedes|archived):\s*/.test(
    line.trim(),
  );
}

function linkBareDecisionRefsInBody(body, targets) {
  const changes = [];
  const manualReview = [];
  const lines = body.split("\n");
  let inCodeFence = false;
  const tokenRe = /(^|[^\w/|\[])(ADR-\d{3}|D-\d{3})(?![\w/-])/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence || /^\s*#/.test(line) || line.includes("[[") || isLikelyFrontmatterLine(line)) continue;

    lines[i] = line.replace(tokenRe, (match, prefix, token) => {
      const result = findUniqueDecisionTarget(token, targets);
      if (result.status === "found") {
        changes.push(`linked ${token} -> ${result.target.rel}`);
        return `${prefix}${linkForDecision(result.target, token)}`;
      }
      if (result.status === "ambiguous") {
        manualReview.push(
          `line ${i + 1}: ${token} matched multiple decision targets: ${result.matches.map((m) => m.rel).join(", ")}`,
        );
      } else if (result.status === "missing") {
        manualReview.push(`line ${i + 1}: ${token} has no matching decision target`);
      }
      return match;
    });
  }

  return { updated: lines.join("\n"), changes, manualReview };
}

export function repairLiveRoutingDrift(content, relPath, targets = []) {
  if (isHistoricalRel(relPath)) return { updated: content, changes: [], manualReview: [] };

  const changes = [];
  const manualReview = [];
  const { frontmatter, body } = splitFrontmatter(content);
  let workingFrontmatter = frontmatter;
  let workingBody = body;

  for (const segment of ["frontmatter", "body"]) {
    const text = segment === "frontmatter" ? workingFrontmatter : workingBody;
    if (!text) continue;

    const decisionPaths = repairDecisionPathReferences(text, targets);
    let updated = decisionPaths.updated;
    changes.push(...decisionPaths.changes);
    manualReview.push(...decisionPaths.manualReview);

    const lanes = repairLanePaths(updated);
    updated = lanes.updated;
    changes.push(...lanes.changes);

    const labels = repairRelevantAdrLabels(updated);
    updated = labels.updated;
    changes.push(...labels.changes);

    if (segment === "frontmatter") workingFrontmatter = updated;
    else workingBody = updated;
  }

  const linked = linkBareDecisionRefsInBody(workingBody, targets);
  workingBody = linked.updated;
  changes.push(...linked.changes);
  manualReview.push(...linked.manualReview);

  return {
    updated: `${workingFrontmatter}${workingBody}`,
    changes: unique(changes),
    manualReview: unique(manualReview),
  };
}

export function findLiveRoutingDrift(content, relPath) {
  if (isHistoricalRel(relPath)) return [];
  const findings = [];
  const patterns = [
    { label: "dead roadmap/plans/decisions path", re: /roadmap\/plans\/decisions\// },
    { label: "deprecated planning/decisions lane", re: /planning\/decisions\/?/ },
    { label: "deprecated planning/ lane", re: /\bplanning\// },
    { label: "deprecated Relevant ADRs label", re: /Relevant ADRs?:/ },
  ];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of patterns) {
      if (pattern.re.test(lines[i])) findings.push(`line ${i + 1}: ${pattern.label}`);
    }
  }
  return unique(findings);
}
