/**
 * migrations/1.0.0-lane-restructure.mjs
 *
 * First registered migration. Restructures the PM-folder layout:
 *   - planning/                          → roadmap/plans/
 *   - planning/decisions/                → decisions/  (top-level)
 *   - ADR-NNN_<slug>.md                  → D-NNN_ADR_<slug>.md
 *   - Frontmatter pageType: adr          → pageType: decision, decision_type: ADR
 *
 * Wikilink rewrites:
 *   - [[…/planning/<x>]]         → [[…/roadmap/plans/<x>]]
 *   - [[…/planning/decisions/<x>]] → [[…/decisions/<x>]]
 *
 * Out of scope (preserved as-is):
 *   - archive/  (immutable; broken links surface in the validator)
 *   - history/  (immutable; broken links surface in the validator)
 *   - decisions/decisions.md body text (rebuild it manually if desired)
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { execFileSync } from "node:child_process";

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

function isInGitRepo(pmFolder) {
  try {
    execFileSync("git", ["-C", pmFolder, "rev-parse", "--show-toplevel"], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function gitMv(srcRel, dstRel, pmFolder) {
  execFileSync("git", ["-C", pmFolder, "mv", srcRel, dstRel], { stdio: "inherit" });
}

function moveDir(srcAbs, dstAbs, ctx) {
  if (srcAbs === dstAbs) return;
  if (!existsSync(srcAbs)) return;
  if (ctx.dryRun) {
    ctx.log(`move`, `${relative(ctx.pmFolder, srcAbs)} → ${relative(ctx.pmFolder, dstAbs)}`);
    return;
  }
  if (ctx.isGit) {
    gitMv(relative(ctx.pmFolder, srcAbs), relative(ctx.pmFolder, dstAbs), ctx.pmFolder);
  } else {
    renameSync(srcAbs, dstAbs);
  }
  ctx.log(`moved`, `${relative(ctx.pmFolder, srcAbs)} → ${relative(ctx.pmFolder, dstAbs)}`);
}

function detect({ pmFolder }) {
  const hasPlanning = existsSync(join(pmFolder, "planning"));
  const hasPlanningDecisions = existsSync(join(pmFolder, "planning", "decisions"));
  const hasRoadmapPlans = existsSync(join(pmFolder, "roadmap", "plans"));
  const hasDecisions = existsSync(join(pmFolder, "decisions"));
  if (!hasPlanning && !hasPlanningDecisions) return false;
  if (hasRoadmapPlans && hasDecisions && !hasPlanning && !hasPlanningDecisions) return false;
  return true;
}

function plan({ pmFolder }) {
  const lines = [];
  if (existsSync(join(pmFolder, "planning"))) {
    lines.push(`Move planning/ → roadmap/plans/`);
  }
  if (existsSync(join(pmFolder, "planning", "decisions"))) {
    lines.push(`Move planning/decisions/ → decisions/ (top-level, peers with roadmap/)`);
  }
  const decisionsDir = existsSync(join(pmFolder, "decisions"))
    ? join(pmFolder, "decisions")
    : existsSync(join(pmFolder, "planning", "decisions"))
    ? join(pmFolder, "planning", "decisions")
    : null;
  if (decisionsDir) {
    const adrs = readdirSync(decisionsDir).filter((f) => /^ADR-\d+_/.test(f));
    if (adrs.length) {
      lines.push(`Rename ${adrs.length} ADR file(s) to D-NNN_ADR_<slug>.md and update frontmatter`);
    }
  }
  lines.push(`Rewrite [[…/planning/…]] wikilinks → [[…/roadmap/plans/…]] in non-archive, non-history .md files`);
  lines.push(`Rewrite [[…/planning/decisions/…]] wikilinks → [[…/decisions/…]] in non-archive, non-history .md files`);
  lines.push(`Preserve archive/ and history/ untouched (broken links, if any, surface in the validator)`);
  return lines;
}

function apply({ pmFolder, ctx }) {
  ctx.log(`start`, `pm-folder=${pmFolder}`);
  ctx.isGit = isInGitRepo(pmFolder);
  ctx.pmFolder = pmFolder;

  if (!ctx.dryRun) {
    moveDir(
      join(pmFolder, "planning"),
      join(pmFolder, "roadmap", "plans"),
      ctx,
    );

    const planningDecisionsSrc = join(pmFolder, "roadmap", "plans", "decisions");
    const decisionsDst = join(pmFolder, "decisions");
    if (existsSync(planningDecisionsSrc) && !existsSync(decisionsDst)) {
      moveDir(planningDecisionsSrc, decisionsDst, ctx);
    } else if (existsSync(planningDecisionsSrc) && existsSync(decisionsDst)) {
      ctx.log(`skip`, `roadmap/plans/decisions already exists; manual merge required`);
    }

    if (existsSync(decisionsDst)) {
      const entries = readdirSync(decisionsDst).filter((f) => /^ADR-\d+_/.test(f));
      for (const oldName of entries) {
        const newName = oldName.replace(/^ADR-(\d+)_/, "D-$1_ADR_");
        const src = join(decisionsDst, oldName);
        const dst = join(decisionsDst, newName);
        renameSync(src, dst);
        ctx.log(`renamed`, `${oldName} → ${newName}`);
      }
    }
  } else {
    if (existsSync(join(pmFolder, "planning"))) {
      ctx.log(`move`, `planning → roadmap/plans`);
    }
    if (existsSync(join(pmFolder, "planning", "decisions"))) {
      ctx.log(`move`, `planning/decisions → decisions`);
    }
    const decSrc =
      existsSync(join(pmFolder, "planning", "decisions"))
        ? join(pmFolder, "planning", "decisions")
        : existsSync(join(pmFolder, "decisions"))
        ? join(pmFolder, "decisions")
        : null;
    if (decSrc) {
      for (const f of readdirSync(decSrc).filter((x) => /^ADR-\d+_/.test(x))) {
        ctx.log(`rename`, `${f} → ${f.replace(/^ADR-(\d+)_/, "D-$1_ADR_")}`);
      }
    }
  }

  const decisionsDst = existsSync(join(pmFolder, "decisions"))
    ? join(pmFolder, "decisions")
    : null;
  if (decisionsDst) {
    const decisionFiles = readdirSync(decisionsDst).filter(
      (f) => f.startsWith("D-") && f.endsWith(".md"),
    );
    for (const file of decisionFiles) {
      const abs = join(decisionsDst, file);
      const original = readFileSync(abs, "utf8");
      let updated = original;
      updated = updated.replace(/^pageType:\s*adr\s*$/m, "pageType: decision");
      updated = updated.replace(/^decision_type:\s*ADR\s*$/m, "");
      if (!/^decision_type:/m.test(updated)) {
        updated = updated.replace(
          /^pageType:\s*decision\s*$/m,
          "pageType: decision\ndecision_type: ADR",
        );
      }
      if (updated !== original) {
        if (ctx.dryRun) {
          ctx.log(`rewrite frontmatter`, `decisions/${file}`);
        } else {
          writeFileSync(abs, updated);
          ctx.log(`rewrote frontmatter`, `decisions/${file}`);
        }
      }
    }
  }

  const skipDirs = ["archive", "history"];
  const files = listMdFiles(pmFolder, skipDirs);
  let changedFiles = 0;
  let changedLinks = 0;
  for (const file of files) {
    const original = readFileSync(file, "utf8");
    let updated = original;
    const mappings = [
      ["/planning/decisions/", "/decisions/"],
      ["/planning/", "/roadmap/plans/"],
    ];
    for (const [from, to] of mappings) {
      const re = new RegExp(escapeRegExp(from), "g");
      const matches = updated.match(re);
      if (matches && matches.length) {
        updated = updated.split(from).join(to);
        changedLinks += matches.length;
      }
    }
    if (updated !== original) {
      changedFiles++;
      if (ctx.dryRun) {
        ctx.log(`rewrite links`, relative(pmFolder, file));
      } else {
        writeFileSync(file, updated);
        ctx.log(`rewrote links`, relative(pmFolder, file));
      }
    }
  }
  ctx.log(`summary`, `links: ${changedLinks} across ${changedFiles} files`);

  return {
    suggestedHistory: [
      "- **Planning notes and decisions now live in their modern PM lanes.** chore(pm): migrate planning/ to roadmap/plans/ and generalize planning/decisions/ to decisions/ as a typed first-class PM lane at root (migration 1.0.0-lane-restructure).",
    ],
  };
}

export default {
  id: "1.0.0-lane-restructure",
  from: "<1.0.0",
  to: "1.0.0",
  describe:
    "Move planning/ → roadmap/plans/; promote planning/decisions/ to decisions/ at the project root; rename ADR-NNN_*.md to D-NNN_ADR_*.md; rewrite frontmatter (pageType: adr → pageType: decision, decision_type: ADR); rewrite [[…/planning/…]] wikilinks. archive/ and history/ are preserved untouched.",
  detect,
  plan,
  apply,
};
