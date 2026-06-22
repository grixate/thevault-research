#!/usr/bin/env bash

core_python() {
  local root_dir
  root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  local core_dir="$root_dir/services/core"
  local python_path="$core_dir"
  if [[ -n "${PYTHONPATH:-}" ]]; then
    python_path="$python_path:$PYTHONPATH"
  fi

  if [[ -x "$core_dir/.venv/bin/python" ]]; then
    PYTHONPATH="$python_path" "$core_dir/.venv/bin/python" -m "$@"
  elif command -v uv >/dev/null 2>&1; then
    PYTHONPATH="$python_path" uv run --project "$core_dir" python -m "$@"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHONPATH="$python_path" python3 -m "$@"
  else
    PYTHONPATH="$python_path" python -m "$@"
  fi
}
