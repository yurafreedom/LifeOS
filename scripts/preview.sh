#!/bin/bash
# JENKIN local preview launcher (macOS). One command:
#
#   ./scripts/preview.sh                 preview this checkout (working tree as-is)
#   ./scripts/preview.sh --ref <branch|commit>   preview a fetched revision in a managed worktree
#   ./scripts/preview.sh status | stop | token | logs | help
#
# Documentation: scripts/preview/README.md. The work happens in
# scripts/preview/launcher.py (Python 3.11 standard library only).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

# Node is often provided by nvm, which only interactive shells load.
if ! command -v node >/dev/null 2>&1 && [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null 2>&1 || true
fi

python=""
for candidate in python3.11 /opt/homebrew/bin/python3.11 /usr/local/bin/python3.11; do
  if command -v "$candidate" >/dev/null 2>&1; then
    python="$(command -v "$candidate")"
    break
  fi
done
if [ -z "$python" ]; then
  echo "JENKIN preview needs Python 3.11 (the API requires >=3.11,<3.12)." >&2
  echo "Install it with: brew install python@3.11" >&2
  exit 1
fi

exec "$python" "$here/preview/launcher.py" "$@"
