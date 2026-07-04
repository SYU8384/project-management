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
