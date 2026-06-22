# AI Registry Release Plan

- Status: **ready_to_pin**
- Ready to pin: **yes**
- Structural validation: **pass**

## Sources

- Model registry: `/tmp/vault-model-source-pins-release-packet/vault-candidate-model-registry.hydrated.patched.json`
- Runtime registry: `/tmp/vault-model-source-pins-release-packet/vault-candidate-runtime-registry.model-source-pins.patched.json`

## Pin Preview

| Registry | Candidate SHA-256 | Added | Changed | Removed |
| --- | --- | ---: | ---: | ---: |
| `model_registry` | `5419d56e760155d9559e0479b453cfad90e304be4395fa610fd0df4dbee20e08` | 0 | 10 | 0 |
| `runtime_registry` | `a050ca271ca3acee8fa2df7875ab91327571f462bdc766e1889dffd96f92d2a6` | 0 | 3 | 0 |

### Model Changes

- Changed: `balanced-embedding-placeholder`, `balanced-reranker-placeholder`, `standard-gguf-placeholder`, `standard-whisper-placeholder`, `strong-gguf-placeholder`, `tiny-embedding-placeholder`, `tiny-gguf-placeholder`, `tiny-piper-placeholder`, `tiny-reranker-placeholder`, `tiny-whisper-placeholder`

### Runtime Changes

- Changed: `llama-cpp-managed-runtime`, `piper-managed-runtime`, `whisper-cpp-managed-runtime`

## Summary

| Metric | Value |
| --- | ---: |
| Total checks | 146 |
| Blocked checks | 0 |
| Check warnings | 0 |
| Total warnings | 0 |
| Validation errors | 0 |
| Validation warnings | 0 |
| Production packs ready | 4/4 |
| Production models ready | 10/10 |
| Production runtimes ready | 3/3 |

## Promotion Pipeline

| Stage | Status | Detail | Action |
| --- | --- | --- | --- |
| Manifest evidence | `done` | Candidate manifests are pin-ready. | Evaluate candidate manifests and clear registry validation. |
| Metadata hydration | `done` | Pinned source revisions, file metadata, and license labels are present. | Hydrate upstream metadata before reviewer evidence. |
| Source probe | `pending` | Candidate artifact sources and license references have not been probed. | Probe source, size, checksum, and license evidence. |
| Byte verification | `pending` | Candidate artifact bytes have not been hashed into evidence. | Verify artifact bytes before reviewer evidence. |
| Evidence overlay | `pending` | Reviewer evidence has not been applied to candidate registries. | Apply reviewer evidence JSON. |
| Pin handoff | `active` | Candidate registries are ready for guarded pin handoff generation. | Export patched registries and handoff. |
| Final pin | `active` | Candidate registries can be passed to the guarded pin command. | Run guarded registry pin command. |
| Readiness gate | `pending` | Strict local-AI readiness has not passed with the pinned registries. | Run strict local-AI readiness gate. |

## Artifacts

### Recommended Starter Pack

- Type: `model_pack`
- ID: `starter-local-pack`
- Status: **ready**
- Blockers: **0**

- [x] `starter-local-pack:capability-coverage` **Capability coverage** - Required models cover every advertised pack capability.
- [x] `starter-local-pack:profile-fit` **Profile fit** - Required models fit the standard profile target.
- [x] `starter-local-pack:required-models` **Required models** - Every required model is release-ready.
- [x] `starter-local-pack:managed-runtimes` **Managed runtimes** - Managed runtimes are release-ready: llama_cpp, piper, whisper_cpp.

### Tiny Production Local Pack

- Type: `model_pack`
- ID: `tiny-production-pack`
- Status: **ready**
- Blockers: **0**

- [x] `tiny-production-pack:capability-coverage` **Capability coverage** - Required models cover every advertised pack capability.
- [x] `tiny-production-pack:profile-fit` **Profile fit** - Required models fit the tiny profile target.
- [x] `tiny-production-pack:required-models` **Required models** - Every required model is release-ready.
- [x] `tiny-production-pack:managed-runtimes` **Managed runtimes** - Managed runtimes are release-ready: llama_cpp, piper, whisper_cpp.

### Standard Local Pack

- Type: `model_pack`
- ID: `standard-local-pack`
- Status: **ready**
- Blockers: **0**

- [x] `standard-local-pack:capability-coverage` **Capability coverage** - Required models cover every advertised pack capability.
- [x] `standard-local-pack:profile-fit` **Profile fit** - Required models fit the standard profile target.
- [x] `standard-local-pack:required-models` **Required models** - Every required model is release-ready.
- [x] `standard-local-pack:managed-runtimes` **Managed runtimes** - Managed runtimes are release-ready: llama_cpp, piper, whisper_cpp.

### Strong Local Pack

- Type: `model_pack`
- ID: `strong-local-pack`
- Status: **ready**
- Blockers: **0**

- [x] `strong-local-pack:capability-coverage` **Capability coverage** - Required models cover every advertised pack capability.
- [x] `strong-local-pack:profile-fit` **Profile fit** - Required models fit the strong profile target.
- [x] `strong-local-pack:required-models` **Required models** - Every required model is release-ready.
- [x] `strong-local-pack:managed-runtimes` **Managed runtimes** - Managed runtimes are release-ready: llama_cpp, piper, whisper_cpp.

### Standard GGUF Local Model

- Type: `model`
- ID: `standard-gguf-placeholder`
- Status: **ready**
- Blockers: **0**

- [x] `standard-gguf-placeholder:provider` **Provider** - Uses llama_cpp runtime.
- [x] `standard-gguf-placeholder:capability-fit` **Capability fit** - llm capabilities match the model kind.
- [x] `standard-gguf-placeholder:runtime-fit` **Runtime fit** - llama_cpp is valid for llm models.
- [x] `standard-gguf-placeholder:runtime-defaults` **Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `standard-gguf-placeholder:source` **Source** - Hugging Face source is pinned to 90862c4b9d2787eaed51d12237eafdfe7c5f6077.
- [x] `standard-gguf-placeholder:filename` **Filename** - Qwen3-1.7B-Q8_0.gguf is pinned.
- [x] `standard-gguf-placeholder:checksum` **Checksum** - SHA-256 checksum is pinned.
- [x] `standard-gguf-placeholder:size` **File size** - 1834426016 bytes recorded.
- [x] `standard-gguf-placeholder:license` **License** - Apache-2.0 approved.
- [x] `standard-gguf-placeholder:license-artifact` **License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/blob/main/LICENSE.
- [x] `standard-gguf-placeholder:release-approval` **Release approval** - Release approved by Codex release evidence review on 2026-06-22.

### Balanced Production Embedding Model

- Type: `model`
- ID: `balanced-embedding-placeholder`
- Status: **ready**
- Blockers: **0**

- [x] `balanced-embedding-placeholder:provider` **Provider** - Uses local_embedding runtime.
- [x] `balanced-embedding-placeholder:capability-fit` **Capability fit** - embedding capabilities match the model kind.
- [x] `balanced-embedding-placeholder:runtime-fit` **Runtime fit** - local_embedding is valid for embedding models.
- [x] `balanced-embedding-placeholder:runtime-defaults` **Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `balanced-embedding-placeholder:source` **Source** - Hugging Face source is pinned to 97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3.
- [x] `balanced-embedding-placeholder:filename` **Filename** - model.safetensors is pinned.
- [x] `balanced-embedding-placeholder:checksum` **Checksum** - SHA-256 checksum is pinned.
- [x] `balanced-embedding-placeholder:size` **File size** - 1191586416 bytes recorded.
- [x] `balanced-embedding-placeholder:license` **License** - Apache-2.0 approved.
- [x] `balanced-embedding-placeholder:license-artifact` **License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-Embedding-0.6B/blob/main/README.md.
- [x] `balanced-embedding-placeholder:release-approval` **Release approval** - Release approved by Codex release evidence review on 2026-06-22.

### Production whisper.cpp Small Model

- Type: `model`
- ID: `standard-whisper-placeholder`
- Status: **ready**
- Blockers: **0**

- [x] `standard-whisper-placeholder:provider` **Provider** - Uses whisper_cpp runtime.
- [x] `standard-whisper-placeholder:capability-fit` **Capability fit** - stt capabilities match the model kind.
- [x] `standard-whisper-placeholder:runtime-fit` **Runtime fit** - whisper_cpp is valid for stt models.
- [x] `standard-whisper-placeholder:runtime-defaults` **Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `standard-whisper-placeholder:source` **Source** - Hugging Face source is pinned to 5359861c739e955e79d9a303bcbc70fb988958b1.
- [x] `standard-whisper-placeholder:filename` **Filename** - ggml-base.en.bin is pinned.
- [x] `standard-whisper-placeholder:checksum` **Checksum** - SHA-256 checksum is pinned.
- [x] `standard-whisper-placeholder:size` **File size** - 147964211 bytes recorded.
- [x] `standard-whisper-placeholder:license` **License** - MIT approved.
- [x] `standard-whisper-placeholder:license-artifact` **License artifact** - License artifact is pinned: https://huggingface.co/ggerganov/whisper.cpp/blob/main/README.md.
- [x] `standard-whisper-placeholder:release-approval` **Release approval** - Release approved by Codex release evidence review on 2026-06-22.

### Tiny Production Piper Voice

- Type: `model`
- ID: `tiny-piper-placeholder`
- Status: **ready**
- Blockers: **0**

- [x] `tiny-piper-placeholder:provider` **Provider** - Uses piper runtime.
- [x] `tiny-piper-placeholder:capability-fit` **Capability fit** - tts capabilities match the model kind.
- [x] `tiny-piper-placeholder:runtime-fit` **Runtime fit** - piper is valid for tts models.
- [x] `tiny-piper-placeholder:runtime-defaults` **Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `tiny-piper-placeholder:source` **Source** - Hugging Face source is pinned to e21c7de8d4eab79b902f0d61e662b3f21664b8d2.
- [x] `tiny-piper-placeholder:filename` **Filename** - en/en_US/amy/low/en_US-amy-low.onnx is pinned.
- [x] `tiny-piper-placeholder:checksum` **Checksum** - SHA-256 checksum is pinned.
- [x] `tiny-piper-placeholder:size` **File size** - 63104526 bytes recorded.
- [x] `tiny-piper-placeholder:filename` **Filename** - en/en_US/amy/low/en_US-amy-low.onnx.json is pinned.
- [x] `tiny-piper-placeholder:size` **File size** - 4164 bytes recorded.
- [x] `tiny-piper-placeholder:license` **License** - MIT approved.
- [x] `tiny-piper-placeholder:license-artifact` **License artifact** - License artifact is pinned: https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/amy/low/MODEL_CARD.
- [x] `tiny-piper-placeholder:release-approval` **Release approval** - Release approved by Codex release evidence review on 2026-06-22.

### Balanced Production Reranker

- Type: `model`
- ID: `balanced-reranker-placeholder`
- Status: **ready**
- Blockers: **0**

- [x] `balanced-reranker-placeholder:provider` **Provider** - Uses local_cross_encoder runtime.
- [x] `balanced-reranker-placeholder:capability-fit` **Capability fit** - reranker capabilities match the model kind.
- [x] `balanced-reranker-placeholder:runtime-fit` **Runtime fit** - local_cross_encoder is valid for reranker models.
- [x] `balanced-reranker-placeholder:runtime-defaults` **Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `balanced-reranker-placeholder:source` **Source** - Hugging Face source is pinned to e61197ed45024b0ed8a2d74b80b4d909f1255473.
- [x] `balanced-reranker-placeholder:filename` **Filename** - model.safetensors is pinned.
- [x] `balanced-reranker-placeholder:checksum` **Checksum** - SHA-256 checksum is pinned.
- [x] `balanced-reranker-placeholder:size` **File size** - 1191588280 bytes recorded.
- [x] `balanced-reranker-placeholder:license` **License** - Apache-2.0 approved.
- [x] `balanced-reranker-placeholder:license-artifact` **License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-Reranker-0.6B/blob/main/README.md.
- [x] `balanced-reranker-placeholder:release-approval` **Release approval** - Release approved by Codex release evidence review on 2026-06-22.

### Tiny GGUF Local Model

- Type: `model`
- ID: `tiny-gguf-placeholder`
- Status: **ready**
- Blockers: **0**

- [x] `tiny-gguf-placeholder:provider` **Provider** - Uses llama_cpp runtime.
- [x] `tiny-gguf-placeholder:capability-fit` **Capability fit** - llm capabilities match the model kind.
- [x] `tiny-gguf-placeholder:runtime-fit` **Runtime fit** - llama_cpp is valid for llm models.
- [x] `tiny-gguf-placeholder:runtime-defaults` **Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `tiny-gguf-placeholder:source` **Source** - Hugging Face source is pinned to 23749fefcc72300e3a2ad315e1317431b06b590a.
- [x] `tiny-gguf-placeholder:filename` **Filename** - Qwen3-0.6B-Q8_0.gguf is pinned.
- [x] `tiny-gguf-placeholder:checksum` **Checksum** - SHA-256 checksum is pinned.
- [x] `tiny-gguf-placeholder:size` **File size** - 639446688 bytes recorded.
- [x] `tiny-gguf-placeholder:license` **License** - Apache-2.0 approved.
- [x] `tiny-gguf-placeholder:license-artifact` **License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/blob/main/LICENSE.
- [x] `tiny-gguf-placeholder:release-approval` **Release approval** - Release approved by Codex release evidence review on 2026-06-22.

### Tiny Production Embedding Model

- Type: `model`
- ID: `tiny-embedding-placeholder`
- Status: **ready**
- Blockers: **0**

- [x] `tiny-embedding-placeholder:provider` **Provider** - Uses local_embedding runtime.
- [x] `tiny-embedding-placeholder:capability-fit` **Capability fit** - embedding capabilities match the model kind.
- [x] `tiny-embedding-placeholder:runtime-fit` **Runtime fit** - local_embedding is valid for embedding models.
- [x] `tiny-embedding-placeholder:runtime-defaults` **Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `tiny-embedding-placeholder:source` **Source** - Hugging Face source is pinned to 97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3.
- [x] `tiny-embedding-placeholder:filename` **Filename** - model.safetensors is pinned.
- [x] `tiny-embedding-placeholder:checksum` **Checksum** - SHA-256 checksum is pinned.
- [x] `tiny-embedding-placeholder:size` **File size** - 1191586416 bytes recorded.
- [x] `tiny-embedding-placeholder:license` **License** - Apache-2.0 approved.
- [x] `tiny-embedding-placeholder:license-artifact` **License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-Embedding-0.6B/blob/main/README.md.
- [x] `tiny-embedding-placeholder:release-approval` **Release approval** - Release approved by Codex release evidence review on 2026-06-22.

### Tiny Production whisper.cpp Model

- Type: `model`
- ID: `tiny-whisper-placeholder`
- Status: **ready**
- Blockers: **0**

- [x] `tiny-whisper-placeholder:provider` **Provider** - Uses whisper_cpp runtime.
- [x] `tiny-whisper-placeholder:capability-fit` **Capability fit** - stt capabilities match the model kind.
- [x] `tiny-whisper-placeholder:runtime-fit` **Runtime fit** - whisper_cpp is valid for stt models.
- [x] `tiny-whisper-placeholder:runtime-defaults` **Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `tiny-whisper-placeholder:source` **Source** - Hugging Face source is pinned to 5359861c739e955e79d9a303bcbc70fb988958b1.
- [x] `tiny-whisper-placeholder:filename` **Filename** - ggml-tiny.en.bin is pinned.
- [x] `tiny-whisper-placeholder:checksum` **Checksum** - SHA-256 checksum is pinned.
- [x] `tiny-whisper-placeholder:size` **File size** - 77704715 bytes recorded.
- [x] `tiny-whisper-placeholder:license` **License** - MIT approved.
- [x] `tiny-whisper-placeholder:license-artifact` **License artifact** - License artifact is pinned: https://huggingface.co/ggerganov/whisper.cpp/blob/main/README.md.
- [x] `tiny-whisper-placeholder:release-approval` **Release approval** - Release approved by Codex release evidence review on 2026-06-22.

### Tiny Production Reranker

- Type: `model`
- ID: `tiny-reranker-placeholder`
- Status: **ready**
- Blockers: **0**

- [x] `tiny-reranker-placeholder:provider` **Provider** - Uses local_cross_encoder runtime.
- [x] `tiny-reranker-placeholder:capability-fit` **Capability fit** - reranker capabilities match the model kind.
- [x] `tiny-reranker-placeholder:runtime-fit` **Runtime fit** - local_cross_encoder is valid for reranker models.
- [x] `tiny-reranker-placeholder:runtime-defaults` **Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `tiny-reranker-placeholder:source` **Source** - Hugging Face source is pinned to e61197ed45024b0ed8a2d74b80b4d909f1255473.
- [x] `tiny-reranker-placeholder:filename` **Filename** - model.safetensors is pinned.
- [x] `tiny-reranker-placeholder:checksum` **Checksum** - SHA-256 checksum is pinned.
- [x] `tiny-reranker-placeholder:size` **File size** - 1191588280 bytes recorded.
- [x] `tiny-reranker-placeholder:license` **License** - Apache-2.0 approved.
- [x] `tiny-reranker-placeholder:license-artifact` **License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-Reranker-0.6B/blob/main/README.md.
- [x] `tiny-reranker-placeholder:release-approval` **Release approval** - Release approved by Codex release evidence review on 2026-06-22.

### Strong GGUF Local Model

- Type: `model`
- ID: `strong-gguf-placeholder`
- Status: **ready**
- Blockers: **0**

- [x] `strong-gguf-placeholder:provider` **Provider** - Uses llama_cpp runtime.
- [x] `strong-gguf-placeholder:capability-fit` **Capability fit** - llm capabilities match the model kind.
- [x] `strong-gguf-placeholder:runtime-fit` **Runtime fit** - llama_cpp is valid for llm models.
- [x] `strong-gguf-placeholder:runtime-defaults` **Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `strong-gguf-placeholder:source` **Source** - Hugging Face source is pinned to 7c41481f57cb95916b40956ab2f0b139b296d974.
- [x] `strong-gguf-placeholder:filename` **Filename** - Qwen3-8B-Q4_K_M.gguf is pinned.
- [x] `strong-gguf-placeholder:checksum` **Checksum** - SHA-256 checksum is pinned.
- [x] `strong-gguf-placeholder:size` **File size** - 5027783488 bytes recorded.
- [x] `strong-gguf-placeholder:license` **License** - Apache-2.0 approved.
- [x] `strong-gguf-placeholder:license-artifact` **License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-8B-GGUF/blob/main/LICENSE.
- [x] `strong-gguf-placeholder:release-approval` **Release approval** - Release approved by Codex release evidence review on 2026-06-22.

### Managed llama.cpp Runtime

- Type: `runtime`
- ID: `llama-cpp-managed-runtime`
- Status: **ready**
- Blockers: **0**

- [x] `llama-cpp-managed-runtime:source` **Source** - url source is pinned.
- [x] `llama-cpp-managed-runtime:checksum` **Checksum** - Runtime SHA-256 checksum is pinned.
- [x] `llama-cpp-managed-runtime:size` **File size** - 10547769 bytes recorded.
- [x] `llama-cpp-managed-runtime:license` **License** - MIT approved.
- [x] `llama-cpp-managed-runtime:license-artifact` **License artifact** - Runtime license artifact is pinned: https://github.com/ggml-org/llama.cpp/blob/b9596/LICENSE.
- [x] `llama-cpp-managed-runtime:release-approval` **Release approval** - Runtime release approved by Codex release evidence review on 2026-06-22.

### Managed whisper.cpp Runtime

- Type: `runtime`
- ID: `whisper-cpp-managed-runtime`
- Status: **ready**
- Blockers: **0**

- [x] `whisper-cpp-managed-runtime:source` **Source** - url source is pinned.
- [x] `whisper-cpp-managed-runtime:checksum` **Checksum** - Runtime SHA-256 checksum is pinned.
- [x] `whisper-cpp-managed-runtime:size` **File size** - 1224375 bytes recorded.
- [x] `whisper-cpp-managed-runtime:license` **License** - MIT approved.
- [x] `whisper-cpp-managed-runtime:license-artifact` **License artifact** - Runtime license artifact is pinned: https://github.com/ggml-org/whisper.cpp/blob/v1.8.6/LICENSE.
- [x] `whisper-cpp-managed-runtime:release-approval` **Release approval** - Runtime release approved by Codex release evidence review on 2026-06-22.

### Managed Piper Runtime

- Type: `runtime`
- ID: `piper-managed-runtime`
- Status: **ready**
- Blockers: **0**

- [x] `piper-managed-runtime:source` **Source** - url source is pinned.
- [x] `piper-managed-runtime:checksum` **Checksum** - Runtime SHA-256 checksum is pinned.
- [x] `piper-managed-runtime:size` **File size** - 19146957 bytes recorded.
- [x] `piper-managed-runtime:license` **License** - MIT approved.
- [x] `piper-managed-runtime:license-artifact` **License artifact** - Runtime license artifact is pinned: https://github.com/rhasspy/piper/blob/2023.11.14-2/LICENSE.md.
- [x] `piper-managed-runtime:release-approval` **Release approval** - Runtime release approved by Codex release evidence review on 2026-06-22.

## Next Actions

- [x] Ready to pin approved registries.
