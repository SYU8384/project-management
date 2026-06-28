<#
.SYNOPSIS
  Windows-native installer for the project-management skill.
  Requires git on PATH (ships with Git for Windows, GitHub Desktop,
  or VS Code). No bash dependency.

.DESCRIPTION
  Native PowerShell installer. Clones the project-management repo to
  one of the standard targets (codex, agents, claude, openclaw) or a
  custom directory, then checks out the requested ref (default:
  moving v1 branch).

  Mirrors install.sh on the bash side. The two installers are
  siblings: install.sh is the source of truth for bash / WSL /
  Git Bash environments; install.ps1 is the source of truth for
  native PowerShell. Both produce the same installed directory.

  This script uses a param() block, so it must be invoked as a
  downloaded .ps1 file -- not piped through `irm | iex`. PowerShell
  rejects param() blocks in iex-evaluated script blocks. The
  standard two-step is:
      $installer = Join-Path $env:TEMP "project-management-install.ps1"
      Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/SYU8384/project-management/main/install.ps1" -OutFile $installer
      powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer -Target agents -Yes

  Downloading to $env:TEMP avoids protected-current-directory failures
  such as C:\WINDOWS\system32. The execution-policy bypass is scoped to
  this installer process.

  Failure modes:
    - git not on PATH: the installer prints a one-line error
      pointing at the Git for Windows download and exits 1.
#>
[CmdletBinding()]
param(
    [ValidateSet("codex", "agents", "claude", "openclaw")]
    [string] $Target,

    [ValidateSet("v1", "main")]
    [string] $Channel,

    [string] $Ref,

    [string] $Dest,

    [string] $Name = "project-management",

    [string] $Repo = "https://github.com/SYU8384/project-management.git",

    [switch] $Force,

    [switch] $Yes
)

$ErrorActionPreference = 'Stop'

# Resolve target -> install directory.
if ($PSBoundParameters.ContainsKey('Dest')) {
    $installDir = Join-Path $Dest $Name
} elseif ($Target) {
    $map = @{
        'codex'    = Join-Path $env:USERPROFILE '.codex\skills'
        'agents'   = Join-Path $env:USERPROFILE '.agents\skills'
        'claude'   = Join-Path $env:USERPROFILE '.claude\skills'
        'openclaw' = Join-Path $env:USERPROFILE '.openclaw\skills'
    }
    $installDir = Join-Path $map[$Target] $Name
} else {
    $installDir = Join-Path (Join-Path $env:USERPROFILE '.agents\skills') $Name
}

$resolvedRef = if ($Ref) { $Ref } elseif ($Channel) { $Channel } else { 'v1' }

if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) {
    Write-Error "git not found. Install Git for Windows: https://git-scm.com/download/win"
    exit 1
}

$parentDir = Split-Path $installDir -Parent
if (-not (Test-Path $parentDir)) {
    if (-not $Yes) {
        $confirm = Read-Host "About to create '$parentDir'. Proceed? (y/n)"
        if ($confirm -ne 'y') { Write-Host "Cancelled."; exit 1 }
    }
    New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
}

if (Test-Path (Join-Path $installDir '.git')) {
    if ($Force) {
        git -C $installDir reset --hard | Out-Null
        git -C $installDir clean -fd | Out-Null
    }
    git -C $installDir fetch origin | Out-Null
    git -C $installDir checkout $resolvedRef | Out-Null
    git -C $installDir pull --ff-only origin $resolvedRef | Out-Null
} else {
    git clone --depth 1 --branch $resolvedRef $Repo $installDir | Out-Null
}

$versionFile = Join-Path $installDir 'VERSION'
if (Test-Path $versionFile) {
    $version = (Get-Content $versionFile -Raw).Trim()
    Write-Host "==> Installed version: $version"
}
