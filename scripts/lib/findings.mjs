export function finding({ code, severity = "error", path = "", message, remedy = "", fixable = false }) {
  if (!code) throw new Error("finding requires code");
  if (!message) throw new Error("finding requires message");
  return { code, severity, path, message, remedy, fixable };
}

export function renderFindings(title, findings, { okMessage = "No issues found." } = {}) {
  const lines = [`# ${title}`, ""];
  lines.push(`**Status:** ${findings.length === 0 ? "PASS" : "FAIL"}`);
  lines.push("");
  if (findings.length === 0) {
    lines.push(okMessage);
    return lines.join("\n");
  }
  for (const item of findings) {
    const path = item.path ? ` \`${item.path}\`` : "";
    const fixable = item.fixable ? " fixable" : "";
    lines.push(`- [${item.severity}${fixable}] ${item.code}${path}: ${item.message}`);
    if (item.remedy) lines.push(`  Remedy: ${item.remedy}`);
  }
  return lines.join("\n");
}

export function issueCount(groups) {
  let total = 0;
  for (const value of Object.values(groups)) {
    if (Array.isArray(value)) total += value.length;
    else if (value && typeof value === "object") total += issueCount(value);
  }
  return total;
}
