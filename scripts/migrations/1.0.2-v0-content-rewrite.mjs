/**
 * migrations/1.0.2-v0-content-rewrite.mjs
 *
 * Rewrite v0.x body text and frontmatter fields that the v1.0.0 migration
 * missed. The v1.0.0 migration handled folder moves, file renames, and
 * wikilink targets; this migration handles the prose-level cleanup that
 * requires content-aware rewriting (folder-note body text, feature-page
 * section headers, README rows, plan H1s, v0.x frontmatter fields).
 *
 * Scope: deterministic string rewrites only. Items that require human
 * judgement (plan status/body mismatch, decision content authoring,
 * mis-copied feature body text) are surfaced as MANUAL REVIEW warnings
 * and listed in `apply()`'s `manualReview` return value.
 *
 * Idempotent: re-running on a project that has already been migrated to
 * v1.0.2 conventions is a no-op.
 *
 * Out of scope: archive/ and history/ content (immutable by design).
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function listMdFiles(root, skipDirs = []) {
  const out = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        const rel = relative(root, abs);
        if (skipDirs.some((s) => rel === s || rel.startsWith(s + sep))) continue;
        walk(abs);
      } else if (e.isFile() && e.name.endsWith(".md")) {
        out.push(abs);
      }
    }
  }
  walk(root);
  return out;
}

function readFile(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function writeFile(path, content, ctx) {
  if (ctx.dryRun) {
    ctx.log("write", relative(ctx.pmFolder, path));
    return true;
  }
  try {
    writeFileSync(path, content);
    ctx.log("wrote", relative(ctx.pmFolder, path));
    return true;
  } catch (err) {
    ctx.log("error", `failed to write ${relative(ctx.pmFolder, path)}: ${err.message}`);
    return false;
  }
}

// Rewrite a multi-line frontmatter field that contains a YAML list. Matches
// inline (`[a, b]`) and block (`- a\n- b`) styles. Returns {updated, changed}.
function rewriteFrontmatterListField(rawFm, key, regex, replacement) {
  const inlineRe = new RegExp(`(\\n${key}:\\s*)\\[([^\\]]*)\\]`);
  const blockRe = new RegExp(`(\\n${key}:)\\n((?:\\s+-\\s+.*\\n?)+)`);

  let changed = false;
  let updated = rawFm;

  const inlineMatch = updated.match(inlineRe);
  if (inlineMatch) {
    const items = inlineMatch[2].split(",").map((s) => s.trim()).filter(Boolean);
    const newItems = items.map((it) => {
      const r = it.replace(regex, replacement);
      if (r !== it) changed = true;
      return r;
    });
    if (changed) {
      updated = updated.replace(inlineRe, `$1[${newItems.join(", ")}]`);
    }
  }

  const blockMatch = updated.match(blockRe);
  if (blockMatch) {
    const lines = blockMatch[2].split("\n").filter(Boolean);
    const newLines = lines.map((line) => {
      const m = line.match(/^(\s+-\s+)(.*)$/);
      if (!m) return line;
      const r = m[2].replace(regex, replacement);
      if (r !== m[2]) changed = true;
      return `${m[1]}${r}`;
    });
    if (changed) {
      updated = updated.replace(blockRe, `$1\n${newLines.join("\n")}\n`);
    }
  }

  return { updated, changed };
}

function rewriteFrontmatterSingleLineField(rawFm, key, regex, replacement) {
  const re = new RegExp(`(\\n${key}:\\s*)([^\\n]+)`);
  const m = rawFm.match(re);
  if (!m) return { updated: rawFm, changed: false };
  const newVal = m[2].replace(regex, replacement);
  if (newVal === m[2]) return { updated: rawFm, changed: false };
  return { updated: rawFm.replace(re, `$1${newVal}`), changed: true };
}

// ---------------------------------------------------------------------------
// Detect
// ---------------------------------------------------------------------------

function detect({ pmFolder }) {
  const decisionsMd = join(pmFolder, "decisions", "decisions.md");
  const plansMd = join(pmFolder, "roadmap", "plans", "plans.md");
  const archiveMd = join(pmFolder, "archive", "archive.md");

  if (existsSync(decisionsMd)) {
    const c = readFile(decisionsMd);
    if (c && (c.includes("Architecture Decision Records (ADRs) for") || c.includes("## Decisions Log"))) return true;
  }

  if (existsSync(plansMd)) {
    const c = readFile(plansMd);
    if (c && /^# planning\s*$/m.test(c)) return true;
    if (c && !c.includes("## Conventions")) return true;
  }

  if (existsSync(archiveMd)) {
    const c = readFile(archiveMd);
    if (c && /or planning docs\./.test(c)) return true;
  }

  const skipDirs = ["archive", "history", ".pm"];
  for (const file of listMdFiles(pmFolder, skipDirs)) {
    const c = readFile(file);
    if (!c) continue;
    if (c.includes("## Relevant ADRs")) return true;
    if (c.includes("> No ADRs yet.")) return true;
    if (c.includes("templates/ADR.md")) return true;
    if (/\n(current_behavior_source|source_of_truth|related):\s*[^\n]*planning\//.test(c)) return true;
    if (/^tags:\s*\[[^\]]*\b(wip|deprecated)\b[^\]]*\]/m.test(c)) return true;
    if (/\nstatus:\s*in-progress\s*$/m.test(c)) return true;
  }

  const decisionsDir = join(pmFolder, "decisions");
  if (existsSync(decisionsDir)) {
    for (const f of readdirSync(decisionsDir).filter((x) => x.startsWith("D-") && x.endsWith(".md"))) {
      const c = readFile(join(decisionsDir, f));
      if (!c) continue;
      if (c.includes("## Implementation Notes")) return true;
      if (c.includes("## Alternatives considered")) return true;
      if (/^title:\s*ADR-\d+:/m.test(c)) return true;
      if (/^# ADR-\d+:/m.test(c)) return true;
    }
  }

  const plansDir = join(pmFolder, "roadmap", "plans");
  if (existsSync(plansDir)) {
    for (const f of readdirSync(plansDir).filter((x) => x.endsWith(".md"))) {
      if (f === "plans.md") continue;
      const stem = f.replace(/\.md$/, "");
      const c = readFile(join(plansDir, f));
      if (!c) continue;
      const h1Match = c.match(/^# (.+?)\s*$/m);
      if (!h1Match) continue;
      if (h1Match[1].trim() !== stem) return true;
    }
  }

  for (const file of listMdFiles(pmFolder, skipDirs)) {
    const c = readFile(file);
    if (!c) continue;
    for (const line of c.split("\n")) {
      const opens = (line.match(/\[\[/g) || []).length;
      const closes = (line.match(/\]\]/g) || []).length;
      if (opens > closes) return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

function plan({ pmFolder }) {
  const lines = [];
  const skipDirs = ["archive", "history", ".pm"];

  const decisionsMd = join(pmFolder, "decisions", "decisions.md");
  if (existsSync(decisionsMd)) {
    const c = readFile(decisionsMd);
    if (c && c.includes("Architecture Decision Records (ADRs) for")) {
      lines.push("Rewrite decisions/decisions.md: replace v0.x ADR-monoculture intro with v1.0.0 typed-decision language");
    }
    if (c && c.includes("## Decisions Log")) {
      lines.push("Rewrite decisions/decisions.md: remove the v0.x ## Decisions Log section");
    }
  }

  const plansMd = join(pmFolder, "roadmap", "plans", "plans.md");
  if (existsSync(plansMd)) {
    const c = readFile(plansMd);
    if (c && /^# planning\s*$/m.test(c)) {
      lines.push("Rewrite roadmap/plans/plans.md: H1 # planning → # plans; title: planning → title: plans");
    }
    if (c && !c.includes("## Conventions")) {
      lines.push("Rewrite roadmap/plans/plans.md: add ## Conventions section (filename, H1, status values, archived field, cross-link, decisions cited not duplicated)");
    }
  }

  const archiveMd = join(pmFolder, "archive", "archive.md");
  if (existsSync(archiveMd)) {
    const c = readFile(archiveMd);
    if (c && /or planning docs\./.test(c)) {
      lines.push("Rewrite archive/archive.md: replace \"or planning docs.\" with v1.0.0 lane naming");
    }
  }

  let featurePagesToFix = 0;
  for (const file of listMdFiles(pmFolder, skipDirs)) {
    const c = readFile(file);
    if (!c) continue;
    if (c.includes("## Relevant ADRs") || c.includes("> No ADRs yet.") || c.includes("templates/ADR.md")) {
      featurePagesToFix++;
    }
  }
  if (featurePagesToFix > 0) {
    lines.push(`Rewrite ${featurePagesToFix} file(s): ## Relevant ADRs → ## Relevant Decisions, > No ADRs yet. → > No decisions yet., templates/ADR.md → templates/decision.md`);
  }

  let fmToFix = 0;
  for (const file of listMdFiles(pmFolder, skipDirs)) {
    const c = readFile(file);
    if (!c) continue;
    if (/\n(current_behavior_source|source_of_truth|related):\s*[^\n]*planning\//.test(c)) {
      fmToFix++;
    }
  }
  if (fmToFix > 0) {
    lines.push(`Rewrite frontmatter fields (current_behavior_source, source_of_truth, related) in ${fmToFix} file(s): planning/ → roadmap/plans/`);
  }

  let tagsToFix = 0;
  for (const file of listMdFiles(pmFolder, skipDirs)) {
    const c = readFile(file);
    if (!c) continue;
    if (/^tags:\s*\[[^\]]*\b(wip|deprecated)\b[^\]]*\]/m.test(c)) {
      tagsToFix++;
    }
  }
  if (tagsToFix > 0) {
    lines.push(`Drop v0.x tags (wip, deprecated) from ${tagsToFix} file(s)`);
  }

  let statusToFix = 0;
  for (const file of listMdFiles(pmFolder, skipDirs)) {
    const c = readFile(file);
    if (!c) continue;
    if (/\nstatus:\s*in-progress\s*$/m.test(c)) statusToFix++;
  }
  if (statusToFix > 0) {
    lines.push(`Fix invalid status: in-progress → active in ${statusToFix} file(s)`);
  }

  let brokenLinksToFix = 0;
  for (const file of listMdFiles(pmFolder, skipDirs)) {
    const c = readFile(file);
    if (!c) continue;
    for (const line of c.split("\n")) {
      const opens = (line.match(/\[\[/g) || []).length;
      const closes = (line.match(/\]\]/g) || []).length;
      if (opens > closes) brokenLinksToFix++;
    }
  }
  if (brokenLinksToFix > 0) {
    lines.push(`Repair ${brokenLinksToFix} broken wikilink line(s) with missing ]]`);
  }

  const decisionsDir = join(pmFolder, "decisions");
  let decisionsBodyToFix = 0;
  let decisionTitlesToFix = 0;
  if (existsSync(decisionsDir)) {
    for (const f of readdirSync(decisionsDir).filter((x) => x.startsWith("D-") && x.endsWith(".md"))) {
      const c = readFile(join(decisionsDir, f));
      if (!c) continue;
      if (c.includes("## Implementation Notes")) decisionsBodyToFix++;
      if (c.includes("## Alternatives considered")) decisionsBodyToFix++;
      if (/^title:\s*ADR-\d+:/m.test(c)) decisionTitlesToFix++;
      if (/^# ADR-\d+:/m.test(c)) decisionTitlesToFix++;
    }
  }
  if (decisionsBodyToFix > 0) {
    lines.push(`Rewrite ${decisionsBodyToFix} decision file(s): ## Implementation Notes → ## Realization Notes; ## Alternatives considered → ## Options Considered`);
  }
  if (decisionTitlesToFix > 0) {
    lines.push(`Rewrite ${decisionTitlesToFix} decision title/H1: ADR-NNN: … → D-NNN: …`);
  }

  let planH1ToFix = 0;
  const plansDir = join(pmFolder, "roadmap", "plans");
  if (existsSync(plansDir)) {
    for (const f of readdirSync(plansDir).filter((x) => x.endsWith(".md"))) {
      if (f === "plans.md") continue;
      const stem = f.replace(/\.md$/, "");
      const c = readFile(join(plansDir, f));
      if (!c) continue;
      const h1Match = c.match(/^# (.+?)\s*$/m);
      if (!h1Match) continue;
      if (h1Match[1].trim() !== stem) planH1ToFix++;
    }
  }
  if (planH1ToFix > 0) {
    lines.push(`Rewrite ${planH1ToFix} plan H1(s) to slug-only (matching filename stem). Original descriptive title preserved as ## Summary section.`);
  }

  const donePendingMd = join(pmFolder, "roadmap", "done-pending.md");
  if (existsSync(donePendingMd)) {
    const c = readFile(donePendingMd);
    if (c && /^## \d{4}-\d{2}-\d{2}_[a-z0-9-]+\s*$/m.test(c)) {
      lines.push("Rewrite roadmap/done-pending.md: date-prefixed ## YYYY-MM-DD_slug section headers → slug-only ## slug");
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

function processGenericFile(file, ctx) {
  const original = readFile(file);
  if (!original) return false;
  let updated = original;
  let changed = false;

  function applyTransform(label, fn) {
    const before = updated;
    const after = fn(updated);
    if (after !== null && after !== before) {
      updated = after;
      changed = true;
      ctx.log(label, relative(ctx.pmFolder, file));
    }
  }

  applyTransform("relevant-adrs", (c) => {
    if (!c.includes("## Relevant ADRs") && !c.includes("> No ADRs yet.") && !c.includes("templates/ADR.md")) return null;
    let u = c;
    let k = false;
    if (u.includes("## Relevant ADRs")) {
      u = u.replace(/## Relevant ADRs/g, "## Relevant Decisions");
      k = true;
    }
    if (u.includes("> No ADRs yet.")) {
      u = u.replace(/> No ADRs yet\./g, "> No decisions yet.");
      k = true;
    }
    if (u.includes("templates/ADR.md")) {
      u = u.replace(/templates\/ADR\.md/g, "templates/decision.md");
      k = true;
    }
    return k ? u : null;
  });

  applyTransform("fm-paths", (c) => {
    if (!/\n(current_behavior_source|source_of_truth|related):\s*[^\n]*planning\//.test(c)) return null;
    let raw = c;
    let k = false;
    for (const key of ["current_behavior_source", "source_of_truth"]) {
      const r = rewriteFrontmatterSingleLineField(raw, key, /planning\//g, "roadmap/plans/");
      if (r.changed) { raw = r.updated; k = true; }
    }
    const r = rewriteFrontmatterListField(raw, "related", /planning\//g, "roadmap/plans/");
    if (r.changed) { raw = r.updated; k = true; }
    return k ? raw : null;
  });

  applyTransform("tags", (c) => {
    const m = c.match(/^tags:\s*\[([^\]]*)\]\s*$/m);
    if (!m) return null;
    const items = m[1].split(",").map((s) => s.trim()).filter(Boolean);
    const filtered = items.filter((it) => it !== "wip" && it !== "deprecated");
    if (filtered.length === items.length) return null;
    if (filtered.length === 0) return c.replace(m[0], "");
    return c.replace(m[0], `tags: [${filtered.join(", ")}]`);
  });

  applyTransform("status", (c) => {
    if (!/\nstatus:\s*in-progress\s*$/m.test(c)) return null;
    return c.replace(/\nstatus:\s*in-progress\s*$/m, "\nstatus: active");
  });

  applyTransform("wikilinks", (c) => {
    const lines = c.split("\n");
    let k = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const opens = (line.match(/\[\[/g) || []).length;
      const closes = (line.match(/\]\]/g) || []).length;
      if (opens > closes) {
        lines[i] = line + "]]".repeat(opens - closes);
        k = true;
      }
    }
    return k ? lines.join("\n") : null;
  });

  if (changed) writeFile(file, updated, ctx);
  return changed;
}

function processDecisionsFolderNote(file, ctx) {
  const original = readFile(file);
  if (!original) return false;
  let updated = original;
  let k = false;

  const oldIntroMatch = updated.match(/Architecture Decision Records \(ADRs\) for[^\n]*\n(?:Each ADR captures[^\n]*\n)?(?:ADRs are short records[^\n]*\n?)?/);
  if (oldIntroMatch) {
    const newIntro =
      "Record of decisions made for the project. Typed entries (ADR / PRD / MKT / VND / POL / NEG / EXP) capture one significant decision each: context, options, the call, and the consequences. ADRs are one type, not the only kind. See SKILL.md \"PM-folder rules\" for the type legend and `templates/decision.md` for the body shape.";
    updated = updated.replace(oldIntroMatch[0], newIntro + "\n");
    k = true;
    ctx.log("intro", relative(ctx.pmFolder, file));
  }

  const logSection = updated.match(/## Decisions Log\n[\s\S]*?(?=\n## |\n*$)/);
  if (logSection) {
    updated = updated.replace(logSection[0], "");
    k = true;
    ctx.log("decisions-log-removed", relative(ctx.pmFolder, file));
  }

  const aliasFixed = updated.replace(
    /aliases:\s*\[[^\]]*\bplanning\/decisions\b[^\]]*\]/,
    (m) => m.replace(/\bplanning\/decisions\b,?\s*/, "").replace(/\[\s*,/, "[").replace(/,\s*\]/, "]"),
  );
  if (aliasFixed !== updated) {
    updated = aliasFixed;
    k = true;
    ctx.log("alias-cleanup", relative(ctx.pmFolder, file));
  }

  if (k) writeFile(file, updated, ctx);
  return k;
}

function processPlansFolderNote(file, ctx) {
  const original = readFile(file);
  if (!original) return false;
  let updated = original;
  let k = false;

  if (/^# planning\s*$/m.test(updated)) {
    updated = updated.replace(/^# planning\s*$/m, "# plans");
    k = true;
    ctx.log("h1", relative(ctx.pmFolder, file));
  }
  if (/^title:\s*planning\s*$/m.test(updated)) {
    updated = updated.replace(/^title:\s*planning\s*$/m, "title: plans");
    k = true;
    ctx.log("title", relative(ctx.pmFolder, file));
  }

  if (!updated.includes("## Conventions")) {
    const conventions = `## Conventions

- **Filename:** \`YYYY-MM-DD_slug.md\` (date prefix from \`created:\` frontmatter). See \`templates/decision.md\` for decision filenames.
- **H1:** the slug only (no number, no date prefix).
- **Status:** \`proposed\` for plans not yet approved; \`active\` for in-flight plans; \`shipped\` for plans where all work is done and the file is kept for historical reference; \`rejected\` for proposals that were declined; \`superseded\` for plans replaced by a newer plan or decision. These five values are planning-specific; the global schema documents them in \`SKILL.md\` "Frontmatter Schema → Planning".
- **Archived field:** when a planning file moves to \`archive/\`, set \`archived: <date>\` in the frontmatter (the date of the move). The \`status\` field is **not** changed: a shipped-then-archived plan keeps \`status: shipped\`; a rejected-then-archived plan keeps \`status: rejected\`; a superseded-then-archived plan keeps \`status: superseded\`. \`archived:\` is the file-location marker; \`status:\` is the lifecycle marker. They are orthogonal.
- **Archive rename:** when retiring, rename to \`archive/<slug>-archived.md\` (drop the date prefix, preserve the slug, append \`-archived\`) — this rename rule is mandatory and is documented in \`SKILL.md\` "Planning To Roadmap Sync".
- **Owner:** typically \`PM\`. Use \`Platform team\` or \`Operator\` for plans owned by another team.
- **Cross-link:** when a planning note is approved, add a \`## YYYY-MM-DD_slug\` section to \`roadmap/done-pending.md\` with the planning note link. When it ships, distill durable current truth into \`system/\` and archive the file.
- **Decisions cited, not duplicated:** if the plan records a significant decision, write a typed \`decisions/D-NNN_<type>_<slug>.md\` and link it from the plan's Related section. Do not restate the decision's reasoning in the plan.

`;
    const navIdx = updated.indexOf("## Navigation");
    if (navIdx !== -1) {
      updated = updated.slice(0, navIdx) + conventions + updated.slice(navIdx);
      k = true;
      ctx.log("conventions-added", relative(ctx.pmFolder, file));
    }
  }

  if (k) writeFile(file, updated, ctx);
  return k;
}

function processArchiveFolderNote(file, ctx) {
  const original = readFile(file);
  if (!original || !/or planning docs\./.test(original)) return false;
  const updated = original.replace(/or planning docs\./g, "or `roadmap/plans/` and `decisions/` docs.");
  writeFile(file, updated, ctx);
  return true;
}

function processDonePending(file, ctx) {
  const original = readFile(file);
  if (!original) return false;
  const updated = original.replace(
    /^## (\d{4}-\d{2}-\d{2}_)([a-z0-9-]+)\s*$/gm,
    "## $2",
  );
  if (updated === original) return false;
  writeFile(file, updated, ctx);
  return true;
}

function processDecisionFile(file, ctx) {
  const original = readFile(file);
  if (!original) return false;
  let updated = original;
  let k = false;

  const titleMatch = updated.match(/^title:\s*"?\s*(ADR-\d+:.*?)"?\s*$/m);
  if (titleMatch) {
    const oldTitle = titleMatch[1];
    const newTitle = oldTitle.replace(/^ADR-(\d+):/, "D-$1:");
    updated = updated.replace(titleMatch[0], `title: "${newTitle}"`);
    k = true;
  }
  const h1Match = updated.match(/^# (ADR-\d+:.*)$/m);
  if (h1Match) {
    const oldH1 = h1Match[1];
    const newH1 = oldH1.replace(/^ADR-(\d+):/, "D-$1:");
    updated = updated.replace(h1Match[0], `# ${newH1}`);
    k = true;
  }
  if (updated.includes("## Implementation Notes")) {
    updated = updated.replace(/## Implementation Notes/g, "## Realization Notes");
    k = true;
  }
  if (updated.includes("## Alternatives considered")) {
    updated = updated.replace(/## Alternatives considered/g, "## Options Considered");
    k = true;
  }

  if (k) writeFile(file, updated, ctx);
  return k;
}

function processPlanFile(file, ctx) {
  const original = readFile(file);
  if (!original) return false;
  const h1Match = original.match(/^# (.+?)\s*$/m);
  if (!h1Match) return false;
  const h1 = h1Match[1].trim();
  const stem = file.replace(/\.md$/, "").split(sep).pop();
  if (h1 === stem) return false;

  let updated = original.replace(h1Match[0], `# ${stem}`);
  if (!updated.includes("## Summary")) {
    const fmMatch = updated.match(/^---\n[\s\S]*?\n---\n/);
    if (fmMatch) {
      const insertAt = fmMatch.index + fmMatch[0].length;
      updated = updated.slice(0, insertAt) +
        `\n## Summary\n\n${h1}\n` +
        updated.slice(insertAt);
    }
  }
  writeFile(file, updated, ctx);
  return true;
}

function apply({ pmFolder, ctx }) {
  const skipDirs = ["archive", "history", ".pm"];
  const manualReview = [];

  const decisionsMd = join(pmFolder, "decisions", "decisions.md");
  const plansMd = join(pmFolder, "roadmap", "plans", "plans.md");
  const archiveMd = join(pmFolder, "archive", "archive.md");
  const donePendingMd = join(pmFolder, "roadmap", "done-pending.md");
  const decisionsDir = join(pmFolder, "decisions");
  const plansDir = join(pmFolder, "roadmap", "plans");

  processDecisionsFolderNote(decisionsMd, ctx);
  processPlansFolderNote(plansMd, ctx);
  processArchiveFolderNote(archiveMd, ctx);
  processDonePending(donePendingMd, ctx);

  if (existsSync(decisionsDir)) {
    for (const f of readdirSync(decisionsDir).filter((x) => x.startsWith("D-") && x.endsWith(".md"))) {
      processDecisionFile(join(decisionsDir, f), ctx);
    }
  }

  if (existsSync(plansDir)) {
    for (const f of readdirSync(plansDir).filter((x) => x.endsWith(".md"))) {
      if (f === "plans.md") continue;
      processPlanFile(join(plansDir, f), ctx);
    }
  }

  for (const file of listMdFiles(pmFolder, skipDirs)) {
    if (file === decisionsMd || file === plansMd || file === archiveMd || file === donePendingMd) continue;
    if (file.startsWith(decisionsDir + sep)) continue;
    if (file.startsWith(plansDir + sep)) continue;
    processGenericFile(file, ctx);
  }

  for (const file of listMdFiles(pmFolder, skipDirs)) {
    if (!file.includes("/roadmap/plans/")) continue;
    const f = relative(pmFolder, file);
    if (f.endsWith("/plans.md")) continue;
    const c = readFile(file);
    if (!c) continue;
    const fmMatch = c.match(/^status:\s*(.+?)\s*$/m);
    if (!fmMatch) continue;
    const fmStatus = fmMatch[1];
    if (/SUPERSEDED by/i.test(c) && fmStatus === "active") {
      manualReview.push(`${f}: frontmatter status: active but body says "SUPERSEDED by …". v1.0.0 expects status: superseded. Review and update by hand.`);
    }
    if (/NOT YET APPROVED/i.test(c) && fmStatus === "active") {
      manualReview.push(`${f}: frontmatter status: active but body says "NOT YET APPROVED". v1.0.0 expects status: proposed. Review and update by hand.`);
    }
    if (/DRAFT \(/.test(c) && fmStatus === "active") {
      manualReview.push(`${f}: frontmatter status: active but body says "DRAFT". v1.0.0 expects status: proposed. Review and update by hand.`);
    }
    if (c.includes("## Decisions Locked")) {
      manualReview.push(`${f}: contains "## Decisions Locked" section that duplicates decision-record content. v1.0.0 says "Decisions cited, not duplicated" — split each row into decisions/D-NNN_<type>_<slug>.md and cite from the plan's Related section.`);
    }
    if (c.includes("## Decisions (all explicit")) {
      manualReview.push(`${f}: contains "## Decisions (all explicit, …)" section with inline decisions. v1.0.0 says these are typed decisions/D-NNN_<type>_<slug>.md files, not plan content. Split each decision into its own file.`);
    }
  }

  const knownIssuesMd = join(pmFolder, "roadmap", "known-issues.md");
  if (existsSync(knownIssuesMd)) {
    const c = readFile(knownIssuesMd);
    if (c) {
      const lines = c.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*[-*]\s*\[[ x]\]\s+/.test(line) &&
            /\b(possible|could|if .* happens|risk of)\b/i.test(line) &&
            !/observed|repro|test|customer|alert/i.test(line)) {
          manualReview.push(`roadmap/known-issues.md:${i + 1}: theoretical-risk wording in known-issues entry ("possible" / "could" / "if X happens"). v1.0.0 says "observed defects only". Move to ideas.md, or reword to an observed incident.`);
        }
      }
    }
  }

  return {
    suggestedHistory: [
      "- chore(pm): apply v1.0.2-v0-content-rewrite migration to refresh v0.x body text and frontmatter after the v1.0.0 lane restructure.",
    ],
    manualReview,
  };
}

export default {
  id: "1.0.2-v0-content-rewrite",
  from: "1.0.0",
  to: "1.0.2",
  describe:
    "Rewrite v0.x body text and frontmatter fields that the v1.0.0 migration missed: decisions/decisions.md intro, plans.md H1 and conventions, archive/archive.md phrasing, ## Relevant ADRs → ## Relevant Decisions, > No ADRs yet. → > No decisions yet., templates/ADR.md → templates/decision.md, frontmatter current_behavior_source/source_of_truth/related paths (planning/ → roadmap/plans/), v0.x tags (wip, deprecated), status: in-progress → active, decision body shape (## Implementation Notes → ## Realization Notes, ## Alternatives considered → ## Options Considered), decision title/H1 (ADR-NNN: → D-NNN:), plan H1 → slug-only, broken wikilinks, and done-pending.md date-prefixed section headers. Surfaces manual-review items: plan status/body mismatches, decision content authoring, known-issues theoretical-risk wording.",
  detect,
  plan,
  apply,
};