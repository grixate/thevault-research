# Local AI Production Readiness

- Generated: `2026-06-22T05:45:03.963310+00:00`
- Status: **blocked**
- Production ready: **no**
- Demo fallback: **yes**
- Gate mode: **strict production**
- Recommended profile: **standard**
- Recommended pack: **starter-local-pack**

## Summary

| Metric | Value |
| --- | ---: |
| Total checks | 277 |
| Passed | 267 |
| Warnings | 1 |
| Pending | 0 |
| Blocked | 9 |
| Production packs ready | 4/4 |
| Production runtimes ready | 3/3 |

## Approval Board

- [ ] **Route production capabilities** (9 blockers)
  - Category: Capability route
  - Action: Route this capability to an approved local production model before release.
  - Samples:
    - extract_objects still uses the mock_llm demo provider.
    - extract_claims still uses the mock_llm demo provider.
    - summarize still uses the mock_llm demo provider.
  - Checks:
    - `capability:extract_objects`
    - `capability:extract_claims`
    - `capability:summarize`
    - `capability:generate_note`
    - `capability:grounded_answer`
    - `capability:create_learning_item`
    - `capability:embed_text`
    - `capability:transcribe_audio`
    - ...and 1 more

## Readiness Sections

### Production model packs

- Status: **ready**
- Blockers: **0**
- Summary: Production model packs have release-ready metadata.

- [x] `pack:starter-local-pack:required-downloads` **Recommended Starter Pack / Required downloads** - Every required model has an installed or release-ready downloadable artifact.
- [x] `pack:starter-local-pack:capability-coverage` **Recommended Starter Pack / Capability coverage** - Required models cover every advertised pack capability.
- [x] `pack:starter-local-pack:profile-fit` **Recommended Starter Pack / Profile fit** - Required models fit the standard profile target.
- [x] `pack:starter-local-pack:standard-gguf-placeholder:provider` **Recommended Starter Pack / Standard GGUF Local Model / Provider** - Uses llama_cpp runtime.
- [x] `pack:starter-local-pack:standard-gguf-placeholder:capability-fit` **Recommended Starter Pack / Standard GGUF Local Model / Capability fit** - llm capabilities match the model kind.
- [x] `pack:starter-local-pack:standard-gguf-placeholder:runtime-fit` **Recommended Starter Pack / Standard GGUF Local Model / Runtime fit** - llama_cpp is valid for llm models.
- [x] `pack:starter-local-pack:standard-gguf-placeholder:runtime-defaults` **Recommended Starter Pack / Standard GGUF Local Model / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:starter-local-pack:standard-gguf-placeholder:source` **Recommended Starter Pack / Standard GGUF Local Model / Source** - Hugging Face source is pinned to 90862c4b9d2787eaed51d12237eafdfe7c5f6077.
- [x] `pack:starter-local-pack:standard-gguf-placeholder:filename` **Recommended Starter Pack / Standard GGUF Local Model / Filename** - Qwen3-1.7B-Q8_0.gguf is pinned.
- [x] `pack:starter-local-pack:standard-gguf-placeholder:checksum` **Recommended Starter Pack / Standard GGUF Local Model / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:starter-local-pack:standard-gguf-placeholder:size` **Recommended Starter Pack / Standard GGUF Local Model / File size** - 1834426016 bytes recorded.
- [x] `pack:starter-local-pack:standard-gguf-placeholder:license` **Recommended Starter Pack / Standard GGUF Local Model / License** - Apache-2.0 approved.
- [x] `pack:starter-local-pack:standard-gguf-placeholder:license-artifact` **Recommended Starter Pack / Standard GGUF Local Model / License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/blob/main/LICENSE.
- [x] `pack:starter-local-pack:standard-gguf-placeholder:release-approval` **Recommended Starter Pack / Standard GGUF Local Model / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:starter-local-pack:balanced-embedding-placeholder:provider` **Recommended Starter Pack / Balanced Production Embedding Model / Provider** - Uses local_embedding runtime.
- [x] `pack:starter-local-pack:balanced-embedding-placeholder:capability-fit` **Recommended Starter Pack / Balanced Production Embedding Model / Capability fit** - embedding capabilities match the model kind.
- [x] `pack:starter-local-pack:balanced-embedding-placeholder:runtime-fit` **Recommended Starter Pack / Balanced Production Embedding Model / Runtime fit** - local_embedding is valid for embedding models.
- [x] `pack:starter-local-pack:balanced-embedding-placeholder:runtime-defaults` **Recommended Starter Pack / Balanced Production Embedding Model / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:starter-local-pack:balanced-embedding-placeholder:source` **Recommended Starter Pack / Balanced Production Embedding Model / Source** - Hugging Face source is pinned to 97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3.
- [x] `pack:starter-local-pack:balanced-embedding-placeholder:filename` **Recommended Starter Pack / Balanced Production Embedding Model / Filename** - model.safetensors is pinned.
- [x] `pack:starter-local-pack:balanced-embedding-placeholder:checksum` **Recommended Starter Pack / Balanced Production Embedding Model / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:starter-local-pack:balanced-embedding-placeholder:size` **Recommended Starter Pack / Balanced Production Embedding Model / File size** - 1191586416 bytes recorded.
- [x] `pack:starter-local-pack:balanced-embedding-placeholder:license` **Recommended Starter Pack / Balanced Production Embedding Model / License** - Apache-2.0 approved.
- [x] `pack:starter-local-pack:balanced-embedding-placeholder:license-artifact` **Recommended Starter Pack / Balanced Production Embedding Model / License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-Embedding-0.6B/blob/main/README.md.
- [x] `pack:starter-local-pack:balanced-embedding-placeholder:release-approval` **Recommended Starter Pack / Balanced Production Embedding Model / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:starter-local-pack:standard-whisper-placeholder:provider` **Recommended Starter Pack / Production whisper.cpp Small Model / Provider** - Uses whisper_cpp runtime.
- [x] `pack:starter-local-pack:standard-whisper-placeholder:capability-fit` **Recommended Starter Pack / Production whisper.cpp Small Model / Capability fit** - stt capabilities match the model kind.
- [x] `pack:starter-local-pack:standard-whisper-placeholder:runtime-fit` **Recommended Starter Pack / Production whisper.cpp Small Model / Runtime fit** - whisper_cpp is valid for stt models.
- [x] `pack:starter-local-pack:standard-whisper-placeholder:runtime-defaults` **Recommended Starter Pack / Production whisper.cpp Small Model / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:starter-local-pack:standard-whisper-placeholder:source` **Recommended Starter Pack / Production whisper.cpp Small Model / Source** - Hugging Face source is pinned to 5359861c739e955e79d9a303bcbc70fb988958b1.
- [x] `pack:starter-local-pack:standard-whisper-placeholder:filename` **Recommended Starter Pack / Production whisper.cpp Small Model / Filename** - ggml-base.en.bin is pinned.
- [x] `pack:starter-local-pack:standard-whisper-placeholder:checksum` **Recommended Starter Pack / Production whisper.cpp Small Model / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:starter-local-pack:standard-whisper-placeholder:size` **Recommended Starter Pack / Production whisper.cpp Small Model / File size** - 147964211 bytes recorded.
- [x] `pack:starter-local-pack:standard-whisper-placeholder:license` **Recommended Starter Pack / Production whisper.cpp Small Model / License** - MIT approved.
- [x] `pack:starter-local-pack:standard-whisper-placeholder:license-artifact` **Recommended Starter Pack / Production whisper.cpp Small Model / License artifact** - License artifact is pinned: https://huggingface.co/ggerganov/whisper.cpp/blob/main/README.md.
- [x] `pack:starter-local-pack:standard-whisper-placeholder:release-approval` **Recommended Starter Pack / Production whisper.cpp Small Model / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:starter-local-pack:tiny-piper-placeholder:provider` **Recommended Starter Pack / Tiny Production Piper Voice / Provider** - Uses piper runtime.
- [x] `pack:starter-local-pack:tiny-piper-placeholder:capability-fit` **Recommended Starter Pack / Tiny Production Piper Voice / Capability fit** - tts capabilities match the model kind.
- [x] `pack:starter-local-pack:tiny-piper-placeholder:runtime-fit` **Recommended Starter Pack / Tiny Production Piper Voice / Runtime fit** - piper is valid for tts models.
- [x] `pack:starter-local-pack:tiny-piper-placeholder:runtime-defaults` **Recommended Starter Pack / Tiny Production Piper Voice / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:starter-local-pack:tiny-piper-placeholder:source` **Recommended Starter Pack / Tiny Production Piper Voice / Source** - Hugging Face source is pinned to e21c7de8d4eab79b902f0d61e662b3f21664b8d2.
- [x] `pack:starter-local-pack:tiny-piper-placeholder:filename` **Recommended Starter Pack / Tiny Production Piper Voice / Filename** - en/en_US/amy/low/en_US-amy-low.onnx is pinned.
- [x] `pack:starter-local-pack:tiny-piper-placeholder:checksum` **Recommended Starter Pack / Tiny Production Piper Voice / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:starter-local-pack:tiny-piper-placeholder:size` **Recommended Starter Pack / Tiny Production Piper Voice / File size** - 63104526 bytes recorded.
- [x] `pack:starter-local-pack:tiny-piper-placeholder:filename` **Recommended Starter Pack / Tiny Production Piper Voice / Filename** - en/en_US/amy/low/en_US-amy-low.onnx.json is pinned.
- [x] `pack:starter-local-pack:tiny-piper-placeholder:size` **Recommended Starter Pack / Tiny Production Piper Voice / File size** - 4164 bytes recorded.
- [x] `pack:starter-local-pack:tiny-piper-placeholder:license` **Recommended Starter Pack / Tiny Production Piper Voice / License** - MIT approved.
- [x] `pack:starter-local-pack:tiny-piper-placeholder:license-artifact` **Recommended Starter Pack / Tiny Production Piper Voice / License artifact** - License artifact is pinned: https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/amy/low/MODEL_CARD.
- [x] `pack:starter-local-pack:tiny-piper-placeholder:release-approval` **Recommended Starter Pack / Tiny Production Piper Voice / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:starter-local-pack:balanced-reranker-placeholder:optional-provider` **Recommended Starter Pack / Optional Balanced Production Reranker / Provider** - Uses local_cross_encoder runtime.
- [x] `pack:starter-local-pack:balanced-reranker-placeholder:optional-capability-fit` **Recommended Starter Pack / Optional Balanced Production Reranker / Capability fit** - reranker capabilities match the model kind.
- [x] `pack:starter-local-pack:balanced-reranker-placeholder:optional-runtime-fit` **Recommended Starter Pack / Optional Balanced Production Reranker / Runtime fit** - local_cross_encoder is valid for reranker models.
- [x] `pack:starter-local-pack:balanced-reranker-placeholder:optional-runtime-defaults` **Recommended Starter Pack / Optional Balanced Production Reranker / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:starter-local-pack:balanced-reranker-placeholder:optional-source` **Recommended Starter Pack / Optional Balanced Production Reranker / Source** - Hugging Face source is pinned to e61197ed45024b0ed8a2d74b80b4d909f1255473.
- [x] `pack:starter-local-pack:balanced-reranker-placeholder:optional-filename` **Recommended Starter Pack / Optional Balanced Production Reranker / Filename** - model.safetensors is pinned.
- [x] `pack:starter-local-pack:balanced-reranker-placeholder:optional-checksum` **Recommended Starter Pack / Optional Balanced Production Reranker / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:starter-local-pack:balanced-reranker-placeholder:optional-size` **Recommended Starter Pack / Optional Balanced Production Reranker / File size** - 1191588280 bytes recorded.
- [x] `pack:starter-local-pack:balanced-reranker-placeholder:optional-license` **Recommended Starter Pack / Optional Balanced Production Reranker / License** - Apache-2.0 approved.
- [x] `pack:starter-local-pack:balanced-reranker-placeholder:optional-license-artifact` **Recommended Starter Pack / Optional Balanced Production Reranker / License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-Reranker-0.6B/blob/main/README.md.
- [x] `pack:starter-local-pack:balanced-reranker-placeholder:optional-release-approval` **Recommended Starter Pack / Optional Balanced Production Reranker / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:starter-local-pack:optional-models` **Recommended Starter Pack / Optional model add-ons** - 1/1 optional model add-ons are installed or release-ready.
- [x] `pack:starter-local-pack:managed-runtimes` **Recommended Starter Pack / Managed runtimes** - Approved managed runtime manifests are available for llama_cpp, piper, whisper_cpp.
- [x] `pack:tiny-production-pack:required-downloads` **Tiny Production Local Pack / Required downloads** - Every required model has an installed or release-ready downloadable artifact.
- [x] `pack:tiny-production-pack:capability-coverage` **Tiny Production Local Pack / Capability coverage** - Required models cover every advertised pack capability.
- [x] `pack:tiny-production-pack:profile-fit` **Tiny Production Local Pack / Profile fit** - Required models fit the tiny profile target.
- [x] `pack:tiny-production-pack:tiny-gguf-placeholder:provider` **Tiny Production Local Pack / Tiny GGUF Local Model / Provider** - Uses llama_cpp runtime.
- [x] `pack:tiny-production-pack:tiny-gguf-placeholder:capability-fit` **Tiny Production Local Pack / Tiny GGUF Local Model / Capability fit** - llm capabilities match the model kind.
- [x] `pack:tiny-production-pack:tiny-gguf-placeholder:runtime-fit` **Tiny Production Local Pack / Tiny GGUF Local Model / Runtime fit** - llama_cpp is valid for llm models.
- [x] `pack:tiny-production-pack:tiny-gguf-placeholder:runtime-defaults` **Tiny Production Local Pack / Tiny GGUF Local Model / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:tiny-production-pack:tiny-gguf-placeholder:source` **Tiny Production Local Pack / Tiny GGUF Local Model / Source** - Hugging Face source is pinned to 23749fefcc72300e3a2ad315e1317431b06b590a.
- [x] `pack:tiny-production-pack:tiny-gguf-placeholder:filename` **Tiny Production Local Pack / Tiny GGUF Local Model / Filename** - Qwen3-0.6B-Q8_0.gguf is pinned.
- [x] `pack:tiny-production-pack:tiny-gguf-placeholder:checksum` **Tiny Production Local Pack / Tiny GGUF Local Model / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:tiny-production-pack:tiny-gguf-placeholder:size` **Tiny Production Local Pack / Tiny GGUF Local Model / File size** - 639446688 bytes recorded.
- [x] `pack:tiny-production-pack:tiny-gguf-placeholder:license` **Tiny Production Local Pack / Tiny GGUF Local Model / License** - Apache-2.0 approved.
- [x] `pack:tiny-production-pack:tiny-gguf-placeholder:license-artifact` **Tiny Production Local Pack / Tiny GGUF Local Model / License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/blob/main/LICENSE.
- [x] `pack:tiny-production-pack:tiny-gguf-placeholder:release-approval` **Tiny Production Local Pack / Tiny GGUF Local Model / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:tiny-production-pack:tiny-embedding-placeholder:provider` **Tiny Production Local Pack / Tiny Production Embedding Model / Provider** - Uses local_embedding runtime.
- [x] `pack:tiny-production-pack:tiny-embedding-placeholder:capability-fit` **Tiny Production Local Pack / Tiny Production Embedding Model / Capability fit** - embedding capabilities match the model kind.
- [x] `pack:tiny-production-pack:tiny-embedding-placeholder:runtime-fit` **Tiny Production Local Pack / Tiny Production Embedding Model / Runtime fit** - local_embedding is valid for embedding models.
- [x] `pack:tiny-production-pack:tiny-embedding-placeholder:runtime-defaults` **Tiny Production Local Pack / Tiny Production Embedding Model / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:tiny-production-pack:tiny-embedding-placeholder:source` **Tiny Production Local Pack / Tiny Production Embedding Model / Source** - Hugging Face source is pinned to 97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3.
- [x] `pack:tiny-production-pack:tiny-embedding-placeholder:filename` **Tiny Production Local Pack / Tiny Production Embedding Model / Filename** - model.safetensors is pinned.
- [x] `pack:tiny-production-pack:tiny-embedding-placeholder:checksum` **Tiny Production Local Pack / Tiny Production Embedding Model / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:tiny-production-pack:tiny-embedding-placeholder:size` **Tiny Production Local Pack / Tiny Production Embedding Model / File size** - 1191586416 bytes recorded.
- [x] `pack:tiny-production-pack:tiny-embedding-placeholder:license` **Tiny Production Local Pack / Tiny Production Embedding Model / License** - Apache-2.0 approved.
- [x] `pack:tiny-production-pack:tiny-embedding-placeholder:license-artifact` **Tiny Production Local Pack / Tiny Production Embedding Model / License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-Embedding-0.6B/blob/main/README.md.
- [x] `pack:tiny-production-pack:tiny-embedding-placeholder:release-approval` **Tiny Production Local Pack / Tiny Production Embedding Model / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:tiny-production-pack:tiny-whisper-placeholder:provider` **Tiny Production Local Pack / Tiny Production whisper.cpp Model / Provider** - Uses whisper_cpp runtime.
- [x] `pack:tiny-production-pack:tiny-whisper-placeholder:capability-fit` **Tiny Production Local Pack / Tiny Production whisper.cpp Model / Capability fit** - stt capabilities match the model kind.
- [x] `pack:tiny-production-pack:tiny-whisper-placeholder:runtime-fit` **Tiny Production Local Pack / Tiny Production whisper.cpp Model / Runtime fit** - whisper_cpp is valid for stt models.
- [x] `pack:tiny-production-pack:tiny-whisper-placeholder:runtime-defaults` **Tiny Production Local Pack / Tiny Production whisper.cpp Model / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:tiny-production-pack:tiny-whisper-placeholder:source` **Tiny Production Local Pack / Tiny Production whisper.cpp Model / Source** - Hugging Face source is pinned to 5359861c739e955e79d9a303bcbc70fb988958b1.
- [x] `pack:tiny-production-pack:tiny-whisper-placeholder:filename` **Tiny Production Local Pack / Tiny Production whisper.cpp Model / Filename** - ggml-tiny.en.bin is pinned.
- [x] `pack:tiny-production-pack:tiny-whisper-placeholder:checksum` **Tiny Production Local Pack / Tiny Production whisper.cpp Model / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:tiny-production-pack:tiny-whisper-placeholder:size` **Tiny Production Local Pack / Tiny Production whisper.cpp Model / File size** - 77704715 bytes recorded.
- [x] `pack:tiny-production-pack:tiny-whisper-placeholder:license` **Tiny Production Local Pack / Tiny Production whisper.cpp Model / License** - MIT approved.
- [x] `pack:tiny-production-pack:tiny-whisper-placeholder:license-artifact` **Tiny Production Local Pack / Tiny Production whisper.cpp Model / License artifact** - License artifact is pinned: https://huggingface.co/ggerganov/whisper.cpp/blob/main/README.md.
- [x] `pack:tiny-production-pack:tiny-whisper-placeholder:release-approval` **Tiny Production Local Pack / Tiny Production whisper.cpp Model / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:tiny-production-pack:tiny-piper-placeholder:provider` **Tiny Production Local Pack / Tiny Production Piper Voice / Provider** - Uses piper runtime.
- [x] `pack:tiny-production-pack:tiny-piper-placeholder:capability-fit` **Tiny Production Local Pack / Tiny Production Piper Voice / Capability fit** - tts capabilities match the model kind.
- [x] `pack:tiny-production-pack:tiny-piper-placeholder:runtime-fit` **Tiny Production Local Pack / Tiny Production Piper Voice / Runtime fit** - piper is valid for tts models.
- [x] `pack:tiny-production-pack:tiny-piper-placeholder:runtime-defaults` **Tiny Production Local Pack / Tiny Production Piper Voice / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:tiny-production-pack:tiny-piper-placeholder:source` **Tiny Production Local Pack / Tiny Production Piper Voice / Source** - Hugging Face source is pinned to e21c7de8d4eab79b902f0d61e662b3f21664b8d2.
- [x] `pack:tiny-production-pack:tiny-piper-placeholder:filename` **Tiny Production Local Pack / Tiny Production Piper Voice / Filename** - en/en_US/amy/low/en_US-amy-low.onnx is pinned.
- [x] `pack:tiny-production-pack:tiny-piper-placeholder:checksum` **Tiny Production Local Pack / Tiny Production Piper Voice / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:tiny-production-pack:tiny-piper-placeholder:size` **Tiny Production Local Pack / Tiny Production Piper Voice / File size** - 63104526 bytes recorded.
- [x] `pack:tiny-production-pack:tiny-piper-placeholder:filename` **Tiny Production Local Pack / Tiny Production Piper Voice / Filename** - en/en_US/amy/low/en_US-amy-low.onnx.json is pinned.
- [x] `pack:tiny-production-pack:tiny-piper-placeholder:size` **Tiny Production Local Pack / Tiny Production Piper Voice / File size** - 4164 bytes recorded.
- [x] `pack:tiny-production-pack:tiny-piper-placeholder:license` **Tiny Production Local Pack / Tiny Production Piper Voice / License** - MIT approved.
- [x] `pack:tiny-production-pack:tiny-piper-placeholder:license-artifact` **Tiny Production Local Pack / Tiny Production Piper Voice / License artifact** - License artifact is pinned: https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/amy/low/MODEL_CARD.
- [x] `pack:tiny-production-pack:tiny-piper-placeholder:release-approval` **Tiny Production Local Pack / Tiny Production Piper Voice / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:tiny-production-pack:tiny-reranker-placeholder:optional-provider` **Tiny Production Local Pack / Optional Tiny Production Reranker / Provider** - Uses local_cross_encoder runtime.
- [x] `pack:tiny-production-pack:tiny-reranker-placeholder:optional-capability-fit` **Tiny Production Local Pack / Optional Tiny Production Reranker / Capability fit** - reranker capabilities match the model kind.
- [x] `pack:tiny-production-pack:tiny-reranker-placeholder:optional-runtime-fit` **Tiny Production Local Pack / Optional Tiny Production Reranker / Runtime fit** - local_cross_encoder is valid for reranker models.
- [x] `pack:tiny-production-pack:tiny-reranker-placeholder:optional-runtime-defaults` **Tiny Production Local Pack / Optional Tiny Production Reranker / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:tiny-production-pack:tiny-reranker-placeholder:optional-source` **Tiny Production Local Pack / Optional Tiny Production Reranker / Source** - Hugging Face source is pinned to e61197ed45024b0ed8a2d74b80b4d909f1255473.
- [x] `pack:tiny-production-pack:tiny-reranker-placeholder:optional-filename` **Tiny Production Local Pack / Optional Tiny Production Reranker / Filename** - model.safetensors is pinned.
- [x] `pack:tiny-production-pack:tiny-reranker-placeholder:optional-checksum` **Tiny Production Local Pack / Optional Tiny Production Reranker / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:tiny-production-pack:tiny-reranker-placeholder:optional-size` **Tiny Production Local Pack / Optional Tiny Production Reranker / File size** - 1191588280 bytes recorded.
- [x] `pack:tiny-production-pack:tiny-reranker-placeholder:optional-license` **Tiny Production Local Pack / Optional Tiny Production Reranker / License** - Apache-2.0 approved.
- [x] `pack:tiny-production-pack:tiny-reranker-placeholder:optional-license-artifact` **Tiny Production Local Pack / Optional Tiny Production Reranker / License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-Reranker-0.6B/blob/main/README.md.
- [x] `pack:tiny-production-pack:tiny-reranker-placeholder:optional-release-approval` **Tiny Production Local Pack / Optional Tiny Production Reranker / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:tiny-production-pack:optional-models` **Tiny Production Local Pack / Optional model add-ons** - 1/1 optional model add-ons are installed or release-ready.
- [x] `pack:tiny-production-pack:managed-runtimes` **Tiny Production Local Pack / Managed runtimes** - Approved managed runtime manifests are available for llama_cpp, piper, whisper_cpp.
- [x] `pack:standard-local-pack:required-downloads` **Standard Local Pack / Required downloads** - Every required model has an installed or release-ready downloadable artifact.
- [x] `pack:standard-local-pack:capability-coverage` **Standard Local Pack / Capability coverage** - Required models cover every advertised pack capability.
- [x] `pack:standard-local-pack:profile-fit` **Standard Local Pack / Profile fit** - Required models fit the standard profile target.
- [x] `pack:standard-local-pack:standard-gguf-placeholder:provider` **Standard Local Pack / Standard GGUF Local Model / Provider** - Uses llama_cpp runtime.
- [x] `pack:standard-local-pack:standard-gguf-placeholder:capability-fit` **Standard Local Pack / Standard GGUF Local Model / Capability fit** - llm capabilities match the model kind.
- [x] `pack:standard-local-pack:standard-gguf-placeholder:runtime-fit` **Standard Local Pack / Standard GGUF Local Model / Runtime fit** - llama_cpp is valid for llm models.
- [x] `pack:standard-local-pack:standard-gguf-placeholder:runtime-defaults` **Standard Local Pack / Standard GGUF Local Model / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:standard-local-pack:standard-gguf-placeholder:source` **Standard Local Pack / Standard GGUF Local Model / Source** - Hugging Face source is pinned to 90862c4b9d2787eaed51d12237eafdfe7c5f6077.
- [x] `pack:standard-local-pack:standard-gguf-placeholder:filename` **Standard Local Pack / Standard GGUF Local Model / Filename** - Qwen3-1.7B-Q8_0.gguf is pinned.
- [x] `pack:standard-local-pack:standard-gguf-placeholder:checksum` **Standard Local Pack / Standard GGUF Local Model / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:standard-local-pack:standard-gguf-placeholder:size` **Standard Local Pack / Standard GGUF Local Model / File size** - 1834426016 bytes recorded.
- [x] `pack:standard-local-pack:standard-gguf-placeholder:license` **Standard Local Pack / Standard GGUF Local Model / License** - Apache-2.0 approved.
- [x] `pack:standard-local-pack:standard-gguf-placeholder:license-artifact` **Standard Local Pack / Standard GGUF Local Model / License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/blob/main/LICENSE.
- [x] `pack:standard-local-pack:standard-gguf-placeholder:release-approval` **Standard Local Pack / Standard GGUF Local Model / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:standard-local-pack:balanced-embedding-placeholder:provider` **Standard Local Pack / Balanced Production Embedding Model / Provider** - Uses local_embedding runtime.
- [x] `pack:standard-local-pack:balanced-embedding-placeholder:capability-fit` **Standard Local Pack / Balanced Production Embedding Model / Capability fit** - embedding capabilities match the model kind.
- [x] `pack:standard-local-pack:balanced-embedding-placeholder:runtime-fit` **Standard Local Pack / Balanced Production Embedding Model / Runtime fit** - local_embedding is valid for embedding models.
- [x] `pack:standard-local-pack:balanced-embedding-placeholder:runtime-defaults` **Standard Local Pack / Balanced Production Embedding Model / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:standard-local-pack:balanced-embedding-placeholder:source` **Standard Local Pack / Balanced Production Embedding Model / Source** - Hugging Face source is pinned to 97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3.
- [x] `pack:standard-local-pack:balanced-embedding-placeholder:filename` **Standard Local Pack / Balanced Production Embedding Model / Filename** - model.safetensors is pinned.
- [x] `pack:standard-local-pack:balanced-embedding-placeholder:checksum` **Standard Local Pack / Balanced Production Embedding Model / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:standard-local-pack:balanced-embedding-placeholder:size` **Standard Local Pack / Balanced Production Embedding Model / File size** - 1191586416 bytes recorded.
- [x] `pack:standard-local-pack:balanced-embedding-placeholder:license` **Standard Local Pack / Balanced Production Embedding Model / License** - Apache-2.0 approved.
- [x] `pack:standard-local-pack:balanced-embedding-placeholder:license-artifact` **Standard Local Pack / Balanced Production Embedding Model / License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-Embedding-0.6B/blob/main/README.md.
- [x] `pack:standard-local-pack:balanced-embedding-placeholder:release-approval` **Standard Local Pack / Balanced Production Embedding Model / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:standard-local-pack:standard-whisper-placeholder:provider` **Standard Local Pack / Production whisper.cpp Small Model / Provider** - Uses whisper_cpp runtime.
- [x] `pack:standard-local-pack:standard-whisper-placeholder:capability-fit` **Standard Local Pack / Production whisper.cpp Small Model / Capability fit** - stt capabilities match the model kind.
- [x] `pack:standard-local-pack:standard-whisper-placeholder:runtime-fit` **Standard Local Pack / Production whisper.cpp Small Model / Runtime fit** - whisper_cpp is valid for stt models.
- [x] `pack:standard-local-pack:standard-whisper-placeholder:runtime-defaults` **Standard Local Pack / Production whisper.cpp Small Model / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:standard-local-pack:standard-whisper-placeholder:source` **Standard Local Pack / Production whisper.cpp Small Model / Source** - Hugging Face source is pinned to 5359861c739e955e79d9a303bcbc70fb988958b1.
- [x] `pack:standard-local-pack:standard-whisper-placeholder:filename` **Standard Local Pack / Production whisper.cpp Small Model / Filename** - ggml-base.en.bin is pinned.
- [x] `pack:standard-local-pack:standard-whisper-placeholder:checksum` **Standard Local Pack / Production whisper.cpp Small Model / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:standard-local-pack:standard-whisper-placeholder:size` **Standard Local Pack / Production whisper.cpp Small Model / File size** - 147964211 bytes recorded.
- [x] `pack:standard-local-pack:standard-whisper-placeholder:license` **Standard Local Pack / Production whisper.cpp Small Model / License** - MIT approved.
- [x] `pack:standard-local-pack:standard-whisper-placeholder:license-artifact` **Standard Local Pack / Production whisper.cpp Small Model / License artifact** - License artifact is pinned: https://huggingface.co/ggerganov/whisper.cpp/blob/main/README.md.
- [x] `pack:standard-local-pack:standard-whisper-placeholder:release-approval` **Standard Local Pack / Production whisper.cpp Small Model / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:standard-local-pack:tiny-piper-placeholder:provider` **Standard Local Pack / Tiny Production Piper Voice / Provider** - Uses piper runtime.
- [x] `pack:standard-local-pack:tiny-piper-placeholder:capability-fit` **Standard Local Pack / Tiny Production Piper Voice / Capability fit** - tts capabilities match the model kind.
- [x] `pack:standard-local-pack:tiny-piper-placeholder:runtime-fit` **Standard Local Pack / Tiny Production Piper Voice / Runtime fit** - piper is valid for tts models.
- [x] `pack:standard-local-pack:tiny-piper-placeholder:runtime-defaults` **Standard Local Pack / Tiny Production Piper Voice / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:standard-local-pack:tiny-piper-placeholder:source` **Standard Local Pack / Tiny Production Piper Voice / Source** - Hugging Face source is pinned to e21c7de8d4eab79b902f0d61e662b3f21664b8d2.
- [x] `pack:standard-local-pack:tiny-piper-placeholder:filename` **Standard Local Pack / Tiny Production Piper Voice / Filename** - en/en_US/amy/low/en_US-amy-low.onnx is pinned.
- [x] `pack:standard-local-pack:tiny-piper-placeholder:checksum` **Standard Local Pack / Tiny Production Piper Voice / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:standard-local-pack:tiny-piper-placeholder:size` **Standard Local Pack / Tiny Production Piper Voice / File size** - 63104526 bytes recorded.
- [x] `pack:standard-local-pack:tiny-piper-placeholder:filename` **Standard Local Pack / Tiny Production Piper Voice / Filename** - en/en_US/amy/low/en_US-amy-low.onnx.json is pinned.
- [x] `pack:standard-local-pack:tiny-piper-placeholder:size` **Standard Local Pack / Tiny Production Piper Voice / File size** - 4164 bytes recorded.
- [x] `pack:standard-local-pack:tiny-piper-placeholder:license` **Standard Local Pack / Tiny Production Piper Voice / License** - MIT approved.
- [x] `pack:standard-local-pack:tiny-piper-placeholder:license-artifact` **Standard Local Pack / Tiny Production Piper Voice / License artifact** - License artifact is pinned: https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/amy/low/MODEL_CARD.
- [x] `pack:standard-local-pack:tiny-piper-placeholder:release-approval` **Standard Local Pack / Tiny Production Piper Voice / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:standard-local-pack:balanced-reranker-placeholder:optional-provider` **Standard Local Pack / Optional Balanced Production Reranker / Provider** - Uses local_cross_encoder runtime.
- [x] `pack:standard-local-pack:balanced-reranker-placeholder:optional-capability-fit` **Standard Local Pack / Optional Balanced Production Reranker / Capability fit** - reranker capabilities match the model kind.
- [x] `pack:standard-local-pack:balanced-reranker-placeholder:optional-runtime-fit` **Standard Local Pack / Optional Balanced Production Reranker / Runtime fit** - local_cross_encoder is valid for reranker models.
- [x] `pack:standard-local-pack:balanced-reranker-placeholder:optional-runtime-defaults` **Standard Local Pack / Optional Balanced Production Reranker / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:standard-local-pack:balanced-reranker-placeholder:optional-source` **Standard Local Pack / Optional Balanced Production Reranker / Source** - Hugging Face source is pinned to e61197ed45024b0ed8a2d74b80b4d909f1255473.
- [x] `pack:standard-local-pack:balanced-reranker-placeholder:optional-filename` **Standard Local Pack / Optional Balanced Production Reranker / Filename** - model.safetensors is pinned.
- [x] `pack:standard-local-pack:balanced-reranker-placeholder:optional-checksum` **Standard Local Pack / Optional Balanced Production Reranker / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:standard-local-pack:balanced-reranker-placeholder:optional-size` **Standard Local Pack / Optional Balanced Production Reranker / File size** - 1191588280 bytes recorded.
- [x] `pack:standard-local-pack:balanced-reranker-placeholder:optional-license` **Standard Local Pack / Optional Balanced Production Reranker / License** - Apache-2.0 approved.
- [x] `pack:standard-local-pack:balanced-reranker-placeholder:optional-license-artifact` **Standard Local Pack / Optional Balanced Production Reranker / License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-Reranker-0.6B/blob/main/README.md.
- [x] `pack:standard-local-pack:balanced-reranker-placeholder:optional-release-approval` **Standard Local Pack / Optional Balanced Production Reranker / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:standard-local-pack:optional-models` **Standard Local Pack / Optional model add-ons** - 1/1 optional model add-ons are installed or release-ready.
- [x] `pack:standard-local-pack:managed-runtimes` **Standard Local Pack / Managed runtimes** - Approved managed runtime manifests are available for llama_cpp, piper, whisper_cpp.
- [x] `pack:strong-local-pack:required-downloads` **Strong Local Pack / Required downloads** - Every required model has an installed or release-ready downloadable artifact.
- [x] `pack:strong-local-pack:capability-coverage` **Strong Local Pack / Capability coverage** - Required models cover every advertised pack capability.
- [x] `pack:strong-local-pack:profile-fit` **Strong Local Pack / Profile fit** - Required models fit the strong profile target.
- [x] `pack:strong-local-pack:strong-gguf-placeholder:provider` **Strong Local Pack / Strong GGUF Local Model / Provider** - Uses llama_cpp runtime.
- [x] `pack:strong-local-pack:strong-gguf-placeholder:capability-fit` **Strong Local Pack / Strong GGUF Local Model / Capability fit** - llm capabilities match the model kind.
- [x] `pack:strong-local-pack:strong-gguf-placeholder:runtime-fit` **Strong Local Pack / Strong GGUF Local Model / Runtime fit** - llama_cpp is valid for llm models.
- [x] `pack:strong-local-pack:strong-gguf-placeholder:runtime-defaults` **Strong Local Pack / Strong GGUF Local Model / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:strong-local-pack:strong-gguf-placeholder:source` **Strong Local Pack / Strong GGUF Local Model / Source** - Hugging Face source is pinned to 7c41481f57cb95916b40956ab2f0b139b296d974.
- [x] `pack:strong-local-pack:strong-gguf-placeholder:filename` **Strong Local Pack / Strong GGUF Local Model / Filename** - Qwen3-8B-Q4_K_M.gguf is pinned.
- [x] `pack:strong-local-pack:strong-gguf-placeholder:checksum` **Strong Local Pack / Strong GGUF Local Model / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:strong-local-pack:strong-gguf-placeholder:size` **Strong Local Pack / Strong GGUF Local Model / File size** - 5027783488 bytes recorded.
- [x] `pack:strong-local-pack:strong-gguf-placeholder:license` **Strong Local Pack / Strong GGUF Local Model / License** - Apache-2.0 approved.
- [x] `pack:strong-local-pack:strong-gguf-placeholder:license-artifact` **Strong Local Pack / Strong GGUF Local Model / License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-8B-GGUF/blob/main/LICENSE.
- [x] `pack:strong-local-pack:strong-gguf-placeholder:release-approval` **Strong Local Pack / Strong GGUF Local Model / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:strong-local-pack:balanced-embedding-placeholder:provider` **Strong Local Pack / Balanced Production Embedding Model / Provider** - Uses local_embedding runtime.
- [x] `pack:strong-local-pack:balanced-embedding-placeholder:capability-fit` **Strong Local Pack / Balanced Production Embedding Model / Capability fit** - embedding capabilities match the model kind.
- [x] `pack:strong-local-pack:balanced-embedding-placeholder:runtime-fit` **Strong Local Pack / Balanced Production Embedding Model / Runtime fit** - local_embedding is valid for embedding models.
- [x] `pack:strong-local-pack:balanced-embedding-placeholder:runtime-defaults` **Strong Local Pack / Balanced Production Embedding Model / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:strong-local-pack:balanced-embedding-placeholder:source` **Strong Local Pack / Balanced Production Embedding Model / Source** - Hugging Face source is pinned to 97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3.
- [x] `pack:strong-local-pack:balanced-embedding-placeholder:filename` **Strong Local Pack / Balanced Production Embedding Model / Filename** - model.safetensors is pinned.
- [x] `pack:strong-local-pack:balanced-embedding-placeholder:checksum` **Strong Local Pack / Balanced Production Embedding Model / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:strong-local-pack:balanced-embedding-placeholder:size` **Strong Local Pack / Balanced Production Embedding Model / File size** - 1191586416 bytes recorded.
- [x] `pack:strong-local-pack:balanced-embedding-placeholder:license` **Strong Local Pack / Balanced Production Embedding Model / License** - Apache-2.0 approved.
- [x] `pack:strong-local-pack:balanced-embedding-placeholder:license-artifact` **Strong Local Pack / Balanced Production Embedding Model / License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-Embedding-0.6B/blob/main/README.md.
- [x] `pack:strong-local-pack:balanced-embedding-placeholder:release-approval` **Strong Local Pack / Balanced Production Embedding Model / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:strong-local-pack:standard-whisper-placeholder:provider` **Strong Local Pack / Production whisper.cpp Small Model / Provider** - Uses whisper_cpp runtime.
- [x] `pack:strong-local-pack:standard-whisper-placeholder:capability-fit` **Strong Local Pack / Production whisper.cpp Small Model / Capability fit** - stt capabilities match the model kind.
- [x] `pack:strong-local-pack:standard-whisper-placeholder:runtime-fit` **Strong Local Pack / Production whisper.cpp Small Model / Runtime fit** - whisper_cpp is valid for stt models.
- [x] `pack:strong-local-pack:standard-whisper-placeholder:runtime-defaults` **Strong Local Pack / Production whisper.cpp Small Model / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:strong-local-pack:standard-whisper-placeholder:source` **Strong Local Pack / Production whisper.cpp Small Model / Source** - Hugging Face source is pinned to 5359861c739e955e79d9a303bcbc70fb988958b1.
- [x] `pack:strong-local-pack:standard-whisper-placeholder:filename` **Strong Local Pack / Production whisper.cpp Small Model / Filename** - ggml-base.en.bin is pinned.
- [x] `pack:strong-local-pack:standard-whisper-placeholder:checksum` **Strong Local Pack / Production whisper.cpp Small Model / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:strong-local-pack:standard-whisper-placeholder:size` **Strong Local Pack / Production whisper.cpp Small Model / File size** - 147964211 bytes recorded.
- [x] `pack:strong-local-pack:standard-whisper-placeholder:license` **Strong Local Pack / Production whisper.cpp Small Model / License** - MIT approved.
- [x] `pack:strong-local-pack:standard-whisper-placeholder:license-artifact` **Strong Local Pack / Production whisper.cpp Small Model / License artifact** - License artifact is pinned: https://huggingface.co/ggerganov/whisper.cpp/blob/main/README.md.
- [x] `pack:strong-local-pack:standard-whisper-placeholder:release-approval` **Strong Local Pack / Production whisper.cpp Small Model / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:strong-local-pack:tiny-piper-placeholder:provider` **Strong Local Pack / Tiny Production Piper Voice / Provider** - Uses piper runtime.
- [x] `pack:strong-local-pack:tiny-piper-placeholder:capability-fit` **Strong Local Pack / Tiny Production Piper Voice / Capability fit** - tts capabilities match the model kind.
- [x] `pack:strong-local-pack:tiny-piper-placeholder:runtime-fit` **Strong Local Pack / Tiny Production Piper Voice / Runtime fit** - piper is valid for tts models.
- [x] `pack:strong-local-pack:tiny-piper-placeholder:runtime-defaults` **Strong Local Pack / Tiny Production Piper Voice / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:strong-local-pack:tiny-piper-placeholder:source` **Strong Local Pack / Tiny Production Piper Voice / Source** - Hugging Face source is pinned to e21c7de8d4eab79b902f0d61e662b3f21664b8d2.
- [x] `pack:strong-local-pack:tiny-piper-placeholder:filename` **Strong Local Pack / Tiny Production Piper Voice / Filename** - en/en_US/amy/low/en_US-amy-low.onnx is pinned.
- [x] `pack:strong-local-pack:tiny-piper-placeholder:checksum` **Strong Local Pack / Tiny Production Piper Voice / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:strong-local-pack:tiny-piper-placeholder:size` **Strong Local Pack / Tiny Production Piper Voice / File size** - 63104526 bytes recorded.
- [x] `pack:strong-local-pack:tiny-piper-placeholder:filename` **Strong Local Pack / Tiny Production Piper Voice / Filename** - en/en_US/amy/low/en_US-amy-low.onnx.json is pinned.
- [x] `pack:strong-local-pack:tiny-piper-placeholder:size` **Strong Local Pack / Tiny Production Piper Voice / File size** - 4164 bytes recorded.
- [x] `pack:strong-local-pack:tiny-piper-placeholder:license` **Strong Local Pack / Tiny Production Piper Voice / License** - MIT approved.
- [x] `pack:strong-local-pack:tiny-piper-placeholder:license-artifact` **Strong Local Pack / Tiny Production Piper Voice / License artifact** - License artifact is pinned: https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/amy/low/MODEL_CARD.
- [x] `pack:strong-local-pack:tiny-piper-placeholder:release-approval` **Strong Local Pack / Tiny Production Piper Voice / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:strong-local-pack:balanced-reranker-placeholder:optional-provider` **Strong Local Pack / Optional Balanced Production Reranker / Provider** - Uses local_cross_encoder runtime.
- [x] `pack:strong-local-pack:balanced-reranker-placeholder:optional-capability-fit` **Strong Local Pack / Optional Balanced Production Reranker / Capability fit** - reranker capabilities match the model kind.
- [x] `pack:strong-local-pack:balanced-reranker-placeholder:optional-runtime-fit` **Strong Local Pack / Optional Balanced Production Reranker / Runtime fit** - local_cross_encoder is valid for reranker models.
- [x] `pack:strong-local-pack:balanced-reranker-placeholder:optional-runtime-defaults` **Strong Local Pack / Optional Balanced Production Reranker / Runtime defaults** - Runtime defaults are pinned for setup and smoke testing.
- [x] `pack:strong-local-pack:balanced-reranker-placeholder:optional-source` **Strong Local Pack / Optional Balanced Production Reranker / Source** - Hugging Face source is pinned to e61197ed45024b0ed8a2d74b80b4d909f1255473.
- [x] `pack:strong-local-pack:balanced-reranker-placeholder:optional-filename` **Strong Local Pack / Optional Balanced Production Reranker / Filename** - model.safetensors is pinned.
- [x] `pack:strong-local-pack:balanced-reranker-placeholder:optional-checksum` **Strong Local Pack / Optional Balanced Production Reranker / Checksum** - SHA-256 checksum is pinned.
- [x] `pack:strong-local-pack:balanced-reranker-placeholder:optional-size` **Strong Local Pack / Optional Balanced Production Reranker / File size** - 1191588280 bytes recorded.
- [x] `pack:strong-local-pack:balanced-reranker-placeholder:optional-license` **Strong Local Pack / Optional Balanced Production Reranker / License** - Apache-2.0 approved.
- [x] `pack:strong-local-pack:balanced-reranker-placeholder:optional-license-artifact` **Strong Local Pack / Optional Balanced Production Reranker / License artifact** - License artifact is pinned: https://huggingface.co/Qwen/Qwen3-Reranker-0.6B/blob/main/README.md.
- [x] `pack:strong-local-pack:balanced-reranker-placeholder:optional-release-approval` **Strong Local Pack / Optional Balanced Production Reranker / Release approval** - Release approved by Codex release evidence review on 2026-06-22.
- [x] `pack:strong-local-pack:optional-models` **Strong Local Pack / Optional model add-ons** - 1/1 optional model add-ons are installed or release-ready.
- [x] `pack:strong-local-pack:managed-runtimes` **Strong Local Pack / Managed runtimes** - Approved managed runtime manifests are available for llama_cpp, piper, whisper_cpp.

### Production runtimes

- Status: **ready**
- Blockers: **0**
- Summary: Production runtime manifests are pinned and approved.

- [x] `runtime:llama-cpp-managed-runtime:source` **Managed llama.cpp Runtime / Source** - url source is pinned.
- [x] `runtime:llama-cpp-managed-runtime:checksum` **Managed llama.cpp Runtime / Checksum** - Runtime SHA-256 checksum is pinned.
- [x] `runtime:llama-cpp-managed-runtime:size` **Managed llama.cpp Runtime / File size** - 10547769 bytes recorded.
- [x] `runtime:llama-cpp-managed-runtime:license` **Managed llama.cpp Runtime / License** - MIT approved.
- [x] `runtime:llama-cpp-managed-runtime:license-artifact` **Managed llama.cpp Runtime / License artifact** - Runtime license artifact is pinned: https://github.com/ggml-org/llama.cpp/blob/b9596/LICENSE.
- [x] `runtime:llama-cpp-managed-runtime:release-approval` **Managed llama.cpp Runtime / Release approval** - Runtime release approved by Codex release evidence review on 2026-06-22.
- [x] `runtime:whisper-cpp-managed-runtime:source` **Managed whisper.cpp Runtime / Source** - url source is pinned.
- [x] `runtime:whisper-cpp-managed-runtime:checksum` **Managed whisper.cpp Runtime / Checksum** - Runtime SHA-256 checksum is pinned.
- [x] `runtime:whisper-cpp-managed-runtime:size` **Managed whisper.cpp Runtime / File size** - 1224375 bytes recorded.
- [x] `runtime:whisper-cpp-managed-runtime:license` **Managed whisper.cpp Runtime / License** - MIT approved.
- [x] `runtime:whisper-cpp-managed-runtime:license-artifact` **Managed whisper.cpp Runtime / License artifact** - Runtime license artifact is pinned: https://github.com/ggml-org/whisper.cpp/blob/v1.8.6/LICENSE.
- [x] `runtime:whisper-cpp-managed-runtime:release-approval` **Managed whisper.cpp Runtime / Release approval** - Runtime release approved by Codex release evidence review on 2026-06-22.
- [x] `runtime:piper-managed-runtime:source` **Managed Piper Runtime / Source** - url source is pinned.
- [x] `runtime:piper-managed-runtime:checksum` **Managed Piper Runtime / Checksum** - Runtime SHA-256 checksum is pinned.
- [x] `runtime:piper-managed-runtime:size` **Managed Piper Runtime / File size** - 19146957 bytes recorded.
- [x] `runtime:piper-managed-runtime:license` **Managed Piper Runtime / License** - MIT approved.
- [x] `runtime:piper-managed-runtime:license-artifact` **Managed Piper Runtime / License artifact** - Runtime license artifact is pinned: https://github.com/rhasspy/piper/blob/2023.11.14-2/LICENSE.md.
- [x] `runtime:piper-managed-runtime:release-approval` **Managed Piper Runtime / Release approval** - Runtime release approved by Codex release evidence review on 2026-06-22.

### Privacy boundary

- Status: **ready**
- Blockers: **0**
- Summary: Cloud fallback is blocked by default.

- [x] `privacy:local-only` **Local-only default** - All configured AI routes are local-only.

### Capability routes

- Status: **blocked**
- Blockers: **9**
- Summary: Required production capabilities are not fully mapped to approved local models.

- [ ] `capability:extract_objects` **extract_objects route** - extract_objects still uses the mock_llm demo provider.
  - Action: Route this capability to an approved local production model before release.
- [ ] `capability:extract_claims` **extract_claims route** - extract_claims still uses the mock_llm demo provider.
  - Action: Route this capability to an approved local production model before release.
- [ ] `capability:summarize` **summarize route** - summarize still uses the mock_llm demo provider.
  - Action: Route this capability to an approved local production model before release.
- [ ] `capability:generate_note` **generate_note route** - generate_note still uses the mock_llm demo provider.
  - Action: Route this capability to an approved local production model before release.
- [ ] `capability:grounded_answer` **grounded_answer route** - grounded_answer still uses the mock_llm demo provider.
  - Action: Route this capability to an approved local production model before release.
- [ ] `capability:create_learning_item` **create_learning_item route** - create_learning_item still uses the mock_llm demo provider.
  - Action: Route this capability to an approved local production model before release.
- [ ] `capability:embed_text` **embed_text route** - embed_text still uses the mock_embedding demo provider.
  - Action: Route this capability to an approved local production model before release.
- [ ] `capability:transcribe_audio` **transcribe_audio route** - transcribe_audio still uses the mock_stt demo provider.
  - Action: Route this capability to an approved local production model before release.
- [ ] `capability:synthesize_speech` **synthesize_speech route** - synthesize_speech still uses the mock_tts demo provider.
  - Action: Route this capability to an approved local production model before release.
- [ ] `capability:rerank_results` **rerank_results route** - rerank_results still uses the mock_reranker demo provider.
  - Action: Route this capability to an approved local production model before release.

## Next Release Gates

- [ ] Route this capability to an approved local production model before release.
