export const MONTH_NAMES = Object.freeze([
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);

export function historyDateParts(date) {
  const match = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid history date: ${date}. Expected YYYY-MM-DD.`);
  }
  const [, year, month, day] = match;
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex >= MONTH_NAMES.length) {
    throw new Error(`Invalid history month in date: ${date}.`);
  }
  return {
    year,
    month,
    day,
    yearMonth: `${year}-${month}`,
    monthName: MONTH_NAMES[monthIndex],
  };
}

export function historyYearRel(date) {
  const { year } = historyDateParts(date);
  return `history/${year}`;
}

export function historyYearIndexRel(date) {
  const { year } = historyDateParts(date);
  return `history/${year}/${year}`;
}

export function historyMonthRel(date) {
  const { year, monthName } = historyDateParts(date);
  return `history/${year}/${monthName}`;
}

export function historyMonthIndexRel(date) {
  const { monthName } = historyDateParts(date);
  return `${historyMonthRel(date)}/${monthName}`;
}

export function historyDayRel(date) {
  return `${historyMonthRel(date)}/history-${date}`;
}

export function historyArchivedSectionsRel(date) {
  return `${historyMonthRel(date)}/history-${date}-archived-sections`;
}

export function isCanonicalHistoryMonthRel(relPath) {
  const normalized = String(relPath).replaceAll("\\", "/");
  return /^history\/\d{4}\/[A-Z][a-z]+(?:\/|$)/.test(normalized);
}

export function isCanonicalHistoryLogRel(relPath) {
  const normalized = String(relPath).replaceAll("\\", "/");
  return /^history\/\d{4}\/[A-Z][a-z]+\/history-\d{4}-\d{2}-\d{2}(?:-archived-sections)?\.md$/.test(normalized);
}

// Compatibility helpers for migrations only. New history writes must use
// historyDayRel()/historyArchivedSectionsRel(), never these legacy paths.
export function legacyHistoryMonthRel(date) {
  const { yearMonth } = historyDateParts(date);
  return `history/${yearMonth}`;
}

export function legacyHistoryDayRel(date) {
  const { yearMonth } = historyDateParts(date);
  return `history/${yearMonth}/history-${date}`;
}

export function isLegacyHistoryMonthRel(relPath) {
  const normalized = String(relPath).replaceAll("\\", "/");
  return /^history\/\d{4}-\d{2}(?:\/|$)/.test(normalized);
}

export function isLegacyHistoryLogRel(relPath) {
  const normalized = String(relPath).replaceAll("\\", "/");
  return /^history\/\d{4}-\d{2}\/history-\d{4}-\d{2}-\d{2}(?:-archived-sections)?\.md$/.test(normalized);
}

export function isMigrationCompatibilityLine(line) {
  return /\b(legacy|migration|migrate|compatibility|compat|retired|invalid)\b/i.test(String(line));
}

export function staleHistoryGuidanceLines(content) {
  return String(content)
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) =>
      /(?:history\/)?YYYY-MM\/history-YYYY-MM-DD(?:-archived-sections)?\.md|history\/YYYY-MM\//.test(line)
    )
    .filter(({ line }) => !isMigrationCompatibilityLine(line));
}

export function rewriteStaleHistoryGuidance(content) {
  const original = String(content);
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const normalized = original.replace(/\r\n/g, "\n");
  const withCanonicalTree = normalized.replace(
    /^(\s*[│ ]*└── )YYYY-MM\/\n(\s*[│ ]*└── )history-YYYY-MM-DD\.md$/gm,
    (_, folderPrefix, filePrefix) => {
      const childPrefix = filePrefix.replace(/└── $/, "");
      return `${folderPrefix}YYYY/\n${childPrefix}├── YYYY.md\n${childPrefix}└── <Month>/\n${childPrefix}    ├── <Month>.md\n${childPrefix}    └── history-YYYY-MM-DD.md`;
    }
  );

  const rewritten = withCanonicalTree
    .split("\n")
    .map((line) => {
      if (isMigrationCompatibilityLine(line)) return line;
      return line
        .replaceAll("history/YYYY-MM/", "history/YYYY/<Month>/")
        .replaceAll("YYYY-MM/history-YYYY-MM-DD-archived-sections.md", "YYYY/<Month>/history-YYYY-MM-DD-archived-sections.md")
        .replaceAll("YYYY-MM/history-YYYY-MM-DD.md", "YYYY/<Month>/history-YYYY-MM-DD.md");
    })
    .join("\n");
  if (rewritten === normalized) return original;
  return eol === "\r\n" ? rewritten.replace(/\n/g, "\r\n") : rewritten;
}
