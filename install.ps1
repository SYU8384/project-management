<#
.SYNOPSIS
  Windows-friendly entry point for the project-management skill installer.
  Delegates to install.sh via Git Bash (bash.exe) or WSL (wsl.exe bash).

.DESCRIPTION
  Thin PowerShell shim that downloads the canonical install.sh and runs it
  through whichever POSIX shell is available on the user's machine. install.sh
  remains the single source of truth for install logic; this shim is ~50 lines
  of glue.

  Detection order:
    1. bash.exe (ships with Git for Windows) — preferred; no VM startup.
    2. wsl.exe bash -c (Windows Subsystem for Linux) — fallback for users
       who have WSL enabled but not Git for Windows.
    3. Otherwise: fail with a Windows-friendly message pointing at the
       Git for Windows download.

  PowerShell native install (no bash dependency) is intentionally NOT
  supported. install.sh has been the install surface since v1.0.0 and
  already handles Git Bash on Windows via cygpath-aware path expansion
  (added in v1.3.0). A native port would double the install-code
  maintenance surface and drift from install.sh over time.

.PARAMETER Arguments
  Forwarded to install.sh verbatim. Pass install.sh flags after the
  script name; they are bound via PowerShell's remaining-arguments
  parameter and forwarded to bash via splat.

  Recognized install.sh flags (see install.sh --help for full list):
    --target <name>   codex | agents | claude | openclaw
    --channel <name>  v1 | main
    --ref <ref>       branch or tag (e.g. v1.17.0)
    --dest <dir>      custom parent skills directory
    --name <name>     installed skill directory name
    --repo <url>      alternative repo URL
    --force           discard local changes on update
    --yes             skip confirmation prompts

.EXAMPLE
  PS> irm https://raw.githubusercontent.com/SYU8384/project-management/main/install.ps1 | iex
  # One-liner: download the shim and run it. Defaults to the moving
  # v1 branch (latest stable).

.EXAMPLE
  PS> irm https://raw.githubusercontent.com/SYU8384/project-management/main/install.ps1 | iex -target agents -yes
  # Same as above with forwarded flags. PowerShell's iex binds the
  # trailing -key value pairs to $args, which the shim forwards to
  # install.sh.

.EXAMPLE
  PS> Invoke-WebRequest .../install.ps1 -OutFile install.ps1
  PS> .\install.ps1 --target agents --yes
  # Download-then-run pattern; the script lives next to your terminal
  # session and can be re-run with different flags without re-downloading.

.NOTES
  Tested under PowerShell 5.1+ (Windows 10+ and PowerShell Core 7+).
  On PowerShell 3.0 (Windows 8) the script should also work because it
  uses no PowerShell 5+ specific syntax.
#>
[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $Arguments
)

$ErrorActionPreference = 'Stop'

# 1. Detect a POSIX shell: bash.exe (Git Bash) first, then wsl.exe bash -c.
$bashCmd = $null
$bashPrefix = @()
if (Get-Command bash.exe -ErrorAction SilentlyContinue) {
    $bashCmd = 'bash.exe'
} elseif (Get-Command wsl.exe -ErrorAction SilentlyContinue) {
    $bashCmd = 'wsl.exe'
    $bashPrefix = @('bash', '-c')
} else {
    Write-Error "No POSIX shell found. Install Git for Windows (https://git-scm.com/download/win) or enable WSL, then re-run."
    exit 1
}

# 2. Download install.sh to a temp file. Use GetTempFileName (PS 3+) for
#    max compatibility; New-TemporaryFile is PS 5+ only.
$tmp = [System.IO.Path]::GetTempFileName()
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $url = 'https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh'
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $tmp

    # 3. Forward args. bash.exe takes args via CreateProcess (splat works
    #    directly). wsl needs the full command in one string for the
    #    `bash -c` invocation, with each arg single-quoted to survive
    #    shell re-parsing.
    if ($bashCmd -eq 'wsl.exe') {
        $argString = ($Arguments | ForEach-Object { "'$_'" }) -join ' '
        & $bashCmd @bashPrefix "curl -fsSL $url | bash -s -- $argString"
    } else {
        & $bashCmd $tmp @Arguments
    }
    exit $LASTEXITCODE
} finally {
    Remove-Item $tmp -ErrorAction SilentlyContinue
}
