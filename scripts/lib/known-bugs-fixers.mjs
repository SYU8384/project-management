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

function isTopLevelHeading(linkText) {
  for (const section of TOP_LEVEL_SECTIONS) {
    if (linkText === section || linkText.startsWith(section + " ")) return true;
  }
  return false;
}

export function ensureHeadingsOnOwnLines(content) {
  const changes = [];
  const lines = content.split("\n");
  const out = [];
  let skip = false;
  for (let i = 0; i < lines.length; i++) {
    if (skip) {
      skip = false;
      continue;
    }
    const line = lines[i];
    const next = lines[i + 1];
    if (/^#$/.test(line) && next && /^## /.test(next)) {
      out.push("#" + next);
      skip = true;
      changes.push("repaired split H3 heading");
      continue;
    }
    if (/^#$/.test(line) && next && /^### /.test(next)) {
      out.push(next);
      skip = true;
      changes.push("repaired split H3 heading");
      continue;
    }
    if (/^## /.test(line) || /^### /.test(line)) {
      const prev = out[out.length - 1] ?? "";
      const prevTrim = prev.trim();
      const isPrevHeading = /^## /.test(prev) || /^### /.test(prev);
      const isPrevField = /^\*\*[^:*]+:\*\*/.test(prev);
      const isPrevList = /^- /.test(prev);
      const isPrevFrontmatter = /^---/.test(prev);
      const isPrevTocMarker = /<!-- vault-maintain:toc/.test(prev);
      const isPrevEmpty = prevTrim === "";
      if (isPrevEmpty || isPrevHeading || isPrevField || isPrevList || isPrevFrontmatter || isPrevTocMarker) {
        out.push(line);
      } else {
        out[out.length - 1] = prev + line;
        changes.push("merged split heading");
      }
    } else {
      out.push(line);
    }
  }
  let updated = out.join("\n");
  const step2 = updated.replace(/(\*\*[^:*]+:\*\*.*?)(##|###) /g, (match, field, marker) => {
    changes.push(`moved ${marker} heading to its own line`);
    return `${field}\n${marker} `;
  });
  if (step2 !== updated) updated = step2;
  const step3 = updated.replace(/([.!?]\s*)(##|###) /g, (match, prefix, marker) => {
    changes.push(`moved ${marker} heading to its own line`);
    return `${prefix}\n${marker} `;
  });
  if (step3 !== updated) updated = step3;
  return { updated, changes, manualReview: [] };
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
