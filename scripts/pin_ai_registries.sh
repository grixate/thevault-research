#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/core"
uv run python -m vault_core.scripts.pin_ai_registries "$@"
