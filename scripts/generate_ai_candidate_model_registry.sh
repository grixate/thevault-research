#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../services/core"
if command -v uv >/dev/null 2>&1; then
  uv run python -m vault_core.scripts.generate_ai_candidate_model_registry "$@"
else
  python -m vault_core.scripts.generate_ai_candidate_model_registry "$@"
fi
