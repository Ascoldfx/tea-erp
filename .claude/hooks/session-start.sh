#!/bin/bash
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"
git fetch origin main --quiet
git merge origin/main --ff-only --quiet 2>/dev/null || true

WIKI_DIR="$CLAUDE_PROJECT_DIR/graphify-out/tea-wiki"
if [ -d "$WIKI_DIR" ]; then
  echo "[session-start] Knowledge graph loaded:"
  ls "$WIKI_DIR" | sed 's/^/  - /'
  echo "[session-start] Entry point: graphify-out/tea-wiki/index.md"
else
  echo "[session-start] WARNING: graphify-out/tea-wiki/ not found"
fi
