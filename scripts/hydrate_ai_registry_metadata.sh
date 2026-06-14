#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/core"

if command -v uv >/dev/null 2>&1; then
  uv run python -m vault_core.scripts.hydrate_ai_registry_metadata "$@"
elif command -v python3 >/dev/null 2>&1; then
  python3 -m vault_core.scripts.hydrate_ai_registry_metadata "$@"
else
  python -m vault_core.scripts.hydrate_ai_registry_metadata "$@"
fi
