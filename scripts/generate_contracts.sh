#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/core"
uv run python -m vault_core.scripts.export_openapi "$ROOT/packages/contracts/openapi.json"
echo "Wrote packages/contracts/openapi.json"

