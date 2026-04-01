#!/usr/bin/env bash
set -euo pipefail

# Install skissue globally from a checkout of this repo (build + npm pack + npm install -g).
# Requires Node 24+ and npm.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "error: node is required (>=24)" >&2
  exit 1
fi

if ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)" 2>/dev/null; then
  echo "error: node >= 24 is required (got $(node -p process.version))" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "error: npm is required" >&2
  exit 1
fi

npm install
npm run build

TMP="${TMPDIR:-/tmp}"
ARCHIVE_NAME="$(npm pack --pack-destination "$TMP" | tail -1)"
ARCHIVE_PATH="$TMP/$ARCHIVE_NAME"

npm install -g "$ARCHIVE_PATH"
echo "Installed skissue from $ARCHIVE_PATH"
