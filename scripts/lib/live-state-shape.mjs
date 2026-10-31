import {
  CURRENT_STATUS_SECTIONS,
  MILESTONE_REQUIRED_SECTIONS,
} from "./convention.mjs";
import { stripFrontmatter } from "./markdown.mjs";

export const LIVE_STATE_REVIEW_BUDGETS = Object.freeze({
  status: 160,
  milestone: 240,
});

const COMMIT_LEDGER_RE = /\bImplementation commits?\s*:/gi;

export function h2Sections(content) {
  const body = stripFrontmatter(String(content ?? "")).replace(/\r\n/g, "\n");
  const matches = [...body.matchAll(/^##\s+(.+?)\s*$/gm)];
  return matches.map((match, index) => {
    const bodyStart = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : body.length;
    return {
      heading: match[1].trim(),
      body: body.slice(bodyStart, end).trim(),
    };
  });
}

function lineCount(content) {
  return String(content ?? "").replace(/\r\n/g, "\n").split("\n").length;
}

export function checkLiveNoteShape(content, { kind }) {
  if (!["status", "milestone"].includes(kind)) {
    throw new Error(`Unknown live-note kind: ${kind}`);
  }
  const allowed = kind === "status" ? CURRENT_STATUS_SECTIONS : MILESTONE_REQUIRED_SECTIONS;
  const sections = h2Sections(content);
  const issues = [];
  const warnings = [];
  const seen = new Set();

  for (const section of sections) {
    if (!allowed.includes(section.heading)) {
      issues.push({
        code: "unexpected-section",
        message: `unexpected implementation/journal section \`## ${section.heading}\`; use history or the owning plan`,
      });
    }
    if (seen.has(section.heading)) {
      issues.push({ code: "duplicate-heading", message: `duplicate H2 \`## ${section.heading}\`` });
    }
    seen.add(section.heading);
  }

  const ledgerCount = String(content ?? "").match(COMMIT_LEDGER_RE)?.length ?? 0;
  if (ledgerCount > 0) {
    issues.push({
      code: "commit-ledger",
      message: `${ledgerCount} implementation-commit ledger reference(s); keep the canonical ledger in history and, when useful, the owning plan`,
    });
  }

  const lines = lineCount(content);
  const budget = LIVE_STATE_REVIEW_BUDGETS[kind];
  if (lines > budget) {
    warnings.push({
      code: "size-review",
      message: `${lines} lines exceeds the ${budget}-line review budget; compact or split through the human-approved reorganization workflow`,
    });
  }

  return { issues, warnings, lines, sections };
}

function normalizedDuplicateBody(body) {
  return String(body ?? "").trim().replace(/\s+/g, " ");
}

export function duplicateLiveSections(leftContent, rightContent, { ignoredHeadings = [] } = {}) {
  const ignored = new Set(ignoredHeadings);
  const right = new Map();
  for (const section of h2Sections(rightContent)) {
    const normalized = normalizedDuplicateBody(section.body);
    if (normalized.length >= 120) right.set(`${section.heading}\0${normalized}`, true);
  }
  const duplicates = [];
  for (const section of h2Sections(leftContent)) {
    if (ignored.has(section.heading)) continue;
    const normalized = normalizedDuplicateBody(section.body);
    if (normalized.length < 120) continue;
    if (right.has(`${section.heading}\0${normalized}`)) duplicates.push(section.heading);
  }
  return [...new Set(duplicates)];
}

export const STATUS_MILESTONE_SHARED_SCAFFOLD = Object.freeze([
  ...CURRENT_STATUS_SECTIONS,
  ...MILESTONE_REQUIRED_SECTIONS,
  "Navigation",
]);
