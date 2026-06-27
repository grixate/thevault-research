#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="demo"
export CI="${CI:-true}"

usage() {
  cat <<'USAGE'
Usage: ./scripts/verify_v1.sh [--strict-production]

Runs the v1 quality gate:
  - Python core tests
  - Python lint
  - desktop unit/security/route tests
  - desktop production build
  - promptless browser QA smoke
  - renderer e2e smoke
  - AI registry structural validation
  - local AI smoke
  - local voice smoke
  - local AI readiness gate

Default mode allows the demo local-AI fixture path so the runnable v1 can pass.
Use --strict-production for release approval; it fails until real production
model/runtime manifests, approvals, checksums, and routes are pinned.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict-production)
      MODE="strict"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

run_step() {
  local label="$1"
  shift
  printf '\n==> %s\n' "$label"
  "$@"
  printf 'ok: %s\n' "$label"
}

cd "$ROOT"

echo "Vault v1 verification (${MODE})"
run_step "Python core tests" bash -lc "cd services/core && uv run pytest"
run_step "Python lint" bash -lc "cd services/core && uv run ruff check ."
run_step "Desktop tests" pnpm --filter @vault/desktop test -- --runInBand
run_step "Desktop production build" pnpm --filter @vault/desktop build
run_step "Promptless browser QA" node scripts/check_browser_qa.mjs
run_step "Renderer e2e smoke" pnpm e2e
run_step "AI registry validation" ./scripts/validate_ai_registries.sh
run_step "Local AI smoke" ./scripts/test_local_ai.sh --format json
run_step "Local voice smoke" ./scripts/test_voice_local.sh --format json

if [[ "$MODE" == "strict" ]]; then
  run_step "Strict local AI readiness" ./scripts/check_ai_readiness.sh
else
  run_step "Demo-allowed local AI readiness" ./scripts/check_ai_readiness.sh --allow-demo
fi

printf '\nVault v1 verification passed (%s).\n' "$MODE"
