#!/usr/bin/env bash
set -euo pipefail

SCRIPT_URL="https://raw.githubusercontent.com/SYU8384/project-management/main/install.sh"

if [[ -f "$(dirname "$0")/install.sh" ]]; then
  exec "$(dirname "$0")/install.sh" --update "$@"
fi

curl -fsSL "$SCRIPT_URL" | bash -s -- --update "$@"
