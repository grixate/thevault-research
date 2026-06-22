#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib/core_python.sh"
core_python vault_core.scripts.run_ai_setup "$@"
