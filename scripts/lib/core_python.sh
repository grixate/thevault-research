#!/usr/bin/env bash

core_python() {
  local root_dir
  root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  local core_dir="$root_dir/services/core"

  cd "$core_dir"
  if [[ -x "$core_dir/.venv/bin/python" ]]; then
    "$core_dir/.venv/bin/python" -m "$@"
  elif command -v uv >/dev/null 2>&1; then
    uv run python -m "$@"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -m "$@"
  else
    python -m "$@"
  fi
}
