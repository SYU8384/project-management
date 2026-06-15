#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/SYU8384/project-management.git"
REF="main"
CHANNEL=""
SKILL_NAME="project-management"
TARGET=""
DEST_PARENT=""
YES=0
FORCE=0

usage() {
  cat <<'USAGE'
Install or update the project-management skill.

Usage:
  install.sh [--target codex|agents|claude|openclaw] [--yes] [--update] [--force]
  install.sh --dest <skills-dir> [--name project-management] [--yes] [--update] [--force]

Options:
  --target <target>  Install/update target: codex, agents, claude, or openclaw.
  --dest <dir>       Custom parent skills directory.
  --name <name>      Installed skill directory name. Default: project-management.
  --repo <url>       Git repo URL. Default: https://github.com/SYU8384/project-management.git
  --ref <ref>        Branch or tag to install. Default: main (bleeding edge). Pin with e.g. v1.0.0.
  --channel <name>   Release channel: main (bleeding edge) or v1 (latest v1.x.x release). Default: unset.
  --update           Explicitly request update behavior. Existing installs update automatically.
  --force            On existing installs, discard local changes and untracked files before updating.
  --yes              Skip confirmation prompts.
  --help            Show this help.

Notes:
  For native Windows, run this installer from Git Bash or WSL (not
  cmd.exe or PowerShell). The installer uses POSIX shell semantics.
  Path expansion (`~` and `~/foo`) auto-detects Windows under Git
  Bash and routes through `cygpath` when available; otherwise it
  falls back to `$HOME`.

Examples:
  curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh | bash
  curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh | bash -s -- --target codex --yes
  curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh | bash -s -- --channel v1 --yes
USAGE
}

die() {
  echo "Error: $*" >&2
  exit 1
}

info() {
  echo "==> $*"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required but was not found."
}

has_tty() {
  ( : < /dev/tty ) >/dev/null 2>&1
}

tty_read() {
  local prompt="$1"
  local value
  if ! has_tty; then
    die "Interactive input requires a TTY. Re-run with --target <target> or --dest <skills-dir>."
  fi
  printf "%s" "$prompt" > /dev/tty
  IFS= read -r value < /dev/tty
  printf "%s" "$value"
}

# resolve_home: returns the user's home directory in a form that the
# rest of the installer (and the validators in lib/paths.mjs) can use.
# Detection chain:
#   1. If we're on Windows (OS=Windows_NT, which is the case under
#      Git Bash, MSYS2, and Cygwin) AND `cygpath` is on PATH, use
#      `cygpath -w "$HOME"` to get the Windows-form path, then
#      convert backslashes to forward slashes. The skill's
#      validators use `node:path` which handles both, but
#      forward slashes are more portable.
#   2. Otherwise, return $HOME as-is. This works on POSIX shells
#      (macOS, Linux, WSL, Git Bash's POSIX view).
#   3. If $HOME is unset and we're not on Windows, fail loudly —
#      the user has a broken shell environment.
resolve_home() {
  if [[ "${OS:-}" == "Windows_NT" ]] && command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$HOME" 2>/dev/null | tr '\\' '/' || {
      # cygpath failed; fall back to $HOME
      printf "%s" "$HOME"
    }
  elif [[ -n "$HOME" ]]; then
    printf "%s" "$HOME"
  else
    die "HOME is not set and cygpath is unavailable; cannot resolve ~."
  fi
}

expand_path() {
  local input="$1"
  case "$input" in
    "~") resolve_home ;;
    \~/*) printf "%s/%s" "$(resolve_home)" "${input#\~/}" ;;
    *) printf "%s" "$input" ;;
  esac
}

target_dest_parent() {
  case "$1" in
    codex) printf "%s/skills" "${CODEX_HOME:-$HOME/.codex}" ;;
    agents) printf "%s/.agents/skills" "$HOME" ;;
    claude) printf "%s/.claude/skills" "$HOME" ;;
    openclaw) printf "%s/.openclaw/skills" "$HOME" ;;
    *) die "Unknown target: $1" ;;
  esac
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --target)
        [[ $# -ge 2 ]] || die "--target requires a value."
        TARGET="$2"
        shift 2
        ;;
      --dest)
        [[ $# -ge 2 ]] || die "--dest requires a value."
        DEST_PARENT="$(expand_path "$2")"
        shift 2
        ;;
      --name)
        [[ $# -ge 2 ]] || die "--name requires a value."
        SKILL_NAME="$2"
        shift 2
        ;;
      --repo)
        [[ $# -ge 2 ]] || die "--repo requires a value."
        REPO_URL="$2"
        shift 2
        ;;
    --ref)
      [[ $# -ge 2 ]] || die "--ref requires a value."
      REF="$2"
      shift 2
      ;;
    --channel)
      [[ $# -ge 2 ]] || die "--channel requires a value."
      CHANNEL="$2"
      shift 2
      ;;
      --yes|-y)
        YES=1
        shift
        ;;
      --update)
        shift
        ;;
      --force|-f)
        FORCE=1
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done
}

choose_target() {
  if ! has_tty; then
    die "Interactive install requires a TTY. Re-run with --target <target> or --dest <skills-dir>."
  fi
  cat > /dev/tty <<'MENU'
Choose where to install project-management:
  1) Agents  (~/.agents/skills)
  2) Codex   (~/.codex/skills)
  3) Claude  (~/.claude/skills)
  4) OpenClaw (~/.openclaw/skills)
  5) Custom skills directory
MENU
  local choice
  choice="$(tty_read "Enter 1-5: ")"
  case "$choice" in
    1) TARGET="agents" ;;
    2) TARGET="codex" ;;
    3) TARGET="claude" ;;
    4) TARGET="openclaw" ;;
    5) DEST_PARENT="$(expand_path "$(tty_read "Parent skills directory: ")")" ;;
    *) die "Invalid choice: $choice" ;;
  esac
}

normalize_repo_url() {
  local url="$1"
  url="${url%.git}"
  case "$url" in
    git@github.com:*) url="https://github.com/${url#git@github.com:}" ;;
  esac
  printf "%s" "$url"
}

ensure_same_repo() {
  local existing_url
  existing_url="$(git -C "$1" config --get remote.origin.url || true)"
  [[ -n "$existing_url" ]] || return 1
  [[ "$(normalize_repo_url "$existing_url")" == "$(normalize_repo_url "$REPO_URL")" ]]
}

install_or_update() {
  local install_dir="$1"
  local parent_dir
  parent_dir="$(dirname "$install_dir")"
  mkdir -p "$parent_dir"

  if [[ -e "$install_dir" ]]; then
    [[ -d "$install_dir/.git" ]] || die "$install_dir already exists but is not a git checkout."
    ensure_same_repo "$install_dir" || die "$install_dir exists but does not point at $REPO_URL."

    if [[ -n "$(git -C "$install_dir" status --porcelain)" ]]; then
      if [[ "$FORCE" -ne 1 ]]; then
        die "$install_dir has local changes. Commit, stash, or remove them before updating, or re-run with --force to discard them."
      fi
      info "Forcing update: discarding local changes and untracked files at $install_dir"
      git -C "$install_dir" reset --hard
      git -C "$install_dir" clean -fd
    fi

    info "Updating existing install at $install_dir to $REF"
    git -C "$install_dir" fetch --tags origin
    git -C "$install_dir" checkout "$REF"
    git -C "$install_dir" pull --ff-only origin "$REF" || {
      # If pull fails because REF is a tag or detached, checkout already did the work.
      info "Note: could not fast-forward pull $REF; staying at checked-out ref."
    }
  else
    info "Cloning $REPO_URL ($REF) to $install_dir"
    git clone --depth 1 --branch "$REF" "$REPO_URL" "$install_dir"
  fi

  [[ -f "$install_dir/SKILL.md" ]] || die "Installed directory is missing SKILL.md."
  # NOTE: `projects.json` lives at `~/.config/project-management/projects.json`,
  # not in the skill directory. The bootstrap script (run after install) creates
  # it there on first use. v1.3.0+ no longer writes projects.json to the
  # skill root; existing pre-v1.3.0 installs should manually `mv` their file.

  local installed_version="unknown"
  if [[ -f "$install_dir/VERSION" ]]; then
    installed_version="$(tr -d '[:space:]' < "$install_dir/VERSION")"
  fi
  info "Installed version: $installed_version"
}

main() {
  parse_args "$@"
  need_cmd git

  if [[ -n "$TARGET" && -n "$DEST_PARENT" ]]; then
    die "Use either --target or --dest, not both."
  fi
  if [[ -z "$TARGET" && -z "$DEST_PARENT" ]]; then
    if has_tty; then
      choose_target
    else
      # Piped install (no TTY): default to the most portable target.
      TARGET="agents"
      DEST_PARENT="$(target_dest_parent "$TARGET")"
      info "No --target given and no TTY available; defaulting to $TARGET ($DEST_PARENT/$SKILL_NAME)"
    fi
  fi
  if [[ -n "$TARGET" && -z "$DEST_PARENT" ]]; then
    DEST_PARENT="$(target_dest_parent "$TARGET")"
  fi

  [[ -n "$DEST_PARENT" ]] || die "No destination selected."
  [[ "$SKILL_NAME" != *"/"* && "$SKILL_NAME" != "." && "$SKILL_NAME" != ".." ]] || die "Invalid skill name: $SKILL_NAME"

  case "$CHANNEL" in
    "") ;;
    main) REF="main" ;;
    v1) REF="v1" ;;
    *) die "Unknown --channel: $CHANNEL. Supported: main, v1." ;;
  esac

  local install_dir="$DEST_PARENT/$SKILL_NAME"

  if [[ "$YES" -ne 1 ]]; then
    echo "Install or update project-management at: $install_dir"
    local confirm
    confirm="$(tty_read "Continue? [y/N] ")"
    [[ "$confirm" == "y" || "$confirm" == "Y" ]] || die "Canceled."
  fi

  install_or_update "$install_dir"

  cat <<EOF

Installed or updated project-management at:
  $install_dir

Next steps:
  1. Restart your agent so it discovers the skill.
  2. Use the skill and say: setup this repo
  3. Advanced/manual fallback: edit ~/.config/project-management/projects.json (created by the bootstrap script on first setup) with your vault and project paths.
EOF
}

main "$@"
