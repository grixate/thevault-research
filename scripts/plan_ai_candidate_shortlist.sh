#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../services/core"
if command -v uv >/dev/null 2>&1; then
  uv run python -m vault_core.scripts.plan_ai_candidate_shortlist "$@"
else
  python -m vault_core.scripts.plan_ai_candidate_shortlist "$@"
fi
