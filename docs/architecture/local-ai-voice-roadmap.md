# Local AI and Voice Roadmap

Status: in progress.

Authoritative inputs:

- `docs/specs/the_vault_research_lab_codex_spec_v0_2.md`
- `docs/specs/the_vault_research_lab_local_ai_voice_addendum.md`

## What Changed

The original v1 prototype has a deterministic/mock AI path. That is useful for tests and product flow, but it is not the intended alpha endpoint anymore.

The v0.2 plan makes local AI a first-class subsystem:

- downloadable small local model packs,
- local model manager,
- capability-based routing,
- local structured extraction,
- local note generation,
- local embeddings,
- optional local reranking,
- local speech-to-text,
- local text-to-speech,
- explicit cloud opt-in only.

The architecture framing is now:

```text
Electron = cockpit
Vault Core = research operating system
Local AI runtime = private engine room
Python Tool Studio = lab bench
Voice layer = microphone and narrator
```

## Current Gap

Current code has:

- provider interfaces for LLM and embeddings,
- mock/deterministic extraction,
- prompt files,
- GBNF grammar scaffold,
- review validation and evidence gates.

Current code now has Milestone 4A scaffolding:

- capability registry,
- provider locality labels,
- hardware profile endpoint,
- provider/capability/model registry endpoints,
- Tiny, Standard, and Strong model-pack metadata with pack-level download orchestration for release-ready small models,
- mock text, JSON, embedding, rerank, STT, and TTS API paths,
- `ai_capability_bindings` and `ai_model_runs` tables,
- Settings UI for AI Models, Routing, Voice, and Privacy.
- 4B foundation for registry-defined fixture/URL/Hugging Face downloads, background streaming, partial resume, checksum verification, installed-model records, and download history.
- 4B hardening for checksum-failure blocking, pause/resume/cancel controls, startup resume for interrupted downloads, manual local GGUF import, model delete, and capability reset on delete.
- 4C runtime-readiness foundation for llama.cpp binary discovery, installed-GGUF health, guarded smoke checks, runtime-backed model tests, routed text generation, and Settings runtime status.
- 4C llama.cpp server foundation with a loopback-only server process manager, runtime-tested non-fixture GGUF gate, start/stop API, generation/embedding mode separation, health/log status, Settings controls, unload/delete shutdown protection, server-backed text generation for selected `llama_cpp_server` routes, and server-backed vector indexing/search/reindex for selected `llama_cpp_server_embeddings` routes.
- 4D generated-note foundation that routes note drafting through the selected `generate_note` capability and stores generated-note provenance.
- 4D grounded assistant foundation that prefers approved claim evidence over raw source blocks, routes local-model answers through the selected `grounded_answer` capability when configured, validates local-model citation markers against the supplied evidence pack, records assistant AI runs without storing private evidence text for mock/default routes, refuses Vault-only factual answers without evidence, and creates deduped missing-evidence/citation-repair review items when answers cannot be backed by approved claims or cite unsupported evidence.
- 4D local claim-extraction foundation that routes `extract_claims` through a runtime-tested llama.cpp model and validates exact source quotes before review.
- 4E deterministic, app-managed artifact-backed, and loopback HTTP local embedding foundation that indexes source blocks, stores provider/model/dimension embedding spaces, preserves old spaces during reindex, supports vector/hybrid search, runs reindex as cancellable, restart-resumable lab jobs with progress, and can rerank hybrid search results through either a loopback-only local HTTP reranker or an app-managed local reranker artifact.
- 4G managed-runtime foundation with registry-backed demo llama.cpp runtime install, host platform/architecture compatibility gating, explicit `compatible`/`host_platform`/`host_arch`/`compatibility_error` runtime contract fields, checksum and executable smoke/version verification, app-data placement, setup-guide action, Settings target/host compatibility badges, checksum/smoke/compatibility blocking, and delete/repair lifecycle.
- Structured release-readiness diagnostics for model entries, model packs, and managed runtimes, exposed through API contracts and Settings checklists so production Tiny/Standard/Strong blockers are concrete.
- 4H first-run setup wizard shell with a guided step rail for privacy, hardware, runtimes, production pack readiness, demo fallback, and capability-route activation previews. The wizard is backed by `/ai/setup/status`, can run `/ai/setup/run`, install the demo runtime, download eligible packs, and show setup-run skips/failures without pretending fixture assets are production local AI.
- A production readiness report at `/ai/readiness/report` and `./scripts/check_ai_readiness.sh` release gate that aggregate production model-pack checks, production runtime checks, privacy gates, required capability-route gates, and grouped approval items into one auditable contract surfaced in Settings and CI/manual release checks. Capability routes are only production-clear when they use known non-cloud, non-mock local providers, installed app-approved model inventory, non-fixture/non-manual-import assets, matching provider/model kinds, and local runtime-tested models where applicable. Model registry readiness now also blocks candidates whose kind/runtime/capabilities/defaults do not fit the local provider contract, and production packs must prove their required models cover every advertised capability without sneaking larger-profile models into Tiny/Standard packs. The CLI, `/ai/readiness/report/export`, and Settings Export readiness can also export the same strict-production Markdown approval checklist for local-model release review. `/ai/readiness/approval-template/export`, `/ai/readiness/approval-template/evaluate`, `./scripts/export_ai_approval_template.sh`, and Settings template/evidence exports produce fill-in Markdown review templates plus fillable evidence overlay JSON for source, checksum, size, license, model runtime defaults, and approval evidence fields across bundled or pre-pin candidate registries.
- A structural registry validation gate at `./scripts/validate_ai_registries.sh`, `/ai/registry/validation`, and Settings -> AI Models that catches malformed model/runtime manifests before readiness checks or setup flows run. It also verifies bundled manifest digests against the app-pinned `registry_policy.json`, rejects unsafe artifact filenames, unsafe bundled fixture paths, invalid source URLs, and embedded URL credentials, and is refreshed with `./scripts/pin_ai_registries.sh` after approved registry edits. The gate also reports pending production license artifacts through `license_url` or `license_path` warnings. `/ai/registry/release-plan`, `/ai/registry/release-plan/export`, `/ai/registry/release-plan/evaluate`, `./scripts/plan_ai_registry_release.sh`, and the Settings Registry release plan panel now summarize whether bundled or candidate production packs, models, and runtimes are ready to pin, let release owners dry-run selected candidate JSON files in-app, preview manifest SHA-256 digests plus added/changed/removed registry IDs, and save bundled or candidate Markdown review artifacts with source labels and pin-impact evidence. Candidate dry runs can also probe source reachability, remote size headers, exposed remote SHA-256 metadata, license URL reachability, or bundled license-path existence through `/ai/registry/artifact-probe/evaluate`, Settings Probe sources, or `./scripts/probe_ai_registry_artifacts.sh`, export `candidate-ai-registry-artifact-probe.md`, stream full candidate model/runtime bytes with `./scripts/verify_ai_registry_artifacts.sh` to compute exact checksum/size evidence without installing or approving artifacts, export matching Markdown approval and fillable evidence JSON artifacts for the exact same model/runtime files before pinning, then apply reviewer evidence through `/ai/registry/evidence/apply`, Settings Apply evidence JSON, `./scripts/apply_ai_registry_evidence.sh`, or `./scripts/prepare_ai_registry_release_candidate.sh`; successful overlay application exposes exact patched-file SHA-256s plus separate applied Markdown review artifacts, a source-probe command, a byte-verification command, a one-shot release-packet command, an acceptance-report command, a final pin handoff, and patched model/runtime registry JSON files. `./scripts/probe_ai_registry_artifacts.sh --model-registry ... --runtime-registry ... --format markdown --output ...` verifies candidate artifact/license reachability, bundled license paths, remote size headers, and exposed checksum metadata without full model downloads; `./scripts/verify_ai_registry_artifacts.sh --model-registry ... --runtime-registry ... --evidence-output ...` performs the full byte verification and evidence export; `./scripts/prepare_ai_registry_release_candidate.sh --model-registry ... --runtime-registry ... --evidence ... --output-dir ... --probe-sources --verify-bytes` writes the full pre-pin packet, including the source-probe report, byte-verification report, and byte-evidence JSON, in one directory; `./scripts/pin_ai_registries.sh --model-registry ... --runtime-registry ... --check --format markdown --output ...` writes an auditable candidate acceptance report; the same pin command without `--check` validates the candidate release plan, refuses blocked candidates, copies approved candidate manifests into the bundled registry files, and writes `registry_policy.json` from the exact copied bytes.
- A Hugging Face metadata hydrator at `./scripts/hydrate_ai_registry_metadata.sh`, `/ai/registry/metadata/hydrate`, and Settings -> AI Models that helps release owners turn approved small-model candidate repo/file choices into concrete candidate manifest metadata before review. It resolves immutable commit revision, exact file size, LFS SHA-256, and upstream license label from the Hugging Face model API, writes a hydrated candidate `model_registry.json`, refreshes the candidate release-plan digest preview in-app, and deliberately leaves `approval.*` plus license artifacts to the human approval/evidence-overlay gates.
- Distinct blocked registry targets for the addendum's small local model profiles: tiny/standard/strong GGUF LLM slots, tiny and balanced embedding slots, tiny and balanced optional reranker slots, tiny and small whisper.cpp slots, and Piper TTS.
- Manual in-process smoke scripts at `./scripts/test_local_ai.sh` and `./scripts/test_voice_local.sh` that exercise the local AI setup/generation/embedding/rerank routes and voice transcription/TTS/cache routes against temporary or selected Vault data directories.

Current code does not yet have:

- release-approved Tiny, Standard, and Strong local model packs with real pinned model files, checksums, sizes, licenses, and language notes,
- production-approved bundled or managed local runtime installation for llama.cpp, whisper.cpp, and Piper,
- approved production embedding model packs,
- release-approved production reranker model pack and app-approved default local reranker artifact; loopback-only local HTTP and app-managed local reranker adapters exist,
- approved production whisper.cpp and Piper/Kokoro model packs,
- release-approved bundled production model/runtime manifests; the setup runner can install, test, and select approved URL-backed LLM, whisper.cpp, and Piper artifacts once those manifests exist,
- generalized durable worker scheduling beyond embedding reindex and model-download resume,
- completed Product Design plugin canvas export.

## Inserted Milestones

These milestones are inserted after current Milestone 3 and before the old "Local LLM extraction" milestone.

### Milestone 4A: Local AI Subsystem Skeleton

Goal: capability-based AI routing exists with mock providers.

Current status: substantially implemented.

Backend tasks:

- Add provider interfaces for LLM, embedding, reranker, STT, and TTS.
- Add capability registry for:
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
- Add hardware profile service.
- Add AI provider and capability Pydantic contracts.
- Add `/ai/providers`, `/ai/capabilities`, `/ai/hardware`.
- Add `ai_model_runs` table.
- Log every AI run without storing full private prompts by default.

Frontend tasks:

- Add Settings -> AI Models.
- Add Settings -> Voice.
- Show local/cloud/external-local privacy labels.
- Show "No model installed" and repair actions.

Acceptance:

- App runs with no real model installed. Done.
- Mock providers can generate deterministic output. Done.
- User can see capability bindings and locality labels. Done.
- Tests pass without downloading models. Done.
- Cloud fallback is impossible without explicit opt-in. Done at capability-selection and request time.

Remaining 4A hardening:

- Split the large FastAPI route module into route-specific files.
- Add frontend tests for the Settings tabs.
- Add a Pencil/Product Design canvas once the plugin connection works.
- Add more precise installed model records instead of registry-level `installed` flags.

### Milestone 4B: Model Registry and Downloader

Goal: downloadable local models can be installed safely.

Current status: foundation implemented for registry-defined fixture/URL/Hugging Face downloads, model-pack metadata, pack-level download orchestration, and manual local GGUF import. Non-builtin registry downloads now run in background worker threads, stream into cache files, preserve partial bytes for resume, expose progress through `/ai/models/downloads`, resume interrupted queued/downloading rows on startup, and can be paused, resumed, or cancelled from Settings. Hugging Face sources must be registry-defined, pinned to a 40-character revision, matched by `allow_patterns`, and protected by a pinned file checksum. Installed model rows now persist `license_label`, `license_url`, and `license_path` as an audit snapshot, and model APIs prefer that installed provenance over mutable registry metadata once an artifact is on disk.

Backend tasks:

- Add `services/core/vault_core/ai/models/model_registry.json`.
- Add Tiny, Standard, and Strong model-pack records above individual model entries.
- Add model storage under application data:
  - `models/llm`
  - `models/embeddings`
  - `models/voice/stt`
  - `models/voice/tts`
  - `ai_runtime/llama_cpp`
  - `cache/model_downloads`
- Add installed model database records. Done, including first-class installed license provenance columns with backfill from saved manifests.
- Add download queue state:
  - `not_installed`
  - `queued`
  - `downloading`
  - `paused`
  - `verifying`
  - `installed`
  - `failed`
  - `needs_license_action`
  - `update_available`
- Add checksum verification.
- Add pause, resume, cancel, delete.
- For alpha, allow only registry-defined downloads, no arbitrary URLs.
- Add manual local `.gguf` import. Done: imports copy into Vault model storage, compute SHA-256, write a manifest, and start as `manual_import_untrusted`.

Frontend tasks:

- Add first-run AI setup panel. Started through Settings -> AI Models model-pack cards.
- Show Tiny, Standard, Strong profiles. Done in pack metadata and Settings.
- Show disk size, license, privacy labels, and download progress. Done for model cards and the Settings download queue.

Acceptance:

- User can install a tiny/small local model pack from registry metadata. Done for the release-ready Tiny fixture pack; registry-defined URL and Hugging Face-style individual downloads also enforce pinned checksum and revision policy.
- User can import an already-downloaded local GGUF manually. Done.
- Imported models cannot be selected until a runtime smoke test passes. Done.
- Checksum failure blocks installation. Done and tested.
- Failed downloads can resume or be deleted. Done for registry-defined local fixture, URL, and Hugging Face-style downloads; partial cache resume is tested with a local HTTP fixture server.
- Interrupted queued/downloading transfers resume on app startup. Done for registry-defined downloads.
- No model install is required for the app to launch. Done.
- Installed fixture models can be deleted, files are removed, and affected capability bindings reset to defaults. Done.

Remaining 4B hardening:

- Add Hugging Face-specific downloader policy for allowlisted registry entries. Done for pinned revision, allow-pattern, and checksum validation; approved real entries remain pending.
- Add resumable partial-file support and local fixture server tests. Done for registry-defined URL downloads.
- Add UI affordances for pause/resume/cancel once remote downloads are asynchronous. Done in Settings -> AI Models.
- Add signed or app-pinned registry update policy. Done for app-pinned bundled registries via `registry_policy.json` and `./scripts/pin_ai_registries.sh`; signed external registry updates remain future work.
- Add installed model records that include license text paths. Done for registry downloads, manual imports, builtin installs, existing workspace backfill, and API model cards.
- Add production-approved Standard and Strong pack entries with real model IDs, licenses, and checksums.

### Milestone 4C: llama.cpp Runtime

Goal: local GGUF inference works.

Current status: runtime-readiness and server generation/embedding foundation implemented. The app can discover llama.cpp binaries from environment variables, app-data runtime folders, or `PATH`; report installed llama.cpp GGUF candidates; expose `/ai/runtime/health`; and run a guarded smoke endpoint. `/ai/models/{model_id}/test` now routes installed llama.cpp models through runtime smoke execution instead of mock generation. `/ai/generate/text` now uses capability routing and can execute a runtime-tested llama.cpp model through the CLI path. Manual imports graduate from `manual_import_untrusted` to `runtime_tested` after a passed smoke test. The tiny fixture model is intentionally marked as fixture-only rather than inference-capable. The core service can also start and stop a single loopback-only `llama-server` process for a runtime-tested non-fixture GGUF, expose PID/endpoint/mode/log status through health, stop that process automatically on model unload, model delete, or app shutdown, generate text through OpenAI-compatible `/v1/completions` with native `/completion` fallback when a capability is routed to `llama_cpp_server`, and index/search/reindex vectors through OpenAI-compatible `/v1/embeddings` with native `/embedding` fallback when `embed_text` is routed to `llama_cpp_server_embeddings`.

Backend tasks:

- Package or locate llama.cpp. Partially done: discovery is implemented; packaging is pending.
- Add CLI runtime for grammar-constrained extraction. Done for `extract_claims` and `extract_objects` when the configured llama.cpp CLI supports `--grammar-file` or inline `--grammar`.
- Add server runtime for interactive generation and optional embeddings. Done for managed process lifecycle, text generation, and vector indexing/search/reindex.
- Add process manager, health checks, model load/unload, and logs. Done for loopback start/stop/status/logs plus unload/delete/shutdown protection.
- Add smoke prompt endpoint. Partially done: guarded endpoint exists; execution path is tested with a fake CLI and non-fixture model file; production inference requires a real GGUF model and configured CLI.
- Add runtime failure surfaces with actionable errors. Partially done.

Acceptance:

- A downloaded or manually imported GGUF model can answer a test prompt locally. Done for manual imports when a user provides a real model and CLI; automated tests cover the execution path with a fake CLI and non-fixture file.
- CLI provider can run a grammar-constrained extraction prompt. Done for claim extraction with `vault_claim_extraction.gbnf` and object extraction with `vault_object_extraction.gbnf`.
- Server provider can generate text for note drafts. Done when `generate_note` is routed to `llama_cpp_server`.
- Runtime failures do not crash the app. Done for discovery and smoke checks.
- The model Test action reports runtime-backed `not_configured`, `fixture_only`, `ready`, `passed`, or `failed` status for llama.cpp models. Done.
- `/ai/generate/text` routes selected llama.cpp capabilities through local CLI execution and records `ai_model_runs` without storing prompts. Done.

Remaining 4C hardening:

- Add approved real tiny GGUF registry entry with pinned checksum and license text.
- Add managed llama.cpp binary install/verification per OS.
- Add approved real-model integration smoke tests behind optional local fixtures.
- Add release-approved production embedding GGUF/model packs for the implemented server-backed embedding route.

### Milestone 4D: Local Extraction and Note Generation

Goal: local AI performs real Vault work.

Current status: generated-note, grounded-assistant, claim-extraction, object-extraction, grammar-constrained claim extraction, and grammar-constrained object extraction foundations implemented. `/notes/generate` now builds an evidence-aware prompt, routes through the selected `generate_note` capability, requires synthesis/evidence/uncertainty sections for local llama.cpp output, rejects empty, headings-only, prose-only, section-incomplete, citation-missing, or unsupported-citation local drafts before note creation, keeps accepted generated notes in `generated_pending_review`, and stores provenance including provider, model ID, capability, source IDs, claim IDs, citation policy, AI run ID, off-device status, output hash, and validation status. `/assistant/ask` now retrieves approved claim evidence before raw source blocks, refuses Vault-only factual answers when matching evidence is absent, creates deduped `assistant_missing_evidence` review items for missing or weak evidence, returns citation chips with evidence kind and claim/source IDs, logs the selected `grounded_answer` route, and can send a strict evidence-only prompt to a configured local llama.cpp route. Local grounded-answer output is now citation-validated before display: missing or unsupported markers such as `[99]` are treated as validation failures, the visible answer is rebuilt from the evidence pack, the AI run validation status is updated, and a review follow-up is created when needed. `/extraction/run` now routes claim proposals through the selected `extract_claims` capability and concept/object proposals through the selected `extract_objects` capability when those capabilities point to runtime-tested llama.cpp models. Valid local proposals must pass schema, privileged-status, quote, confidence, relation-shape, relation-confidence, and executable-content validation before entering pending review; invalid model output is quarantined as dismissed review metadata. Valid contradiction proposals enter Review as `new_contradiction`, recheck their exact source quote on approval, and create contradiction graph nodes without automatically mutating claim status. Weak-evidence `claim_status_change` review approvals can only apply low-trust statuses and cannot promote claims to supported, verified, or user-confirmed. When llama.cpp advertises `--grammar-file` or inline `--grammar`, `extract_claims` supplies `vault_claim_extraction.gbnf` and `extract_objects` supplies `vault_object_extraction.gbnf`; unsupported CLIs fall back to prompt-only JSON with the same validation and quarantine gates.

Backend tasks:

- Route extraction through selected `extract_objects` / `extract_claims` capability. Done for runtime-tested llama.cpp local imports.
- Apply GBNF grammar constraints for claim and object extraction when supported by the CLI. Done for `extract_claims` and `extract_objects`.
- Route generated notes through selected `generate_note` capability and reject empty/skeletal/section-incomplete/citation-invalid local drafts. Done.
- Keep exact quote validation mandatory. Done for claim/definition/procedure/contradiction objects.
- Keep review queue mandatory. Done for local claim and object extraction.
- Make contradiction review explicit and non-mutating. Done for `new_contradiction` review items with approval-time quote rechecks.
- Prevent weak-evidence review items from promoting claim trust. Done for `claim_status_change` approval.
- Quarantine invalid model output. Done for invalid local claim and object output, including malformed object relations.
- Record `ai_model_runs` metadata and validation status. Done for routed text, generated-note drafting, local claim extraction, and local object extraction.

Frontend tasks:

- Add provider/model status to extraction and generation panels. Done for Notes and Sources.
- Add generated-note provenance:
  - `generated_by`
  - `model_id`
  - `capability`
  - `source_ids`
  - `claim_ids`
  - `citation_policy`
  - `requires_review`
  Done in generated note metadata and Note provenance strip.
- Add a visible quarantine lane for invalid local extraction output. Done in Review.

Acceptance:

- User can extract claims from a source block locally. Done when `extract_claims` points to a runtime-tested llama.cpp import.
- User can extract concept/object candidates from a source block locally. Done when `extract_objects` points to a runtime-tested llama.cpp import.
- Claim and object extraction can use Vault GBNF grammars. Done when the configured CLI advertises grammar support; unsupported CLIs keep the validated fallback path.
- User can generate a note draft from selected context locally. Done when `generate_note` points to a runtime-tested llama.cpp import; default mock path remains available.
- Invalid extraction is quarantined. Done for local claim and object extraction.
- Generated note can be approved, edited, rejected, or regenerated.

### Milestone 4E: Local Embeddings and Reranking

Goal: semantic search and optional reranking work without cloud.

Current status: deterministic local embedding/search foundation implemented, plus an app-managed local embedding adapter for approved installed artifacts, plus a loopback-only HTTP embedding adapter for user-managed local embedding servers that expose OpenAI-compatible `/v1/embeddings`-style responses, plus a managed llama.cpp server embedding adapter. Imported and updated source blocks are indexed locally using the selected `embed_text` provider/model/dimensions. `/search` supports `fts`, `vector`, and `hybrid` modes, and hybrid search can optionally rerank its result set through the selected `local_reranker_http` or `local_cross_encoder` provider. `/ai/embed` and indexing/reindexing now route through the selected embedding provider; the app-managed `local_embedding` adapter requires `settings.model_path`, rejects missing or empty model files, fingerprints the installed artifact into the vector space, and reports the fingerprint in `/ai/embed` output. The HTTP embedding adapter rejects non-localhost endpoints so `local_only` cannot accidentally become cloud inference, and the managed llama.cpp adapter starts the app-owned loopback server in `--embedding` mode before indexing/search/reindex. `/ai/rerank` routes through `rerank_results`, supports a loopback-only local HTTP reranker and an app-managed local cross-encoder artifact path, records local model runs without storing full private candidate text, and rejects non-local endpoints. The app now exposes a non-mock `local_embedding` provider for approved app-managed embedding artifacts, a `llama_cpp_server_embeddings` provider for GGUF server embeddings, a `local_reranker_http` provider for user-managed local reranker servers, and a `local_cross_encoder` provider for installed local reranker artifacts. `/ai/setup/run` can download and verify an approved embedding or reranker model, run a local smoke test, mark it runtime-tested, activate `embed_text` or `rerank_results`, and index/search/rerank source blocks in the resulting local provider/model space. `/ai/embeddings/reindex` creates an `embedding_reindex` lab job that runs in the background, updates source/block progress, supports cancellation through `/jobs/cancel/{job_id}`, resumes queued jobs on startup, requeues interrupted running jobs, and preserves older embedding spaces while writing the current space. The desktop topbar defaults to Hybrid search and Settings -> Routing exposes the active `embed_text` capability, Reindex action, progress strip, Cancel action, local HTTP endpoint settings, managed llama-server port settings, and the active `rerank_results` route with local HTTP endpoint or local model-path settings plus a saved-route smoke test. Release-approved production embedding and reranker manifests, a native app-approved embedding inference backend, a real app-approved bundled reranker artifact, and generalized durable workers beyond embedding reindex startup resume remain pending.

Backend tasks:

- Add embedding provider interface and local provider. Done for deterministic local/mock provider, app-managed local embedding provider, and loopback-only HTTP local embedding provider.
- Add embedding model install option. Started for approved URL-backed app-managed embedding artifacts; bundled production embedding manifests remain pending.
- Add embedding job queue with progress and cancellation. Done for desktop lab jobs, including startup resume for queued and interrupted embedding reindex jobs.
- Store model ID, dimensions, provider, and embedding space. Done via `(provider, model, dimensions)` rows and response `space_id`.
- Add re-embedding workflow. Done for `/ai/embeddings/reindex` lab jobs.
- Add hybrid FTS plus vector search. Done.
- Preserve old embeddings until new embedding space is complete. Done for current background reindex jobs.
- Add optional local reranking for hybrid search. Done for `/ai/rerank` and hybrid `/search` when `rerank_results` is routed to the loopback-only `local_reranker_http` provider or the app-managed `local_cross_encoder` provider.

Remaining 4E hardening:

- Add approved production embedding packs for the implemented app-managed and llama.cpp server-backed routes.
- Add an approved production reranker pack or bundled local reranker artifact for the implemented loopback HTTP and app-managed local reranker routes.
- Add a generalized durable worker scheduler for other lab job types.
- Add resumable progress within a single partially indexed source if very large source blocks become common.

Frontend tasks:

- Add hybrid search control to global command search. Done.
- Add Settings reindex action for the active `embed_text` capability. Done.
- Add embedding job progress/cancel UI. Done in Settings -> Routing.
- Add reranker route controls and local endpoint/model-path smoke test. Done in Settings -> Routing.

Acceptance:

- Imported sources are embedded locally. Done.
- Search combines FTS and vector similarity. Done.
- Hybrid search can rerank locally without sending data to a cloud endpoint. Done for loopback HTTP reranker routes.
- Changing embedding model creates a new embedding space. Done for model/dimension changes followed by reindex.
- Old embeddings remain until replacement completes. Done for existing blocks during background reindex.

### Milestone 4F: Approved Small Local Model Packs

Goal: make the addendum's "downloadable small local models" requirement real for users, not just represented by fixtures and placeholders.

Current status: production pack implementation has started, but no bundled production model pack is release-ready. The registry, downloader, model-pack metadata, checksum gate, Hugging Face pinning policy, metadata hydrator, manual GGUF import, runtime smoke paths, and managed runtime fixture path exist. The app now separates the CI/demo fixture pack from production local packs, exposes `release_channel`, `release_status`, `readiness_checks`, `blocked_reasons`, and `installable` in the model and model-pack APIs, and blocks production pack downloads until real model files, licenses, runtimes, sizes, checksums, and release approval records are approved. Tiny, Standard, and Strong have distinct blocked model targets rather than reusing the same tiny placeholder: Tiny maps to a tiny GGUF LLM, tiny embedding model, optional tiny reranker, tiny whisper.cpp model, and Piper voice; Standard maps to a stronger small GGUF LLM, balanced embedding model, optional balanced reranker, small whisper.cpp model, and Piper voice; Strong maps to a larger GGUF LLM target plus the balanced embedding, optional balanced reranker, and small voice targets. Production readiness checks now name the exact missing approval for each pack/model: source, pinned revision, filename, checksum, size, license label, license artifact (`license_url` or `license_path`), release approval record (`approval.status`, `approved_by`, `approved_at`, and `evidence`), provider/runtime eligibility, managed runtime availability, route provider locality, installed approved model inventory, fixture/manual-import exclusion, model/provider kind matching, and runtime-tested status. Optional reranker add-ons are counted by release-plan, approval-template, probe, and byte-verification tooling, while pack-level blockers and default setup activation remain required-model based so optional reranking cannot block a base Tiny/Standard/Strong install. `/ai/setup/run` accepts `include_optional_models` for explicit add-on installs; Settings production pack cards expose an Install / Check add-ons action that downloads, verifies, smoke-tests, and activates optional local model capabilities after the base pack is ready. Pack readiness is now runtime-aware: managed-runtime blockers clear only when the required production runtime manifest is installed or installable. `/ai/readiness/report` now aggregates these pack checks with production runtime, privacy, required capability-route gates, and grouped approval items, so release blockers are visible in Settings and testable as a single contract. Settings production pack cards now show route coverage for each pack capability, required-ready counts, optional add-on counts, and expose a one-action Preflight / Install & test button that runs `/ai/setup/run` for that pack, returning a blocked approval plan today and the install/download/test/select flow once a pack is approved. The production setup path is covered by approved URL-artifact tests that install production runtimes where required, download and verify production model artifacts, smoke-test llama.cpp, app-managed local embedding, app-managed local reranker add-ons, whisper.cpp, and Piper models, mark them runtime-tested, and activate their local routes with managed binary/model paths where applicable. `./scripts/check_ai_readiness.sh` now runs the same contract as a strict CLI release gate and can export Markdown approval checklists; it fails until production local packs and runtimes are ready, while `--allow-demo` can pass development builds that intentionally rely on fixture assets.

Plan:

- Keep the current fixture pack for deterministic tests and demos, but label it internally as a fixture/demo pack in docs and UI copy.
- Add release-approved Tiny production pack metadata. Started with blocked placeholder entries and structured readiness checks; real model IDs, files, and approvals remain pending:
  - one tiny/small GGUF instruct model for `extract_objects`, `extract_claims`, `summarize`, and `generate_note`,
  - one local embedding model or managed local embedding runtime for `embed_text`,
  - one optional tiny reranker model for `rerank_results`,
  - one small whisper.cpp-compatible STT model for `transcribe_audio`,
  - one Piper-compatible local voice for `synthesize_speech`.
- Add release-approved Standard production pack metadata. Started with separate Standard GGUF, balanced embedding, and small whisper placeholders:
  - stronger small GGUF instruct model for extraction, grounded answering, note generation, and learning item creation,
  - balanced embedding model with stored dimensions and reindex workflow,
  - one optional balanced reranker model for hybrid search quality,
  - small-class STT model,
  - local TTS voice.
- Keep Strong as optional until memory/runtime testing is reliable on target hardware. Started with a separate larger GGUF target that remains blocked until source, checksum, size, license, and runtime testing are approved.
- For every production model entry, require:
  - approved source type,
  - pinned revision or app-pinned URL,
  - exact filename allowlist,
  - SHA-256 checksum,
  - size in bytes,
  - license label and license artifact through `license_url` or a bundled `license_path`,
  - language coverage,
  - recommended profile,
  - runtime defaults for context, threads, GPU layers, temperatures, and max tokens.
- Use `./scripts/hydrate_ai_registry_metadata.sh --model-registry candidate-model-registry.json --output candidate-model-registry.hydrated.json` after reviewers choose concrete Hugging Face repos/files and before approval evidence is filled. This hydrates commit revision, file size, LFS SHA-256, and upstream license label only; it does not set `approval.*`, select a license artifact, or replace legal/runtime review.
- Keep `readiness_checks` populated for every production pack/model until all release gates pass; blockers should be machine-readable enough for Settings and setup automation to choose the next repair/install action. This now includes suitability checks for model kind/runtime/capability fit, runtime defaults, pack capability coverage, and profile fit, not only artifact evidence.
- Keep the strict `./scripts/check_ai_readiness.sh` gate failing until production pack, runtime, privacy, and route blockers are resolved; use `--allow-demo` only for dev/demo pipelines and `--format markdown --output ...`, `/ai/readiness/report/export`, or Settings Export readiness to archive release approval work. Use `/ai/readiness/approval-template/export`, `/ai/readiness/approval-template/evaluate`, `./scripts/export_ai_approval_template.sh --evidence-output ...`, or Settings template/evidence exports to hand reviewers both a fill-in checklist and a directly consumable evidence JSON skeleton of exact manifest fields still requiring evidence; use `/ai/registry/artifact-probe/evaluate`, Settings Probe sources, or `./scripts/probe_ai_registry_artifacts.sh --model-registry ... --runtime-registry ... --format markdown --output ...` to verify candidate source/license reachability, bundled license paths, remote size headers, and exposed checksum metadata before approval; use `./scripts/verify_ai_registry_artifacts.sh --model-registry ... --runtime-registry ... --evidence-output ...` to stream candidate bytes into checksum/size evidence before applying reviewer approval; use `/ai/registry/evidence/apply`, Settings Apply evidence JSON, or `./scripts/apply_ai_registry_evidence.sh --release-plan-output ... --approval-template-output ... --pin-handoff-output ... --model-output ... --runtime-output ... --check` to convert filled evidence into applied review Markdown, a final pin handoff, patched candidate manifests, and proof of whether they are ready to pin. Use `./scripts/prepare_ai_registry_release_candidate.sh --model-registry ... --runtime-registry ... --evidence ... --output-dir ... --probe-sources --verify-bytes` when release owners need the full evidence bundle, patched manifests, source probe, byte verification, applied reviews, acceptance report, handoff, and packet index in one directory.
- Keep `./scripts/validate_ai_registries.sh` and `/ai/registry/validation` passing so registry edits cannot introduce duplicate IDs, broken pack references, unsupported source types, invalid checksum formats, malformed pinned revisions, unsafe artifact paths, invalid source URLs, missing fixture paths, or unapproved manifest digest changes. Use `./scripts/plan_ai_registry_release.sh --model-registry ... --runtime-registry ...` or Settings candidate-file dry runs backed by `/ai/registry/release-plan/evaluate` to evaluate candidate production manifests before pinning: they must show zero structural warnings, zero production artifact blockers, complete approval evidence, expected manifest SHA-256 digests, and an understood added/changed/removed ID preview before a registry edit is ready for `./scripts/pin_ai_registries.sh`. `/ai/registry/release-plan/export`, `/ai/registry/release-plan/evaluate`, `/ai/registry/artifact-probe/evaluate`, `/ai/registry/artifact-verify/evaluate`, Settings Export Markdown, Settings Export candidate, Settings Probe sources, Settings Verify bytes, Settings Export probe, Settings Export byte report, Settings Export byte evidence, Settings Export candidate template, Settings Export evidence JSON, Settings Apply evidence JSON, Settings applied Markdown exports, Settings visible source-probe/byte-verification/release-packet/final pin handoff commands, Settings pin handoff export, Settings patched registry exports, and `./scripts/prepare_ai_registry_release_candidate.sh` produce auditable plan, evidence-template, source-probe, byte-verification, patched-manifest, patched-file digest, validation, packet, and final command artifacts reviewers can attach to release approval records. After approval, `./scripts/pin_ai_registries.sh --model-registry ... --runtime-registry ... --check --format markdown --output ...` dry-runs the exact candidate files and writes the acceptance report, and the same command without `--check` copies them into the bundled manifests and writes the app-pinned policy. Model download and managed runtime install paths also reject unsafe registry filenames before writing into app-data storage. Settings shows this as structural manifest health plus a Registry release plan panel, separate from runtime setup and capability-route blockers.
- Add a model-pack install path that downloads, verifies, runs runtime health tests, and offers route selection only after tests pass.
- Preserve the rule that no arbitrary model repository code is executed.

Frontend tasks:

- Separate "Demo fixture pack" from "Production local packs" in Settings -> AI Models. Done.
- Show why a pack is blocked when it has placeholder metadata, missing license approval, missing runtime, or missing checksum. Done with API-backed blocker lists and structured readiness checklists in Settings.
- Show a production readiness audit with total blocked checks, production pack readiness count, production runtime manifest readiness count, next release gates, grouped approval items, and grouped blockers. Done through `/ai/readiness/report`.
- Add a one-action "Install and test" path for the recommended production pack. Started in Settings with production pack Preflight / Install & test buttons backed by `/ai/setup/run`; blocked packs return approval steps, and approved URL-backed packs now use the same runner for install/test/select.
- Show capability coverage per pack and which routes will be updated after install. Started with per-pack route coverage badges for local/demo/missing/off-device capability routes in Settings.

Acceptance:

- A normal user can install at least one Tiny production pack without knowing GGUF, quantization, CLI flags, or GPU settings.
- After install, the app can locally generate a note, extract review-gated claims/objects, embed imported sources, transcribe a local audio file, and synthesize speech using production model files.
- Every production model has checksum and license metadata in the registry.
- The strict local-AI readiness CLI exits zero only after real production local model packs, managed runtimes, privacy gates, and required capability routes are ready.
- CI still uses mocks and fixtures only; no large downloads are required in automated tests.
- Cloud fallback remains impossible without explicit opt-in.

### Milestone 4G: Managed Local Runtime Installation

Goal: the user should not have to install llama.cpp, whisper.cpp, or Piper manually for the production small-model pack.

Current status: foundation implemented for the demo llama.cpp fixture runtime and approved URL runtime manifests. Users can configure binaries through paths or environment variables, and tests cover fake local CLIs. The runtime registry now exposes demo and production runtime entries with release channel, install state, structured readiness checks, blocker reasons, checksum metadata, integrity status, installability, and recent install/verify log entries. `/ai/runtimes/registry`, `/ai/runtimes/{runtime_id}/install`, `/ai/runtimes/{runtime_id}/verify`, and `DELETE /ai/runtimes/{runtime_id}` install the demo llama.cpp fixture into `ai_runtime/llama_cpp/bin`, install approved URL runtime manifests after content-length, file-size, SHA-256, optional explicit archive-member extraction, executable-permission, and bounded version/smoke verification, make binaries executable, surface them through runtime health, record install/verify/failure evidence with probed version output, block checksum-mismatched or smoke-failed managed llama.cpp, whisper.cpp, and Piper binaries from use even when selected explicitly in route settings, and remove them safely from app data. Archive-backed runtime manifests can pin the downloaded zip/tar artifact in `files[0]`, name a safe `source.archive.member` or `source.archive_member`, and install only that member as the managed binary; unsafe members, symlinks, links, and invalid archive formats are rejected. Production llama.cpp, whisper.cpp, and Piper runtime entries remain blocked until approved sources, licenses, sizes, and checksums are pinned.

Backend tasks:

- Add app-pinned runtime manifests for llama.cpp, whisper.cpp, and Piper by OS/architecture. Started with demo fixture and blocked production placeholders.
- Download or bundle verified runtime binaries outside the Electron app bundle under `ai_runtime/`. Started for the demo llama.cpp fixture plus approved direct-binary or explicit archive-member URL runtime manifests.
- Verify runtime manifest platform/architecture compatibility before install. Done for managed runtime registry/install APIs; wrong-host manifests remain visible in Settings but are not installable, and `/ai/runtimes/registry` exposes the target/host compatibility fields Settings uses for the runtime cards and setup wizard.
- Verify runtime binary checksums before use. Done for managed demo runtime installs, approved direct URL runtime installs, approved archive-backed URL runtime installs, and app-data runtime health; URL installs also enforce pinned source artifact file size before copy or extraction.
- Verify runtime binaries can execute a bounded version/smoke command before use. Done for managed runtime install/verify; checksum-valid binaries with no smoke output are marked failed and blocked from runtime health.
- Expose runtime version, checksum, path, state, logs, and repair actions through runtime APIs. Started with registry/install/verify/delete plus checksum/smoke-aware `/ai/runtime/health`; install/verify/failure logs are now persisted with probed version evidence and surfaced through `/ai/runtimes/registry`, while runtime process log rotation remains pending.
- Add safe runtime unload/load and log rotation.
- Add server lifecycle for llama.cpp server mode where useful for interactive generation and embeddings. Started with loopback process manager, generation/embedding modes, logs, health, UI controls, unload/delete shutdown protection, server-backed text generation, and server-backed vector indexing/search/reindex.
- Keep CLI mode available for strict grammar-constrained extraction.

Frontend tasks:

- Add runtime install/repair controls beside model-pack install. Started in Settings -> AI Models.
- Surface clear states: missing runtime, installed, incompatible platform, checksum mismatch, failed smoke test, ready. Started with registry install states, target/host compatibility badges, integrity badges, blocker lists, structured readiness checklists, repair actions, runtime health, and install-log version/smoke evidence.
- Keep advanced binary-path overrides available for power users.

Acceptance:

- Fresh app data can install a demo runtime from Settings. Tiny production pack install waits on approved production model metadata.
- Runtime platform/architecture mismatch, checksum mismatch, or executable smoke failure blocks inference and offers repair. Done for managed demo and approved URL runtime install paths; production runtimes wait on approved binaries.
- Runtime failures do not crash the app.
- The user can see where local binaries and models are stored.

### Milestone 4H: First-Run AI Setup and Repair

Goal: turn the local AI subsystem into a self-serve first-run flow.

Current status: wizard foundation implemented. Settings exposes the necessary AI Models foundations, and `/ai/setup/status` now aggregates local-only privacy, hardware profile, runtime health, recommended production pack, demo fallback, capability-route coverage, next action, and blocked reasons into one setup contract. Settings -> AI Models renders both a compact first-run guide and a full Local AI Setup Wizard. The wizard opens on the first actionable blocker, walks through privacy, hardware, managed runtimes, the recommended production pack, the demo fallback, and route activation, and can trigger `/ai/setup/run`, demo runtime install, and eligible pack downloads. The setup runner installs checksum-verified demo runtimes, downloads and verifies release-ready pack assets, runs readiness checks, activates only safe local routes, and reports skipped activation steps such as fixture-only LLMs or missing production runtimes. Recommended production setup now returns an actionable blocked setup report when a production pack is not approved yet, and runtime installation is release-channel constrained so production packs cannot accidentally use demo managed runtimes. When production pack and runtime manifests are approved, the runner can install the production runtime, download and verify the model, smoke-test llama.cpp, app-managed embedding, whisper.cpp, and Piper candidates locally, mark them runtime-tested, and activate capability routes with managed binary and model paths where applicable. Production bundled runtimes and model packs remain blocked until real binaries/model files, licenses, sizes, and checksums are approved; their structured readiness checks now define the pending production setup-run work item by item.

Tasks:

- Add first-run choice: Local only by default, optional cloud later. Started with the setup contract's local-only mode and privacy step.
- Run hardware scan and recommend Tiny, Standard, or Strong. Done in `/ai/setup/status`.
- Show disk size, license, privacy label, and capability coverage for each pack. Started in AI Models pack cards and setup guide.
- Download, verify, smoke test, and select routes in one guided flow. Started with the setup wizard and `/ai/setup/run` for the demo fixture path plus approved URL-backed LLM, app-managed embedding, whisper.cpp, and Piper production packs; bundled production packs remain blocked until approved artifacts exist.
- Add repair actions when runtime, model, checksum, or route health fails. Started with demo runtime install/repair, pack download, route blocker steps, structured readiness diagnostics, blocked production setup reports, and setup-run skip/failure reporting; production repair actions remain pending.
- Add a "skip for now" path that leaves mock/local deterministic behavior intact.

Acceptance:

- A first-time user can make the app useful with small local AI in one guided path. Started with the wizard and demo setup runner; production-ready user value waits on approved real model packs and runtimes.
- The app remains useful when the user skips model setup.
- The privacy boundary is visible before any data can leave the machine.

## Voice Milestones

These are inserted around Learning Mode, before packaging.

### Milestone 10A: Local Voice Dictation

Goal: voice memo and note dictation work locally.

Current status: durable voice transcription foundation started. `/voice/transcribe` still uses the mock local STT provider by default, but it can now switch to a configured whisper.cpp CLI/model path through the local-only `transcribe_audio` route. Registry-backed STT model installation is wired with a tiny fixture model, and Settings -> Voice can pick an installed whisper.cpp model to populate the route's local model path. For approved URL-backed production packs, `/ai/setup/run` can install the managed whisper.cpp runtime, download and verify the STT model, run a local transcription smoke test, mark the model runtime-tested, and activate the route with verified binary/model paths. Selected audio files can be persisted as `audio_assets` rows, converted into timestamped `transcript_segments`, turned into `audio` sources with transcript source blocks, indexed for FTS/vector search, exposed as recent audio assets in Settings -> Voice, and inserted into the active note editor through the Dictate action. The note editor also has a microphone Record/Stop flow: the renderer records through `MediaRecorder`, Electron saves the recording to a local temp file through a constrained IPC bridge, `/voice/transcribe` stores it as an audio source, and the transcript is inserted into the active note. Transcript content is explicitly treated as source data, not instructions. Release-approved bundled whisper.cpp model/runtime manifests and push-to-talk shortcuts remain pending.

Backend tasks:

- Add `audio_assets` and `transcript_segments` tables. Done.
- Add STT provider interface. Done through capability routing plus mock and whisper.cpp provider adapters.
- Add whisper.cpp provider. Done for configured local CLI/model paths and registry-backed fixture model selection; approved production model packs and managed binary installation remain pending.
- Store transcripts as sources with timestamped blocks. Done for `/voice/transcribe` with `create_source=true`.
- Treat transcripts as untrusted source text for prompt-injection rules. Done in stored source metadata.

Frontend tasks:

- Add microphone permission flow. Started through the browser/Electron permission prompt on the note editor Record action; a dedicated preflight/permissions panel remains pending.
- Add push-to-talk record component. Started as note editor Record/Stop microphone capture; hold-to-talk shortcuts remain pending.
- Add note editor dictate button. Done for selected local audio files and microphone recording.
- Add source audio import and transcribe action. Done in Settings -> Voice and as note-editor dictation from selected local audio.

Acceptance:

- User can record a voice memo. Done in the note editor Record/Stop path.
- Transcription happens locally. Done for mock local STT, configured whisper.cpp CLI/model routing, and installed STT model path selection.
- Transcript becomes a source with timestamped blocks. Done for selected audio files.
- User can insert transcript into a note. Done for selected local audio files and microphone recordings.

### Milestone 10B: Local Text-to-Speech

Goal: The Vault can speak notes and lessons locally.

Current status: local TTS foundation started. `/voice/synthesize` now routes through the selected `synthesize_speech` capability, enforces local-only provider gates before cache lookup, supports a configured Piper CLI/voice model path, writes generated output under `blobs/speech`, caches repeated synthesis in durable `speech_assets` rows keyed by text, provider/model, voice, speed, language, format, and route settings, and exposes recent speech assets in Settings -> Voice. `/voice/speech-assets/{id}/audio` returns data URLs only for speech files confined to Vault speech storage. For approved URL-backed production packs, `/ai/setup/run` can install the managed Piper runtime, download and verify the voice model, run a local synthesis smoke test, mark the model runtime-tested, and activate the route with verified binary/model paths. The note editor has a Speak action that synthesizes the active note into a cached local speech asset and shows playback controls. Settings can play recent speech assets. Release-approved bundled Piper/Kokoro model/runtime manifests and Learning Mode spoken prompts remain pending.

Backend tasks:

- Add `speech_assets` table. Done.
- Add TTS provider interface. Done.
- Add Piper provider. Started for configured local CLI/model paths.
- Add optional Kokoro provider.
- Add local voice downloader.
- Cache TTS by hash of text, voice, speed, language, format, provider/model, and route settings. Done.

Frontend tasks:

- Add read-aloud controls in Notes and Learning. Started in Notes with the Speak action and playback controls.
- Add local voice selection. Started through Settings -> Voice route controls.
- Add audio prompt controls for flashcards.

Acceptance:

- User can select a local voice. Started through `synthesize_speech` route settings.
- App can read a note aloud locally. Started: note Speak generates and plays a local cached speech asset.
- Generated audio is cached. Done.
- No cloud request is made. Done for local-only requests and cached results.

### Milestone 10C: Optional ElevenLabs Provider

Goal: cloud voice is available only as an explicit premium adapter.

Backend tasks:

- Add ElevenLabs provider config.
- Add API key storage path.
- Add `sent_off_device` audit flag.
- Disable provider by default.

Frontend tasks:

- Add cloud warning UI.
- Add per-action consent language.
- Visibly mark every cloud voice action.

Acceptance:

- Provider is disabled by default.
- User can enable it with an API key.
- Every cloud voice action is visibly marked.
- Audit log records off-device processing.

## Model Profiles

Tiny:

- CPU-friendly and low RAM.
- Good for smoke tests, basic extraction, simple summaries, flashcards, and small embeddings.
- Must be the CI-friendly assumption, but CI still uses mocks.

Standard:

- Best alpha default for modern laptops.
- Good for extraction, claims, grounded answers, generated notes, and learning.

Strong:

- Optional power-user install.
- Good for longer synthesis, claim clusters, contradiction detection, and richer learning generation.

## Privacy Rules

- Local-only is default.
- Inference must stay local unless the user explicitly enables a cloud provider.
- Model downloads may use the internet.
- No silent cloud fallback.
- Download only registry allowlisted model files.
- Verify checksums before marking a model installed.
- Do not execute model repository code.
- Do not store full prompts by default.
- Generated model output remains untrusted.
- No always-listening microphone.
- No voice cloning in alpha.

## Testing Additions

Automated tests:

- provider interface tests with mock providers,
- model registry schema validation,
- model/runtime registry structural validation CLI,
- checksum verification,
- download pause/resume/cancel against local fixture server,
- capability routing,
- cloud fallback prevention,
- grammar validation,
- invalid source quote rejection,
- generated note draft creation,
- no canonical mutation without review,
- audio asset creation,
- mock transcription persistence,
- mock TTS cache key,
- cloud voice disabled by default,
- `sent_off_device` audit flag.
- Markdown readiness checklist export for production local-model approval. Done for CLI, `/ai/readiness/report/export`, Settings Export readiness, and the fill-in approval template export.

Manual scripts:

```bash
./scripts/test_local_ai.sh
./scripts/test_voice_local.sh
```

Current status: implemented as in-process Vault Core smoke checks. They default to temporary data directories, accept `--data-dir` for configured workspaces, and are covered by CLI tests.

CI must not require large model downloads.
