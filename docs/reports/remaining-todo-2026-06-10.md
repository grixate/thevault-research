# The Vault Research Lab - Remaining Todo Handoff

Generated: 2026-06-10  
Workspace: `/Users/grixate/Documents/Research lab`  
Current focus: continue moving the runnable v1 toward production quality without redefining success around demo-only local AI.

## How To Use This Document

This is the downloadable handoff file for the next session:

`docs/reports/remaining-todo-2026-06-10.md`

It is intentionally written as an execution document, not a status memo. Start from "Immediate Resume Point" first, then pick one workstream. Do not treat demo-mode success as production local-AI readiness.

## Immediate Resume Point

The last implementation slice built a reproducible macOS arm64 `whisper-cli` package from `whisper.cpp` source, moved the whisper runtime from distribution-decision to release-evidence, verified all production model candidate bytes, and merged the current byte-evidence files into one candidate overlay.

Completed in that slice:

- Ran scoped byte verification for:
  - `tiny-whisper-placeholder`
  - `standard-whisper-placeholder`
  - `llama-cpp-managed-runtime`
  - `piper-managed-runtime`
- Generated `/tmp/vault-small-ai-byte-evidence.json`.
- Verified 4/4 files and 20/20 byte checks with 0 blocked checks:
  - `ggml-tiny.en.bin`
  - `ggml-base.en.bin`
  - `llama-b9596-bin-macos-arm64.tar.gz`
  - `piper_macos_aarch64.tar.gz`
- Applied that byte evidence to temporary candidate files:
  - `/tmp/vault-candidate-model-registry.small-byte-patched.json`
  - `/tmp/vault-candidate-runtime-registry.small-byte-patched.json`
- Re-ran the candidate release plan against those temporary files. It is still correctly blocked: 142 checks, 24 blocked, 17 validation warnings, 0 check warnings.
- Installed CMake and built `whisper-cli` from `ggml-org/whisper.cpp` tag `v1.8.6` on macOS arm64.
- Added `scripts/package_whisper_cpp_runtime.sh` to reproduce the package build.
- Produced `/tmp/vault-whisper-package-script/dist/whisper.cpp-v1.8.6-macos-arm64.tar.gz`.
- Captured package metadata in `/tmp/vault-whisper-package-script/dist/whisper.cpp-v1.8.6-macos-arm64.metadata.json`.
- Added `scripts/verify_whisper_runtime_package.sh` plus the Python verifier for pre-publish package checks.
- Verified the real packaged tarball before publication:
  - report: `/tmp/vault-whisper-runtime-package-prepublish-verification.txt`
  - JSON: `/tmp/vault-whisper-runtime-package-prepublish-verification.json`
  - package SHA-256: `cfbba61b4f9a4fa3c0387ff7816c1368cac6394f2c97432e22b635564f03ad6d`
  - binary SHA-256: `8c967474d3c6acc16949e20a66abbc5da771bb04212e401ca1d11d3f5b89f3fc`
  - checks: 11/11 pass, 0 blocked
- Pinned the package filename, archive member, size, SHA-256, license URL, and smoke command in `candidate_shortlist.json`.
- Moved `whisper-cpp-macos-arm64` to `needs_release_evidence`.
- Regenerated a candidate runtime registry that applies all 3 production runtimes with 0 skipped:
  - `/tmp/vault-candidate-runtime-registry.whisper-packaged.json`
- Re-ran source probing and release planning against the new runtime candidate registry.
- Verified `tiny-gguf-placeholder` (`Qwen3-0.6B-Q8_0.gguf`) byte evidence:
  - SHA-256 `9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031`
  - size `639446688`
  - evidence file `/tmp/vault-tiny-qwen-byte-evidence.json`
- Verified `standard-gguf-placeholder` (`Qwen3-1.7B-Q8_0.gguf`) byte evidence:
  - SHA-256 `061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a`
  - size `1834426016`
  - evidence file `/tmp/vault-standard-qwen-byte-evidence.json`
- Verified `strong-gguf-placeholder` (`Qwen3-8B-Q4_K_M.gguf`) byte evidence:
  - SHA-256 `d98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785`
  - size `5027783488`
  - evidence file `/tmp/vault-strong-qwen-byte-evidence.json`
- Added `scripts/merge_ai_registry_evidence.sh` plus the Python merge CLI/module.
- Added URL-level download reuse in artifact byte verification so duplicate production slots can share one streamed hash result while still exporting evidence for each model ID.
- Added bounded retry handling for transient stream resets during large artifact byte verification.
- Merged current byte evidence into `/tmp/vault-merged-byte-evidence.json`:
  - `/tmp/vault-piper-byte-evidence.json`
  - `/tmp/vault-small-ai-byte-evidence.json`
  - `/tmp/vault-tiny-qwen-byte-evidence.json`
- Applied the merged evidence to:
  - `/tmp/vault-candidate-model-registry.merged-byte-patched.json`
  - `/tmp/vault-candidate-runtime-registry.merged-byte-patched.json`
- Verified the shared embedding file for both embedding slots:
  - `tiny-embedding-placeholder`
  - `balanced-embedding-placeholder`
  - evidence file `/tmp/vault-embedding-byte-evidence.json`
- Verified the shared reranker file for both reranker slots:
  - `tiny-reranker-placeholder`
  - `balanced-reranker-placeholder`
  - evidence file `/tmp/vault-reranker-byte-evidence.json`
- Merged embedding/reranker byte evidence into `/tmp/vault-merged-byte-evidence.with-embedding-reranker.json`.
- Applied the newest merged evidence to:
  - `/tmp/vault-candidate-model-registry.embedding-reranker-byte-patched.json`
  - `/tmp/vault-candidate-runtime-registry.embedding-reranker-byte-patched.json`
- Merged standard Qwen evidence into `/tmp/vault-merged-byte-evidence.with-standard-qwen.json`.
- Applied the newest merged evidence to:
  - `/tmp/vault-candidate-model-registry.standard-qwen-byte-patched.json`
  - `/tmp/vault-candidate-runtime-registry.standard-qwen-byte-patched.json`
- Merged strong Qwen evidence into `/tmp/vault-merged-byte-evidence.all-models.json`.
- Applied the all-model byte evidence to:
  - `/tmp/vault-candidate-model-registry.all-models-byte-patched.json`
  - `/tmp/vault-candidate-runtime-registry.all-models-byte-patched.json`

Verified after that slice:

- `./scripts/verify_ai_registry_artifacts.sh --model-registry /tmp/vault-candidate-model-registry.piper-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.piper-byte-patched.json --artifact-id tiny-whisper-placeholder --artifact-id standard-whisper-placeholder --artifact-id llama-cpp-managed-runtime --artifact-id piper-managed-runtime --max-bytes 200000000 ...`: passed with warn status from unrelated validation warnings; 4/4 files verified, 20/20 verification checks passed, 0 blocked.
- `./scripts/apply_ai_registry_evidence.sh --model-registry /tmp/vault-candidate-model-registry.piper-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.piper-byte-patched.json --evidence /tmp/vault-small-ai-byte-evidence.json ...`: applied, 12 fields patched or confirmed.
- `./scripts/package_whisper_cpp_runtime.sh --tag v1.8.6 --work-dir /tmp/vault-whisper-package-script --output-dir /tmp/vault-whisper-package-script/dist --jobs 6`: passed; wrote package and metadata.
- `./scripts/verify_whisper_runtime_package.sh --package /tmp/vault-whisper-package-script/dist/whisper.cpp-v1.8.6-macos-arm64.tar.gz --metadata /tmp/vault-whisper-package-script/dist/whisper.cpp-v1.8.6-macos-arm64.metadata.json --format summary --output /tmp/vault-whisper-runtime-package-prepublish-verification.txt`: passed; filename, size, SHA-256, archive member, executable bit, `--help` smoke, and metadata all matched candidate evidence.
- `./scripts/verify_whisper_runtime_package.sh --package /tmp/vault-whisper-package-script/dist/whisper.cpp-v1.8.6-macos-arm64.tar.gz --metadata /tmp/vault-whisper-package-script/dist/whisper.cpp-v1.8.6-macos-arm64.metadata.json --format json --output /tmp/vault-whisper-runtime-package-prepublish-verification.json`: passed; wrote machine-readable pre-publish evidence.
- `./scripts/generate_ai_candidate_runtime_registry.sh --output /tmp/vault-candidate-runtime-registry.whisper-packaged.json --format json`: passed; 3 applied, 0 skipped, 0 errors.
- `./scripts/plan_ai_registry_release.sh --model-registry /tmp/vault-candidate-model-registry.small-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.whisper-packaged.json --format text`: expected blocked exit; structural validation passed with 0 errors and 14 warnings; 142 checks, 20 blocked, 0 check warnings; production packs 0/3, production models 0/10, production runtimes 0/3.
- `./scripts/probe_ai_registry_artifacts.sh --model-registry /tmp/vault-candidate-model-registry.small-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.whisper-packaged.json --format json --output /tmp/vault-whisper-packaged-source-probe.json`: expected warn exit; 53 checks, 52 pass, 0 blocked, 1 pending. Only `whisper-cpp-managed-runtime:files[0]:source` remains pending because the package has not been published to an approved URL.
- `./scripts/merge_ai_registry_evidence.sh /tmp/vault-piper-byte-evidence.json /tmp/vault-small-ai-byte-evidence.json /tmp/vault-tiny-qwen-byte-evidence.json --output /tmp/vault-merged-byte-evidence.json`: passed.
- `./scripts/apply_ai_registry_evidence.sh --model-registry /tmp/vault-candidate-model-registry.small-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.whisper-packaged.json --evidence /tmp/vault-merged-byte-evidence.json ...`: applied 21 fields; structural validation passed with 0 errors and 14 warnings.
- `./scripts/plan_ai_registry_release.sh --model-registry /tmp/vault-candidate-model-registry.merged-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.merged-byte-patched.json --format text`: expected blocked exit; structural validation passed with 0 errors and 14 warnings; 142 checks, 20 blocked, 0 check warnings; production packs 0/3, production models 0/10, production runtimes 0/3.
- `./scripts/probe_ai_registry_artifacts.sh --model-registry /tmp/vault-candidate-model-registry.merged-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.merged-byte-patched.json --format json --output /tmp/vault-merged-byte-source-probe.json`: expected warn exit; 53 checks, 52 pass, 0 blocked, 1 pending. Only `whisper-cpp-managed-runtime:files[0]:source` remains pending because the package has not been published to an approved URL.
- `./scripts/verify_ai_registry_artifacts.sh --model-registry /tmp/vault-candidate-model-registry.merged-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.merged-byte-patched.json --artifact-id tiny-embedding-placeholder --artifact-id balanced-embedding-placeholder --max-bytes 1300000000 --timeout 900 ...`: passed with warn status from validation warnings; 2/2 files verified, 10/10 verification checks passed, 0 blocked.
- `./scripts/verify_ai_registry_artifacts.sh --model-registry /tmp/vault-candidate-model-registry.embedding-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.embedding-byte-patched.json --artifact-id tiny-reranker-placeholder --artifact-id balanced-reranker-placeholder --max-bytes 1300000000 --timeout 900 ...`: passed with warn status from validation warnings; 2/2 files verified, 10/10 verification checks passed, 0 blocked.
- `./scripts/merge_ai_registry_evidence.sh /tmp/vault-merged-byte-evidence.with-embedding.json /tmp/vault-reranker-byte-evidence.json --output /tmp/vault-merged-byte-evidence.with-embedding-reranker.json`: passed.
- `./scripts/apply_ai_registry_evidence.sh --model-registry /tmp/vault-candidate-model-registry.embedding-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.embedding-byte-patched.json --evidence /tmp/vault-merged-byte-evidence.with-embedding-reranker.json ...`: applied 33 fields; structural validation passed with 0 errors and 14 warnings.
- `./scripts/plan_ai_registry_release.sh --model-registry /tmp/vault-candidate-model-registry.embedding-reranker-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.embedding-reranker-byte-patched.json --format text`: expected blocked exit; structural validation passed with 0 errors and 14 warnings; 142 checks, 20 blocked, 0 check warnings; production packs 0/3, production models 0/10, production runtimes 0/3.
- `./scripts/probe_ai_registry_artifacts.sh --model-registry /tmp/vault-candidate-model-registry.embedding-reranker-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.embedding-reranker-byte-patched.json --format json --output /tmp/vault-embedding-reranker-byte-source-probe.json`: expected warn exit; 53 checks, 52 pass, 0 blocked, 1 pending. Only `whisper-cpp-managed-runtime:files[0]:source` remains pending because the package has not been published to an approved URL.
- `./scripts/verify_ai_registry_artifacts.sh --model-registry /tmp/vault-candidate-model-registry.embedding-reranker-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.embedding-reranker-byte-patched.json --artifact-id standard-gguf-placeholder --max-bytes 2000000000 --timeout 1200 ...`: passed with warn status from validation warnings; 1/1 file verified, 5/5 verification checks passed, 0 blocked.
- `./scripts/merge_ai_registry_evidence.sh /tmp/vault-merged-byte-evidence.with-embedding-reranker.json /tmp/vault-standard-qwen-byte-evidence.json --output /tmp/vault-merged-byte-evidence.with-standard-qwen.json`: passed.
- `./scripts/apply_ai_registry_evidence.sh --model-registry /tmp/vault-candidate-model-registry.embedding-reranker-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.embedding-reranker-byte-patched.json --evidence /tmp/vault-merged-byte-evidence.with-standard-qwen.json ...`: applied 36 fields; structural validation passed with 0 errors and 14 warnings.
- `./scripts/plan_ai_registry_release.sh --model-registry /tmp/vault-candidate-model-registry.standard-qwen-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.standard-qwen-byte-patched.json --format text`: expected blocked exit; structural validation passed with 0 errors and 14 warnings; 142 checks, 20 blocked, 0 check warnings; production packs 0/3, production models 0/10, production runtimes 0/3.
- `./scripts/probe_ai_registry_artifacts.sh --model-registry /tmp/vault-candidate-model-registry.standard-qwen-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.standard-qwen-byte-patched.json --format json --output /tmp/vault-standard-qwen-byte-source-probe.json`: expected warn exit; 53 checks, 52 pass, 0 blocked, 1 pending. Only `whisper-cpp-managed-runtime:files[0]:source` remains pending because the package has not been published to an approved URL.
- `./scripts/verify_ai_registry_artifacts.sh --model-registry /tmp/vault-candidate-model-registry.standard-qwen-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.standard-qwen-byte-patched.json --artifact-id strong-gguf-placeholder --max-bytes 5500000000 --timeout 2400 ...`: passed with warn status from validation warnings; 1/1 file verified, 5/5 verification checks passed, 0 blocked.
- `./scripts/merge_ai_registry_evidence.sh /tmp/vault-merged-byte-evidence.with-standard-qwen.json /tmp/vault-strong-qwen-byte-evidence.json --output /tmp/vault-merged-byte-evidence.all-models.json`: passed.
- `./scripts/apply_ai_registry_evidence.sh --model-registry /tmp/vault-candidate-model-registry.standard-qwen-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.standard-qwen-byte-patched.json --evidence /tmp/vault-merged-byte-evidence.all-models.json ...`: applied 39 fields; structural validation passed with 0 errors and 14 warnings.
- `./scripts/plan_ai_registry_release.sh --model-registry /tmp/vault-candidate-model-registry.all-models-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.all-models-byte-patched.json --format text`: expected blocked exit; structural validation passed with 0 errors and 14 warnings; 142 checks, 20 blocked, 0 check warnings; production packs 0/3, production models 0/10, production runtimes 0/3.
- `./scripts/probe_ai_registry_artifacts.sh --model-registry /tmp/vault-candidate-model-registry.all-models-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.all-models-byte-patched.json --format json --output /tmp/vault-all-models-byte-source-probe.json`: expected warn exit; 53 checks, 52 pass, 0 blocked, 1 pending. Only `whisper-cpp-managed-runtime:files[0]:source` remains pending because the package has not been published to an approved URL.
- `uv run pytest tests/test_core_flow.py -k "evidence_merge or artifact_verification or evidence_overlay"`: passed, 11 focused tests.
- `uv run pytest tests/test_core_flow.py -k "candidate_shortlist or candidate_runtime_registry"`: passed, 6 focused tests.
- `uv run pytest tests/test_core_flow.py -k "artifact_verification or evidence_merge or evidence_overlay or candidate_shortlist or candidate_runtime"`: passed, 19 focused tests.
- `./scripts/prepare_ai_registry_release_candidate.sh --model-registry /tmp/vault-candidate-model-registry.standard-qwen-byte-patched.json --runtime-registry /tmp/vault-candidate-runtime-registry.standard-qwen-byte-patched.json --evidence /tmp/vault-merged-byte-evidence.all-models.json --output-dir /tmp/vault-all-models-release-packet --probe-sources --format summary`: expected blocked exit; generated a 10-file release packet with source probe status `warn`, 39 applied evidence fields, and a structured blocking finding for `whisper-cpp-managed-runtime:files[0]:source`.
- `./scripts/apply_whisper_runtime_package_url.sh --url https://downloads.example.test/vault/whisper.cpp-v1.8.6-macos-arm64.tar.gz --output-shortlist /tmp/vault-candidate-shortlist.with-whisper-url.example.json --runtime-output /tmp/vault-candidate-runtime-registry.with-whisper-url.example.json --format summary`: passed with a fixture URL; updated only the copied shortlist, generated a runtime registry with 3 applied / 0 skipped / 0 errors, preserved the pinned whisper runtime SHA-256/size/archive member/smoke test, and emitted follow-up probe/byte-verification commands.
- `uv run pytest tests/test_core_flow.py -k "managed_runtime_url_archive_install or whisper_runtime_package_url or candidate_runtime or release_candidate_packet or release_packet"`: passed, 12 focused tests.
- `uv run pytest tests/test_core_flow.py -k "whisper_runtime_package_verify or whisper_runtime_package_url or managed_runtime_url_archive_install"`: passed, 7 focused tests.
- `uv run ruff check vault_core tests`: passed.

Recommended next slice: publish `/tmp/vault-whisper-package-script/dist/whisper.cpp-v1.8.6-macos-arm64.tar.gz` to an approved immutable release URL, then run:

```bash
./scripts/apply_whisper_runtime_package_url.sh \
  --url APPROVED_HTTPS_URL_FOR_whisper.cpp-v1.8.6-macos-arm64.tar.gz \
  --output-shortlist /tmp/vault-candidate-shortlist.with-whisper-url.json \
  --runtime-output /tmp/vault-candidate-runtime-registry.with-whisper-url.json \
  --format summary
```

Then re-run source probe and byte verification against `/tmp/vault-candidate-runtime-registry.with-whisper-url.json`.

Note: strict production is still blocked by design. Merged byte evidence now covers all 10 production model candidate IDs plus selected llama.cpp/Piper runtime archives. The whisper.cpp macOS arm64 runtime package is built, pinned in candidate metadata, and pre-publish verified with filename, size, SHA-256, archive member, executable bit, `--help` smoke, and metadata checks passing. It still needs an approved immutable URL. Source/license probing has 0 blocked checks against the latest temporary patched candidates and only the unpublished whisper package URL pending. None of this pins production registries or marks approval complete. The candidate set still lacks release approval evidence, a published whisper.cpp runtime package URL, full setup-run smoke verification with approved manifests, and capability-route activation.

## Current State

The app is still the intended product: a local-first notes and knowledge base workspace with integrated local models, local voice workflows, immutable Storage, editable Notes, review-gated knowledge, and a private research-lab operating model.

The current v1 base is healthy in demo mode.

Design north star: use Notion, Obsidian, and Apple Notes as the practical reference set. The app should feel like a quiet writing and knowledge workspace, not an Atlassian/Microsoft-style admin console. Keep navigation minimal, captions specific, controls sparse, and user flow obvious: Notes are for editable thinking, Storage is for immutable evidence, Review is the trust gate, Assistant is grounded synthesis, and Settings is for local/private configuration.

Current accepted UI bar after user review on 2026-06-12: the desktop Quick note redesign should be used as the minimalist reference direction. Prefer native-feeling Spotlight/Apple Notes patterns: content first, no decorative sublines, no route-card explanations, no duplicate actions, minimal labels, subtle segmented controls, quiet glass/paper surfaces, and visible controls only where they directly support the current action.

Capsules addendum: `/Users/grixate/Downloads/the_vault_research_lab_knowledge_capsules_codex_spec.md` is now part of the product plan. Capsules are first-class, transferable, versioned, evidence-backed projections of the global Vault graph. They must reference canonical Notes, Storage, claims, concepts, evidence links, learning items, and tools; they must not become isolated mini-vaults or folders.

Latest full demo gate on 2026-06-10:

- `pnpm verify`: passed in demo mode.
- Python core tests: 124 passed.
- Python lint: passed.
- Desktop tests: 60 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.
- AI registry validation: passed with 0 errors and 75 expected release-approval warnings.
- Local AI smoke: passed with demo fixtures, readiness warning preserved.
- Local voice smoke: passed.
- Demo-allowed local AI readiness: command passed while honestly reporting production blockers.

Latest local-AI production candidate verification on 2026-06-12:

- Candidate model registry generation: passed, 10 hydration-ready model entries applied and 0 entries skipped.
- Candidate metadata hydration: passed, 31 fields updated, 1 warning, 0 errors.
- Candidate runtime registry generation: passed, 3 selected runtime entries applied and 0 unresolved runtime entries skipped.
- Candidate shortlist report: passed, now shows 0 source-confirmation gates, 3 release-evidence gates, and 0 runtime distribution decisions.
- Selected Qwen model license artifacts: passed, pinned for three GGUF model candidates plus embedding/reranker model-card license artifacts.
- Selected Whisper STT model artifacts: passed, pinned public `ggerganov/whisper.cpp` source, MIT model-card license artifact, revisions, sizes, and SHA-256 values for `ggml-tiny.en.bin` and `ggml-base.en.bin`.
- Selected Piper TTS voice artifacts: passed with one expected hydration warning, pinned ONNX + JSON sidecar, repo revision, ONNX size/SHA-256, sidecar size, and voice model-card license/evidence artifact.
- Scoped Piper byte verification: passed, verified ONNX + JSON sidecar bytes and produced sidecar SHA-256 `2250a9a605b8dc35a116717fadc5056695dd809e34a15d02f72a0f52d53d3ebb` in a temporary evidence overlay.
- Scoped Whisper/runtime byte verification: passed, verified `ggml-tiny.en.bin`, `ggml-base.en.bin`, `llama-b9596-bin-macos-arm64.tar.gz`, and `piper_macos_aarch64.tar.gz`; 4/4 files verified and 20/20 byte checks passed.
- Evidence overlay: passed after multi-file overlay fix, patched the Piper sidecar SHA into `/tmp/vault-candidate-model-registry.piper-byte-patched.json`.
- Whisper runtime distribution decision: checked latest `ggml-org/whisper.cpp` `v1.8.6` release on 2026-06-12, rejected the xcframework/Windows assets for managed CLI use, and recorded `package-approved-macos-arm64-cli-from-source` as the recommended path.
- Source/license probe: expected warn result after checksum-header fix; latest all-model candidate probe has 53 checks, 52 pass, 0 blocked, and 1 pending for the unpublished `whisper-cpp-managed-runtime` package source URL.
- Runtime archive inspection: passed, pinned `llama-b9596/llama-cli` and `piper/piper` archive members.
- Runtime archive byte metadata: passed, pinned sizes and SHA-256 values for selected llama.cpp and Piper archives.
- Runtime license artifacts: passed, pinned release-tag license URLs for selected llama.cpp and Piper candidates.
- Combined candidate release plan after all current byte evidence: expected blocked result; structural validation passed with 0 errors, 14 warnings, 20 blocked checks, and 0/3 production packs ready.
- Focused candidate tests: latest focused local-AI slice passed 7 verifier/runtime tests plus the earlier 12 release/runtime tests.
- Adjacent release/readiness tests: 20 passed.
- Python lint: passed.

Latest capsule alpha verification on 2026-06-14:

- Added capsule schema foundations in the existing SQLite bootstrap style: `capsules`, `capsule_items`, `capsule_versions`, `capsule_dependencies`, `capsule_health_snapshots`, `capsule_exports`, `capsule_imports`, and `capsule_changelog`.
- Added backend capsule services/routes for create, list, detail, update, archive, add/remove referenced global items, auto-include claim evidence, run health, create snapshots, and list versions.
- Added desktop route wiring in browser dev mode and Electron IPC.
- Added `Capsules` to the Knowledge navigation and a minimal first UI slice: capsule index, create dialog, selected capsule detail, health/status, add existing note/source/claim, auto evidence inclusion for claims, and manual snapshots.
- The UI slice intentionally does not fake the full future tab system. Export/import quarantine, diff, fork, learning generation, tool attachment review, and capsule assistant context remain follow-up work.
- Focused backend capsule test: 1 passed.
- Focused desktop capsule test: passed; desktop test count is now 62.
- Desktop production build: passed.
- Playwright desktop Capsules smoke: Capsules rendered at 1440x950 with no horizontal overflow, no visible spec/marketing copy (`portable projection of the graph`, `not a folder`, `mini-vaults`), and the selected capsule detail rendered. Screenshot captured at `/tmp/vault-capsules-alpha-desktop.png`.

Latest capsule workflow verification on 2026-06-15:

- Added compact `Add to capsule` entry points from the current Note, selected Storage source, selected Storage source block, and selected Graph claim.
- Review can now attach a newly approved claim to a selected capsule in the same approval action, with claim evidence included automatically.
- The workflow attach dialog stays compact: capsule, role, optional source export policy, optional claim evidence, and Add/Cancel only.
- Removed the old note-tools subtitle while touching the note toolbar, keeping the document surface closer to the accepted minimalist direction.
- Desktop tests: 63 passed.
- Desktop production build: passed.

Latest capsule export verification on 2026-06-15:

- Added backend capsule export preview and `.vaultcapsule` package creation.
- Export preview now reports mode, privacy status, private item count, full-source private policy count, disabled tools, unsupported claims, exact quote count, estimated records, warnings, blockers, and checksum readiness.
- Non-private export modes are blocked when private capsule items or `full_sources_private` source policies are present.
- `.vaultcapsule` export writes a zip package with `manifest.json`, `manifest-sha256.txt`, capsule/items/source/note/claim/evidence/graph/learning/tool records, health report, privacy report, validation report, note markdown, file checksums, and audit rows in `capsule_exports`.
- Added a compact desktop Export dialog from capsule detail with mode selection, preview counters, blockers/warnings, disabled export when blocked, and saved package result.
- Focused backend capsule test: passed.
- Desktop capsule/export test path: passed.
- Desktop production build: passed.

Latest capsule import quarantine verification on 2026-06-15:

- Added backend `.vaultcapsule` import quarantine.
- Import now copies the original package into `capsules/imports/{import_id}/original.vaultcapsule`, validates safe zip paths, rejects absolute/path-traversal/symlink entries, enforces file-count and unpacked-size limits, validates `manifest-sha256.txt`, validates manifest file checksums, and writes `manifest.json`, `validation_report.json`, and `merge_plan.json` into the quarantine folder.
- Import creates a `capsule_imports` audit row and a global event, but does not create canonical notes, sources, claims, tools, or capsules.
- Merge plan currently reports review actions and keeps imported tools disabled by default; selective merge/review-item creation remains future work.
- Added a compact desktop `Import` action on Capsules and a quarantine inspection view with status, source/quarantine paths, object counts, checksum summary, and merge-plan actions.
- Focused backend capsule test: passed.
- Desktop capsule import/export test path: passed.
- Desktop production build: passed.

Latest focused verification on 2026-06-11 before the current claim-grammar slice:

- Python core tests: 125 passed.
- Desktop tests: 60 passed.
- Desktop production build: passed.

Latest backend verification on 2026-06-11 after the current claim-grammar slice:

- Python core tests: 126 passed.

Latest backend verification on 2026-06-11 after the current generated-note structure slice:

- Python core tests: 126 passed.

Latest focused verification on 2026-06-11 after the current malformed-relation slice:

- Object extraction tests: 6 passed.

Latest backend verification on 2026-06-11 after the current malformed-relation slice:

- Python core tests: 127 passed.

Latest focused verification on 2026-06-11 after the current weak-evidence status slice:

- Tool/Night Lab review tests: 2 passed.

Latest backend verification on 2026-06-11 after the current weak-evidence status slice:

- Python core tests: 127 passed.

Latest focused verification on 2026-06-11 after the current contradiction review slice:

- Local object/contradiction extraction tests: 7 passed.

Latest backend verification on 2026-06-11 after the current contradiction review slice:

- Python core tests: 128 passed.

Latest focused verification on 2026-06-11 after the current generated-note section slice:

- Generated-note/local llama tests: 5 passed.

Latest backend verification on 2026-06-11 after the current generated-note section slice:

- Python core tests: 128 passed.

Latest focused verification on 2026-06-11 after the current generated-note citation slice:

- Generated-note/local llama tests: 6 passed.

Latest backend verification on 2026-06-11 after the current generated-note citation slice:

- Python core tests: 129 passed.

Latest desktop verification on 2026-06-12 after the current minimalist workspace UX slice:

- The cluttered Notes/Storage path strip was removed from the Notes list pane after visual review. Storage remains a separate navigation surface instead of a mini-card inside Notes.
- The same path strip was removed from Storage; Notes and Storage are now separated by the main navigation, not by repeated in-pane cards.
- The Notes pane now keeps one local primary action, `New note`; quick capture remains available through the global `Quick note` button, shortcut, and empty-state action.
- The Notes filter tab row was removed; purpose is now shown by lightweight note badges in the list rather than a cramped filter control.
- Topbar subtitles, Notes/Storage section sublines, source-detail helper copy, and the Add Source dialog subtitle were removed; desktop topbar height was reduced to 64px.
- Home was reduced from a hero-style statement to a plain `Home` surface.
- Empty Storage detail now stays quiet until a source is selected; source pipeline, capability chips, block filters, and extraction actions are hidden when they are not actionable.
- Storage empty/search copy and the Add Source tabs were shortened so they name actions rather than explain the app.
- Add source was moved closer to the accepted minimalist direction: compact glass/paper sheet, pill import modes, hidden semantic labels for paste title/text, no second paste heading, no file/audio explanatory paragraphs, and shorter save/shortcut copy.
- Home was brought closer to the same minimalist bar: duplicated Home section header and duplicate action row removed, first-run route explanations removed, the old `Start here` guide copy removed, route controls collapsed into one compact status/action strip, Storage empty copy reduced to `No sources`, and the lower Home panels now size to content instead of stretching into blank cards.
- Review list copy was reduced to status/counts; the repeated trust-gate teaching text was removed from the list and detail empty states.
- Assistant idle state no longer renders grounding/citation scaffolding before a question is asked.
- Assistant was reshaped from a split workbench into a modern chat-style flow: centered conversation, prompt chips, compact evidence selector, bottom composer, voice question, and answer-owned grounding/citations.
- Desktop Quick note was redesigned into a Spotlight-like capture surface: no visible title, no leading note icon, close icon anchored top-right, one borderless writing area, subtle `Note` / `Source` destination control, keyboard hint, and one icon save action. Visible helper description, route-card sublines, destination badges, and Cancel clutter were removed.
- The editor header was softened into a document-first surface: title, quiet note context, save/status badges, compact formatting toolbar, and a secondary local-tools drawer.
- Notes empty state now offers only the practical starts: `Quick note`, `New note`, and `Storage`.
- Global visual variables moved from cream-heavy tones toward a neutral Shadcn `new-york`/Apple-notes-like graphite paper palette.
- Shadcn config is present and aligned: `new-york`, neutral base, CSS variables, Lucide icons.
- Desktop tests: 61 passed.
- Desktop production build: passed.
- Playwright desktop Home smoke: Home rendered at 1440x950 with no horizontal overflow, no old tutorial strings (`Start here`, `Capture a thought without choosing a folder first.`, `Import source material when it should stay unchanged.`, `Suggestions wait here before becoming knowledge.`, `Choose approved local models before trusting automation.`), and compact lane buttons for Notes, Storage, Review, and Models. Screenshot captured at `/tmp/vault-home-minimal-desktop.png`.
- Playwright visual smoke: Notes rendered at 1440x950 and 390x844 with no horizontal overflow, no topbar subtitle, and no `Note type` tablist; screenshots captured at `/tmp/vault-notes-desktop.png` and `/tmp/vault-notes-mobile.png`.
- Playwright editor smoke: selected-note editor rendered at 1440x950 and 390x844 with no horizontal overflow; screenshots captured at `/tmp/vault-editor-desktop.png` and `/tmp/vault-editor-mobile.png`.
- Playwright Storage smoke: Storage rendered at 1440x950 and 390x844 with no horizontal overflow, no path strip, and no section descriptions; screenshots captured at `/tmp/vault-storage-desktop.png` and `/tmp/vault-storage-mobile.png`.
- Playwright follow-up smoke: Storage, Review, and Assistant rendered with no horizontal overflow, no path strip, no topbar subtitle, and no section descriptions. Storage has one `Add source` action; Assistant no longer shows the old idle grounding copy. Screenshots captured at `/tmp/vault-storage-minimal-desktop.png`, `/tmp/vault-storage-minimal-mobile.png`, `/tmp/vault-review-minimal-desktop.png`, `/tmp/vault-assistant-minimal-desktop.png`, and `/tmp/vault-assistant-minimal-v2-desktop.png`.
- Playwright Assistant chat smoke: Assistant rendered at 1440x950 and 390x844 with no horizontal overflow, no old split-pane compose/answer surfaces, prompt chips visible, and no section descriptions. Screenshots captured at `/tmp/vault-assistant-chat-desktop.png` and `/tmp/vault-assistant-chat-mobile.png`.
- User review note on 2026-06-12: the Assistant mobile layout is still broken despite the no-overflow smoke result. Do not treat the mobile screenshot as accepted visual QA. Skip mobile repair for the next slice unless explicitly resumed.
- Playwright desktop Quick note smoke: Quick note rendered at 1440x950 with no horizontal overflow, no visible helper description, no destination badges, no Cancel button, no leading note icon, a borderless textarea, and the expected `Note`/`Source` destination control. Screenshots captured at `/tmp/vault-quick-note-spotlight-desktop.png`, `/tmp/vault-quick-note-spotlight-desktop-v2.png`, and accepted direction `/tmp/vault-quick-note-spotlight-desktop-v3.png`.
- Playwright desktop Add source smoke: paste/files/audio intake rendered at 1440x950 with no horizontal overflow and none of the old explanatory strings (`Paste source text`, `Import Markdown`, `The original file`, `local voice route`, `timestamped transcript blocks`, `Paste the source exactly as captured.`). Screenshots captured at `/tmp/vault-add-source-paste-desktop.png`, `/tmp/vault-add-source-files-desktop.png`, and `/tmp/vault-add-source-audio-desktop.png`.

Latest desktop verification on 2026-06-11 after the current Notes/Storage/Quick Note UX slice:

- Desktop tests: 60 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Review trust-decision UX slice:

- Desktop tests: 60 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings Voice read-aloud UX slice:

- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Notes dictation result UX slice:

- Focused Notes dictation tests: 3 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Assistant grounding context UX slice:

- Focused Assistant grounding test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings Privacy model-activity UX slice:

- Focused Settings Privacy test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Review provenance UX slice:

- Focused Review test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Local tools run-status UX slice:

- Focused Local tools test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings Search route-test UX slice:

- Focused Settings Search route tests: 2 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Home Night Lab status UX slice:

- Focused Home Night Lab test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings model download queue UX slice:

- Focused Settings Models download queue test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings embedding reindex progress UX slice:

- Focused Settings Search embedding progress test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings private setup guide UX slice:

- Focused Settings Models local model pack test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings setup result UX slice:

- Focused Settings Models local model pack test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings runtime card UX slice:

- Focused Settings Models local model pack test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings model pack card UX slice:

- Focused Settings Models local model pack test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings model pack route coverage UX slice:

- Focused Settings Models local model pack test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings setup wizard status UX slice:

- Focused Settings Models local model pack test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings setup wizard runtime preview UX slice:

- Focused Settings Models local model pack test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings setup action label UX slice:

- Focused Settings Models local model pack test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings model pack metric UX slice:

- Focused Settings Models local model pack test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings local model summary copy UX slice:

- Focused Settings Models local model pack test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings local model setup-path copy UX slice:

- Focused Settings Models local model pack test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings Approval details copy UX slice:

- Focused Settings Models local model pack test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest desktop verification on 2026-06-11 after the current Settings candidate check copy UX slice:

- Focused Settings Models local model pack test: 1 passed.
- Desktop tests: 56 passed.
- Desktop production build: passed.
- Renderer e2e smoke: passed.

Latest backend/local-AI verification on 2026-06-12 after the current whisper-runtime package slice:

- Candidate model registry generation: passed, 10 applied, 0 skipped, 0 errors.
- Candidate metadata hydration: passed, 31 fields updated, 1 warning, 0 errors.
- Candidate runtime registry generation: passed, 3 applied, 0 skipped, 0 errors.
- Selected Qwen model license URLs: pinned for three GGUF models and model-card license artifacts pinned for embedding/reranker.
- Selected Whisper STT models: pinned public `ggerganov/whisper.cpp` source, MIT model-card license artifact, immutable revision, sizes, and SHA-256 values for tiny/base English files.
- Selected Piper TTS voice model: pinned repo, voice model-card license/evidence artifact, ONNX + JSON sidecar filenames, immutable revision, ONNX size/SHA-256, sidecar size, and full byte-verified sidecar SHA-256 in the temporary patched candidate registry.
- Runtime archive members: `llama-b9596/llama-cli` and `piper/piper` inspected and pinned.
- Runtime archive size/SHA-256 metadata: pinned for selected llama.cpp and Piper candidates.
- Runtime license URLs: pinned for selected llama.cpp and Piper candidates.
- Candidate shortlist report: passed, 10/10 model targets covered, 3/3 runtime targets covered, 0 source-confirmation gates, 3 release-evidence gates, 0 runtime distribution decisions.
- Scoped Piper byte verification: passed, 2/2 files verified and 10/10 byte checks passed.
- Scoped small-artifact byte verification: passed, 4/4 files verified and 20/20 byte checks passed for Whisper tiny/base models plus llama.cpp/Piper runtime archives.
- Scoped tiny Qwen byte verification: passed, `Qwen3-0.6B-Q8_0.gguf` verified with SHA-256 `9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031` and size `639446688`.
- Scoped standard Qwen byte verification: passed, `Qwen3-1.7B-Q8_0.gguf` verified with SHA-256 `061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a` and size `1834426016`.
- Scoped strong Qwen byte verification: passed, `Qwen3-8B-Q4_K_M.gguf` verified with SHA-256 `d98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785` and size `5027783488`.
- Scoped embedding byte verification: passed, 2/2 model slots verified and 10/10 byte checks passed for the shared `Qwen/Qwen3-Embedding-0.6B` `model.safetensors` file.
- Scoped reranker byte verification: passed, 2/2 model slots verified and 10/10 byte checks passed for the shared `Qwen/Qwen3-Reranker-0.6B` `model.safetensors` file.
- Artifact byte verification now reuses duplicate artifact downloads by URL, which avoids streaming the same embedding/reranker file twice for tiny and balanced slots.
- Artifact byte verification now retries transient stream resets, which made large Qwen verification resilient to a connection reset during the first attempt.
- Evidence overlay with multi-file fix: passed, 6 fields applied, patched model registry SHA-256 `065f12df5f63346a7a246ae47378ce993a85281084629a5aeb5187e7c4c4fd66`.
- Small-artifact evidence overlay: passed, 12 fields patched or confirmed in temporary candidate registries.
- Whisper runtime package: built with `scripts/package_whisper_cpp_runtime.sh`; package SHA-256 `cfbba61b4f9a4fa3c0387ff7816c1368cac6394f2c97432e22b635564f03ad6d`, size `1224375`, archive member `whisper.cpp-v1.8.6-macos-arm64/whisper-cli`.
- Byte-evidence merge: passed; `/tmp/vault-merged-byte-evidence.json` combines Piper sidecar, small-artifact, and tiny Qwen evidence.
- Merged evidence overlay: passed, 21 fields applied; patched model registry SHA-256 `065f12df5f63346a7a246ae47378ce993a85281084629a5aeb5187e7c4c4fd66`, patched runtime registry SHA-256 `a92c8910d62ad78dab0f9fe7f8564c35284a2c93bd85948a84d98f396d5127a1`.
- Full byte-evidence merge with embedding/reranker: passed; `/tmp/vault-merged-byte-evidence.with-embedding-reranker.json` covers 8 model IDs and 2 runtime IDs.
- Merged evidence overlay with embedding/reranker: passed, 33 fields applied; patched model registry SHA-256 `065f12df5f63346a7a246ae47378ce993a85281084629a5aeb5187e7c4c4fd66`, patched runtime registry SHA-256 `a92c8910d62ad78dab0f9fe7f8564c35284a2c93bd85948a84d98f396d5127a1`.
- Full byte-evidence merge with standard Qwen: passed; `/tmp/vault-merged-byte-evidence.with-standard-qwen.json` covers 9 model IDs and 2 runtime IDs.
- Merged evidence overlay with standard Qwen: passed, 36 fields applied; patched model registry SHA-256 `065f12df5f63346a7a246ae47378ce993a85281084629a5aeb5187e7c4c4fd66`, patched runtime registry SHA-256 `a92c8910d62ad78dab0f9fe7f8564c35284a2c93bd85948a84d98f396d5127a1`.
- Full byte-evidence merge with strong Qwen: passed; `/tmp/vault-merged-byte-evidence.all-models.json` covers all 10 model IDs and 2 runtime IDs.
- Merged evidence overlay with all model bytes: passed, 39 fields applied; patched model registry SHA-256 `065f12df5f63346a7a246ae47378ce993a85281084629a5aeb5187e7c4c4fd66`, patched runtime registry SHA-256 `a92c8910d62ad78dab0f9fe7f8564c35284a2c93bd85948a84d98f396d5127a1`.
- Source/license probe after all model byte evidence: expected warn result; 53 checks, 52 pass, 0 blocked, 1 pending for unpublished `whisper-cpp-managed-runtime` package URL.
- Combined candidate release plan after all model byte evidence: expected blocked exit; structural validation passed with 0 errors and 14 warnings; 142 checks, 20 blocked, 0 check warnings.
- Release packet after all model byte evidence: expected blocked result; `/tmp/vault-all-models-release-packet/candidate-ai-registry-release-packet.md` now includes a `Blocking Details` section naming `source_probe` / `whisper-cpp-managed-runtime:files[0]:source` as the remaining source-probe finding.
- Focused/adjacent registry/readiness/overlay tests: 24 passed.
- Focused shortlist/runtime candidate tests after the whisper-runtime package update: 6 passed.
- Focused evidence merge/artifact verification/evidence overlay tests: 11 passed.
- Focused local-AI registry/artifact/release-packet tests after duplicate-download reuse, retry hardening, packet blocker details, and the whisper URL helper: 22 passed.
- Python lint: passed.

Latest readiness snapshot:

```text
Local AI readiness: blocked
Production ready: no
Demo fallback: yes
Gate mode: demo allowed
Recommended profile: standard
Recommended pack: standard-local-pack
Checks: 209 total / 67 pass / 1 warn / 24 pending / 117 blocked
Production packs: 0/3 ready
Production runtimes: 0/3 ready
```

Important: strict production is still not done. `pnpm verify:strict` and `./scripts/check_ai_readiness.sh` should continue to fail until real production model/runtime manifests, checksums, licenses, approval evidence, and local capability routes are pinned.

## Completed In The Latest Verified Slice

Production local-AI byte evidence and whisper.cpp runtime package state are now explicit for all model candidates; the remaining source/byte gap is the unpublished whisper runtime URL:

- Scoped byte verification for Whisper tiny/base model files and selected llama.cpp/Piper runtime archives passed.
- Generated `/tmp/vault-small-ai-byte-evidence.json`.
- Applied the generated evidence to temporary candidate registries in `/tmp`.
- Verified the tiny Qwen GGUF candidate and generated `/tmp/vault-tiny-qwen-byte-evidence.json`.
- Verified the standard Qwen GGUF candidate and generated `/tmp/vault-standard-qwen-byte-evidence.json`.
- Verified the strong Qwen GGUF candidate and generated `/tmp/vault-strong-qwen-byte-evidence.json`.
- Verified the duplicated embedding candidate file once and generated `/tmp/vault-embedding-byte-evidence.json` for both embedding slots.
- Verified the duplicated reranker candidate file once and generated `/tmp/vault-reranker-byte-evidence.json` for both reranker slots.
- Added strict evidence merging and generated `/tmp/vault-merged-byte-evidence.json`.
- Added duplicate URL reuse and transient stream retry handling to artifact byte verification.
- Added structured blocker details to release packet generation.
- Added `scripts/apply_whisper_runtime_package_url.sh` to apply an approved whisper runtime package URL to a copied shortlist, reject placeholder/non-HTTP/credential URLs, generate the updated runtime registry, and print the next probe/byte-verification commands.
- Added runtime installer coverage proving a tar.gz archive runtime can extract `whisper.cpp-v1.8.6-macos-arm64/whisper-cli` and run a custom `--help` smoke test instead of the default `--version` check.
- Applied merged evidence to temporary candidate registries in `/tmp`, latest pair:
  - `/tmp/vault-candidate-model-registry.all-models-byte-patched.json`
  - `/tmp/vault-candidate-runtime-registry.all-models-byte-patched.json`
- Generated `/tmp/vault-all-models-release-packet`.
  - Packet status: blocked.
  - Source probe: warn.
  - Blocking detail: `whisper-cpp-managed-runtime:files[0]:source` is still pending because the package URL is not concrete.
- Checked latest upstream whisper.cpp release metadata and recorded why no upstream macOS arm64 CLI asset was selectable.
- Built a static macOS arm64 `whisper-cli` package from tagged source.
- Added a reproducible packaging script.
- Candidate runtime generation now applies all 3 runtimes and skips 0.
- The temporary patched candidate release plan remains structurally valid but still blocked: 20 blocked checks, 0/3 production packs ready, 0/10 production models ready, and 0/3 production runtimes ready.
- Strict production remains blocked until package URL publication/probing, approval overlay, runtime smoke verification through setup, and capability routing are completed.

Files touched:

- `services/core/vault_core/ai/models/candidate_shortlist.json`
- `services/core/vault_core/ai/models/candidate_shortlist.py`
- `services/core/vault_core/ai/models/evidence_merge.py`
- `services/core/vault_core/ai/models/artifact_verification.py`
- `services/core/vault_core/scripts/prepare_ai_registry_release_candidate.py`
- `services/core/vault_core/scripts/apply_whisper_runtime_package_url.py`
- `services/core/vault_core/scripts/verify_whisper_runtime_package.py`
- `services/core/vault_core/scripts/merge_ai_registry_evidence.py`
- `scripts/package_whisper_cpp_runtime.sh`
- `scripts/merge_ai_registry_evidence.sh`
- `scripts/verify_whisper_runtime_package.sh`
- `docs/reports/whisper-cpp-runtime-package-2026-06-12.md`
- `services/core/vault_core/ai/models/approval_overlay.py`
- `services/core/tests/test_core_flow.py`
- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Production local-AI Piper TTS candidate now includes sidecar-aware manifest evidence:

- Candidate Hugging Face generation now supports a primary file plus `source.sidecar_filenames`.
- The selected Piper voice candidate now generates both the ONNX model and its required `.onnx.json` sidecar.
- The Piper voice candidate now has the voice `MODEL_CARD` pinned as its license/evidence artifact.
- Hydration fills the Piper repo revision, ONNX size, ONNX SHA-256, and sidecar size.
- Hydration leaves the sidecar SHA-256 pending because Hugging Face does not expose LFS SHA-256 metadata for that JSON file; full byte verification must fill it.
- Source-confirmation gates are now 0.
- The combined model+runtime candidate release plan remains structurally valid but still blocked: 25 blocked checks, 0/3 production packs ready, 0/10 production models ready, and 0/3 production runtimes ready.
- Strict production remains blocked until source probing, byte verification, approval overlay, whisper.cpp runtime distribution, runtime smoke verification, and capability routing are completed.

Files touched:

- `services/core/vault_core/ai/models/candidate_shortlist.json`
- `services/core/vault_core/ai/models/candidate_shortlist.py`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Production local-AI Whisper STT model candidates are now source-confirmed and hydration-ready:

- Replaced the inaccessible `ggml-org/whisper.cpp` Hugging Face model source with public `ggerganov/whisper.cpp`.
- Pinned MIT model-card license artifact for the selected Whisper STT model candidates.
- Candidate model generation now patches `tiny-whisper-placeholder` and `standard-whisper-placeholder`.
- Hydration now fills revision, size, and SHA-256 values for `ggml-tiny.en.bin` and `ggml-base.en.bin`.
- Piper TTS remains the only model candidate still in source-confirmation because its ONNX sidecar and voice/dataset-license evidence need explicit handling.
- The combined model+runtime candidate release plan remains structurally valid but still blocked: 30 blocked checks, 0/3 production packs ready, 0/10 production models ready, and 0/3 production runtimes ready.
- Strict production remains blocked until Piper voice handling, source probing, byte verification, approval overlay, whisper.cpp runtime distribution, runtime smoke verification, and capability routing are completed.

Files touched:

- `services/core/vault_core/ai/models/candidate_shortlist.json`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Production local-AI candidate lifecycle reporting now separates selected runtime evidence work from unresolved source selection:

- Added `needs_release_evidence` as a recognized candidate lifecycle state.
- Moved selected llama.cpp and Piper runtime candidates into `needs_release_evidence` because archive members, sizes, SHA-256 values, and license URLs are already pinned.
- Kept the three voice model candidates in `needs_source_confirmation`.
- Kept `whisper-cpp-macos-arm64` in `needs_runtime_distribution_decision`.
- Shortlist text/Markdown output now reports 3 source-confirmation gates, 2 release-evidence gates, and 1 runtime distribution decision.
- The combined model+runtime candidate release plan remains structurally valid but still blocked: 42 blocked checks, 0/3 production packs ready, 0/10 production models ready, and 0/3 production runtimes ready.
- Strict production remains blocked until source probing, byte verification, approval overlay, voice model selection, whisper.cpp runtime distribution, runtime smoke verification, and capability routing are completed.

Files touched:

- `services/core/vault_core/ai/models/candidate_shortlist.json`
- `services/core/vault_core/ai/models/candidate_shortlist.py`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Production local-AI model license artifacts are now pinned for selected Qwen candidates:

- Pinned selected Qwen GGUF license URLs for the Tiny, Standard, and Strong LLM candidate slots.
- Pinned selected Qwen embedding and reranker model-card license artifacts where the Hugging Face repos expose the license in card metadata rather than a sibling `LICENSE` file.
- Candidate model generation now carries those selected license URLs into seven generated model registry entries.
- Candidate metadata hydration still fills revisions, sizes, and SHA-256 values for seven Hugging Face-backed model slots with 0 warnings and 0 errors.
- The combined model+runtime candidate release plan remains structurally valid but still blocked: 42 blocked checks, 0/3 production packs ready, 0/10 production models ready, and 0/3 production runtimes ready.
- Strict production remains blocked until source probing, byte verification, approval overlay, voice model selection, whisper.cpp runtime distribution, runtime smoke verification, and capability routing are completed.

Files touched:

- `services/core/vault_core/ai/models/candidate_shortlist.json`
- `services/core/vault_core/ai/models/candidate_shortlist.py`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Production local-AI runtime license artifacts are now pinned for selected runtime candidates:

- Inspected the selected llama.cpp archive and pinned `llama-b9596/llama-cli`.
- Inspected the selected Piper archive and pinned `piper/piper`.
- Pinned selected runtime archive byte sizes and SHA-256 values in `candidate_shortlist.json`.
- Pinned selected runtime release-tag license URLs in `candidate_shortlist.json`.
- Candidate runtime generation now copies selected archive members, sizes, and SHA-256 values into the temporary runtime registry.
- Candidate runtime generation now copies selected runtime license URLs into the temporary runtime registry.
- Tests assert pinned archive members, sizes, hashes, and license URLs.
- The combined model+runtime candidate release plan remains structurally valid but still blocked: 49 blocked checks, 0/3 production packs ready, 0/10 production models ready, and 0/3 production runtimes ready.
- Strict production remains blocked until source probing, license review, approval overlay, voice model selection, whisper.cpp runtime distribution, runtime smoke verification, and capability routing are completed.

Files touched:

- `services/core/vault_core/ai/models/candidate_shortlist.json`
- `services/core/vault_core/ai/models/candidate_shortlist.py`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Production local-AI runtime distribution decisions are now explicit:

- The candidate shortlist report now separates `needs_runtime_distribution_decision` from generic source confirmation.
- Markdown/JSON shortlist output includes `Need runtime distribution decision: 1`.
- The dedicated runtime distribution decision list currently contains `whisper-cpp-macos-arm64`.
- Runtime candidate generation now skips unresolved whisper.cpp with `runtime distribution decision needed`.
- Tests assert the new report field, Markdown section, and skip reason.
- The combined model+runtime candidate release plan remained structurally valid but blocked: 55 blocked checks, 0/3 production packs ready, 0/10 production models ready, and 0/3 production runtimes ready.
- Strict production remained blocked until source probing, byte verification, license review, approval overlay, voice model selection, whisper.cpp runtime distribution, runtime archive review, and capability routing were completed.

Files touched:

- `services/core/vault_core/ai/models/candidate_shortlist.py`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Production local-AI candidate runtime manifests can now be generated:

- Added candidate runtime registry generation from `candidate_shortlist.json`.
- Added `services/core/vault_core/scripts/generate_ai_candidate_runtime_registry.py`.
- Added `scripts/generate_ai_candidate_runtime_registry.sh`.
- Added tests proving candidate generation patches the selected llama.cpp and Piper runtime placeholders while preserving the unresolved whisper.cpp runtime placeholder.
- The generator applies 2 runtime replacements from selected macOS arm64 GitHub release candidates and skips 1 whisper.cpp candidate whose CLI runtime asset is still unselected.
- The generated runtime candidate registry pins the llama.cpp and Piper release URLs plus archive formats, while keeping archive members, checksums, sizes, license artifacts, approval evidence, and smoke verification blocked.
- The combined model+runtime candidate release plan is structurally valid but still blocked: 55 blocked checks, 0/3 production packs ready, 0/10 production models ready, and 0/3 production runtimes ready.
- Strict production remains blocked until source probing, byte verification, license review, approval overlay, voice model selection, whisper.cpp runtime distribution, runtime archive review, and capability routing are completed.

Files touched:

- `services/core/vault_core/ai/models/candidate_shortlist.py`
- `services/core/vault_core/scripts/generate_ai_candidate_runtime_registry.py`
- `scripts/generate_ai_candidate_runtime_registry.sh`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Production local-AI candidate model manifests can now be generated and hydrated:

- Added candidate model registry generation from `candidate_shortlist.json`.
- Added `services/core/vault_core/scripts/generate_ai_candidate_model_registry.py`.
- Added `scripts/generate_ai_candidate_model_registry.sh`.
- Added tests proving candidate generation patches the hydration-ready model placeholders and preserves pack/profile fit for shared embedding/reranker candidates.
- The generator applies 7 model replacements from 5 Hugging Face candidates and skips 3 unconfirmed voice candidates.
- Metadata hydration now fills revisions, sizes, and SHA-256 values for those 7 generated entries.
- The refreshed hydrated candidate release plan is structurally valid but still blocked: 59 blocked checks, 0/3 production packs ready, 0/10 production models ready, and 0/3 production runtimes ready.
- Strict production remains blocked until source probing, byte verification, license review, approval overlay, voice model selection, runtime archive review, and capability routing are completed.

Files touched:

- `services/core/vault_core/ai/models/candidate_shortlist.py`
- `services/core/vault_core/scripts/generate_ai_candidate_model_registry.py`
- `scripts/generate_ai_candidate_model_registry.sh`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Production local-AI candidate selection became explicit and checkable:

- Added `services/core/vault_core/ai/models/candidate_shortlist.json`.
- Added `services/core/vault_core/ai/models/candidate_shortlist.py`.
- Added `services/core/vault_core/scripts/plan_ai_candidate_shortlist.py`.
- Added `scripts/plan_ai_candidate_shortlist.sh`.
- Added tests proving the shortlist covers every current production model/runtime placeholder and reports missing coverage.
- Current shortlist report is `ready_for_hydration`, with 8 model candidates, 3 runtime candidates, 5 hydration-ready Hugging Face model candidates, and no coverage errors.
- Strict production remains blocked until metadata hydration, source probing, byte verification, license review, approval overlay, runtime archive review, and capability routing are completed.

Files touched:

- `services/core/vault_core/ai/models/candidate_shortlist.json`
- `services/core/vault_core/ai/models/candidate_shortlist.py`
- `services/core/vault_core/scripts/plan_ai_candidate_shortlist.py`
- `scripts/plan_ai_candidate_shortlist.sh`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Earlier Verified Slice

Assistant compose is quieter and less card-heavy:

- The Assistant question field is now the main action in the compose panel.
- Starter prompts moved from three visible cards into a compact `Try` shortcut row.
- Starter descriptions and full prompts remain inspectable through button titles.
- The evidence scope summary now reads as an inline status line instead of another panel.
- The mobile top bar no longer reserves desktop search width below 760px, fixing the Assistant narrow-width overflow.
- Focused Assistant tests assert the starter shortcut still uses the matching evidence policy.
- Focused Assistant tests, the desktop app test file, desktop build, renderer e2e smoke, and a 390px overflow check passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Quick Note has a clearer Thought versus Evidence flow:

- The modal now has selectable `Thought` and `Evidence` destinations.
- `Thought` keeps the existing fast Notes capture path.
- `Evidence` routes the captured text into Storage intake without creating a note.
- The footer now shows a single primary action, `Save to Notes` or `Save to Storage`, based on the selected destination.
- The keyboard hint follows the selected destination.
- Focused Quick Note tests assert the chooser state and the Storage handoff path.
- Focused Quick Note tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings setup action labels are less release-engineering shaped:

- Blocked model-pack actions now say `Check readiness` instead of `Preflight`.
- Setup wizard fallback actions now say `Review setup` instead of `Review what is missing`.
- Underlying setup/preflight routes are unchanged.
- Focused Settings Models tests assert the new action labels and prevent `Preflight` from returning to visible pack cards.
- Focused Settings Models test, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings setup wizard runtime preview is less manifest-shaped:

- Runtime preview rows now show `Runtime binary` and `Works here`.
- Raw binary, target, and host details remain available in titles/tooltips.
- The wizard runtime preview now matches the quieter Model library runtime cards.
- Focused Settings Models tests assert the readable runtime preview copy and prevent `target any/any` and `Host macos/arm64` from returning inside the setup dialog.
- Focused Settings Models test, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings setup wizard status copy is less backend-state shaped:

- Setup wizard status badges now use readable labels such as `Needs action`, `Ready`, and `Complete`.
- Exact one-word setup summaries such as `blocked`, `ready`, and `done` are normalized before display.
- The setup wizard route preview uses the same setup outcome labels as model pack route coverage.
- Focused Settings Models tests assert readable wizard status copy and prevent visible `blocked` from returning inside the setup dialog.
- Focused Settings Models test, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings model pack route coverage is less route-table shaped:

- Model pack route coverage now says `0/2 trusted local routes` instead of `0/2 production-local routes`.
- Route badges now use setup outcomes such as `Needs route`, `Starter route`, `Trusted route`, and `Off-device`.
- Raw provider/model route ids remain available in titles/tooltips.
- Focused Settings Models tests assert the readable route coverage labels and prevent `missing` and `production-local routes` from returning to visible pack cards.
- Focused Settings Models test, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings model pack cards are less registry-status shaped:

- Model pack cards now show readable setup labels such as `Needs approval`, `Starter ready`, and `Suggested`.
- Pack task summaries now use user-facing capability names such as `Claim suggestions + Draft notes`.
- Readiness checklist badges inside pack cards now use `Needs action` while keeping raw check statuses available in titles/tooltips.
- Focused Settings Models tests assert the readable pack-card labels and prevent raw `blocked`, `demo_ready`, and raw capability id strings from returning to visible pack cards.
- Focused Settings Models test, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings runtime cards are less runtime-manifest shaped:

- Managed runtime cards now show readable setup labels such as `Needs install`, `Starter`, `Trusted`, and `Needs repair`.
- The setup wizard runtime preview and the detailed Model library runtime cards use the same shared runtime labels.
- Raw runtime install state, release channel, and integrity status values remain available in titles/tooltips.
- Focused Settings Models tests assert the readable runtime-card labels and prevent raw `not installed`, `demo`, `production`, and visible `mismatch` badges from returning.
- Focused Settings Models test, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings setup result panels are less backend-response shaped:

- Setup results now show readable copy such as `Needs action`, `Trusted model setup`, and `0 downloads checked`.
- Setup result step badges use the same setup-state labels, and raw capability ids are translated to task names when shown.
- Raw setup result status, pack id, release channel, and capability id values remain available in titles/tooltips.
- Focused Settings Models tests assert the readable setup result copy and prevent raw `tiny-production-pack / production` and visible `blocked` from returning to the setup result panel.
- Focused Settings Models test, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings private setup guide is less backend-state shaped:

- The private setup guide now uses readable setup states such as `Not set up`, `Needs action`, `Complete`, and `Ready`.
- The setup guide summary now shows `Trusted pack selected` instead of raw recommended pack ids.
- Raw setup status and pack id values remain available in titles/tooltips.
- Focused Settings Models tests assert the readable setup guide copy and prevent raw `not_started` / `tiny-production-pack` from returning to the visible guide.
- Focused Settings Models test, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings embedding reindex progress is less backend-state shaped:

- Embedding reindex progress now uses readable status copy such as `Running`.
- The progress detail now says `Search index selected` instead of exposing raw embedding-space ids.
- Raw job status, phase, and embedding-space values remain available in titles/tooltips.
- Focused Settings Search tests assert the readable progress copy and prevent raw `mock_embedding:mock-local-embedding:32` from returning to the visible progress card.
- Focused Settings Search test, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings model download queue is less backend-state shaped:

- Download queue badges now use the same readable labels as model cards, including `Downloading`, `Paused`, `Queued`, and `Download failed`.
- Raw download states remain available in titles/tooltips.
- Focused Settings Models tests assert readable queue badges and prevent raw `downloading` / `paused` from returning to the visible queue.
- Focused Settings Models tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Home Night Lab status copy is less job-state shaped:

- The Home Local automation badge now uses readable states such as `Complete`, `Running`, `Needs attention`, and `Ready`.
- Night Lab task result captions now use `Complete · 1 proposal` with correct singular/plural copy.
- Raw job/task statuses remain available in titles/tooltips.
- Focused Home tests assert the readable labels and prevent `completed ·` from returning to the Night Lab task grid.
- Focused Home tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings Search route-test results are less id-shaped:

- Search index test results now show the tested task, dimensions, and privacy outcome instead of raw route provider/model ids.
- Ranking test results now show the tested task, result count, and privacy outcome instead of raw route provider/model ids.
- Raw route ids and artifact fingerprints remain available in titles/tooltips.
- Focused Settings Search tests assert the readable result labels and prevent raw provider/model ids from returning to the visible result strips.
- Focused Settings Search tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Local tools run history is less status-code shaped:

- Tool run history and helper result summary badges now use `Completed`, `Failed`, `Running`, and `Queued`.
- Raw status values remain in titles/tooltips and the Result JSON disclosure.
- Focused Local tools tests assert the readable `Completed` badge and prevent raw `completed` from returning to the helper summary badge.
- Focused Local tools tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Review provenance is less id-shaped:

- Review list cards now use `Local model` / `Off-device model` in the visible timestamp line instead of raw model ids.
- Review proposal metadata now uses `Source block`, `Run recorded`, and `Local model` instead of raw block/run/model/provider ids.
- Raw ids remain in titles/tooltips and in the Technical details disclosure for audit work.
- Focused Review tests assert the readable labels and prevent `mock-local-llm` / `blk_review` from returning to visible proposal regions.
- Focused Review tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings Privacy recent model activity is less id-shaped:

- Recent model activity now uses `Local model` / `Off-device model` instead of raw provider names.
- Run status now uses readable labels such as `Completed` while preserving raw statuses in titles/tooltips.
- Focused Settings Privacy tests assert the readable local-first copy and prevent `mock_local` from returning to the visible row.
- Focused Settings Privacy tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Assistant grounding context is less id-shaped:

- Assistant answer context now uses `Local model` / `Off-device model` instead of raw model ids.
- Pending and empty Assistant model context uses `working` / `waiting`.
- Focused Assistant tests assert `Local model` and prevent `mock-local-llm` from returning to the answer context.
- Focused Assistant tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Notes dictation results are less id-shaped:

- The Notes editor workflow result now uses `On device` for dictation privacy instead of the raw STT model id.
- The same result now uses `Linked to Storage` instead of raw source ids.
- Focused Notes tests assert the visible labels and prevent `mock-local-stt`, `src_voice`, `src_recording`, and `src_push_recording` from returning to those result strips.
- Focused Notes tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings Voice read-aloud setup is less id-shaped:

- The Read aloud panel now uses `Starter voice` and `Saved model selected` instead of raw runtime/model ids.
- Shared voice runtime state is used as a graceful fallback when no nested read-aloud runtime state is present.
- Focused Settings Voice assertions cover the visible labels and prevent `mock_only` / `mock-local-tts` from returning to the panel header.
- Focused Settings Voice tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Generated-note provenance is less id-shaped:

- Generated-note provenance uses `Draft notes`, `Drafted locally`, and `Run recorded` instead of raw capability/model/run ids.
- The generated-note workflow result uses the same readable labels.
- Focused generated-note tests assert raw `mock-local-llm` and `run_generated` are not visible in the workflow result.
- Focused generated-note tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Assistant and Practice voice workflow results are less id-shaped:

- Assistant voice-question results now show `On device` or `Off-device` instead of `mock-local-stt`.
- Practice spoken-answer results now show the same privacy wording.
- Focused tests assert the raw STT model id is not visible in either workflow result.
- Focused voice workflow tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings Voice dictation model setup is less id-shaped:

- The Dictation panel now shows `Starter voice` and `Saved model selected` while keeping raw runtime/model ids inspectable.
- Managed whisper.cpp model options use `Available`, `Downloading`, `Needs download`, and related user-facing labels.
- The selected managed dictation model status now says `Local dictation model ready.` instead of showing the full model path.
- Focused Voice tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings model inventory is less id-shaped:

- Installed model cards now use user-facing status, runtime, format, source, capability, profile, license, trust, and path labels.
- The tiny fixture model card now reads like a model the user can understand: `Needs download`, `Local text runtime`, `GGUF file`, `Starter file`, and `Claim suggestions + Draft notes`.
- Raw model inventory values remain inspectable through titles/tooltips rather than visible first-line copy.
- Focused Settings tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings runtime details are less system-console shaped:

- The top Models card now says `Runtime missing` and `No local GGUF models` instead of `CLI missing` and installed GGUF candidate counts.
- Managed runtime cards now show `Works here` and `Runtime binary`; target/host and binary names remain available as titles/tooltips.
- Runtime health now uses `Local runtime`, `Runtime`, `Server`, and `Session` rows with user-facing state labels.
- Server process diagnostics such as active model id, mode, process id, log path, endpoint, and raw state are preserved as titles/tooltips instead of visible first-line text.
- Focused Settings tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/components/Badge.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Notes and Learning read-aloud results are less id-shaped:

- Notes read-aloud result chips now use `Audio saved`, `On device`, and `Ready to play`.
- Learning read-aloud result chips now use `Audio ready`, `On device`, and `Ready to play`.
- Raw speech model and asset ids remain available as row titles/tooltips.
- Focused read-aloud tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings Voice history is less id-shaped:

- Speech sample confirmation no longer exposes speech asset ids as primary text.
- Audio-note rows use `Voice memo` and `Linked to Storage`.
- Read-aloud history uses privacy and cache labels instead of provider/path labels.
- Focused Voice tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Privacy model activity now reads like app activity, not a capability log:

- Recent activity uses labels such as `Assistant answers`.
- Raw activity ids remain available as titles/tooltips.
- Focused Privacy tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings Search no longer exposes raw capability ids as first-class UI:

- `CapabilityStatus` chips now show user-facing task names.
- The Search advanced disclosure now says `Model task routing`.
- Capability binding rows now show task names and accessible provider labels.
- Setup previews and pack route coverage use the same task names.
- Focused Search tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Models is now framed as part of the notes workspace, not as a primary admin subsystem:

- The sidebar and workspace header now say `Models`.
- Home's start path now points to `Models`.
- Settings uses `Models` / `local preferences` at the page top.
- The setup summary now says `Local models`, `Trusted models`, and `Items to finish`.
- Setup buttons are shorter: `Setup`, `Open Search`, and `Add evidence`.
- The note editor disclosure now says `Model routes`.
- Focused Settings tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings Advanced is less abrupt than the old raw settings dump:

- The visible Settings tab is now `Advanced`, not `Raw`.
- The JSON preferences dump now opens with `Settings snapshot`.
- The JSON block has the accessible label `Settings JSON snapshot`.
- Focused Settings tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Search result privacy wording is less diagnostic:

- Search index test output now says `stayed on this device` or `left this device`.
- Result ranking test output uses the same wording.
- The remaining advanced Search output still includes provider/model details for troubleshooting.
- Focused Search route tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings Privacy and Export are less system-report-shaped:

- Privacy now says `Cloud stays off`, `Private prompts`, and `Recent model activity`.
- Local model activity now says it `stayed on this device`.
- Export is now framed as `Workspace backup`.
- The primary export action is `Create backup`.
- Backup contents now use simpler labels for notes, sources, claims, review history, files, and database.
- Focused Privacy/Backup tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings Voice is less infrastructure-shaped and clearer for a notes workspace:

- The Voice tab now presents transcription as `Dictation`.
- The Voice tab now presents speech generation as `Read aloud`.
- Importing a recording now says `Import audio`.
- Saved voice outputs are grouped as `Audio notes` and `Read-aloud history`.
- Read-aloud and spoken learning context now says it stays local instead of mentioning routes.
- Focused Voice/Learning tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings Search is less infrastructure-shaped and clearer for a notes workspace:

- The Settings tab now says `Search`, not `Routing`.
- The embedding setup is `Search index`.
- The reranker setup is `Result ranking`.
- Search setup actions now say `Save search index` and `Test search index`.
- Ranking setup actions now say `Save ranking` and `Test ranking`.
- Raw capability bindings are still available under `Model task routing`, with user-facing task names.
- Focused Settings tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Evidence graph is less dashboard-like and closer to a quiet knowledge browser:

- The graph header now leads into one inline context line for claim counts and status.
- Claim search says `Find claims`.
- Claim detail shows confidence and evidence inline under the claim text.
- The old KPI tiles and nested claim metric cards were removed.
- Focused graph tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Notes, Storage, and Quick Note are calmer and more intentional:

- Quick Note now presents a concise Thought versus Evidence decision.
- Quick Note footer keeps one primary action, `Save to Notes` or `Save to Storage`, matching the selected destination.
- The Notes/Storage lane strip is a compact two-column switcher without duplicate shortcut badges.
- Notes copy emphasizes writing, connecting, and revising thinking.
- Storage copy emphasizes source material, citable originals, and the cited-note next step.
- Focused desktop tests, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Local generated notes validate citation markers against supplied evidence:

- Generated-note evidence packs now render numbered citation markers.
- Local llama.cpp generated-note output rejects markers outside the supplied evidence range.
- Local llama.cpp generated-note output with supplied evidence must include at least one marker.
- Added a regression for unsupported marker `[99]`, missing marker, and valid marker `[1]` paths.

Files touched:

- `services/core/vault_core/app.py`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`
- `docs/architecture/local-ai-voice-roadmap.md`

## Completed In The Previous Verified Slice

Local generated notes must follow the required section plan:

- `validate_generated_note_output` now requires `## Synthesis`, `## Evidence`, and `## Uncertainties` headings for llama.cpp outputs.
- Each required section must include substantive prose or bullets.
- Prose without the required headings is rejected as `invalid_note_structure`.
- Updated fake CLI/server tests so valid local generated-note fixtures satisfy the same contract.

Files touched:

- `services/core/vault_core/app.py`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Contradiction reviews are explicit and recheck exact evidence:

- Valid extracted contradiction objects now enter Review as `new_contradiction`.
- Approval of a contradiction proposal rechecks `source_quote` against the current source block.
- Stale contradiction evidence is rejected before graph node creation.
- Added a local llama contradiction regression covering stale quote rejection and successful approval after quote restoration.

Files touched:

- `services/core/vault_core/app.py`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Weak-evidence reviews cannot promote claim trust:

- Added approval-time validation for `claim_status_change` review items.
- Blocks review payloads that attempt to set `supported`, `verified`, `user_confirmed`, or any unrecognized status.
- Verifies the target claim exists in the current workspace before applying the status.
- Extended the tool review regression to mutate a pending payload to `verified`, prove approval is rejected, then approve the valid `weakly_supported` downgrade.

Files touched:

- `services/core/vault_core/app.py`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Malformed extracted object relations are quarantined:

- Hardened `validate_extracted_object` so `relations` must be an array of objects.
- Validates relation type, non-empty bounded `target_ref`, and relation confidence range.
- Extends executable-content detection to relation targets.
- Added a local llama object extraction regression for malformed relation arrays.

Files touched:

- `services/core/vault_core/domain/extraction.py`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Local generated notes can no longer be headings-only skeletons:

- Updated the generated-note prompt to request `## Synthesis`, `## Evidence`, and `## Uncertainties` sections with substantive content.
- Added a llama.cpp-only generated-note structure validator.
- Rejected local generated-note output with too little non-heading prose before creating a note.
- Marked invalid skeletal local note runs as `invalid_note_structure` and valid local note runs as `valid`.
- Extended the local GGUF regression to cover valid, skeletal, and empty generated-note output.

Files touched:

- `services/core/vault_core/app.py`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Local claim extraction now uses a hand-written GBNF grammar when supported:

- Added `services/core/vault_core/ai/grammars/vault_claim_extraction.gbnf`.
- Wired `extract_claims` through that grammar in the llama.cpp CLI execution path.
- Preserved the validated fallback path for CLIs without grammar support.
- Added a regression mirroring the object grammar test and asserting the CLI receives `--grammar-file`.
- Updated the local AI roadmap to list both claim and object grammar support accurately.

Files touched:

- `services/core/vault_core/app.py`
- `services/core/vault_core/ai/grammars/vault_claim_extraction.gbnf`
- `services/core/tests/test_core_flow.py`
- `docs/architecture/local-ai-voice-roadmap.md`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Malformed local claim extraction cannot unlock generated-note approval:

- Tightened generated-note claim-review preparation so `prepared` means at least one usable review item exists.
- Preserved quarantined extraction output and audit metadata while keeping approval disabled.
- Added generated-note metadata for blocked review attempts: job id, markdown hash, item counts, quarantine counts, and error text.
- Updated the generated-draft UI to show the blocked reason and offer a clear `Recheck claims` action.
- Added a regression where a fake local GGUF extractor returns malformed JSON and the generated note remains unapprovable.

Files touched:

- `services/core/vault_core/app.py`
- `services/core/tests/test_core_flow.py`
- `apps/desktop/src/app/App.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Empty local generated-note output is rejected and audited:

- Added a guard in `/notes/generate` for whitespace-only local model output.
- Marks the associated AI run as `invalid_empty_output`.
- Returns 422 instead of creating an empty generated-pending-review note.
- Extended the local GGUF runtime regression to prove valid generated notes still work, empty output is rejected, note count is unchanged, and the run log keeps the invalid validation status.

Files touched:

- `services/core/vault_core/app.py`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Storage source status is quieter:

- Replaced the always-open `Source pipeline` section with a `Source status` disclosure.
- Kept compact blocks/review/claims counts visible in the disclosure summary.
- Auto-opens the disclosure when source work needs attention.
- Preserved the existing Open Review action for pending proposal stages.
- Updated the Storage pipeline regression for disclosure semantics.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Generated provenance and source follow-ups preserve long context:

- Added full-text `title` preservation for generated-note provenance capability, model, AI run, and evidence chips.
- Kept evidence chips visually compact while making long labels inspectable.
- Added full imported-source title preservation to the Storage import follow-up container.
- Updated generated-memo and pasted-Storage import regressions with long title/locator cases.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Assistant citation rows stay compact with long evidence:

- Added full-title preservation for Assistant citation titles, exact quotes, and source/claim identifiers.
- Clamped Assistant citation titles and quotes so grounded answers stay readable with long evidence excerpts.
- Let citation footers wrap cleanly around Open claim/Open source actions.
- Updated the grounded-assistant regression with long citation text and full-title/full-quote assertions.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Review rows and action footers handle long text calmly:

- Added title preservation for review list titles and summaries.
- Clamped review row titles/summaries so long model output does not turn Review into a wall of text.
- Let section actions, modal footer actions, Storage intake actions, and generated-draft review actions wrap without overlap.
- Added narrow-width rules that stack Quick note, Storage intake, and generated-draft action buttons.
- Updated the review regression with long proposal text and full-title/full-summary assertions.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Notes and Storage use a quieter lane switcher:

- Reworked the Notes/Storage path strip to remove badge-heavy mini-card treatment.
- Preserved Quick note, New note, Add source, Open Notes, and Open Storage actions.
- Added compact long-path/hash display for selected Storage metadata while preserving full values via `title`.
- Added title affordances and truncation for long section headers and source rows.
- Updated desktop regressions for the new lane copy and compact long-path behavior.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/components/Panel.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Near-miss quote quarantines include repair hints:

- Exact-quote validation still rejects unsupported local-model quotes.
- Near-miss invalid quotes now keep an auditable `suggested_source_quote` hint when the source block has a strong likely match.
- Review displays the hint as `Nearest source text`.
- The backend regression pins the quarantine payload, and desktop tests/build verify the UI still renders and compiles.

Files touched:

- `services/core/vault_core/app.py`
- `services/core/tests/test_core_flow.py`
- `apps/desktop/src/app/App.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Generated-note decisions preserve audit metadata:

- Approving a generated note now has regression coverage proving `content.output_hash` remains attached.
- Rejecting a generated note now has regression coverage proving `content.output_hash` remains attached.
- Both decision paths are pinned to record `reviewed_at`.
- This keeps generated-note review decisions auditable without exposing raw model output.

Files touched:

- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Generated drafts keep model-output fingerprints:

- `/notes/generate` now computes an `output_hash` from the model output.
- The generated draft stores that hash in `content.output_hash`.
- The endpoint response returns the same hash, so UI/review code can reference it without exposing raw model output.
- The generated-note review metadata regression pins this behavior.

Files touched:

- `services/core/vault_core/app.py`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Unrequested local object types are quarantined:

- Added a regression test for local llama object extraction returning `type: task` during a concept-only extraction request.
- The test proves no canonical graph object or pending review proposal is created.
- The unrequested object is stored as dismissed `extraction_quarantine`.
- Local claim/object proposals now include `output_hash`, so validation-time quarantines keep the same audit fingerprint as parser/empty-output quarantines.

Files touched:

- `services/core/vault_core/app.py`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Empty local object extraction output keeps audit metadata:

- Added a regression test for local llama object extraction returning valid JSON with no usable object records, e.g. `objects` contains non-object values only.
- The test proves no canonical graph object or pending review proposal is created.
- The semantically empty output is stored as dismissed `extraction_quarantine`.
- Empty local claim/object quarantine payloads now include `output_hash`, matching invalid-schema quarantine auditability.

Files touched:

- `services/core/vault_core/app.py`
- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Malformed local claim extraction output is covered:

- Added a regression test for local llama claim extraction returning a malformed schema, e.g. `claims` is not an array.
- The test proves no canonical claim or pending review proposal is created.
- The malformed output is stored as dismissed `extraction_quarantine`.
- The quarantine payload keeps `model_id`, `provider_id`, `ai_run_id`, and `output_hash` so the local-model failure remains auditable.

Files touched:

- `services/core/tests/test_core_flow.py`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Home first screen is calmer and closer to Notion / Obsidian / Apple Notes:

- Home now leads with Quick note and Add source, not automation or operational metrics.
- The first-run guide is `Start here`, with plain lanes for Notes, Storage, Review, and Models.
- The old metrics strip has been removed from first glance.
- Night Lab remains available from Home as `Local automation`, but its status, tasks, job counts, and proposal counts are behind a disclosure.
- Recent activity now carries small workspace counts as supporting context.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Learning and Local tools use shared form primitives:

- Learning deck topic now uses the shared `Input` primitive.
- Local tools run-input JSON now uses the shared `Textarea` primitive.
- The global form reset now excludes `.ui-input` and `.ui-textarea`, so shared controls keep consistent borders, focus states, and spacing.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Everyday empty states are more product-specific and less generic:

- Notes now leads with editable thinking and synthesis, with quick capture named as the fast path.
- Storage empty states now emphasize immutable evidence and source import.
- Review empty states now explain that generated claims and drafts wait there before becoming trusted knowledge.
- Learning empty state now frames practice cards as approved-knowledge output that goes through Review first.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings route fields use the shared Shadcn-style input primitive:

- The embedding, reranker, speech-to-text, and text-to-speech route panels now use `Input` for their text and number fields.
- Existing accessible labels, values, and route-saving behavior are preserved.
- Native provider/model selects remain unchanged until Radix Select interaction tests are added.
- This reduces one-off control styling in the densest Settings areas without destabilizing setup behavior.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Notes editor defaults to writing instead of showing every advanced action:

- Local model note actions, voice actions, Storage/export actions, version history, and route diagnostics now live under `Note tools`.
- The disclosure summary keeps the local-first nature visible without turning the editor toolbar into a control panel.
- Tool groups are labeled by user outcome: `Make from this note`, `Voice`, and `File and history`.
- Existing note generation, claim proposal, dictation, read-aloud, linked Storage, Markdown export, version history, and route diagnostics still run after the disclosure is opened.
- The top of the editor now stays focused on title, save state, formatting, and writing.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings -> Models hides model inventory until requested:

- The runtime inventory, model pack lists, individual model cards, runtime health, and download queue now live under `Model library`.
- The disclosure summary shows model, runtime, and download counts.
- Existing inventory actions still run after the disclosure is opened.
- The default Models page is now mostly setup, next action, and two quiet disclosures: `Approval details` and `Model library`.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings -> Models hides dense approval tooling until requested:

- The approval checklist and registry release plan now live under `Approval details`.
- The disclosure summary shows the current blocker count.
- The full approval/export/candidate registry workflows still run after the disclosure is opened.
- The advanced section has restrained row styling instead of another heavy card stack.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Evidence graph is less dashboard-like and closer to a quiet knowledge browser:

- The graph header now leads into one inline context line for claim counts and status.
- Claim search says `Find claims`.
- Claim detail shows confidence and evidence inline under the claim text.
- The old KPI tiles and nested claim metric cards were removed.
- Focused graph tests, the desktop app test file, desktop build, and renderer e2e smoke passed.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Learning and Local tools are less backlog/debug shaped:

- Learning now presents the surface as `Practice`.
- The selected card area is `Current card`.
- Local speech context is one quiet privacy line instead of visible route/capability chips.
- Local tools use simpler labels: `Input`, `History`, `Helper result`, and `Result JSON`.
- Helper result counts now read naturally, e.g. `1 finding`.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Assistant answers now read less like diagnostics:

- Grounding remains visible and citation-safe.
- Scope, citation count, privacy, and model are now grouped under one quiet `Answer context` line.
- The old labelled facts grid was removed from the answer surface.
- The answer body stays the primary visual object.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings -> Models is calmer at first glance:

- The setup summary now frames local AI as `Local models`, not release operations.
- The first-glance cards are `Trusted models`, `Starter models`, and `Items to finish`.
- The setup guide and modal use a short `Setup` / `Model setup` flow name.
- Starter/demo actions are user-facing while still running the same demo setup routes internally.
- Readiness checklist details keep blockers honest but render them in app-language, e.g. `approved downloads` and `before use`.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Settings local-model preparation is less release-management shaped:

- The advanced approval list now reads as `Items to finish`.
- Candidate registry work is grouped under `Local model preparation`.
- The stage tracker is labelled `Setup path`, not `Promotion pipeline`.
- Saved candidate work is called a `setup draft`.
- The setup path renders as a quiet checklist, not a grid of status cards.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Review is less queue-shaped and more like a knowledge decision surface:

- The page now says `Review`, not `Review Queue`.
- Pending work is now presented as `To decide`; dismissed work is presented as `Rejected`.
- A compact evidence-first summary replaces the older metric strip.
- Batch actions use calmer labels and clearer evidence-first copy.
- Invalid extraction output is visibly described as `held for review`.
- Technical payloads remain available behind `Technical details`.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Assistant answers are more clearly grounded:

- The answer panel now leads with `Answered from approved claims`, `Answered with Storage evidence`, or `Not enough approved evidence`.
- Evidence scope, citation count, privacy state, and model are grouped under one calm `Assistant answer grounding` region.
- The old first-glance `Policy / Citations / Model` metrics row no longer makes the Assistant feel like an admin surface.
- Local/off-device status remains visible, but as a readable privacy fact.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Models settings is less release-engineering shaped at first glance:

- The top of Settings now says `Models`.
- The setup summary now says `Local models`.
- Production blockers remain honest, but the visible labels are user-centered.
- The approval checklist keeps export/review tooling available without making the page read like a deployment dashboard.
- The Settings tab now says `Models` rather than `AI Models`.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`
- `docs/reports/remaining-todo-2026-06-10.md`

## Completed In The Previous Verified Slice

Storage pipeline search readiness is less technical:

- The indexed stage no longer exposes `FTS` or vector-index wording to users.
- The UI now explains the same state as source blocks being searchable and ready for smart search.
- Backend pipeline details remain available to the app without changing the source payload.
- The Storage pipeline test pins the cleaner rendered copy.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`

## Completed In The Previous Verified Slice

Global search is less technical and more notes-app friendly:

- The command/search bar no longer exposes `FTS` or `Hybrid` as visible mode labels.
- The default search style is still backend `hybrid`, but the UI calls it `Smart`.
- Result metadata displays readable search sources, e.g. `Exact + Semantic`.
- Search tests pin the new placeholder, tab labels, accessible popover label, and backend payload.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`

## Completed In The Previous Verified Slice

Local tools naming is consistent at the app edges:

- The sidebar groups Local tools and Models under `Local`.
- Local tools remains named consistently in navigation and helper-facing surfaces.
- Night Lab uses `Helper ideas` for local helper suggestions instead of `Tool ideas`.
- The Night Lab regression test now toggles `Helper ideas`.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`

## Completed In The Previous Verified Slice

Local tools is less implementation-shaped and more like an advanced notes workspace utility:

- The Tools surface now says `Local tools` and `Sandboxed helpers`.
- The copy explains that helpers can create Review work but cannot change trusted knowledge directly.
- The page no longer exposes `Tool Studio`, `Python Home Lab`, or `Home Lab` as product language.
- The permission grid, run history, and run metrics use simple separators instead of nested cards.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`

## Completed In The Previous Verified Slice

Home activity is less implementation-shaped and more like a quiet notes workspace:

- The Home side panel no longer says `Recent mutations`.
- Activity events now use readable labels, e.g. `Night Lab Completed`.
- The panel uses simple separators and subdued metadata.
- A regression test pins the user-facing activity language.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`

## Completed In The Previous Verified Slice

Home is less dashboard-like and more like a quiet notes workspace:

- Home copy now says what the app is for without admin-console language.
- The metrics strip is no longer a wall of KPI cards.
- Start here actions remain available, but read as a light guide rather than a task board.
- Night Lab remains available from Home, but its status and task controls are visually restrained.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`

## Completed In The Previous Verified Slice

Notes and Storage surfaces are less card-heavy:

- Shared panels are flatter and no longer add card chrome everywhere by default.
- The editor reads more like a document surface, not a boxed widget.
- Storage source blocks are row-like evidence entries with simple separators.
- Source pipeline panels use subtle separators rather than colored status rails.

Files touched:

- `apps/desktop/src/styles/global.css`

## Completed In The Previous Verified Slice

Visual direction is less enterprise-dashboard and more notes workspace:

- Global tokens now use a quieter system-font, neutral paper-like background, lower contrast borders, flatter inputs, and softer status colors.
- List rows no longer render as heavy cards by default.
- Local AI setup/readiness surfaces use neutral panels instead of large colored status bands.
- First-run setup guide now focuses on the current step instead of showing a full second dashboard.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`

## Completed In The Earlier Verified Slice

Settings local-AI command center is more decisive:

- It chooses the primary action from the top release blocker.
- Capability-route blockers now surface `Open Search` as the main action.
- Demo setup stays available without competing with production repair.
- Candidate-file loading is no longer shown when the current top blocker is routing.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`

## Completed In The Earlier Verified Slice

Notes editor save state is clearer:

- The status badge says `All changes saved`, `Saving changes`, `Unsaved changes`, or `Save failed`.
- The save state is announced as a polite status for assistive tech.
- The regression test proves a real TipTap edit shows unsaved state before saving.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`

## Completed In The Storage Verified Slice

Storage import now has an immediate next step:

- After pasted text, files, or local audio transcription create a source, the imported source is selected.
- The source detail view shows a restrained "Saved to Storage" follow-up.
- `Start cited note` creates a note from the first source block with source/block citations preserved in `content_json`.
- `Find claims` runs the existing extraction path for reviewable local-model proposals.
- The follow-up wraps cleanly on narrow widths.

Files touched:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `apps/desktop/tests/app.test.tsx`

## Completed In The Quick Capture Verified Slice

Quick capture is clearer and faster:

- `Cmd/Ctrl+Shift+N` remains Quick Note for editable thoughts in Notes.
- `Cmd/Ctrl+Shift+E` now opens Add Source for immutable evidence in Storage.
- Electron menu/global shortcut emits `vault:addSource`.
- Preload exposes `onAddSource`.
- Renderer handles the keyboard shortcut and Electron shortcut event.
- Command search now shows Add source with `Cmd/Ctrl+Shift+E`.
- The Add source shortcut remains available without adding another visible badge to the lane strip.
- Browser verification from that earlier slice confirmed `Cmd/Ctrl+Shift+E` opens the Add source dialog.

Files touched:

- `apps/desktop/electron/main.ts`
- `apps/desktop/electron/preload.ts`
- `apps/desktop/src/lib/types.ts`
- `apps/desktop/src/app/App.tsx`
- `apps/desktop/tests/app.test.tsx`

Also already present in the current worktree:

- TipTap/ProseMirror editor, not a homegrown editor.
- Quick note modal with a "Thought" versus "Evidence" decision.
- Choosing Evidence in Quick Note pre-fills Add source with the captured text.
- Shadcn/Radix-style UI primitives for tabs, dialog, input, textarea, select, checkbox, separator, tooltip, and label.

## Product Direction To Preserve

This should remain a notes and knowledge-base app with integrated local models, similar in spirit to "The Vault":

- Notes are the editable thinking layer.
- Storage is the immutable evidence layer.
- Review turns extracted claims and generated material into accepted knowledge.
- Assistant answers should be grounded in local knowledge and citations.
- Local AI is a first-class subsystem, not a hard-coded model path.
- Voice is an input/output layer for notes and research, not an autonomous agent.
- Cloud AI or cloud voice must stay explicit opt-in.

The main UX direction is minimalist, document-first, and close to Notion / Obsidian / Apple Notes:

- no vague dashboard language,
- no unnecessary panels,
- no marketing-page composition,
- no Atlassian/Microsoft-style admin-console density,
- quiet sidebars and document-first main surfaces,
- restrained badges and status color,
- clear labels for Notes versus Storage,
- fast capture paths,
- reviewable local-model output,
- consistent Shadcn/Radix-style controls.

## Main Production Blocker

The biggest remaining production gap is release-approved local AI content and runtime installation, not the basic app spine.

Missing:

- Approved Tiny, Standard, and Strong production model packs.
- Approved production llama.cpp, whisper.cpp, and Piper managed runtime manifests.
- Approved production embedding and reranker model artifacts.
- Approved production STT/TTS model artifacts.
- Production capability routes pointing at installed, approved, tested local inventory.

The app has substantial local AI infrastructure, but production artifacts are still placeholders.

## Workstream 1 - Production Local Model Packs

Goal: users can install real local model packs without understanding GGUF files, quantization, checksums, or CLI flags.

Current good state:

- A candidate shortlist exists at `services/core/vault_core/ai/models/candidate_shortlist.json`.
- The shortlist covers all current production model slots:
  - Tiny, Standard, and Strong GGUF LLM placeholders.
  - Tiny and balanced embedding placeholders.
  - Tiny and balanced reranker placeholders.
  - Tiny and standard whisper.cpp STT placeholders.
  - Tiny Piper TTS placeholder.
- `./scripts/plan_ai_candidate_shortlist.sh --format json` checks coverage and reports 10/10 model targets covered.
- Eight Hugging Face model candidates are ready for metadata hydration:
  - `qwen3-0.6b-gguf-tiny`
  - `qwen3-1.7b-gguf-standard`
  - `qwen3-8b-gguf-strong`
  - `qwen3-embedding-0.6b-tiny`
  - `qwen3-reranker-0.6b-tiny`
  - `whisper-ggml-tiny-en`
  - `whisper-ggml-base-en`
  - `piper-en-us-amy-low`
- `./scripts/generate_ai_candidate_model_registry.sh` turns the hydration-ready shortlist entries into a candidate model registry.
- The generated candidate registry currently patches all 10 production model entries.
- Metadata hydration now fills revisions, sizes, and SHA-256 values for those 10 generated Hugging Face-backed model entries where Hugging Face exposes them.
- Selected Qwen GGUF license URLs are pinned for the Tiny, Standard, and Strong LLM candidate slots.
- Selected Qwen embedding and reranker model-card license artifacts are pinned for the tiny and balanced embedding/reranker slots.
- Selected Whisper STT model source, license artifact, immutable revision, sizes, and SHA-256 values are pinned for tiny and standard STT slots.
- Scoped byte verification passed for the selected Whisper tiny/base STT model files; generated evidence lives at `/tmp/vault-small-ai-byte-evidence.json`.
- Scoped byte verification passed for both selected embedding slots; generated evidence lives at `/tmp/vault-embedding-byte-evidence.json`.
- Scoped byte verification passed for both selected reranker slots; generated evidence lives at `/tmp/vault-reranker-byte-evidence.json`.
- Scoped byte verification passed for the selected standard Qwen GGUF model; generated evidence lives at `/tmp/vault-standard-qwen-byte-evidence.json`.
- Scoped byte verification passed for the selected strong Qwen GGUF model; generated evidence lives at `/tmp/vault-strong-qwen-byte-evidence.json`.
- Selected Piper TTS model source, voice model-card license/evidence artifact, ONNX file metadata, and JSON sidecar size are pinned in the hydrated candidate registry. The sidecar JSON SHA-256 is verified in `/tmp/vault-candidate-model-registry.piper-byte-patched.json`.
- The latest merged byte evidence bundle lives at `/tmp/vault-merged-byte-evidence.all-models.json`.
- The hydrated candidate model registry has a release-plan pin preview digest of `65f12c6ff702f4c5f9b8720adc7d69368ca51a03ff88ff72ce519176da91c54a`.
- The Piper byte-patched candidate model registry has a release-plan pin preview digest of `065f12df5f63346a7a246ae47378ce993a85281084629a5aeb5187e7c4c4fd66`.

Remaining tasks:

- Promote the generated candidate manifest work from temporary `/tmp` artifacts into reviewed candidate files once source/license/byte evidence exists.
- Pin each artifact:
  - source URL/repository,
  - immutable revision where applicable,
  - allowlisted filename,
  - exact size,
  - SHA-256,
  - license label,
  - license URL or bundled license path for the remaining voice/model artifacts not already covered,
  - approval status,
  - approver,
  - approval timestamp,
  - evidence reference.
- Publish/probe the whisper.cpp runtime package URL, then run approval evidence overlay, release packet creation, dry-run pinning, and final pinning.

Acceptance evidence:

- Candidate release plan exits zero.
- Source/license probes pass.
- Byte verification passes.
- Evidence overlay produces patched model/runtime registries.
- `pin_ai_registries.sh --check` passes for candidate files.
- Production pack readiness moves from `0/3` toward `3/3`.

## Workstream 2 - Production Managed Runtimes

Goal: the app installs and verifies local runtimes itself.

Current good state:

- The candidate shortlist covers all current managed runtime placeholders:
  - `llama-cpp-managed-runtime`
  - `whisper-cpp-managed-runtime`
  - `piper-managed-runtime`
- The llama.cpp runtime candidate has an initial macOS arm64 release asset target.
- `./scripts/generate_ai_candidate_runtime_registry.sh` turns selected runtime shortlist entries into a candidate runtime registry.
- The generated candidate runtime registry currently patches `llama-cpp-managed-runtime`, `whisper-cpp-managed-runtime`, and `piper-managed-runtime`.
- The generated candidate runtime registry no longer skips `whisper-cpp-managed-runtime`; it applies the package-built candidate and leaves only the final package URL as a placeholder.
- The candidate shortlist report no longer has a runtime distribution decision gate.
- The latest upstream whisper.cpp release asset audit is recorded in `candidate_shortlist.json`: checked `v1.8.6` on 2026-06-12, saw Windows CLI/CUDA zips, an Apple xcframework, and a Java wrapper zip, and rejected those for the managed macOS arm64 CLI runtime.
- The selected v1 path for whisper.cpp is now executed locally: `scripts/package_whisper_cpp_runtime.sh` builds a static macOS arm64 `whisper-cli` from tagged source.
- The package evidence report is `docs/reports/whisper-cpp-runtime-package-2026-06-12.md`.
- Selected runtime archive members are pinned:
  - `llama-b9596/llama-cli`
  - `whisper.cpp-v1.8.6-macos-arm64/whisper-cli`
  - `piper/piper`
- Selected runtime archive sizes and SHA-256 values are pinned for llama.cpp, whisper.cpp, and Piper.
- The managed runtime installer has test coverage for tar.gz archive extraction plus custom runtime smoke commands, including a whisper-shaped `--help` smoke test.
- Scoped byte verification passed for the selected llama.cpp and Piper runtime archives; generated evidence lives at `/tmp/vault-small-ai-byte-evidence.json`.
- Selected runtime license URLs are pinned for llama.cpp, whisper.cpp, and Piper.
- Selected llama.cpp, whisper.cpp, and Piper runtime candidates are now in `needs_release_evidence`, not source-confirmation/archive-member review.
- The combined hydrated model registry plus generated runtime registry release plan is structurally valid, but still blocked with 25 blocked checks.
- The combined Piper/small-byte-patched temporary candidate release plan is structurally valid, but still blocked with 24 blocked checks.
- The combined small-byte-patched model registry plus packaged-whisper runtime registry release plan is structurally valid, but still blocked with 20 blocked checks and 14 validation warnings.
- The generated runtime candidate registry has a release-plan pin preview digest of `10081aed4f7b195b3b4ec2972dbf7a23354c19d6afad8ae78807131342247aba`.
- The Piper/small-byte-patched temporary runtime registry has a release-plan pin preview digest of `ccb69a46ed72a0ac9b6422ec42098cd0d05197811399c435e1db4fafba3a7624`.
- The packaged-whisper temporary runtime registry has a release-plan pin preview digest of `1b6be607dfc8f815448928e9fc7d682b16caca13d9996173cc79dd3942721d4a`.

Remaining tasks:

- Publish the packaged whisper.cpp runtime archive to an approved immutable release URL.
- Apply the approved URL with `scripts/apply_whisper_runtime_package_url.sh` to avoid hand-editing candidate shortlist/runtime registry files.
- Re-run source probing and byte verification against the published package URL.
- Add runtime approval evidence records.
- Run smoke verification and approval evidence overlay for the packaged whisper.cpp runtime and selected llama.cpp/Piper runtime candidates.
- Keep unsafe archive member protections covered by real archive-member tests and final packet verification.
- Verify macOS arm64 runtime smoke/version commands.
- Decide Intel macOS, Windows, and Linux alpha scope.
- Ensure Settings runtime cards show clear target/host compatibility.

Acceptance evidence:

- Runtime warnings disappear for approved targets.
- Setup wizard installs/verifies production runtimes.
- Runtime install never uses fixture binaries for production packs.
- Runtime blockers disappear from strict readiness.

## Workstream 3 - Capability Routes And Setup Wizard

Goal: one guided setup leaves the app with real local-only routes.

Remaining tasks:

- Ensure `/ai/setup/run` handles real approved production packs end to end.
- Route required capabilities to local approved inventory:
  - `extract_objects`
  - `extract_claims`
  - `summarize`
  - `generate_note`
  - `grounded_answer`
  - `create_learning_item`
  - `embed_text`
  - `rerank_results`
  - `transcribe_audio`
  - `synthesize_speech`
- Keep blockers for cloud, mock, fixture, manual-unapproved, missing, mismatched, and untested routes.
- Add UI tests for successful production setup, not only blocked/demo setup.

Acceptance evidence:

- Capability route blockers drop to zero in strict readiness.
- Settings Search shows local-only approved providers.
- Fresh workspace setup can install, test, and activate a pack.

## Workstream 4 - Notes, Storage, And Editor UX

Goal: the app feels like a minimalist knowledge workspace, not a vague AI dashboard or enterprise admin console.

Current good state:

- Notes are editable thinking.
- Storage is immutable evidence.
- Quick Note and Add Source now both have fast shortcuts.
- Quick note can hand captured evidence to Storage intake.
- Quick Note now makes the `Thought` versus `Evidence` choice explicit before saving.
- Storage import can immediately become a cited note.
- Notes editor save state is visible and human-readable.
- Notes and Storage surfaces are flatter and closer to a document/list workspace.
- The Notes/Storage path strip is now a quiet lane switcher instead of stacked mini-cards.
- Long Storage paths, hashes, source rows, and section titles truncate safely while keeping full values inspectable.
- Review list rows clamp long local-model titles and summaries while preserving the full text.
- Review now opens with a calmer evidence-first decision summary.
- Assistant compose now leads with the question field, with starter prompts as compact `Try` shortcuts instead of cards.
- Assistant answers now use one quiet `Answer context` line instead of a diagnostic facts grid.
- Learning is now framed as `Practice`, with `Current card` and one quiet local-voice privacy line.
- Local tools now use helper/result language instead of studio/debug labels.
- Evidence graph now uses a single context line and inline claim strength instead of KPI cards.
- Settings Search now uses user-facing search/ranking language instead of visible routing jargon.
- Settings Voice now uses `Dictation`, `Read aloud`, `Import audio`, and local-stay-local language.
- Settings Privacy and Export now use local-first privacy and backup language.
- Advanced Search test results now use `stayed on this device`/`left this device` privacy wording.
- Settings Advanced now gives the settings JSON a clear snapshot heading instead of a raw dump.
- Local-model setup now uses `Items to finish`, `Local model preparation`, `Setup path`, and `setup draft` instead of release-queue language.
- Quick Note, Storage intake, and generated-draft action rows wrap or stack cleanly at narrow widths.
- Assistant no longer overflows at 390px; the mobile top bar removes desktop search width and keeps the question flow in view.
- Assistant citation rows clamp long titles and exact quotes while preserving full evidence text.
- Generated-note provenance and Storage import follow-ups now preserve long source/evidence labels without adding visible clutter.
- Storage source status is now a disclosure that opens when review work needs attention.

Remaining tasks:

- Run a screen-by-screen UX reset against Notion, Obsidian, and Apple Notes:
  - Notes should feel like the primary writing surface.
  - Storage should feel like an evidence library, not a second notes list.
  - Quick capture should be instant and calm, with a clear Thought versus Evidence choice.
  - Settings should keep release-engineering detail behind advanced disclosures and user-facing setup language.
- Audit every empty state and caption.
- Replace vague labels with concrete user intent labels.
- Continue testing long-title and long-path handling in generated draft banners.
- Continue removing heavy card treatment from any remaining everyday writing/evidence surfaces.
- Watch whether the save-state copy needs timestamp detail later; do not add clutter unless users need it.
- Watch whether `Find claims` in the post-import banner feels too eager in real use; if it does, move extraction one step deeper.
- Verify modal/footer wrapping visually in Browser at narrow widths.
- Keep generated content reviewable.

Acceptance evidence:

- No primary workflow depends on explanatory walls of text.
- Notes and Storage purpose is clear at capture, list, and detail levels.
- Browser screenshots show a quiet document/list workspace rather than a card-heavy dashboard.
- Desktop tests and browser checks cover quick capture paths.

## Workstream 5 - Shadcn/Radix Consistency

Goal: calm, operational UI using consistent primitives.

Current good state:

- Settings local-AI command center now reduces competing actions and follows the current blocker.
- Private setup steps now show one current step plus compact progress.
- Settings -> Models uses calmer first-glance labels: `Local models`, `Trusted models`, `Starter models`, and `Items to finish`.
- The main app entry point now says `Models` instead of foregrounding `Local AI`.
- Advanced local-model setup now uses a quiet checklist treatment instead of a promotion-pipeline card grid.
- Advanced local-model setup now says `ready to trust`, `Top item`, and `Needs action` instead of `pin-ready`, `Top blocker`, and raw stage states.
- Approval details now use `Model files`, `checked`, `items`, and readable task labels instead of foregrounding registry/pin/blocker language.
- Candidate model checks now use `Candidate check`, `File changes`, `Ready to trust`, and `items` instead of dry-run/pin/blocker language.
- Candidate handoff and packet review now use `Prepared model files`, `Candidate review commands`, and `Setup bundle` instead of registry/pin/release-packet language.
- Local model preparation actions now use source/file/evidence/bundle language instead of hydrate/probe/byte/packet terminology.
- Approval and setup-path language now favors file/trust wording, including `File evidence`, `approval template`, `evidence file`, `Candidate model file check`, `model file`, and `runtime file`.
- Assistant answer grounding uses a compact context line instead of a metric block.
- Assistant prompt starters now use a compact shortcut row instead of card-like buttons.
- The mobile top bar no longer forces desktop search width below 760px.
- Evidence graph uses a compact context line and inline detail metadata instead of card-heavy metrics.
- Settings Search keeps raw capability bindings in a `Model task routing` disclosure with user-facing task names.
- Settings Voice now uses user-facing Dictation/Read aloud labels instead of STT/TTS route language.
- Settings Privacy/Export now use workspace-backup and stayed-on-this-device wording.
- Search index and ranking test results now share the same local-first privacy wording.
- Settings Advanced replaces the visible `Raw` tab with a labelled settings snapshot.
- Learning and Local tools now share the same quieter language style as the rest of the app.
- Global visual tokens and major Settings panels are calmer and closer to notes-app references.

Remaining tasks:

- Opt into Shadcn/Radix primitives intentionally for everyday controls instead of preserving one-off UI patterns.
- Continue replacing one-off controls with existing primitives where useful.
- Audit Settings controls, setup wizard controls, and model/runtime actions.
- Migrate native provider/model selects to Radix Select only with matching interaction tests; the current tests exercise those controls as native selects.
- Continue removing card-heavy treatment from screens that should feel like document/list workspaces.
- Add dropdown/menu primitive if model/runtime action clusters keep growing.
- Avoid nested cards and marketing-like sections.
- Keep buttons icon-led where appropriate.

Acceptance evidence:

- Settings, Notes, Storage, Review, Assistant, and Voice have consistent control language.
- TypeScript build and UI tests pass.
- Browser checks show no obvious overflow.

## Workstream 6 - Grounded Assistant And Extraction Quality

Goal: local model output remains useful but never silently canonical.

Current good state:

- Invalid local claim/object extraction output is quarantined with audit metadata.
- Extracted contradictions have their own review type and recheck exact evidence on approval.
- Malformed object relation data is quarantined instead of crashing extraction.
- Weak-evidence review items cannot promote claim trust during approval.
- Claims require exact evidence before they become reviewable proposals.
- Near-miss source quotes keep repair hints while staying rejected.
- Empty local generated-note output is rejected before an empty review draft can be created.
- Skeletal local generated-note output is rejected before a headings-only review draft can be created.
- Local generated-note output must include required synthesis/evidence/uncertainty sections with content.
- Local generated-note citation markers must map to the supplied evidence pack.
- Generated-note approval stays blocked when local claim review produces only quarantined or malformed output.

Remaining tasks:

- Expand richer structured note planning beyond the current required-section validation.
- Add deeper malformed note-plan tests for citation coverage quality and factual/evidence alignment.
- Improve contradiction-to-claim relation/status workflows beyond the current non-mutating contradiction node review.

Acceptance evidence:

- Invalid local output is held for review.
- Claims require exact evidence.
- Assistant citations map to approved claims/source blocks.

## Workstream 7 - Voice

Goal: local voice feels like microphone and narrator layers.

Current good state:

- Settings Voice now presents transcription as `Dictation`.
- Settings Voice now presents speech generation as `Read aloud`.
- Audio-file intake is labeled `Import audio`.
- Voice history is grouped as `Audio notes` and `Read-aloud history`.
- Off-device voice still requires explicit consent.

Remaining tasks:

- Approve whisper.cpp production runtime/model manifests.
- Approve Piper/Kokoro production runtime/model manifests.
- Add push-to-talk only if it stays simple and local.
- Keep always-listening out of alpha.
- Keep cloud voice explicit opt-in only.

Acceptance evidence:

- `test_voice_local.sh` passes.
- Settings Voice can install/select approved local STT/TTS assets.
- No off-device route activates without consent.

## Workstream 8 - Reliability And Jobs

Goal: long-running operations survive interruption.

Remaining tasks:

- Generalize durable worker scheduling beyond downloads and embedding reindex.
- Add setup-run job mode if real production setup is long.
- Add job retention and failure details.
- Add cleanup for stale partial downloads/temp release packets.
- Add support/debug log export with privacy redaction.

Acceptance evidence:

- Interrupted operations are recoverable.
- Failed jobs have actionable repair steps.
- No background job mutates canonical knowledge without review.

## Workstream 9 - Security, Privacy, Packaging

Goal: private research data is protected in a packaged desktop app.

Remaining tasks:

- Security review Electron IPC and validators.
- Verify packaged CSP/security settings.
- Package macOS app.
- Add signing/notarization plan.
- Define app data migration policy.
- Add workspace backup/export/restore.
- Decide encrypted workspace scope.
- Harden generated Python tool sandbox beyond alpha subprocess mode.

Acceptance evidence:

- Packaged macOS app launches and starts core.
- Renderer never receives backend token or raw filesystem access.
- Backup/export exists.

## Workstream 10 - CI And Release Gates

Goal: repeatable confidence before every handoff.

Current state:

- `pnpm verify` passes in demo mode.
- Strict production remains blocked, correctly.

Remaining tasks:

- Keep demo CI green.
- Treat strict gate as release approval gate.
- Add lighter quick developer gate if iteration cost is high.
- Consider OpenAPI contract diff checks.
- Commit or snapshot the current large untracked worktree before riskier local-AI registry edits.

Acceptance evidence:

- Demo CI green.
- Strict gate fails only for known production artifact blockers until artifacts are approved.

## Workstream 11 - Knowledge Capsules

Goal: capsules become transferable, versioned, evidence-backed projections of the global Vault graph without creating separate mini-vaults.

Source spec:

- `/Users/grixate/Downloads/the_vault_research_lab_knowledge_capsules_codex_spec.md`

Current good state:

- Database foundations exist for capsules, capsule items, versions, dependencies, health snapshots, exports, imports, and changelog.
- Capsules reference global objects by `target_type` and `target_id`.
- Backend routes exist for:
  - list/create/get/update/archive capsules,
  - add/list/remove capsule items,
  - auto-include claim evidence links/source blocks when adding claims,
  - run capsule health,
  - create/list capsule snapshots.
- Health currently counts approved/unreviewed/unsupported/contradicted claims, private items, disabled tools, and basic source/note/tool totals.
- Desktop has a first Capsules surface under Knowledge with:
  - capsule index,
  - create capsule dialog,
  - selected capsule detail,
  - count strip,
  - health/status,
  - add existing note/source/claim,
  - evidence auto-include toggle for claims,
  - manual snapshot action.
- Backend capsule export preview and package creation exist for reference-only, sanitized, private-full, learning, tool, and public modes.
- Desktop capsule detail has a compact Export dialog with preview and package creation.
- Backend `.vaultcapsule` import quarantine exists with safe zip/path/checksum validation, quarantine file output, `capsule_imports` audit rows, and no canonical graph mutation.
- Desktop Capsules has a compact Import action and quarantine inspection view.
- Quarantined imports can now create pending Review items for imported claims, notes, sources, concepts, and tools without mutating canonical graph objects.
- Import review-item creation is idempotent: repeated runs skip already-created targets and keep the import in `review_ready`.
- Desktop quarantine inspection now has a compact `Review items` handoff and `Open Review` action.
- Review approval can now selectively merge individual imported notes, sources, claims, concepts, and tools.
- Imported objects link to an existing local object when the original ID already exists, instead of duplicating canonical graph objects.
- Imported claims are merged as `weakly_supported` unless they already exist locally; imported tools are created disabled.
- Compact capsule attach entry points exist in the real workflows:
  - current Note,
  - selected Storage source,
  - selected Storage source block,
  - selected Graph claim,
  - Review approval of a new claim.
- Focused backend and desktop tests cover the alpha vertical path plus note attach and approval-to-capsule attach.

Remaining tasks:

- Polish the Capsules UI to the accepted minimalist bar before expanding it:
  - no explanatory capsule marketing copy,
  - no card-heavy dashboard treatment,
  - clear source/note/claim attachment flow,
  - responsive desktop-first layout,
  - mobile noted later with the broader mobile repair pass.
- Expand backend item support where useful:
  - kg node/concept selection,
  - learning items,
  - attached tools.
- Add capsule overview generation as a generated pending-review note using reviewed claims/sources only.
- Add capsule learning generation with default `reviewed_claims_only`.
- Harden/export follow-ups:
  - add richer copyrighted-file and secret scanning,
  - add full source blob inclusion only for explicit private-full mode,
  - add export history UI,
  - add version-specific export,
  - add package format contract docs once import stabilizes.
- Complete import merge workflow:
  - add conflict-aware selective merge UI for imported objects that do not already exist locally,
  - add richer merge decisions for evidence links, source blocks, graph edges, and capsule membership,
  - add an explicit enable step for reviewed imported tools,
  - expose import history/details beyond the latest import result,
  - add invalid-package UI states.
- Add version diff.
- Add fork/dependency workflows.
- Add capsule-scoped Assistant mode that uses capsule items first and cites canonical evidence.
- Update workspace export to include capsule tables once the capsule alpha stabilizes.
- Generate/update OpenAPI contract after routes settle.

Acceptance evidence:

- Capsules can be created, curated, health-checked, snapshotted, exported, imported into quarantine, and selectively merged without duplicating canonical graph objects.
- Imported package objects enter Review before canonical merge; imported tools stay disabled until reviewed.
- Export cannot proceed through unsafe modes when privacy blockers are unresolved.
- Generated capsule notes and learning items stay reviewable and evidence-linked.
- Browser screenshots show Capsules as a calm knowledge curation surface, not an overloaded management console.
- Backend tests cover item references, evidence auto-inclusion, health, snapshots, export preview, export manifest/checksum files, export privacy blocking, import quarantine, import review-item creation, and selective merge approval for existing local objects.
- Desktop tests cover create, attach note/source/claim, snapshot, health, export preview/package creation, export blocking, import quarantine inspection, and the Review handoff.

## Recommended Next Session Steps

1. If continuing UX, keep the Notion/Obsidian/Apple Notes reset active: inspect Notes, Storage, Quick Note, Review, Assistant, Capsules, and Settings screenshots, then simplify the most overloaded flow first.
2. If continuing Capsules, polish the alpha surface and attach dialog first, then continue from import review items into selective merge decisions before diff/fork.
3. If continuing local AI production, pick the first real approved runtime/model candidate set and run the release-packet tooling.
4. If stabilizing before bigger registry edits, stage or commit the current v1 state.
5. After any slice:
   - run focused tests,
   - run `pnpm --filter @vault/desktop build`,
   - run `pnpm e2e`,
   - run `pnpm verify` when the slice touches cross-cutting behavior.

## Suggested Verification Commands

Use these when work resumes:

```bash
pnpm --filter @vault/desktop test -- --runInBand
pnpm --filter @vault/desktop build
pnpm e2e
pnpm verify
pnpm verify:strict
```

Expected result today:

- `pnpm verify` should pass in demo mode.
- `pnpm verify:strict` should fail until production local AI artifacts and approvals are pinned.

## Do Not Regress

- This is a notes/knowledge-base app with local models, not a chatbot shell.
- Notes are mutable thinking.
- Storage is immutable evidence.
- Generated content is provisional.
- Cloud fallback stays off by default.
- Demo fixture success must not be mistaken for production readiness.
- Strict production is done only when `./scripts/check_ai_readiness.sh` passes without `--allow-demo`.
