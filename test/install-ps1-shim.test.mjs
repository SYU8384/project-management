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
const README = join(SKILL_DIR, "README.md");
const OPENCLAW_INSTRUCTION = join(SKILL_DIR, "openclaw-instruction.md");

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

test("PowerShell docs use a temp-file execution-policy-safe invocation", () => {
  const readme = readFileSync(README, "utf8");
  const installer = readFileSync(INSTALL_PS1, "utf8");

  for (const content of [readme, installer]) {
    assert.match(content, /Join-Path\s+\$env:TEMP\s+"project-management-install\.ps1"/);
    assert.match(content, /Invoke-WebRequest\s+-UseBasicParsing\s+-Uri\s+"https:\/\/raw\.githubusercontent\.com\/SYU8384\/project-management\/main\/install\.ps1"\s+-OutFile\s+\$installer/);
    assert.match(content, /powershell\.exe\s+-NoProfile\s+-ExecutionPolicy\s+Bypass\s+-File\s+\$installer\s+-Target\s+agents\s+-Yes/);
    assert.doesNotMatch(content, /-OutFile\s+install\.ps1/);
    assert.doesNotMatch(content, /\\\.\\install\.ps1\s+-Target\s+agents\s+-Yes/);
  }
});

test("README Quick Start labels install paths by workflow and shell", () => {
  const readme = readFileSync(README, "utf8");

  assert.match(readme, /Path A — OpenClaw PM agent \(any OS; recommended for PM-domain work\)/);
  assert.match(readme, /any OS where OpenClaw can run the matching installer/);
  assert.match(readme, /uses the bash installer on macOS, Linux, WSL, or Git Bash/);
  assert.match(readme, /PowerShell installer on native Windows/);
  assert.match(readme, /Path B — Coding agent on macOS \/ Linux \/ WSL \/ Git Bash/);
  assert.match(readme, /POSIX `bash`/);
  assert.match(readme, /do \*\*not\*\* run in native Windows PowerShell or `cmd\.exe`/);
  assert.match(readme, /Path C — Coding agent on native Windows PowerShell/);
  assert.match(readme, /Targets are `agents`[\s\S]*`codex`[\s\S]*`claude`[\s\S]*`openclaw`[\s\S]*`-Dest <skills-dir>`/);
  assert.match(readme, /If you went through Path B or Path C/);
  assert.match(readme, /\[`install\.ps1`\]\(\.\/install\.ps1\)/);
  assert.doesNotMatch(readme, /currently `v1\.\d+\.\d+`/);
});

test("OpenClaw instruction has bash and native Windows install paths", () => {
  const content = readFileSync(OPENCLAW_INSTRUCTION, "utf8");

  assert.match(content, /git -C <skill_dir> pull --ff-only/);
  assert.match(content, /install\.sh[\s\S]*--target openclaw --yes/);
  assert.match(content, /install\.ps1[\s\S]*-Target openclaw -Yes/);
  assert.match(content, /install\.sh[\s\S]*--dest <skills-dir> --yes/);
  assert.match(content, /install\.ps1[\s\S]*-Dest "<skills-dir>" -Yes/);
  assert.match(content, /For native Windows PowerShell, add `-Force` before `-Yes`/);
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
