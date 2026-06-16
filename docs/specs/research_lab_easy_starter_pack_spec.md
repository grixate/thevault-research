# Research Lab Easy Starter Pack Spec

**Document version:** 0.1  
**Date:** 2026-06-16  
**Status:** proposed  
**Purpose:** Make The Vault Research Lab useful with local AI immediately after installation, without requiring users to understand model formats, quantization, runtimes, routes, or registry approval machinery.

## 1. Product Thesis

The Research Lab should be powerful, but the first experience should be simple.

The current local AI architecture is intentionally capable: model packs, runtimes, routing, registry evidence, readiness gates, local embeddings, reranking, voice, and optional external providers. That should remain available for advanced users and release operators.

The default product experience, however, should be:

```text
Install app -> choose recommended starter pack -> download -> app is ready to work locally.
```

The user should not need to know what GGUF means, which binary runs inference, whether a capability should use CLI or server mode, what embedding dimensions are, or which route powers extraction. The product should feel ready for research work, not ready for configuration work.

## 2. User Promise

The Easy Starter Pack must make these workflows work locally after one guided install:

- import or write notes,
- index content for local search,
- extract reviewable claims and objects,
- generate a grounded draft note from selected evidence,
- ask a scoped grounded question,
- optionally transcribe a short audio file if the starter voice pack is included,
- show clear local-only provenance for every AI action.

The app may still include advanced model choices, but variety is optional. A working local default is mandatory.

## 3. Non-Goals

The Easy Starter Pack is not:

- a marketplace,
- a benchmarking dashboard,
- a model hobbyist setup flow,
- an invitation to configure every capability,
- a silent cloud fallback,
- an auto-download of unclear licenses,
- a replacement for production registry approval.

Advanced users can still inspect and customize providers, runtimes, and routes. New users should not be forced to.

## 4. Starter Pack Definition

Add one first-class starter pack above the existing Tiny, Standard, and Strong choices.

Suggested ID:

```text
starter-local-pack
```

Suggested display name:

```text
Recommended Starter Pack
```

User-facing copy:

```text
Best first install. Runs locally and enables search, extraction, note drafting, and grounded answers.
```

The Starter Pack is not another expert profile. It is the default path through the system.

It should map to one approved, coherent set of models and runtimes:

- one local instruction LLM for extraction, summarization, note drafting, and grounded answers,
- one local embedding model for search,
- optionally one small local reranker if it materially improves search without making setup fragile,
- optionally one small local speech-to-text model,
- optionally one local TTS voice.

Candidate model families can include Gemma-family or Qwen-family instruction models, plus an embedding model selected for reliable local retrieval. Exact model IDs, files, quantization, checksums, licenses, and runtime defaults must remain registry-approved release data, not hard-coded product assumptions.

## 5. Default Behavior

On first launch, Settings and the setup wizard should prioritize one action:

```text
Install Recommended Starter Pack
```

The flow should:

1. Detect hardware.
2. Pick the recommended starter variant automatically.
3. Show expected disk size and privacy label.
4. Ask for any required license acknowledgement.
5. Download approved runtime binaries if missing.
6. Download approved model files.
7. Verify checksums and sizes.
8. Run smoke tests.
9. Activate capability routes.
10. Reindex or schedule embeddings for existing content.
11. End with a clear ready state.

The completion state should say:

```text
Local AI is ready.
```

It should list enabled workflows in plain product language:

- Search understands meaning.
- Claims and objects can be extracted for review.
- Notes can be drafted from local evidence.
- Scoped answers stay on this device.

## 6. Starter Variants

The product may use hardware-aware internal variants, but the user should still see one starter pack.

### Starter Tiny

For low-memory machines.

Expected:

- small instruction model,
- small embedding model,
- no reranker by default,
- voice optional or skipped,
- conservative extraction settings,
- shorter generated drafts.

### Starter Standard

Default for modern laptops.

Expected:

- small-to-medium instruction model,
- reliable embedding model,
- optional reranker if approved,
- optional local STT,
- grounded answering enabled.

### Starter Strong

For high-memory workstations.

Expected:

- stronger local instruction model,
- same default embedding space unless a better approved embedding model is selected,
- longer synthesis limits,
- still compatible with the same simple install flow.

The UI should not ask the user to choose between these unless automatic detection is uncertain.

## 7. Capability Route Defaults

After starter installation, capability routing should be activated automatically.

Required starter routes:

| Capability | Default route |
| --- | --- |
| `extract_objects` | llama.cpp CLI with grammar support |
| `extract_claims` | llama.cpp CLI with grammar support |
| `summarize` | local LLM |
| `generate_note` | local LLM |
| `grounded_answer` | local LLM |
| `embed_text` | approved local embedding model |

Optional starter routes:

| Capability | Default route |
| --- | --- |
| `rerank_results` | approved local reranker or disabled |
| `transcribe_audio` | approved whisper.cpp-compatible local STT model |
| `synthesize_speech` | approved Piper-compatible local voice |
| `create_learning_item` | local LLM when Standard or Strong starter is installed |

If a capability cannot be safely activated, the setup flow should show it as skipped with a simple reason and keep the rest of the pack ready.

## 8. Runtime Strategy

The Starter Pack should hide runtime complexity.

The app should install or locate:

- `llama.cpp` CLI for grammar-constrained extraction,
- `llama.cpp` server only when needed for interactive generation or embeddings,
- whisper.cpp only if starter STT is included,
- Piper only if starter TTS is included.

The user should not have to choose CLI vs server. The app should decide per capability.

Runtime health details remain available in Advanced settings.

## 9. Registry Requirements

The Starter Pack must use the existing registry and readiness machinery.

Every starter artifact must have:

- stable model ID,
- approved source URL or Hugging Face source,
- pinned revision where applicable,
- exact filename,
- exact byte size,
- exact SHA-256,
- license label,
- license URL or bundled license artifact,
- approval status,
- approved runtime defaults,
- smoke-test prompt or embedding test input,
- language notes,
- hardware profile suitability.

The setup wizard may present one simple install button, but the backend must still enforce the same strict gates as other production packs.

## 10. UX Requirements

The first-run AI area should be reorganized around three levels:

### Primary

One recommended card:

```text
Recommended Starter Pack
Runs locally. Enables search, extraction, note drafting, and grounded answers.
[Install]
```

### Secondary

Small links or cards:

- Tiny
- Standard
- Strong
- Voice add-on

These are alternatives or extensions, not the default path.

### Advanced

Existing registry, runtime, route, release, evidence, and raw JSON controls.

Advanced controls should remain discoverable but should not dominate first-run setup.

## 11. Ready-State Requirements

The app is starter-ready only when:

- required runtime binaries are installed or located,
- required model files are installed,
- checksums and sizes match,
- model/runtime smoke tests pass,
- required routes point to local non-mock providers,
- fixture models are not used for production routes,
- embeddings can be generated,
- a small local end-to-end smoke test passes.

The end-to-end smoke test should exercise:

1. Embed a short local text.
2. Extract one reviewable object or claim from a short source block.
3. Generate a short grounded answer from supplied evidence.
4. Record AI run metadata without storing private prompt text.

## 12. Failure Handling

Failure should be recoverable and product-shaped.

Examples:

- Runtime missing: offer Install Runtime.
- Model checksum mismatch: offer Retry Download.
- Model too large for machine: offer Starter Tiny.
- Extraction smoke failed: keep search enabled and mark extraction as needs repair.
- Voice model skipped: keep text workflows ready.

The app should avoid the all-or-nothing feeling. Partial local readiness is useful as long as it is honest.

## 13. Privacy Requirements

The Starter Pack must be local-only by default.

Rules:

- No cloud provider can be activated by the starter setup.
- No cloud fallback can run when starter models fail.
- Every generated note, extraction run, and grounded answer should record `sent_off_device=false`.
- UI copy should say "Runs on this device" rather than naming internal providers.
- External-local providers such as Ollama, LM Studio, or custom OpenAI-compatible local endpoints are optional advanced routes, not starter defaults.

## 14. Implementation Plan

### Phase 1: Spec and Registry Shape

- Add `starter-local-pack` to model registry as blocked production target.
- Add starter readiness checks.
- Add starter variant metadata for Tiny, Standard, and Strong internal selection.
- Add route activation expectations to setup-run output.

### Phase 2: First-Run UX

- Promote Recommended Starter Pack above production profile cards.
- Move registry release tooling behind an Advanced section.
- Add one-click setup run for starter installation.
- Show plain-language ready state.

### Phase 3: Approved Starter Candidate

- Select candidate LLM, embedding, and runtime artifacts.
- Hydrate metadata.
- Probe sources.
- Verify bytes.
- Apply approval evidence.
- Pin registry.
- Run strict readiness without demo allowance.

### Phase 4: End-to-End Starter Smoke

- Add CLI smoke script:

```text
./scripts/test_starter_pack.sh
```

- Add API endpoint:

```text
POST /ai/setup/starter-smoke
```

- Add Settings action:

```text
Test Starter Pack
```

## 15. Acceptance Criteria

The Easy Starter Pack is accepted when:

- a fresh install presents one recommended local AI install path,
- the user can complete setup without editing model paths,
- the app can search semantically after setup,
- extraction produces reviewable local proposals,
- generated notes include local model provenance,
- grounded answers cite supplied evidence or fall back to deterministic evidence rendering,
- no cloud provider is selected or called,
- failed optional voice/reranker setup does not block core text workflows,
- strict production readiness passes for the starter pack,
- demo fixtures remain clearly separate from the starter pack.

## 16. Open Questions

- Should voice be part of the initial Starter Pack or offered as a second "Voice add-on" after text workflows are ready?
- Should the first approved starter LLM optimize for English only first, or require English and Russian from day one?
- Should the starter embedding model be shared across Tiny, Standard, and Strong to avoid reindexing when upgrading the LLM?
- Should the setup wizard auto-start model downloads after license acknowledgement, or require one final confirmation with disk size?

## 17. Product Principle

Advanced model variety is a feature.

A ready-to-work local starter pack is the product.
