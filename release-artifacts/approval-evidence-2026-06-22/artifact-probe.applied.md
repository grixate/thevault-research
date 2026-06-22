# AI Registry Artifact Probe

- Status: **pass**
- Generated: `2026-06-22T05:41:07.687988+00:00`
- Structural validation: **pass**

## Sources

- Model registry: `vault-candidate-model-registry.hydrated.patched.patched.json`
- Runtime registry: `vault-candidate-runtime-registry.model-source-pins.patched.patched.json`

## Summary

| Metric | Value |
| --- | ---: |
| Artifacts | 13 |
| Checks | 55 |
| Passed | 55 |
| Warnings | 0 |
| Pending | 0 |
| Blocked | 0 |
| Validation errors | 0 |
| Validation warnings | 0 |

## Artifacts

### Tiny GGUF Local Model

- Type: `model`
- ID: `tiny-gguf-placeholder`
- Source type: `huggingface`
- Status: **pass**

- [x] `tiny-gguf-placeholder:files[0]:source` **Artifact source** - https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/23749fefcc72300e3a2ad315e1317431b06b590a/Qwen3-0.6B-Q8_0.gguf returned HTTP 200. Content-Length: 639446688 bytes.
- [x] `tiny-gguf-placeholder:files[0]:size` **Content length** - Remote Content-Length matches 639446688 bytes.
- [x] `tiny-gguf-placeholder:files[0]:sha256` **SHA-256 metadata** - Registry SHA-256 is pinned; remote source did not expose checksum metadata, so full download verification remains the final gate.
- [x] `tiny-gguf-placeholder:license` **License URL** - https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/blob/main/LICENSE returned HTTP 200. Content-Length: 296656 bytes.

### Standard GGUF Local Model

- Type: `model`
- ID: `standard-gguf-placeholder`
- Source type: `huggingface`
- Status: **pass**

- [x] `standard-gguf-placeholder:files[0]:source` **Artifact source** - https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/resolve/90862c4b9d2787eaed51d12237eafdfe7c5f6077/Qwen3-1.7B-Q8_0.gguf returned HTTP 200. Content-Length: 1834426016 bytes.
- [x] `standard-gguf-placeholder:files[0]:size` **Content length** - Remote Content-Length matches 1834426016 bytes.
- [x] `standard-gguf-placeholder:files[0]:sha256` **SHA-256 metadata** - Registry SHA-256 is pinned; remote source did not expose checksum metadata, so full download verification remains the final gate.
- [x] `standard-gguf-placeholder:license` **License URL** - https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/blob/main/LICENSE returned HTTP 200. Content-Length: 296834 bytes.

### Strong GGUF Local Model

- Type: `model`
- ID: `strong-gguf-placeholder`
- Source type: `huggingface`
- Status: **pass**

- [x] `strong-gguf-placeholder:files[0]:source` **Artifact source** - https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/7c41481f57cb95916b40956ab2f0b139b296d974/Qwen3-8B-Q4_K_M.gguf returned HTTP 200. Content-Length: 5027783488 bytes.
- [x] `strong-gguf-placeholder:files[0]:size` **Content length** - Remote Content-Length matches 5027783488 bytes.
- [x] `strong-gguf-placeholder:files[0]:sha256` **SHA-256 metadata** - Registry SHA-256 is pinned; remote source did not expose checksum metadata, so full download verification remains the final gate.
- [x] `strong-gguf-placeholder:license` **License URL** - https://huggingface.co/Qwen/Qwen3-8B-GGUF/blob/main/LICENSE returned HTTP 200. Content-Length: 301289 bytes.

### Tiny Production Embedding Model

- Type: `model`
- ID: `tiny-embedding-placeholder`
- Source type: `huggingface`
- Status: **pass**

- [x] `tiny-embedding-placeholder:files[0]:source` **Artifact source** - https://huggingface.co/Qwen/Qwen3-Embedding-0.6B/resolve/97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3/model.safetensors returned HTTP 200. Content-Length: 1191586416 bytes.
- [x] `tiny-embedding-placeholder:files[0]:size` **Content length** - Remote Content-Length matches 1191586416 bytes.
- [x] `tiny-embedding-placeholder:files[0]:sha256` **SHA-256 metadata** - Registry SHA-256 is pinned; remote source did not expose checksum metadata, so full download verification remains the final gate.
- [x] `tiny-embedding-placeholder:license` **License URL** - https://huggingface.co/Qwen/Qwen3-Embedding-0.6B/blob/main/README.md returned HTTP 200. Content-Length: 174060 bytes.

### Balanced Production Embedding Model

- Type: `model`
- ID: `balanced-embedding-placeholder`
- Source type: `huggingface`
- Status: **pass**

- [x] `balanced-embedding-placeholder:files[0]:source` **Artifact source** - https://huggingface.co/Qwen/Qwen3-Embedding-0.6B/resolve/97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3/model.safetensors returned HTTP 200. Content-Length: 1191586416 bytes.
- [x] `balanced-embedding-placeholder:files[0]:size` **Content length** - Remote Content-Length matches 1191586416 bytes.
- [x] `balanced-embedding-placeholder:files[0]:sha256` **SHA-256 metadata** - Registry SHA-256 is pinned; remote source did not expose checksum metadata, so full download verification remains the final gate.
- [x] `balanced-embedding-placeholder:license` **License URL** - https://huggingface.co/Qwen/Qwen3-Embedding-0.6B/blob/main/README.md returned HTTP 200. Content-Length: 174060 bytes.

### Tiny Production Reranker

- Type: `model`
- ID: `tiny-reranker-placeholder`
- Source type: `huggingface`
- Status: **pass**

- [x] `tiny-reranker-placeholder:files[0]:source` **Artifact source** - https://huggingface.co/Qwen/Qwen3-Reranker-0.6B/resolve/e61197ed45024b0ed8a2d74b80b4d909f1255473/model.safetensors returned HTTP 200. Content-Length: 1191588280 bytes.
- [x] `tiny-reranker-placeholder:files[0]:size` **Content length** - Remote Content-Length matches 1191588280 bytes.
- [x] `tiny-reranker-placeholder:files[0]:sha256` **SHA-256 metadata** - Registry SHA-256 is pinned; remote source did not expose checksum metadata, so full download verification remains the final gate.
- [x] `tiny-reranker-placeholder:license` **License URL** - https://huggingface.co/Qwen/Qwen3-Reranker-0.6B/blob/main/README.md returned HTTP 200. Content-Length: 158387 bytes.

### Balanced Production Reranker

- Type: `model`
- ID: `balanced-reranker-placeholder`
- Source type: `huggingface`
- Status: **pass**

- [x] `balanced-reranker-placeholder:files[0]:source` **Artifact source** - https://huggingface.co/Qwen/Qwen3-Reranker-0.6B/resolve/e61197ed45024b0ed8a2d74b80b4d909f1255473/model.safetensors returned HTTP 200. Content-Length: 1191588280 bytes.
- [x] `balanced-reranker-placeholder:files[0]:size` **Content length** - Remote Content-Length matches 1191588280 bytes.
- [x] `balanced-reranker-placeholder:files[0]:sha256` **SHA-256 metadata** - Registry SHA-256 is pinned; remote source did not expose checksum metadata, so full download verification remains the final gate.
- [x] `balanced-reranker-placeholder:license` **License URL** - https://huggingface.co/Qwen/Qwen3-Reranker-0.6B/blob/main/README.md returned HTTP 200. Content-Length: 158387 bytes.

### Tiny Production whisper.cpp Model

- Type: `model`
- ID: `tiny-whisper-placeholder`
- Source type: `huggingface`
- Status: **pass**

- [x] `tiny-whisper-placeholder:files[0]:source` **Artifact source** - https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-tiny.en.bin returned HTTP 200. Content-Length: 77704715 bytes.
- [x] `tiny-whisper-placeholder:files[0]:size` **Content length** - Remote Content-Length matches 77704715 bytes.
- [x] `tiny-whisper-placeholder:files[0]:sha256` **SHA-256 metadata** - Registry SHA-256 is pinned; remote source did not expose checksum metadata, so full download verification remains the final gate.
- [x] `tiny-whisper-placeholder:license` **License URL** - https://huggingface.co/ggerganov/whisper.cpp/blob/main/README.md returned HTTP 200. Content-Length: 89525 bytes.

### Production whisper.cpp Small Model

- Type: `model`
- ID: `standard-whisper-placeholder`
- Source type: `huggingface`
- Status: **pass**

- [x] `standard-whisper-placeholder:files[0]:source` **Artifact source** - https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.en.bin returned HTTP 200. Content-Length: 147964211 bytes.
- [x] `standard-whisper-placeholder:files[0]:size` **Content length** - Remote Content-Length matches 147964211 bytes.
- [x] `standard-whisper-placeholder:files[0]:sha256` **SHA-256 metadata** - Registry SHA-256 is pinned; remote source did not expose checksum metadata, so full download verification remains the final gate.
- [x] `standard-whisper-placeholder:license` **License URL** - https://huggingface.co/ggerganov/whisper.cpp/blob/main/README.md returned HTTP 200. Content-Length: 89525 bytes.

### Tiny Production Piper Voice

- Type: `model`
- ID: `tiny-piper-placeholder`
- Source type: `huggingface`
- Status: **pass**

- [x] `tiny-piper-placeholder:files[0]:source` **Artifact source** - https://huggingface.co/rhasspy/piper-voices/resolve/e21c7de8d4eab79b902f0d61e662b3f21664b8d2/en/en_US/amy/low/en_US-amy-low.onnx returned HTTP 200. Content-Length: 63104526 bytes.
- [x] `tiny-piper-placeholder:files[0]:size` **Content length** - Remote Content-Length matches 63104526 bytes.
- [x] `tiny-piper-placeholder:files[0]:sha256` **SHA-256 metadata** - Registry SHA-256 is pinned; remote source did not expose checksum metadata, so full download verification remains the final gate.
- [x] `tiny-piper-placeholder:files[1]:source` **Artifact source** - https://huggingface.co/rhasspy/piper-voices/resolve/e21c7de8d4eab79b902f0d61e662b3f21664b8d2/en/en_US/amy/low/en_US-amy-low.onnx.json returned HTTP 200. Content-Length: 4164 bytes.
- [x] `tiny-piper-placeholder:files[1]:size` **Content length** - Remote Content-Length matches 4164 bytes.
- [x] `tiny-piper-placeholder:files[1]:sha256` **SHA-256 metadata** - Registry SHA-256 is pinned; remote source did not expose checksum metadata, so full download verification remains the final gate.
- [x] `tiny-piper-placeholder:license` **License URL** - https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/amy/low/MODEL_CARD returned HTTP 200. Content-Length: 102183 bytes.

### Managed llama.cpp Runtime

- Type: `runtime`
- ID: `llama-cpp-managed-runtime`
- Source type: `url`
- Status: **pass**

- [x] `llama-cpp-managed-runtime:files[0]:source` **Artifact source** - https://github.com/ggml-org/llama.cpp/releases/download/b9596/llama-b9596-bin-macos-arm64.tar.gz returned HTTP 200. Content-Length: 10547769 bytes.
- [x] `llama-cpp-managed-runtime:files[0]:size` **Content length** - Remote Content-Length matches 10547769 bytes.
- [x] `llama-cpp-managed-runtime:files[0]:sha256` **SHA-256 metadata** - Registry SHA-256 is pinned; remote source did not expose checksum metadata, so full download verification remains the final gate.
- [x] `llama-cpp-managed-runtime:license` **License URL** - https://github.com/ggml-org/llama.cpp/blob/b9596/LICENSE returned HTTP 200.

### Managed whisper.cpp Runtime

- Type: `runtime`
- ID: `whisper-cpp-managed-runtime`
- Source type: `url`
- Status: **pass**

- [x] `whisper-cpp-managed-runtime:files[0]:source` **Artifact source** - https://raw.githubusercontent.com/grixate/thevault-research/c8c890ca3f1a3b6f10a74ca3b59f11e6a91f61bf/release-artifacts/whisper.cpp-v1.8.6-macos-arm64/whisper.cpp-v1.8.6-macos-arm64.tar.gz returned HTTP 200. Content-Length: 1224375 bytes.
- [x] `whisper-cpp-managed-runtime:files[0]:size` **Content length** - Remote Content-Length matches 1224375 bytes.
- [x] `whisper-cpp-managed-runtime:files[0]:sha256` **SHA-256 metadata** - Registry SHA-256 is pinned; remote source did not expose checksum metadata, so full download verification remains the final gate.
- [x] `whisper-cpp-managed-runtime:license` **License URL** - https://github.com/ggml-org/whisper.cpp/blob/v1.8.6/LICENSE returned HTTP 200.

### Managed Piper Runtime

- Type: `runtime`
- ID: `piper-managed-runtime`
- Source type: `url`
- Status: **pass**

- [x] `piper-managed-runtime:files[0]:source` **Artifact source** - https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_aarch64.tar.gz returned HTTP 200. Content-Length: 19146957 bytes.
- [x] `piper-managed-runtime:files[0]:size` **Content length** - Remote Content-Length matches 19146957 bytes.
- [x] `piper-managed-runtime:files[0]:sha256` **SHA-256 metadata** - Registry SHA-256 is pinned; remote source did not expose checksum metadata, so full download verification remains the final gate.
- [x] `piper-managed-runtime:license` **License URL** - https://github.com/rhasspy/piper/blob/2023.11.14-2/LICENSE.md returned HTTP 200.

## Next Actions

- [x] Candidate artifact sources and license URLs are reachable.
