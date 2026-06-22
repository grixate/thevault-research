#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/core_python.sh"
core_python vault_core.scripts.export_openapi "$ROOT/packages/contracts/openapi.json"
echo "Wrote packages/contracts/openapi.json"
