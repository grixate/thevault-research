# Runtime Setup Probe - 2026-06-22

This folder records the production runtime setup probe that followed the local-AI registry pin.

## Result

- Fixed managed runtime archive extraction so archive installs preserve regular sibling files next to the selected executable.
- Added safe tar symlink-chain resolution for runtime archives by copying the linked regular file bytes under the alias name. This is required for the llama.cpp macOS release archive, whose dylibs use symlink aliases.
- Added a pinned llama.cpp runtime smoke test using `--help` with a 30 second timeout.
- Verified clean `/tmp` installs for:
  - `llama-cpp-managed-runtime`
  - `whisper-cpp-managed-runtime`
- Demoted `piper-managed-runtime` approval back to `pending` because the selected `piper_macos_aarch64.tar.gz` archive is not self-contained on this host: `piper` exits before `--version` because `libespeak-ng.1.dylib` is absent from the archive and not installed on the host.

## Verification

- `./scripts/validate_ai_registries.sh`: pass, with one expected warning for `piper-managed-runtime.approval.status`.
- `./scripts/check_ai_readiness.sh --format text`: blocked; production runtimes are 2/3 ready, production packs are 0/4 ready until Piper runtime approval is restored.
- `uv run pytest tests/test_core_flow.py -k "managed_runtime_url_archive_install or ai_setup_run_installs_demo_assets_and_safely_activates_routes or production_setup_runtime_selection_never_uses_demo_fixture or approved_production_setup_run_installs_tests_and_activates_pack or approved_voice_setup_run"`: 8 passed.
- `uv run ruff check vault_core tests`: passed.

## Next Gate

Package or select a self-contained Piper runtime for macOS, verify its byte stream and smoke behavior, apply approval evidence, repin the runtime registry, then rerun production setup and capability-route activation.
