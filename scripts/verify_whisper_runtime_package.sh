#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/core"

if command -v uv >/dev/null 2>&1; then
  uv run python -m vault_core.scripts.verify_whisper_runtime_package "$@"
else
  python -m vault_core.scripts.verify_whisper_runtime_package "$@"
fi
