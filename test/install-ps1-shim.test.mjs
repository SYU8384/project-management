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

test("install.ps1 has the expected structure", () => {
  const content = readFileSync(INSTALL_PS1, "utf8");
  // Comment-based help block.
  assert.match(content, /<#/);
  assert.match(content, /\.SYNOPSIS/);
  assert.match(content, /\.DESCRIPTION/);
  // PowerShell parameter binding that captures trailing args verbatim.
  assert.match(content, /ValueFromRemainingArguments/);
  assert.match(content, /\[string\[\]\]\s*\$Arguments/);
  // POSIX-shell detection: bash.exe first, then wsl.exe.
  assert.match(content, /bash\.exe/);
  assert.match(content, /wsl\.exe/);
  // TLS-1.2 explicit set so Invoke-WebRequest works on older PowerShell defaults.
  assert.match(content, /Tls12/);
  // Exit code propagation: PowerShell scripts default to exit 0; the
  // bash installer's exit code must propagate so failures are visible.
  assert.match(content, /exit\s+\$LASTEXITCODE/);
  // Friendly error when no POSIX shell is available.
  assert.match(content, /No POSIX shell found/);
  // Single-source-of-truth: install.sh must be referenced as the delegate.
  assert.match(content, /install\.sh/);
});

test("install.ps1 syntax-checks on PowerShell when pwsh is on PATH", { skip: !commandExists("pwsh") }, () => {
  // Parse-only check. PowerShell prints parse errors to stderr; we ignore
  // all output and just inspect the exit code.
  const result = spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-Command", "Get-Command -Syntax '" + INSTALL_PS1 + "'"], {
    encoding: "utf8",
  });
  // -Command with a syntax-only parse does not actually invoke the script.
  // We use it just to verify the parser accepts the file structure.
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
