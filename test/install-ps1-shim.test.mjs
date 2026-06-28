import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(SCRIPT_DIR);
const INSTALL_PS1 = join(SKILL_DIR, "install.ps1");

test("install.ps1 exists and is non-empty", () => {
  assert.ok(existsSync(INSTALL_PS1), "install.ps1 must exist at the repo root");
  const content = readFileSync(INSTALL_PS1, "utf8");
  assert.ok(content.length > 100, "install.ps1 must not be a stub");
});

test("install.ps1 is a native PowerShell installer (no bash, no wsl)", () => {
  // The native installer's whole point is no bash dependency. A bash.exe
  // or wsl.exe reference would be a regression. (The header comment
  // legitimately mentions WSL and bash as separate paths the user can
  // opt into; this test allows a single mention of each in the
  // header-comment context, but flags the actual *invocation*.)
  const content = readFileSync(INSTALL_PS1, "utf8");
  // No Get-Command / & invocation of bash.exe or wsl.exe.
  assert.doesNotMatch(content, /Get-Command\s+bash/i);
  assert.doesNotMatch(content, /&\s+bash\.exe/);
  assert.doesNotMatch(content, /Get-Command\s+wsl/i);
  assert.doesNotMatch(content, /&\s+wsl\.exe/);
});

test("install.ps1 uses git for clone and pull", () => {
  const content = readFileSync(INSTALL_PS1, "utf8");
  // Match "git clone" with optional flags between ("git clone --depth 1 ...").
  assert.match(content, /git\s+clone/);
  // Match "git pull" — possibly with flags before it ("git -C <dir> pull ...").
  // Use a word boundary on "pull" so the assertion doesn't match e.g. "git pull-request".
  assert.match(content, /git\b[\s\S]*?\bpull\b/);
});

test("install.ps1 supports the standard targets", () => {
  const content = readFileSync(INSTALL_PS1, "utf8");
  for (const target of ["codex", "agents", "claude", "openclaw"]) {
    assert.match(content, new RegExp(target), `install.ps1 must reference target ${target}`);
  }
});

test("install.ps1 has a param() block", () => {
  // The native installer uses a param() block for clean named-parameter
  // ergonomics (-Target, -Channel, -Ref, etc.). This means it CANNOT
  // be invoked via `irm | iex` — PowerShell rejects param() blocks
  // in iex-evaluated script blocks. The README documents the two-step
  // pattern (download to file, then run) instead.
  const content = readFileSync(INSTALL_PS1, "utf8");
  assert.match(content, /^\s*param\s*\(/m);
});

test("install.ps1 has the param-block caveat in the header", () => {
  // Future maintainers might be tempted to "fix" the missing irm | iex
  // one-liner. The header comment must document why the script is
  // param-block-only, so the next reader doesn't reintroduce the
  // footgun.
  const content = readFileSync(INSTALL_PS1, "utf8");
  assert.match(content, /param\(\)\s*block/i);
  assert.match(content, /irm\s*\|\s*iex/);
  assert.match(content, /two-step/i);
});

test("install.ps1 propagates exit code on missing git", () => {
  const content = readFileSync(INSTALL_PS1, "utf8");
  assert.match(content, /git not found/);
  assert.match(content, /git-scm\.com\/download\/win/);
  assert.match(content, /exit\s+1/);
});

test("install.ps1 references install.sh as the sibling", () => {
  const content = readFileSync(INSTALL_PS1, "utf8");
  assert.match(content, /install\.sh/);
});

test("install.ps1 syntax-checks on PowerShell when pwsh is on PATH", { skip: !commandExists("pwsh") }, () => {
  const result = spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-Command", "Get-Command -Syntax '" + INSTALL_PS1 + "'"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    assert.fail(`pwsh syntax check failed for install.ps1:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  }
});

function commandExists(name) {
  try {
    execFileSync("command", ["-v", name], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
