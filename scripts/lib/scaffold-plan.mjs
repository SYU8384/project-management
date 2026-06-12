export function createScaffoldPlan() {
  const entries = [];
  return {
    entries,
    add(action, target, detail = "") {
      entries.push({ action, target, detail });
    },
    counts() {
      return entries.reduce((acc, entry) => {
        acc[entry.action] = (acc[entry.action] ?? 0) + 1;
        return acc;
      }, {});
    },
  };
}

export function summarizeScaffoldCounts(counts, skippedExisting = 0) {
  const parts = [];
  if (counts.mkdir) parts.push(`${counts.mkdir} dir${counts.mkdir === 1 ? "" : "s"} created`);
  if (counts.write) parts.push(`${counts.write} file${counts.write === 1 ? "" : "s"} written`);
  if (counts.update) parts.push(`${counts.update} file${counts.update === 1 ? "" : "s"} updated`);
  if (skippedExisting) parts.push(`${skippedExisting} file${skippedExisting === 1 ? "" : "s"} skipped`);
  return `summary: ${parts.length ? parts.join(", ") : "no changes"}.`;
}
