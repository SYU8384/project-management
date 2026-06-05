#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/SYU8384/project-management.git"
REF="main"
SKILL_NAME="project-management"
TARGET=""
DEST_PARENT=""
YES=0

usage() {
  cat <<'USAGE'
Install the project-management skill.

Usage:
  install.sh [--target codex|agents|claude|openclaw] [--yes]
  install.sh --dest <skills-dir> [--name project-management] [--yes]

Options:
  --target <target>  Install target: codex, agents, claude, or openclaw.
  --dest <dir>       Custom parent skills directory.
  --name <name>      Installed skill directory name. Default: project-management.
  --repo <url>       Git repo URL. Default: https://github.com/SYU8384/project-management.git
  --ref <ref>        Branch or tag to install. Default: main.
  --yes              Skip confirmation prompts.
  --help            Show this help.

Examples:
  curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh | bash
  curl -fsSL https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh | bash -s -- --target codex --yes
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

expand_path() {
  local input="$1"
  case "$input" in
    "~") printf "%s" "$HOME" ;;
    "~/"*) printf "%s/%s" "$HOME" "${input#~/}" ;;
    *) printf "%s" "$input" ;;
  esac
}

target_dest_parent() {
  case "$1" in
    codex) printf "%s/skills" "${CODEX_HOME:-$HOME/.codex}" ;;
    agents) printf "%s/.agents/skills" "$HOME" ;;
    claude) printf "%s/.claude/skills" "$HOME" ;;
    openclaw) printf "%s/.openclaw/shared-skills" "$HOME" ;;
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
      --yes|-y)
        YES=1
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
  1) Codex   (~/.codex/skills)
  2) Agents  (~/.agents/skills)
  3) Claude  (~/.claude/skills)
  4) OpenClaw (~/.openclaw/shared-skills)
  5) Custom skills directory
MENU
  local choice
  choice="$(tty_read "Enter 1-5: ")"
  case "$choice" in
    1) TARGET="codex" ;;
    2) TARGET="agents" ;;
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
      die "$install_dir has local changes. Commit, stash, or remove them before updating."
    fi
    info "Updating existing install at $install_dir"
    git -C "$install_dir" pull --ff-only
  else
    info "Cloning $REPO_URL ($REF) to $install_dir"
    git clone --depth 1 --branch "$REF" "$REPO_URL" "$install_dir"
  fi

  [[ -f "$install_dir/SKILL.md" ]] || die "Installed directory is missing SKILL.md."
  if [[ ! -f "$install_dir/projects.json" ]]; then
    cp "$install_dir/templates/projects.template.json" "$install_dir/projects.json"
    info "Created local projects.json from template"
  else
    info "Keeping existing projects.json"
  fi
}

main() {
  parse_args "$@"
  need_cmd git

  if [[ -n "$TARGET" && -n "$DEST_PARENT" ]]; then
    die "Use either --target or --dest, not both."
  fi
  if [[ -z "$TARGET" && -z "$DEST_PARENT" ]]; then
    choose_target
  fi
  if [[ -n "$TARGET" ]]; then
    DEST_PARENT="$(target_dest_parent "$TARGET")"
  fi

  [[ -n "$DEST_PARENT" ]] || die "No destination selected."
  [[ "$SKILL_NAME" != *"/"* && "$SKILL_NAME" != "." && "$SKILL_NAME" != ".." ]] || die "Invalid skill name: $SKILL_NAME"

  local install_dir="$DEST_PARENT/$SKILL_NAME"

  if [[ "$YES" -ne 1 ]]; then
    echo "Install project-management to: $install_dir"
    local confirm
    confirm="$(tty_read "Continue? [y/N] ")"
    [[ "$confirm" == "y" || "$confirm" == "Y" ]] || die "Canceled."
  fi

  install_or_update "$install_dir"

  cat <<EOF

Installed project-management at:
  $install_dir

Next steps:
  1. Edit $install_dir/projects.json with your vault and project paths.
  2. Restart your agent so it discovers the skill.
EOF
}

main "$@"
