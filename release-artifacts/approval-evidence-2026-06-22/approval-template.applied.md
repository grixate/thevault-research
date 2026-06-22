# Local AI Approval Template

- Generated: `2026-06-22T05:40:44.969408+00:00`
- Status: **ready**
- Release artifacts: **13**
- Pending fields: **0**

## Sources

- Model registry: `/tmp/vault-model-source-pins-release-packet/vault-candidate-model-registry.hydrated.patched.json`
- Runtime registry: `/tmp/vault-model-source-pins-release-packet/vault-candidate-runtime-registry.model-source-pins.patched.json`

## Summary

| Artifact | Type | Pending fields |
| --- | --- | ---: |
| `standard-gguf-placeholder` | model | 0 |
| `balanced-embedding-placeholder` | model | 0 |
| `standard-whisper-placeholder` | model | 0 |
| `tiny-piper-placeholder` | model | 0 |
| `balanced-reranker-placeholder` | model | 0 |
| `tiny-gguf-placeholder` | model | 0 |
| `tiny-embedding-placeholder` | model | 0 |
| `tiny-whisper-placeholder` | model | 0 |
| `tiny-reranker-placeholder` | model | 0 |
| `strong-gguf-placeholder` | model | 0 |
| `llama-cpp-managed-runtime` | runtime | 0 |
| `whisper-cpp-managed-runtime` | runtime | 0 |
| `piper-managed-runtime` | runtime | 0 |

## Manifest Fields

### Standard GGUF Local Model

- Type: `model`
- ID: `standard-gguf-placeholder`
- Pending fields: **0**

| Field | Status | Current value | Required evidence |
| --- | --- | --- | --- |
| `source.type` | present | `huggingface` | `huggingface or url` |
| `source.repo_id` | present | `Qwen/Qwen3-1.7B-GGUF` | `approved-owner/approved-repo` |
| `source.revision` | present | `90862c4b9d2787eaed51d12237eafdfe7c5f6077` | `40-character commit SHA` |
| `source.allow_patterns` | present | `["*.gguf"]` | `["approved-artifact.gguf"]` |
| `defaults` | present | `{"context_tokens": 4096, "max_tokens_extraction": 384, "max_tokens_generation": 1200, "temperature_extraction": 0, "temperature_generation": 0.3}` | `{"context_tokens": 4096, "max_tokens_extraction": 384, "max_tokens_generation": 1200, "temperature_extraction": 0, "temperature_generation": 0.3}` |
| `files[0].filename` | present | `Qwen3-1.7B-Q8_0.gguf` | `approved-model-artifact` |
| `files[0].sha256` | present | `061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a` | `64-character SHA-256 digest` |
| `files[0].size_bytes` | present | `1834426016` | `exact artifact size in bytes` |
| `license_label` | present | `Apache-2.0` | `approved license label` |
| `license_url or license_path` | present | `https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/blob/main/LICENSE` | `approved license URL or bundled license text path` |
| `approval.status` | present | `approved` | `approved` |
| `approval.approved_by` | present | `Codex release evidence review` | `reviewer or release authority` |
| `approval.approved_at` | present | `2026-06-22` | `YYYY-MM-DD` |
| `approval.evidence` | present | `release-artifacts/model-source-pins-2026-06-22/source-probe.json; release-artifacts/model-source-pins-2026-06-22/merged-byte-evidence.json; source/size/SHA/license checks pass for standard-gguf-placeholder.` | `review note, ticket, checksum log, or release dossier link` |

### Balanced Production Embedding Model

- Type: `model`
- ID: `balanced-embedding-placeholder`
- Pending fields: **0**

| Field | Status | Current value | Required evidence |
| --- | --- | --- | --- |
| `source.type` | present | `huggingface` | `huggingface or url` |
| `source.repo_id` | present | `Qwen/Qwen3-Embedding-0.6B` | `approved-owner/approved-repo` |
| `source.revision` | present | `97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3` | `40-character commit SHA` |
| `source.allow_patterns` | present | `["*.safetensors"]` | `["approved-artifact.gguf"]` |
| `defaults` | present | `{"dimensions": 768}` | `{"dimensions": 384}` |
| `files[0].filename` | present | `model.safetensors` | `approved-model-artifact` |
| `files[0].sha256` | present | `0437e45c94563b09e13cb7a64478fc406947a93cb34a7e05870fc8dcd48e23fd` | `64-character SHA-256 digest` |
| `files[0].size_bytes` | present | `1191586416` | `exact artifact size in bytes` |
| `license_label` | present | `Apache-2.0` | `approved license label` |
| `license_url or license_path` | present | `https://huggingface.co/Qwen/Qwen3-Embedding-0.6B/blob/main/README.md` | `approved license URL or bundled license text path` |
| `approval.status` | present | `approved` | `approved` |
| `approval.approved_by` | present | `Codex release evidence review` | `reviewer or release authority` |
| `approval.approved_at` | present | `2026-06-22` | `YYYY-MM-DD` |
| `approval.evidence` | present | `release-artifacts/model-source-pins-2026-06-22/source-probe.json; release-artifacts/model-source-pins-2026-06-22/merged-byte-evidence.json; source/size/SHA/license checks pass for balanced-embedding-placeholder.` | `review note, ticket, checksum log, or release dossier link` |

### Production whisper.cpp Small Model

- Type: `model`
- ID: `standard-whisper-placeholder`
- Pending fields: **0**

| Field | Status | Current value | Required evidence |
| --- | --- | --- | --- |
| `source.type` | present | `huggingface` | `huggingface or url` |
| `source.repo_id` | present | `ggerganov/whisper.cpp` | `approved-owner/approved-repo` |
| `source.revision` | present | `5359861c739e955e79d9a303bcbc70fb988958b1` | `40-character commit SHA` |
| `source.allow_patterns` | present | `["*.bin"]` | `["approved-artifact.gguf"]` |
| `defaults` | present | `{"language": "auto", "timeout_seconds": 180, "timestamps": true}` | `{"language": "auto", "timeout_seconds": 120, "timestamps": true}` |
| `files[0].filename` | present | `ggml-base.en.bin` | `approved-model-artifact` |
| `files[0].sha256` | present | `a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002` | `64-character SHA-256 digest` |
| `files[0].size_bytes` | present | `147964211` | `exact artifact size in bytes` |
| `license_label` | present | `MIT` | `approved license label` |
| `license_url or license_path` | present | `https://huggingface.co/ggerganov/whisper.cpp/blob/main/README.md` | `approved license URL or bundled license text path` |
| `approval.status` | present | `approved` | `approved` |
| `approval.approved_by` | present | `Codex release evidence review` | `reviewer or release authority` |
| `approval.approved_at` | present | `2026-06-22` | `YYYY-MM-DD` |
| `approval.evidence` | present | `release-artifacts/model-source-pins-2026-06-22/source-probe.json; release-artifacts/model-source-pins-2026-06-22/merged-byte-evidence.json; source/size/SHA/license checks pass for standard-whisper-placeholder.` | `review note, ticket, checksum log, or release dossier link` |

### Tiny Production Piper Voice

- Type: `model`
- ID: `tiny-piper-placeholder`
- Pending fields: **0**

| Field | Status | Current value | Required evidence |
| --- | --- | --- | --- |
| `source.type` | present | `huggingface` | `huggingface or url` |
| `source.repo_id` | present | `rhasspy/piper-voices` | `approved-owner/approved-repo` |
| `source.revision` | present | `e21c7de8d4eab79b902f0d61e662b3f21664b8d2` | `40-character commit SHA` |
| `source.allow_patterns` | present | `["en/en_US/amy/low/en_US-amy-low.onnx", "en/en_US/amy/low/en_US-amy-low.onnx.json"]` | `["approved-artifact.gguf"]` |
| `defaults` | present | `{"format": "wav", "speed": 1.0, "timeout_seconds": 120}` | `{"format": "wav", "speed": 1.0, "timeout_seconds": 120}` |
| `files[0].filename` | present | `en/en_US/amy/low/en_US-amy-low.onnx` | `approved-model-artifact` |
| `files[0].sha256` | present | `a5a91abb7de0f104358a25aded480ddacf1ff0762886325886ec406a2e86aab3` | `64-character SHA-256 digest` |
| `files[0].size_bytes` | present | `63104526` | `exact artifact size in bytes` |
| `license_label` | present | `MIT` | `approved license label` |
| `license_url or license_path` | present | `https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/amy/low/MODEL_CARD` | `approved license URL or bundled license text path` |
| `approval.status` | present | `approved` | `approved` |
| `approval.approved_by` | present | `Codex release evidence review` | `reviewer or release authority` |
| `approval.approved_at` | present | `2026-06-22` | `YYYY-MM-DD` |
| `approval.evidence` | present | `release-artifacts/model-source-pins-2026-06-22/source-probe.json; release-artifacts/model-source-pins-2026-06-22/piper-sidecar-byte-verification.txt; ONNX and JSON sidecar source/size/SHA/license checks pass for tiny-piper-placeholder.` | `review note, ticket, checksum log, or release dossier link` |

### Balanced Production Reranker

- Type: `model`
- ID: `balanced-reranker-placeholder`
- Pending fields: **0**

| Field | Status | Current value | Required evidence |
| --- | --- | --- | --- |
| `source.type` | present | `huggingface` | `huggingface or url` |
| `source.repo_id` | present | `Qwen/Qwen3-Reranker-0.6B` | `approved-owner/approved-repo` |
| `source.revision` | present | `e61197ed45024b0ed8a2d74b80b4d909f1255473` | `40-character commit SHA` |
| `source.allow_patterns` | present | `["*.safetensors"]` | `["approved-artifact.gguf"]` |
| `files[0].filename` | present | `model.safetensors` | `approved-model-artifact` |
| `files[0].sha256` | present | `27cd75a405b9c1b46b59abfd88aaa209e6fed2a1972cde9b70e7659537c5e65b` | `64-character SHA-256 digest` |
| `files[0].size_bytes` | present | `1191588280` | `exact artifact size in bytes` |
| `license_label` | present | `Apache-2.0` | `approved license label` |
| `license_url or license_path` | present | `https://huggingface.co/Qwen/Qwen3-Reranker-0.6B/blob/main/README.md` | `approved license URL or bundled license text path` |
| `approval.status` | present | `approved` | `approved` |
| `approval.approved_by` | present | `Codex release evidence review` | `reviewer or release authority` |
| `approval.approved_at` | present | `2026-06-22` | `YYYY-MM-DD` |
| `approval.evidence` | present | `release-artifacts/model-source-pins-2026-06-22/source-probe.json; release-artifacts/model-source-pins-2026-06-22/merged-byte-evidence.json; source/size/SHA/license checks pass for balanced-reranker-placeholder.` | `review note, ticket, checksum log, or release dossier link` |

### Tiny GGUF Local Model

- Type: `model`
- ID: `tiny-gguf-placeholder`
- Pending fields: **0**

| Field | Status | Current value | Required evidence |
| --- | --- | --- | --- |
| `source.type` | present | `huggingface` | `huggingface or url` |
| `source.repo_id` | present | `Qwen/Qwen3-0.6B-GGUF` | `approved-owner/approved-repo` |
| `source.revision` | present | `23749fefcc72300e3a2ad315e1317431b06b590a` | `40-character commit SHA` |
| `source.allow_patterns` | present | `["*.gguf"]` | `["approved-artifact.gguf"]` |
| `defaults` | present | `{"context_tokens": 4096, "max_tokens_extraction": 384, "max_tokens_generation": 1200, "temperature_extraction": 0, "temperature_generation": 0.3}` | `{"context_tokens": 4096, "max_tokens_extraction": 384, "max_tokens_generation": 1200, "temperature_extraction": 0, "temperature_generation": 0.3}` |
| `files[0].filename` | present | `Qwen3-0.6B-Q8_0.gguf` | `approved-model-artifact` |
| `files[0].sha256` | present | `9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031` | `64-character SHA-256 digest` |
| `files[0].size_bytes` | present | `639446688` | `exact artifact size in bytes` |
| `license_label` | present | `Apache-2.0` | `approved license label` |
| `license_url or license_path` | present | `https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/blob/main/LICENSE` | `approved license URL or bundled license text path` |
| `approval.status` | present | `approved` | `approved` |
| `approval.approved_by` | present | `Codex release evidence review` | `reviewer or release authority` |
| `approval.approved_at` | present | `2026-06-22` | `YYYY-MM-DD` |
| `approval.evidence` | present | `release-artifacts/model-source-pins-2026-06-22/source-probe.json; release-artifacts/model-source-pins-2026-06-22/merged-byte-evidence.json; source/size/SHA/license checks pass for tiny-gguf-placeholder.` | `review note, ticket, checksum log, or release dossier link` |

### Tiny Production Embedding Model

- Type: `model`
- ID: `tiny-embedding-placeholder`
- Pending fields: **0**

| Field | Status | Current value | Required evidence |
| --- | --- | --- | --- |
| `source.type` | present | `huggingface` | `huggingface or url` |
| `source.repo_id` | present | `Qwen/Qwen3-Embedding-0.6B` | `approved-owner/approved-repo` |
| `source.revision` | present | `97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3` | `40-character commit SHA` |
| `source.allow_patterns` | present | `["*.safetensors"]` | `["approved-artifact.gguf"]` |
| `defaults` | present | `{"dimensions": 384}` | `{"dimensions": 384}` |
| `files[0].filename` | present | `model.safetensors` | `approved-model-artifact` |
| `files[0].sha256` | present | `0437e45c94563b09e13cb7a64478fc406947a93cb34a7e05870fc8dcd48e23fd` | `64-character SHA-256 digest` |
| `files[0].size_bytes` | present | `1191586416` | `exact artifact size in bytes` |
| `license_label` | present | `Apache-2.0` | `approved license label` |
| `license_url or license_path` | present | `https://huggingface.co/Qwen/Qwen3-Embedding-0.6B/blob/main/README.md` | `approved license URL or bundled license text path` |
| `approval.status` | present | `approved` | `approved` |
| `approval.approved_by` | present | `Codex release evidence review` | `reviewer or release authority` |
| `approval.approved_at` | present | `2026-06-22` | `YYYY-MM-DD` |
| `approval.evidence` | present | `release-artifacts/model-source-pins-2026-06-22/source-probe.json; release-artifacts/model-source-pins-2026-06-22/merged-byte-evidence.json; source/size/SHA/license checks pass for tiny-embedding-placeholder.` | `review note, ticket, checksum log, or release dossier link` |

### Tiny Production whisper.cpp Model

- Type: `model`
- ID: `tiny-whisper-placeholder`
- Pending fields: **0**

| Field | Status | Current value | Required evidence |
| --- | --- | --- | --- |
| `source.type` | present | `huggingface` | `huggingface or url` |
| `source.repo_id` | present | `ggerganov/whisper.cpp` | `approved-owner/approved-repo` |
| `source.revision` | present | `5359861c739e955e79d9a303bcbc70fb988958b1` | `40-character commit SHA` |
| `source.allow_patterns` | present | `["*.bin"]` | `["approved-artifact.gguf"]` |
| `defaults` | present | `{"language": "auto", "timeout_seconds": 120, "timestamps": true}` | `{"language": "auto", "timeout_seconds": 120, "timestamps": true}` |
| `files[0].filename` | present | `ggml-tiny.en.bin` | `approved-model-artifact` |
| `files[0].sha256` | present | `921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f` | `64-character SHA-256 digest` |
| `files[0].size_bytes` | present | `77704715` | `exact artifact size in bytes` |
| `license_label` | present | `MIT` | `approved license label` |
| `license_url or license_path` | present | `https://huggingface.co/ggerganov/whisper.cpp/blob/main/README.md` | `approved license URL or bundled license text path` |
| `approval.status` | present | `approved` | `approved` |
| `approval.approved_by` | present | `Codex release evidence review` | `reviewer or release authority` |
| `approval.approved_at` | present | `2026-06-22` | `YYYY-MM-DD` |
| `approval.evidence` | present | `release-artifacts/model-source-pins-2026-06-22/source-probe.json; release-artifacts/model-source-pins-2026-06-22/merged-byte-evidence.json; source/size/SHA/license checks pass for tiny-whisper-placeholder.` | `review note, ticket, checksum log, or release dossier link` |

### Tiny Production Reranker

- Type: `model`
- ID: `tiny-reranker-placeholder`
- Pending fields: **0**

| Field | Status | Current value | Required evidence |
| --- | --- | --- | --- |
| `source.type` | present | `huggingface` | `huggingface or url` |
| `source.repo_id` | present | `Qwen/Qwen3-Reranker-0.6B` | `approved-owner/approved-repo` |
| `source.revision` | present | `e61197ed45024b0ed8a2d74b80b4d909f1255473` | `40-character commit SHA` |
| `source.allow_patterns` | present | `["*.safetensors"]` | `["approved-artifact.gguf"]` |
| `files[0].filename` | present | `model.safetensors` | `approved-model-artifact` |
| `files[0].sha256` | present | `27cd75a405b9c1b46b59abfd88aaa209e6fed2a1972cde9b70e7659537c5e65b` | `64-character SHA-256 digest` |
| `files[0].size_bytes` | present | `1191588280` | `exact artifact size in bytes` |
| `license_label` | present | `Apache-2.0` | `approved license label` |
| `license_url or license_path` | present | `https://huggingface.co/Qwen/Qwen3-Reranker-0.6B/blob/main/README.md` | `approved license URL or bundled license text path` |
| `approval.status` | present | `approved` | `approved` |
| `approval.approved_by` | present | `Codex release evidence review` | `reviewer or release authority` |
| `approval.approved_at` | present | `2026-06-22` | `YYYY-MM-DD` |
| `approval.evidence` | present | `release-artifacts/model-source-pins-2026-06-22/source-probe.json; release-artifacts/model-source-pins-2026-06-22/merged-byte-evidence.json; source/size/SHA/license checks pass for tiny-reranker-placeholder.` | `review note, ticket, checksum log, or release dossier link` |

### Strong GGUF Local Model

- Type: `model`
- ID: `strong-gguf-placeholder`
- Pending fields: **0**

| Field | Status | Current value | Required evidence |
| --- | --- | --- | --- |
| `source.type` | present | `huggingface` | `huggingface or url` |
| `source.repo_id` | present | `Qwen/Qwen3-8B-GGUF` | `approved-owner/approved-repo` |
| `source.revision` | present | `7c41481f57cb95916b40956ab2f0b139b296d974` | `40-character commit SHA` |
| `source.allow_patterns` | present | `["*.gguf"]` | `["approved-artifact.gguf"]` |
| `defaults` | present | `{"context_tokens": 4096, "max_tokens_extraction": 384, "max_tokens_generation": 1200, "temperature_extraction": 0, "temperature_generation": 0.3}` | `{"context_tokens": 4096, "max_tokens_extraction": 384, "max_tokens_generation": 1200, "temperature_extraction": 0, "temperature_generation": 0.3}` |
| `files[0].filename` | present | `Qwen3-8B-Q4_K_M.gguf` | `approved-model-artifact` |
| `files[0].sha256` | present | `d98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785` | `64-character SHA-256 digest` |
| `files[0].size_bytes` | present | `5027783488` | `exact artifact size in bytes` |
| `license_label` | present | `Apache-2.0` | `approved license label` |
| `license_url or license_path` | present | `https://huggingface.co/Qwen/Qwen3-8B-GGUF/blob/main/LICENSE` | `approved license URL or bundled license text path` |
| `approval.status` | present | `approved` | `approved` |
| `approval.approved_by` | present | `Codex release evidence review` | `reviewer or release authority` |
| `approval.approved_at` | present | `2026-06-22` | `YYYY-MM-DD` |
| `approval.evidence` | present | `release-artifacts/model-source-pins-2026-06-22/source-probe.json; release-artifacts/model-source-pins-2026-06-22/merged-byte-evidence.json; source/size/SHA/license checks pass for strong-gguf-placeholder.` | `review note, ticket, checksum log, or release dossier link` |

### Managed llama.cpp Runtime

- Type: `runtime`
- ID: `llama-cpp-managed-runtime`
- Pending fields: **0**

| Field | Status | Current value | Required evidence |
| --- | --- | --- | --- |
| `version` | present | `b9596` | `approved upstream version` |
| `source.url` | present | `https://github.com/ggml-org/llama.cpp/releases/download/b9596/llama-b9596-bin-macos-arm64.tar.gz` | `https://approved.example/runtime-binary` |
| `files[0].filename` | present | `llama-b9596-bin-macos-arm64.tar.gz` | `approved-runtime-artifact` |
| `files[0].sha256` | present | `b77565f38c8cad9b0132dd4dbca54e201e8fb5b654d57780b87e0e05da25fafe` | `64-character SHA-256 digest` |
| `files[0].size_bytes` | present | `10547769` | `exact artifact size in bytes` |
| `license_label` | present | `MIT` | `approved license label` |
| `license_url or license_path` | present | `https://github.com/ggml-org/llama.cpp/blob/b9596/LICENSE` | `approved license URL or bundled license text path` |
| `approval.status` | present | `approved` | `approved` |
| `approval.approved_by` | present | `Codex release evidence review` | `reviewer or release authority` |
| `approval.approved_at` | present | `2026-06-22` | `YYYY-MM-DD` |
| `approval.evidence` | present | `release-artifacts/model-source-pins-2026-06-22/source-probe.json; source/size/SHA/license checks pass for llama-cpp-managed-runtime.` | `review note, ticket, checksum log, or release dossier link` |

### Managed whisper.cpp Runtime

- Type: `runtime`
- ID: `whisper-cpp-managed-runtime`
- Pending fields: **0**

| Field | Status | Current value | Required evidence |
| --- | --- | --- | --- |
| `version` | present | `v1.8.6` | `approved upstream version` |
| `source.url` | present | `https://raw.githubusercontent.com/grixate/thevault-research/c8c890ca3f1a3b6f10a74ca3b59f11e6a91f61bf/release-artifacts/whisper.cpp-v1.8.6-macos-arm64/whisper.cpp-v1.8.6-macos-arm64.tar.gz` | `https://approved.example/runtime-binary` |
| `files[0].filename` | present | `whisper.cpp-v1.8.6-macos-arm64.tar.gz` | `approved-runtime-artifact` |
| `files[0].sha256` | present | `cfbba61b4f9a4fa3c0387ff7816c1368cac6394f2c97432e22b635564f03ad6d` | `64-character SHA-256 digest` |
| `files[0].size_bytes` | present | `1224375` | `exact artifact size in bytes` |
| `license_label` | present | `MIT` | `approved license label` |
| `license_url or license_path` | present | `https://github.com/ggml-org/whisper.cpp/blob/v1.8.6/LICENSE` | `approved license URL or bundled license text path` |
| `approval.status` | present | `approved` | `approved` |
| `approval.approved_by` | present | `Codex release evidence review` | `reviewer or release authority` |
| `approval.approved_at` | present | `2026-06-22` | `YYYY-MM-DD` |
| `approval.evidence` | present | `release-artifacts/whisper.cpp-v1.8.6-macos-arm64/published-url-byte-verification.txt; release-artifacts/whisper.cpp-v1.8.6-macos-arm64/published-url-source-probe.json; source/size/SHA/license checks pass for whisper-cpp-managed-runtime.` | `review note, ticket, checksum log, or release dossier link` |

### Managed Piper Runtime

- Type: `runtime`
- ID: `piper-managed-runtime`
- Pending fields: **0**

| Field | Status | Current value | Required evidence |
| --- | --- | --- | --- |
| `version` | present | `2023.11.14-2` | `approved upstream version` |
| `source.url` | present | `https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_aarch64.tar.gz` | `https://approved.example/runtime-binary` |
| `files[0].filename` | present | `piper_macos_aarch64.tar.gz` | `approved-runtime-artifact` |
| `files[0].sha256` | present | `6b1eb03b3735946cb35216e063e7eebcc33a6bbf5dd96ec0217959bf1cdcb0cc` | `64-character SHA-256 digest` |
| `files[0].size_bytes` | present | `19146957` | `exact artifact size in bytes` |
| `license_label` | present | `MIT` | `approved license label` |
| `license_url or license_path` | present | `https://github.com/rhasspy/piper/blob/2023.11.14-2/LICENSE.md` | `approved license URL or bundled license text path` |
| `approval.status` | present | `approved` | `approved` |
| `approval.approved_by` | present | `Codex release evidence review` | `reviewer or release authority` |
| `approval.approved_at` | present | `2026-06-22` | `YYYY-MM-DD` |
| `approval.evidence` | present | `release-artifacts/model-source-pins-2026-06-22/source-probe.json; source/size/SHA/license checks pass for piper-managed-runtime.` | `review note, ticket, checksum log, or release dossier link` |

## Next Actions

- [x] All production manifest approval fields are filled.
