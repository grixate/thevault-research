# AI Models and Voice Settings Design

Status: implemented in React as the Milestone 4A surface, with the first Milestone 4F model-pack readiness split, structured production readiness checklists and audit report, first Milestone 4G managed-runtime controls, and the first Milestone 4H setup-guide plus full setup-wizard foundation added. Pencil/Product Design plugin export is pending because the local plugin connection was unavailable during this pass.

Update: a Pencil connection became available later, but the active document was an unrelated design file and the plugin appeared to ignore the requested repo-local file path. To avoid modifying unrelated product work, the repo Markdown handoff remains the source of truth until a dedicated Vault canvas can be opened reliably.

## Product Intent

Settings must make local AI understandable without exposing driver-panel complexity.

The user should see:

- whether AI runs on this device,
- whether anything may send data to cloud,
- which capability uses which provider/model,
- whether a model is installed,
- what hardware profile the app recommends,
- recent AI run metadata without private prompt contents.

## Screen Structure

`Settings` uses a tabbed control-room layout:

- AI Models
- Routing
- Voice
- Privacy
- Raw

Workflow surfaces now expose the same local AI state:

- Global command search defaults to Hybrid and can switch back to FTS.
- Notes editor shows `extract_claims`, `extract_objects`, and `generate_note` capability chips.
- Notes editor has Dictate and Record/Stop actions that transcribe selected local audio or microphone recordings into audio sources and insert transcripts into the active note.
- Source detail shows active claim and object extraction capabilities before running extraction.
- Generated notes show provider/model/run provenance and off-device status.
- Review has a Quarantined lane for invalid local extraction output.

### AI Models

Purpose: first-run model setup and ongoing model inventory.

Key components:

- Local-only status badge.
- First-run local AI setup guide backed by `/ai/setup/status`, with privacy, hardware, runtime, production pack, demo fallback, and capability-route steps.
- Full Local AI Setup Wizard backed by `/ai/setup/status`, with a step rail, first-actionable blocker focus, privacy/hardware/runtime/production/demo/route panels, demo runtime install, pack download actions, and setup-run status.
- Production readiness audit backed by `/ai/readiness/report`, with blocked-check count, production pack readiness count, production runtime manifest readiness count, demo fallback availability, next release gates, grouped blocker sections, a release work queue sorted by blocker count, Export readiness backed by `/ai/readiness/report/export` for the strict-production Markdown approval dossier, Export template backed by `/ai/readiness/approval-template/export` for the fill-in bundled manifest evidence checklist, and Export evidence JSON for the directly fillable overlay consumed by the evidence-apply workflow.
- Registry structure band backed by `/ai/registry/validation`, showing manifest pass/fail status, model/pack/runtime counts, structural errors, unsafe artifact path or URL errors, and placeholder warnings before release-readiness blockers are considered.
- Guided setup run report backed by `/ai/setup/run`, with a Prepare demo lab action, approved URL-backed LLM/app-managed embedding/whisper.cpp/Piper install/download/smoke-test/activation step statuses, activated-route count, and explicit skipped-route reasons.
- Managed runtime section backed by `/ai/runtimes/registry`, with install, repair, verify, delete, release-channel badges, install-state badges, target/host compatibility badges, integrity badges, checksum-backed fixture and approved URL installs, managed-binary integrity for llama.cpp, whisper.cpp, and Piper health, and blocker reasons for production placeholders.
- Production runtime readiness checklists that distinguish missing approved source, checksum, file size, license artifact, and release approval evidence before install buttons become enabled.
- A Registry release plan panel in Settings -> AI Models that separates manifest pin readiness from runtime/setup readiness: it shows ready-to-pin status, validation warning count, pack/model/runtime ratios, top blocked artifacts, next actions from `/ai/registry/release-plan`, and an Export Markdown action backed by `/ai/registry/release-plan/export`. The same panel can select candidate model/runtime JSON files, dry-run them through `/ai/registry/release-plan/evaluate`, render candidate pin-readiness and pin-impact preview beside the bundled registry state, export `candidate-ai-registry-release-plan.md` with source filenames, manifest SHA-256 digests, and added/changed/removed registry IDs for release review, probe candidate artifact sources plus remote size/checksum metadata and license URLs or bundled license paths through `/ai/registry/artifact-probe/evaluate`, export `candidate-ai-registry-artifact-probe.md`, verify full candidate artifact bytes through `/ai/registry/artifact-verify/evaluate`, export `candidate-ai-registry-artifact-byte-verification.md` plus `candidate-ai-byte-evidence.json`, export `candidate-local-ai-approval-template.md` plus `candidate-local-ai-evidence-template.json` through `/ai/readiness/approval-template/evaluate`, apply filled reviewer evidence JSON through `/ai/registry/evidence/apply` to produce `candidate-ai-registry-evidence-bundle.json`, show the exact patched model/runtime file SHA-256s, render the source-probe/byte-verification/release-packet-with-probe-and-bytes/acceptance-report/dry-run/pin/readiness handoff commands inline, save applied release-plan/checklist/pin-handoff Markdown, and then save the patched model/runtime registry JSON files as standalone inputs for the guarded final `pin_ai_registries.sh --model-registry ... --runtime-registry ...` command. Candidate manifests can also be prepared outside the UI with `hydrate_ai_registry_metadata.sh`, which resolves Hugging Face revision, size, LFS SHA-256, and license label metadata before the same panel evaluates/probes/verifies/applies approval evidence.
- A compact Promotion pipeline inside the Registry release plan panel that maps the production road into eight operator-visible stages: manifest evidence, metadata hydration, source probe, byte verification, evidence overlay, pin handoff, final pin, and readiness gate. The stage map is derived from the existing release-plan, metadata-hydration, artifact-probe, artifact-byte-verification, evidence-overlay, pin-handoff, and strict-readiness contracts, so it turns the "1 of 12" release-work feeling into a concrete promotion sequence without inventing a separate state machine.
- Hardware recommendation card.
- Demo fixture pack card kept separate from Tiny, Standard, and Strong production local model-pack cards. Done.
- Tiny, Standard, and Strong production pack cards with recommended profile highlighting, distinct small-model targets per profile, API-backed release-blocked reasons, and readiness checklists when checksums, license labels, license artifacts, runtime, file size, filename, pinned revision, or approved source metadata are missing. Started.
- Production suitability checks in the same readiness checklist: model kind/runtime/capability fit, pinned runtime defaults for setup/smoke tests, pack capability coverage, and profile fit.
- Production pack route coverage strip showing local/demo/missing/off-device status for each pack capability, plus a Preflight / Install & test action backed by `/ai/setup/run`.
- llama.cpp runtime health card with CLI/server status.
- Model cards grouped by registry entries plus installed manual imports.
- Download pack action that queues every release-ready missing model in the selected pack.
- Download action for registry-backed fixture, URL, and approved Hugging Face-pinned models.
- Download queue rows with byte progress, progress bar, Pause, Resume, and Cancel controls.
- Import GGUF action for already-downloaded local model files.
- Imported/tested trust badges.
- Test, verify, use, unload, and delete actions for installed models.
- Runtime health panel with warnings and smoke-check result.
- Setup run report that shows non-activations, such as fixture-only LLMs or missing whisper/Piper runtimes, as visible skipped steps rather than silent success; successful approved-artifact activations include smoke-test evidence in the step detail for LLM, embedding, STT, and TTS routes.
- Release work queue items use existing shadcn-style badges and icon buttons to move users toward the relevant repair surface: setup wizard for model/runtime/privacy approvals and Routing for capability blockers. The queue is now inspectable, with a selected-task evidence panel that resolves grouped approval work back to the exact readiness checks and sections that are blocking release.
- Readiness details wrap safely inside cards on desktop and mobile so long model names, repository IDs, and checksum actions do not overflow.

Primary copy:

- Runs on this device
- No model installed
- Prepare demo lab
- Download
- Download pack
- Test

### Routing

Purpose: capability-based model routing.

Each capability row shows:

- capability name,
- selected model ID,
- provider privacy label,
- provider selector.

Embedding controls:

- Active `embed_text` capability chip.
- First-class embedding route panel with provider, model ID, dimensions, local endpoint, timeout, Save route, and Test saved route controls.
- App-Managed Local Embeddings provider for approved installed embedding model artifacts, distinct from Mock Local Embeddings and Local HTTP Embeddings; backend tests now enforce that the saved route uses an installed `model_path` and artifact-specific fingerprinted vector space.
- Loopback-only endpoint status for the Local HTTP Embeddings provider.
- Reindex action for rebuilding source-block embeddings in the current provider/model/dimension space.
- Reindex progress strip with job status, source count, block count, progress bar, embedding `space_id`, and Cancel action while queued/running.

Safety behavior:

- Cloud providers cannot be selected while `local_only` is true.
- The Local HTTP Embeddings route is only accepted for localhost, `127.0.0.1`, or `::1`; backend validation remains authoritative.
- Provider changes write an event log entry.
- Reindexing runs as a lab job and preserves older embedding spaces for existing blocks until the new space is written.
- Queued reindex jobs resume on core startup; interrupted running reindex jobs are requeued and completed after restart.
- Production readiness route checks block cloud providers, mock providers, missing model inventory, fixture/manual-import assets, provider/model kind mismatches, and untested runtime-backed models.

### Voice

Purpose: show STT/TTS as local input/output layers, not agents.

Components:

- Speech-to-text route panel with provider, managed STT model picker, model ID, language, timeout, whisper.cpp binary path, whisper.cpp model path, runtime state, privacy badge, Download STT model, and Save STT route action.
- Speech-to-text panel with mock transcribe action.
- Transcribe file action that turns a selected audio file into a local transcript source.
- Recent audio sources list backed by durable `audio_assets` rows.
- Text-to-speech panel with mock speak action.
- Text-to-speech route panel with provider, model ID, voice ID, timeout, Piper binary path, Piper voice model path, optional config path, runtime state, privacy badge, and Save TTS route action.
- Speak sample action that creates or reuses a cached `speech_assets` row.
- Recent speech assets list backed by durable `speech_assets` rows with playback controls.
- Voice list with installation and privacy labels.

Not included:

- always-listening mode,
- voice cloning,
- cloud voice by default.
- release-approved bundled production runtime/model manifests for the built-in Tiny, Standard, and Strong packs.
- release-approved production LLM/embedding model packs. The generic approved URL-backed setup path can already install, test, activate, and index with app-managed embedding artifacts once manifests are approved.
- release-approved bundled whisper.cpp model/runtime manifests. The generic approved URL-backed setup path can already install, test, and activate them once manifests are approved.
- release-approved bundled Piper/Kokoro voice/runtime manifests. The generic approved URL-backed setup path can already install, test, and activate Piper once manifests are approved.
- push-to-talk keyboard shortcuts and always-listening capture.

### Privacy

Purpose: make trust boundaries obvious.

Shows:

- cloud fallback blocked,
- prompt privacy explanation,
- recent AI runs,
- `sent_off_device` status.

## Visual Direction

Use restrained shadcn-style primitives:

- segmented tabs,
- cards,
- badges,
- icon-led action buttons,
- compact table-like routing rows.
- segmented search mode control.

The Settings surface should feel operational and calm, not like a marketing page.

## Implementation References

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/styles/global.css`
- `services/core/vault_core/ai/routing.py`
- `services/core/vault_core/ai/embeddings/index.py`
- `services/core/vault_core/ai/models/health.py`
- `services/core/vault_core/ai/models/model_registry.json`
