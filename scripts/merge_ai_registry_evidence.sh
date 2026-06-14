#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/services/core"

if command -v uv >/dev/null 2>&1; then
  uv run python -m vault_core.scripts.merge_ai_registry_evidence "$@"
else
  python -m vault_core.scripts.merge_ai_registry_evidence "$@"
fi
