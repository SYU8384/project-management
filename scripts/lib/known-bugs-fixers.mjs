const TOP_LEVEL_SECTIONS = new Set([
  "Recurring Root-Cause Patterns",
  "Active Bugs",
  "Fixed Bugs",
  "Deferred / Monitoring",
  "Manual Review",
  "Navigation",
]);

const SECTION_FIELDS = {
  "Recurring Root-Cause Patterns": ["Status", "Symptoms", "Root cause", "Solution", "Seen in", "References"],
  "Active Bugs": ["Status", "Symptoms", "Root cause", "Current workaround", "Next action", "References"],
  "Fixed Bugs": ["Status", "Symptoms", "Root cause", "Solution", "Verification", "References"],
  "Deferred / Monitoring": ["Status", "Symptoms", "Reason deferred", "Trigger to reopen", "References"],
};

const SECTION_STATUSES = {
  "Recurring Root-Cause Patterns": new Set(["active", "fixed", "monitoring"]),
  "Active Bugs": new Set(["active"]),
  "Fixed Bugs": new Set(["fixed"]),
  "Deferred / Monitoring": new Set(["deferred", "monitoring"]),
};

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitByHeadings(content, marker) {
  const parts = [];
  const regex = new RegExp(`^${marker} (?!#)(.+?)\\s*$`, "gm");
  let last = 0;
  let lastHeading = null;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (lastHeading !== null) {
      parts.push({ name: lastHeading, text: content.slice(last, match.index) });
    }
    last = match.index;
    lastHeading = match[1].trim();
  }
  if (lastHeading !== null) {
    parts.push({ name: lastHeading, text: content.slice(last) });
  }
  return parts;
}

function splitSections(content) {
  return splitByHeadings(content, "##");
}

function splitEntries(sectionText) {
  return splitByHeadings(sectionText, "###").map((p) => ({ title: p.name, text: p.text }));
}

function parseFields(entryText) {
  const fields = {};
  const fieldOrder = [];
  const lines = entryText.split("\n");
  let currentField = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const fieldMatch = line.match(/^\*\*([^:*]+):\*\*\s*(.*)$/);
    if (fieldMatch) {
      const name = fieldMatch[1].trim();
      const value = fieldMatch[2].trim();
      fields[name] = value;
      fieldOrder.push(name);
      currentField = name;
    } else if (currentField && line.trim() !== "") {
      fields[currentField] += " " + line.trim();
    }
  }
  return { fields, fieldOrder };
}

function h2Blocks(content) {
  const matches = [...content.matchAll(/^## (?!#)(.+?)\s*$/gm)];
  return matches.map((match, index) => {
    const next = matches[index + 1];
    return {
      name: match[1].trim(),
      start: match.index,
      end: next ? next.index : content.length,
      text: content.slice(match.index, next ? next.index : content.length),
    };
  });
}

function h3Entries(block) {
  const matches = [...block.text.matchAll(/^### (?!#)(.+?)\s*$/gm)];
  return matches.map((match, index) => {
    const next = matches[index + 1];
    const start = block.start + match.index;
    const end = block.start + (next ? next.index : block.text.length);
    return {
      title: match[1].trim(),
      start,
      end,
      text: block.text.slice(match.index, next ? next.index : block.text.length),
    };
  });
}

function sectionForStatus(status) {
  const normalized = String(status ?? "").trim().toLowerCase().split(/\s+/)[0];
  if (normalized === "active") return "Active Bugs";
  if (normalized === "fixed") return "Fixed Bugs";
  if (normalized === "deferred" || normalized === "monitoring") return "Deferred / Monitoring";
  return null;
}

function entryStatus(entryText) {
  return entryText.match(/^\*\*Status:\*\*\s*(.+?)\s*$/mi)?.[1]?.trim() ?? null;
}

function isTopLevelHeading(linkText) {
  for (const section of TOP_LEVEL_SECTIONS) {
    if (linkText === section || linkText.startsWith(section + " ")) return true;
  }
  return false;
}

export function removeH3LinksFromContents(content) {
  const changes = [];
  const manualReview = [];
  const sections = splitSections(content);
  const contentsSection = sections.find((s) => s.name === "Contents");
  if (!contentsSection) return { updated: content, changes, manualReview };
  const lines = contentsSection.text.split("\n");
  const updatedLines = [];
  for (const line of lines) {
    const match = line.match(/^- \[\[#([^|\]]+)(?:\|[^\]]+)?\]\]\s*$/);
    if (match) {
      const heading = match[1].trim();
      if (!isTopLevelHeading(heading)) {
        changes.push(`removed H3 link from Contents: [[#${heading}]]`);
        continue;
      }
    }
    updatedLines.push(line);
  }
  const newContentsText = updatedLines.join("\n");
  const updated = content.replace(contentsSection.text, newContentsText);
  return { updated, changes, manualReview };
}

export function normalizePlaceholders(content) {
  const changes = [];
  const manualReview = [];
  let updated = content;
  const placeholderRe = /<to be filled in by maintainer\s*(?:[-—]\s*)?([^>]*)>/gi;
  updated = updated.replace(placeholderRe, (_match, note) => {
    changes.push("normalized `<to be filled in by maintainer` placeholder to `TBD`");
    const cleaned = note.trim();
    return cleaned ? `TBD — ${cleaned}` : "TBD";
  });
  return { updated, changes, manualReview };
}

export function ensureKnownBugSections(content) {
  const changes = [];
  let updated = content;
  for (const section of Object.keys(SECTION_FIELDS)) {
    if (new RegExp(`^##\\s+${escapeRegExp(section)}\\s*$`, "m").test(updated)) continue;
    const navigation = updated.match(/^## Navigation\s*$/m);
    const insertAt = navigation ? navigation.index : updated.length;
    const before = updated.slice(0, insertAt).replace(/\n+$/, "\n\n");
    const after = updated.slice(insertAt).replace(/^\n+/, "\n");
    updated = `${before}## ${section}\n\n*(no entries)*\n\n${after}`.replace(/\n{3,}/g, "\n\n");
    changes.push(`added missing ## ${section} section`);
  }
  return { updated, changes, manualReview: [] };
}

export function moveEntriesToStatusSections(content) {
  const changes = [];
  let updated = content;
  let moved = true;
  let guard = 0;
  while (moved && guard < 100) {
    moved = false;
    guard += 1;
    const blocks = h2Blocks(updated);
    for (const block of blocks) {
      if (!SECTION_FIELDS[block.name] || block.name === "Recurring Root-Cause Patterns") continue;
      const entries = h3Entries(block);
      for (const entry of entries) {
        const destName = sectionForStatus(entryStatus(entry.text));
        if (!destName || destName === block.name) continue;
        const dest = h2Blocks(updated).find((candidate) => candidate.name === destName);
        if (!dest) continue;
        const entryText = entry.text.trim();
        const without = `${updated.slice(0, entry.start).replace(/\n+$/, "\n\n")}${updated.slice(entry.end).replace(/^\n+/, "\n")}`.replace(/\n{3,}/g, "\n\n");
        const refreshedDest = h2Blocks(without).find((candidate) => candidate.name === destName);
        if (!refreshedDest) continue;
        const destBody = refreshedDest.text.replace(/^## .+?\s*\n/, "").trim();
        const placeholderOnly = destBody === "*(no entries)*";
        const insertAt = refreshedDest.end;
        const before = without.slice(0, insertAt).replace(/\n+$/, placeholderOnly ? "\n\n" : "\n\n");
        const after = without.slice(insertAt).replace(/^\n+/, "\n");
        const cleanedBefore = placeholderOnly
          ? before.replace(/\n\*\(no entries\)\*\s*$/m, "\n")
          : before;
        updated = `${cleanedBefore}${entryText}\n\n${after}`.replace(/\n{3,}/g, "\n\n");
        changes.push(`moved ${entry.title} from ${block.name} to ${destName}`);
        moved = true;
        break;
      }
      if (moved) break;
    }
  }
  return { updated, changes, manualReview: [] };
}

export function syncKnownBugsContents(content) {
  const changes = [];
  const blocks = h2Blocks(content);
  const contents = blocks.find((block) => block.name === "Contents");
  if (!contents) return { updated: content, changes, manualReview: [] };
  const headings = blocks
    .map((block) => block.name)
    .filter((name) => name !== "Contents" && TOP_LEVEL_SECTIONS.has(name));
  const body = headings.map((heading) => `- [[#${heading}]]`).join("\n");
  const replacement = `## Contents\n\n${body}\n\n`;
  const updated = `${content.slice(0, contents.start)}${replacement}${content.slice(contents.end).replace(/^\n+/, "")}`.replace(/\n{3,}/g, "\n\n");
  if (updated !== content) changes.push("regenerated Contents top-level links");
  return { updated, changes, manualReview: [] };
}

export function ensureRequiredFields(content) {
  const changes = [];
  const manualReview = [];
  let updated = content;
  const sections = splitSections(updated);
  for (const section of sections) {
    const required = SECTION_FIELDS[section.name];
    if (!required) continue;
    const entries = splitEntries(section.text);
    for (const entry of entries) {
      const { fields, fieldOrder } = parseFields(entry.text);
      const missing = required.filter((f) => !(f in fields));
      if (missing.length === 0) continue;
      const newLines = [entry.text.split("\n")[0]];
      const used = new Set();
      for (const f of required) {
        if (f in fields) {
          newLines.push(`**${f}:** ${fields[f]}`);
          used.add(f);
        } else {
          newLines.push(`**${f}:** TBD`);
          used.add(f);
        }
      }
      for (const f of fieldOrder) {
        if (!used.has(f)) {
          newLines.push(`**${f}:** ${fields[f]}`);
          used.add(f);
        }
      }
      const newBlock = newLines.join("\n");
      updated = updated.replace(entry.text, newBlock);
      changes.push(`${section.name} / ${entry.title}: added missing fields (${missing.join(", ")})`);
    }
  }
  return { updated, changes, manualReview };
}

export function checkKnownBugsShape(content) {
  const issues = [];
  const manualReview = [];
  const sections = splitSections(content);
  const sectionNames = new Set(sections.map((s) => s.name));

  for (const name of Object.keys(SECTION_FIELDS)) {
    if (!sectionNames.has(name)) {
      issues.push(`missing section \`## ${name}\``);
    }
  }

  const contentsSection = sections.find((s) => s.name === "Contents");
  if (contentsSection) {
    const lines = contentsSection.text.split("\n");
    for (const line of lines) {
      const match = line.match(/^- \[\[#([^|\]]+)(?:\|[^\]]+)?\]\]\s*$/);
      if (match) {
        const heading = match[1].trim();
        if (!isTopLevelHeading(heading)) {
          issues.push(`Contents links to H3 heading \`${heading}\``);
        }
      }
    }
  }

  for (const section of sections) {
    const required = SECTION_FIELDS[section.name];
    const allowedStatuses = SECTION_STATUSES[section.name];
    if (!required) continue;
    const entries = splitEntries(section.text);
    for (const entry of entries) {
      const { fields } = parseFields(entry.text);
      for (const f of required) {
        if (!(f in fields)) {
          issues.push(`${section.name} / ${entry.title}: missing \`${f}\``);
        } else if (/^\s*TBD\b/i.test(fields[f]) || /to be filled in by maintainer/i.test(fields[f])) {
          manualReview.push(`${section.name} / ${entry.title}: \`${f}\` is TBD/placeholder`);
        }
      }
      if (allowedStatuses && "Status" in fields) {
        const rawStatus = fields["Status"].toLowerCase();
        if (!/^\s*TBD\b/i.test(fields["Status"]) && !/to be filled in by maintainer/i.test(fields["Status"])) {
          const statusValue = rawStatus.split(/\s+/)[0];
          if (!allowedStatuses.has(statusValue)) {
            issues.push(`${section.name} / ${entry.title}: status \`${fields["Status"]}\` not allowed (expected one of ${[...allowedStatuses].join(", ")})`);
          }
        }
      }
    }
  }

  return { issues, manualReview };
}

export const __test = { TOP_LEVEL_SECTIONS, SECTION_FIELDS, SECTION_STATUSES };
