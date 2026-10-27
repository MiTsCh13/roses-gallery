#!/usr/bin/env bash
# Prepares Claude Code cloud sessions so lint, tests and the build run at once.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
pnpm install --frozen-lockfile
