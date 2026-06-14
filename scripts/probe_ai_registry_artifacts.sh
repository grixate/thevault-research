#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/core"

if command -v uv >/dev/null 2>&1; then
  uv run python -m vault_core.scripts.probe_ai_registry_artifacts "$@"
else
  python -m vault_core.scripts.probe_ai_registry_artifacts "$@"
fi
