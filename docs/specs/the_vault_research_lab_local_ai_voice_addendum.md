# The Vault Research Lab — Local AI and Voice Addendum

**Document version:** 0.2 addendum  
**Date:** 2026-06-03  
**Purpose:** Make downloadable local AI a first-class subsystem of The Vault Research Lab, including small local LLMs, embeddings, rerankers, local speech-to-text, local text-to-speech, and optional cloud voice providers.

### 39.1 Product requirement

The Vault must work without cloud AI by default.

The alpha must support downloadable small local models that can run on ordinary laptops and desktops. The user should not need to understand model formats, quantization, command-line flags, or GPU settings to get useful local AI behavior.

The system must provide:

- a local model manager,
- downloadable model packs,
- capability-based model routing,
- local structured extraction,
- local note generation,
- local embeddings,
- optional local reranking,
- local voice transcription,
- local text-to-speech,
- optional cloud providers, disabled by default,
- privacy controls showing when data leaves the machine.

Important framing:

```text
Electron = cockpit
Vault Core = research operating system
Local AI runtime = private engine room
Python Tool Studio = lab bench
Voice layer = microphone and narrator
```

Do not implement local AI as a single hard-coded model path. Implement it as a model/runtime subsystem.

---

### 39.2 Non-goals for local AI alpha

Do not build these in the first local AI milestone:

- cloud AI enabled by default,
- automatic download of models with unclear licenses,
- silent switching from local to cloud,
- voice cloning,
- celebrity or third-party voice imitation,
- autonomous installation of model files from arbitrary URLs,
- model fine-tuning UI,
- GPU-specific optimization UI beyond automatic detection,
- multimodal vision model workflow unless a later milestone explicitly adds it,
- agent self-modification of model registry or provider permissions.

Generated output from any local model remains untrusted until validated.

---

### 39.3 Architecture overview

Add a dedicated AI subsystem under Vault Core.

```text
services/core/vault_core/ai/
  providers/
    base.py
    mock_llm.py
    llama_cpp_cli.py
    llama_cpp_server.py
    openai_compatible.py
    ollama_adapter.py
    lmstudio_adapter.py
  models/
    registry.py
    downloader.py
    hardware.py
    installer.py
    storage.py
    health.py
    selectors.py
  embeddings/
    base.py
    mock.py
    sentence_transformer.py
    llama_cpp_embeddings.py
  rerankers/
    base.py
    mock.py
    local_cross_encoder.py
  voice/
    stt_base.py
    whisper_cpp.py
    qwen_asr.py
    tts_base.py
    piper.py
    kokoro.py
    elevenlabs.py
  prompts/
    extraction_object_v1.md
    note_generation_v1.md
    grounded_answer_v1.md
    learning_generation_v1.md
  grammars/
    VaultObjectExtraction.gbnf
    VaultClaimExtraction.gbnf
    VaultNotePlan.gbnf
```

Electron should not directly call local model binaries except during very small smoke checks. The renderer calls Vault Core through existing typed APIs. Vault Core owns model state, downloads, inference routing, and privacy controls.

---

### 39.4 Core design: capability routing

The user should choose a simple profile, not a dozen individual models.

Recommended capability names:

```text
extract_objects
extract_claims
summarize
generate_note
grounded_answer
create_learning_item
embed_text
rerank_results
transcribe_audio
synthesize_speech
```

Each capability resolves to a provider and model.

Example:

```json
{
  "capability": "extract_claims",
  "provider": "llama_cpp_cli",
  "model_id": "gemma-4-e2b-it-q4",
  "grammar": "VaultObjectExtraction.gbnf",
  "temperature": 0,
  "max_tokens": 384,
  "requires_validation": true
}
```

Routing rules:

1. Prefer local providers.
2. Never fall back to cloud without explicit user consent.
3. If the selected local model is unavailable, show a repair action.
4. If a task is too large for the active model, split the task or create a reviewable warning.
5. Use larger optional models only when installed and selected.
6. Use deterministic settings for extraction and graph mutation proposals.
7. Allow more creative settings only for note drafting and learning generation.

---

### 39.5 Model profiles

Add three user-facing profiles.

#### Tiny profile

Purpose: almost any machine, low RAM, CPU-friendly.

Use for:

- object extraction,
- basic summarization,
- simple note drafting,
- flashcard generation,
- local embeddings.

Expected behavior:

- slower but usable,
- short context windows,
- chunk-first processing,
- conservative extraction,
- more validation rejections.

#### Standard profile

Purpose: modern laptop, Apple Silicon, decent Intel/AMD desktop.

Use for:

- normal extraction,
- claim generation,
- grounded answering,
- generated note drafts,
- learning mode.

Expected behavior:

- best alpha default,
- good balance between speed and quality,
- still fully local.

#### Strong local profile

Purpose: powerful laptop/workstation.

Use for:

- longer context research synthesis,
- larger claim clusters,
- better contradiction detection,
- richer learning generation.

Expected behavior:

- optional install,
- not required for the app to be useful,
- never assumed in tests.

---

### 39.6 Recommended local model candidates

The registry must be updateable. Treat this list as defaults, not as eternal truth carved into granite.

#### Default text generation / extraction candidates

Use GGUF quantized variants where available.

```text
Tier A: tiny fallback
- Qwen3 0.6B Instruct or equivalent small instruct model
- Purpose: smoke tests, tiny machines, fast utility tasks

Tier B: default alpha extractor
- Gemma 4 E2B instruction model, quantized Q4_K_M or equivalent
- Purpose: object extraction, claim extraction, short note generation

Tier C: stronger local default
- Qwen3 1.7B / 4B Instruct or Gemma 4 E4B quantized
- Purpose: stronger grounded answer and learning generation

Tier D: optional power user
- 7B/8B-class instruct model in GGUF
- Purpose: long synthesis and more robust reasoning, not required for alpha
```

Implementation notes:

- Do not bundle large model weights inside the app installer.
- Ship a small model registry and downloader.
- Let the user download one model pack during onboarding.
- Provide one tiny built-in mock provider for tests and demo mode.
- Use quantized GGUF models for llama.cpp.
- Store model files outside the app bundle in the application data directory.
- Track file size, quantization, license, checksum, and capability suitability.

#### Embedding candidates

```text
Tiny English-first:
- sentence-transformers/all-MiniLM-L6-v2 or equivalent

Balanced local:
- nomic-embed-text-v1.5 GGUF where llama.cpp integration is preferred

Multilingual / Russian-friendly:
- BAAI/bge-m3
- Qwen3-Embedding-0.6B when available and practical
```

Rules:

- Embedding dimensions must be stored with each embedding row.
- The system must support multiple embedding spaces over time.
- Re-embedding should be a background job with progress and cancelation.
- Changing embedding model must not destroy previous embeddings until the new index is complete.

#### Reranker candidates

Alpha may skip reranking. When added, implement it as optional.

```text
rerank_results capability:
- local cross-encoder or lightweight reranker
- optional Qwen3 reranker family model where practical
- fallback: lexical + vector hybrid scoring
```

Do not block alpha on reranking.

---

### 39.7 Local runtime strategy

Use a layered runtime strategy.

#### Primary alpha runtime: llama.cpp

Use llama.cpp for GGUF models because it supports CPU and GPU execution across common desktop hardware and supports constrained generation through GBNF grammars.

Use two modes:

```text
llama_cpp_cli:
- best for strict extraction jobs
- starts per job or uses small warm pool
- accepts grammar files
- easy to isolate and log

llama_cpp_server:
- best for chat, generated notes, embeddings, interactive tasks
- local HTTP server on 127.0.0.1
- OpenAI-compatible endpoints when available
```

#### Secondary runtime adapters

Support these as optional adapters, not as the core dependency:

```text
ollama_adapter:
- useful if user already has Ollama
- external local process
- OpenAI-like or native API where available

lmstudio_adapter:
- useful for developers/power users
- external local process
- OpenAI-compatible endpoint

openai_compatible:
- cloud or local OpenAI-compatible endpoints
- disabled by default
- requires explicit user opt-in
```

Do not make The Vault depend on Ollama or LM Studio for first-run local AI. They are convenient bridges, not the foundation.

---

### 39.8 Hardware detection

Add `HardwareProfileService`.

Fields:

```python
class HardwareProfile(BaseModel):
    os: Literal["macos", "windows", "linux"]
    arch: Literal["arm64", "x64", "unknown"]
    cpu_brand: str | None
    physical_ram_gb: float | None
    available_ram_gb: float | None
    apple_silicon: bool
    metal_available: bool
    cuda_available: bool
    rocm_available: bool
    vulkan_available: bool
    recommended_profile: Literal["tiny", "standard", "strong"]
    warnings: list[str]
```

Detection should be best-effort. Do not fail app startup if GPU detection fails.

Use hardware profile for:

- recommended model pack,
- default context size,
- number of threads,
- GPU layers,
- memory warnings,
- voice model selection.

---

### 39.9 Model registry

Create:

```text
services/core/vault_core/ai/models/model_registry.json
```

Example schema:

```json
{
  "schema_version": 1,
  "models": [
    {
      "id": "gemma-4-e2b-it-q4",
      "display_name": "Gemma 4 E2B Instruct Q4",
      "family": "gemma",
      "kind": "llm",
      "capabilities": ["extract_objects", "extract_claims", "summarize", "generate_note"],
      "runtime": "llama_cpp",
      "format": "gguf",
      "size_class": "small",
      "recommended_profile": "standard",
      "languages": ["en", "ru"],
      "license_label": "check upstream model card",
      "source": {
        "type": "huggingface",
        "repo_id": "REPLACE_WITH_APPROVED_GGUF_REPO",
        "allow_patterns": ["*.gguf"]
      },
      "files": [
        {
          "filename": "REPLACE_WITH_APPROVED_FILE.gguf",
          "sha256": "REQUIRED_BEFORE_RELEASE",
          "size_bytes": null
        }
      ],
      "defaults": {
        "context_tokens": 4096,
        "temperature_extraction": 0,
        "temperature_generation": 0.4,
        "max_tokens_extraction": 384,
        "max_tokens_generation": 1200
      }
    }
  ]
}
```

Rules:

- Every downloadable model must have explicit registry metadata.
- Every release registry must include checksums for direct downloads.
- Registry updates must be signed or pinned by app version before automatic use.
- The user may import a local GGUF manually, but imported models start as untrusted and unavailable for canonical extraction until tested.
- Do not allow arbitrary remote model URLs in alpha.

---

### 39.10 Model storage

Use OS-specific application data path.

```text
VaultData/
  models/
    llm/
      {model_id}/
        model.gguf
        manifest.json
        license.txt
        download.log
    embeddings/
      {model_id}/
    voice/
      stt/
      tts/
  ai_runtime/
    llama_cpp/
      bin/
      logs/
  cache/
    model_downloads/
```

Do not store model files inside the Electron app bundle. App updates must not delete user-downloaded models.

---

### 39.11 Model download flow

User-facing flow:

```text
First Run AI Setup
1. Choose mode: Local only / Local + optional cloud later.
2. Hardware scan recommends Tiny / Standard / Strong.
3. Show model pack options with disk size and privacy labels.
4. User clicks Download.
5. Download progress appears.
6. Verify checksum.
7. Run a tiny health prompt.
8. Mark model ready.
```

Download states:

```text
not_installed
queued
downloading
paused
verifying
installed
failed
needs_license_action
update_available
```

Backend endpoints:

```text
GET    /ai/hardware
GET    /ai/models/registry
GET    /ai/models/installed
POST   /ai/models/download
POST   /ai/models/download/{download_id}/pause
POST   /ai/models/download/{download_id}/resume
POST   /ai/models/download/{download_id}/cancel
POST   /ai/models/{model_id}/verify
POST   /ai/models/{model_id}/select
POST   /ai/models/{model_id}/test
POST   /ai/models/{model_id}/unload
GET    /ai/capabilities
PATCH  /ai/capabilities/{capability}
```

Electron UI screens:

```text
Settings → AI Models
- local model status
- installed models
- selected model per capability
- disk usage
- privacy mode
- download queue
- runtime health
```

---

### 39.12 Local inference job model

Add database table:

```sql
CREATE TABLE ai_model_runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  prompt_id TEXT,
  input_hash TEXT NOT NULL,
  output_hash TEXT,
  status TEXT NOT NULL,
  error TEXT,
  duration_ms INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  validation_status TEXT,
  local_only BOOLEAN NOT NULL DEFAULT 1,
  sent_off_device BOOLEAN NOT NULL DEFAULT 0
);
```

Never store full prompts by default if they may contain private user content. Store hashes and optional debug traces only when developer logging is explicitly enabled.

---

### 39.13 Structured local extraction

Keep the previous Vault decision:

```text
Use hand-written GBNF grammar for local llama.cpp extraction.
Do not rely on JSON-schema-generated grammar as the default path.
Keep the validator as the trust gate.
```

Required files:

```text
services/core/vault_core/ai/grammars/VaultObjectExtraction.gbnf
services/core/vault_core/ai/prompts/extraction_object_v1.md
services/core/vault_core/ai/validators/object_extraction.py
```

Required validator checks:

```text
- JSON parses
- schema matches exactly
- object type is allowed
- confidence is between 0 and 1
- source_quote is exact substring of source block
- source block exists
- generated title/summary length is bounded
- no duplicate object for same source quote and type
- no canonical graph write before review approval
```

For Russian and English:

- Use Unicode-safe string handling.
- Do not create separate English/Russian grammars unless the JSON shape truly changes.
- Language-specific behavior belongs in prompt text and validators, not grammar structure.

---

### 39.14 Generated notes as first-class local AI capability

The user must be able to write notes and generate notes.

Generated notes are not disposable chat messages. They are source-like drafts with provenance.

Add note generation modes:

```text
Generate from source:
- summarize this PDF/article/transcript into a note
- extract practical checklist from this source
- create research memo from selected blocks

Generate from graph:
- create a note from this claim cluster
- write a concept explainer from approved claims only
- create contradiction memo

Generate from learning:
- create a lesson
- create flashcards
- create quiz
- create practice plan

Generate from user instruction:
- draft a new note using selected context
- continue this note
- rewrite selected passage
```

Generated note metadata:

```json
{
  "generation_status": "draft",
  "generated_by": "local_ai",
  "model_id": "gemma-4-e2b-it-q4",
  "capability": "generate_note",
  "source_ids": ["source_123"],
  "claim_ids": ["claim_456"],
  "citation_policy": "required_for_factual_claims",
  "requires_review": true
}
```

UI requirements:

- Generated note opens in editor as a draft.
- Citation chips show source blocks and claims.
- User can approve as normal note, edit, reject, or regenerate.
- Any newly introduced factual claims in generated notes must become review items unless backed by selected source evidence.
- Generated notes may become sources after approval.

---

### 39.15 Grounded answering model policy

For grounded answers:

1. Retrieve candidate source blocks and approved claims.
2. Prefer approved claims with evidence over raw generated summaries.
3. Include citations/chips in UI.
4. Tell the user when local context is insufficient.
5. Do not answer from model memory when the selected mode is “Vault-only.”
6. Create “missing evidence” review items when the answer depends on weak material.

Model routing:

```text
Tiny profile:
- short answers only
- strict context limit
- no long synthesis

Standard profile:
- normal grounded answers
- generated notes up to configured length

Strong profile:
- larger research memos
- cluster-level synthesis
```

---

### 39.16 Voice subsystem overview

Voice work has two separate capabilities:

```text
Speech-to-text (STT): audio → text
Text-to-speech (TTS): text → audio
```

Do not confuse voice with agents. Voice is an input/output layer for notes, research, and learning.

Alpha voice use cases:

```text
1. Dictate a note.
2. Record a voice memo and transcribe it into a source.
3. Ask a question by voice.
4. Listen to generated notes or lessons.
5. Run learning drills with spoken prompts.
6. Transcribe imported audio/video files.
```

Not alpha:

```text
- cloned voices,
- celebrity voices,
- always-listening background mode,
- real-time multi-speaker meetings,
- voice-controlled tool installation,
- cloud voice by default.
```

---

### 39.17 Local speech-to-text

Primary local STT provider:

```text
whisper.cpp
```

Rationale:

- runs locally,
- supports CPU-only inference,
- optimized for Apple Silicon and common desktop acceleration paths,
- widely used,
- easy to package as a binary runtime.

Provider interface:

```python
class SpeechToTextProvider(Protocol):
    async def transcribe(self, request: TranscriptionRequest) -> TranscriptionResponse: ...

class TranscriptionRequest(BaseModel):
    audio_path: str
    language: str | None = None
    translate_to_english: bool = False
    diarization: bool = False
    timestamps: bool = True
    local_only: bool = True

class TranscriptionSegment(BaseModel):
    start_ms: int
    end_ms: int
    text: str
    confidence: float | None = None

class TranscriptionResponse(BaseModel):
    text: str
    segments: list[TranscriptionSegment]
    language_detected: str | None
    provider: str
    model_id: str
    sent_off_device: bool = False
```

Model profiles:

```text
Tiny:
- whisper tiny/base quantized model
- fast note dictation
- lower accuracy

Standard:
- whisper small model
- better multilingual transcription

Strong:
- whisper medium or alternative larger local ASR
- better accuracy, slower
```

Optional future local STT:

```text
Qwen3-ASR 0.6B / 1.7B or equivalent, if packaging and runtime prove reliable.
```

Store transcripts as sources:

```text
Audio file → audio source
Transcript → source blocks
Transcript segments → evidence addressable by timestamp
Claims extracted from transcript → review queue
```

---

### 39.18 Local text-to-speech

Primary local TTS provider:

```text
Piper
```

Rationale:

- fast local neural TTS,
- simple CLI/Python integration,
- multiple downloadable voices,
- good fit for offline learning narration.

Secondary local TTS provider:

```text
Kokoro-82M or equivalent lightweight open-weight TTS
```

Use Kokoro where language/voice quality is suitable. Keep Piper as the broad, dependable default.

Provider interface:

```python
class TextToSpeechProvider(Protocol):
    async def synthesize(self, request: SpeechSynthesisRequest) -> SpeechSynthesisResponse: ...

class SpeechSynthesisRequest(BaseModel):
    text: str
    language: str | None = None
    voice_id: str | None = None
    speed: float = 1.0
    format: Literal["wav", "mp3"] = "wav"
    local_only: bool = True

class SpeechSynthesisResponse(BaseModel):
    audio_path: str
    duration_ms: int | None
    provider: str
    model_id: str
    voice_id: str | None
    sent_off_device: bool = False
```

Use cases:

```text
- Read this note aloud.
- Read today’s Morning Lab Brief.
- Turn this course into an audio lesson.
- Speak flashcard prompts.
- Speak review queue summaries.
```

TTS output should be cached by hash:

```text
hash(text + voice_id + speed + model_id) → audio file
```

This avoids regenerating the same lesson repeatedly.

---

### 39.19 Optional ElevenLabs provider

ElevenLabs is not a local provider. Treat it as optional cloud voice infrastructure.

Use cases:

```text
- higher-quality narration,
- expressive audio lessons,
- optional premium voice output,
- optional cloud STT if the user explicitly enables it.
```

Rules:

- Disabled by default.
- Requires user API key.
- Requires explicit “data leaves this device” privacy notice.
- Never use for private notes unless the user enables cloud voice for that action.
- Do not implement voice cloning in alpha.
- Do not send source files automatically.
- Log `sent_off_device = true` for every run.

Provider path:

```text
services/core/vault_core/ai/voice/elevenlabs.py
```

---

### 39.20 Voice database additions

Add tables:

```sql
CREATE TABLE audio_assets (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  original_filename TEXT,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  duration_ms INTEGER,
  sha256 TEXT NOT NULL,
  source_id TEXT,
  privacy_level TEXT NOT NULL DEFAULT 'private'
);

CREATE TABLE transcript_segments (
  id TEXT PRIMARY KEY,
  audio_asset_id TEXT NOT NULL REFERENCES audio_assets(id),
  source_block_id TEXT REFERENCES source_blocks(id),
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  text TEXT NOT NULL,
  confidence REAL,
  speaker_label TEXT,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL
);

CREATE TABLE speech_assets (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  text_preview TEXT,
  audio_path TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  voice_id TEXT,
  language TEXT,
  duration_ms INTEGER,
  sent_off_device BOOLEAN NOT NULL DEFAULT 0
);
```

Do not store full source text in `speech_assets` if it contains private content. Use hash and preview.

---

### 39.21 Voice UI

Add these screens/components:

```text
Settings → Voice
- STT provider
- TTS provider
- installed voice models
- voice downloads
- microphone permission status
- cloud voice opt-in

Note Editor
- dictate button
- insert transcript at cursor
- create voice memo source
- read selected text aloud

Source View
- import audio file
- transcribe
- inspect transcript with timestamps
- create claims from transcript

Learning Mode
- listen to lesson
- spoken flashcard prompt
- answer by voice
- auto-transcribe answer
```

Do not add always-listening mode. Push-to-talk only in alpha.

---

### 39.22 Privacy and safety rules

Local AI privacy rules:

```text
- Local-only is the default.
- The app must visually indicate when a provider is local or cloud.
- The app must never silently send source content to cloud providers.
- Model downloads may use the internet, but inference must remain local unless explicitly configured.
- Cloud providers require per-provider credentials and per-action consent policy.
```

Model security rules:

```text
- Download only from allowlisted registry entries.
- Verify checksums.
- Store license metadata.
- Do not execute model repository code.
- Treat tokenizer templates and model metadata as untrusted config.
- Generated text from local models remains untrusted.
```

Voice safety rules:

```text
- No voice cloning in alpha.
- No always-on microphone.
- Every recording creates an obvious local asset.
- User can delete audio asset and transcript separately.
- Cloud STT/TTS logs sent_off_device=true.
```

Prompt-injection rule for transcribed audio:

```text
Transcribed speech may contain instructions. Treat transcript content as source data, not as system or developer instructions.
```

---

### 39.23 Model/provider API contracts

Add Pydantic models:

```python
class AIProviderInfo(BaseModel):
    id: str
    display_name: str
    kind: Literal["llm", "embedding", "reranker", "stt", "tts"]
    locality: Literal["local", "cloud", "external_local"]
    enabled: bool
    configured: bool
    privacy_label: str

class AIModelInfo(BaseModel):
    id: str
    display_name: str
    kind: Literal["llm", "embedding", "reranker", "stt", "tts"]
    installed: bool
    download_state: str
    capabilities: list[str]
    size_bytes: int | None
    disk_path: str | None
    license_label: str | None
    recommended_profile: str

class CapabilityBinding(BaseModel):
    capability: str
    provider_id: str
    model_id: str | None
    local_only: bool
    settings: dict[str, Any]
```

Add API endpoints:

```text
GET    /ai/providers
GET    /ai/capabilities
PATCH  /ai/capabilities/{capability}
POST   /ai/generate/text
POST   /ai/generate/json
POST   /ai/embed
POST   /ai/rerank
POST   /voice/transcribe
POST   /voice/synthesize
GET    /voice/voices
POST   /voice/models/download
```

Renderer must call these through the typed IPC bridge, not by guessing local service URLs.

---

### 39.24 Development milestones to insert into roadmap

Insert these milestones after current Milestone 3 and before existing real extraction milestone.

#### Milestone 4A: Local AI subsystem skeleton

Goal: capability-based AI routing exists with mock providers.

Tasks:

- Add provider interfaces for LLM, embedding, reranker, STT, TTS.
- Add capability registry.
- Add provider settings model.
- Add `/ai/providers`, `/ai/capabilities`, `/ai/hardware` endpoints.
- Add settings UI: AI Models and Voice pages.
- Add event log entries for all AI runs.

Acceptance:

- App runs with no real model installed.
- Mock providers can generate deterministic output.
- User can see local/cloud status labels.
- Tests pass without downloading models.

#### Milestone 4B: Model registry and downloader

Goal: downloadable local models can be installed safely.

Tasks:

- Add `model_registry.json`.
- Add model storage paths.
- Add downloader with resume/cancel.
- Add checksum verification.
- Add installed model database.
- Add first-run model setup wizard.

Acceptance:

- User can download a small model pack.
- Failed downloads can resume or be deleted.
- Checksum failure blocks installation.
- App does not break if no model is installed.

#### Milestone 4C: llama.cpp runtime

Goal: local GGUF inference works.

Tasks:

- Package or locate llama.cpp runtime.
- Add CLI provider.
- Add server provider.
- Add process manager and health checks.
- Add model load/unload.
- Add smoke prompt test.
- Add logs.

Acceptance:

- A downloaded GGUF model can answer a test prompt locally.
- Extraction provider can run with grammar.
- Server provider can generate text for note drafts.
- Runtime failures produce actionable UI errors.

#### Milestone 4D: Local extraction and note generation

Goal: local AI performs real Vault work.

Tasks:

- Wire extraction to local provider.
- Wire generated notes to local provider.
- Add generated note draft flow.
- Add citation chips for generated note context.
- Keep review queue mandatory.

Acceptance:

- User can extract objects from a source block locally.
- User can generate a note draft from selected context locally.
- Invalid extraction is quarantined.
- Generated note can be approved, edited, or rejected.

#### Milestone 4E: Local embeddings

Goal: semantic search works without cloud.

Tasks:

- Add embedding model install option.
- Add embedding provider.
- Add embedding job queue.
- Add model-specific dimensions.
- Add re-embedding workflow.
- Add hybrid search.

Acceptance:

- Imported sources are embedded locally.
- Search combines FTS and vector similarity.
- Changing embedding model creates a new embedding space.
- Old embeddings remain until replacement completes.

#### Milestone 10A: Local voice dictation

Goal: voice memo and note dictation work locally.

Tasks:

- Add microphone permission flow.
- Add audio recording component.
- Add whisper.cpp provider.
- Add audio asset storage.
- Add transcription as source.
- Add dictate into note editor.

Acceptance:

- User can record a voice memo.
- Transcription happens locally.
- Transcript becomes a source with timestamped blocks.
- User can insert transcript into a note.

#### Milestone 10B: Local text-to-speech

Goal: The Vault can speak notes and lessons locally.

Tasks:

- Add Piper provider.
- Add voice model downloader.
- Add TTS cache.
- Add read-aloud UI.
- Add learning-mode audio prompts.

Acceptance:

- User can select a local voice.
- App can read a note aloud locally.
- Generated audio is cached.
- No cloud request is made.

#### Milestone 10C: Optional ElevenLabs provider

Goal: cloud voice is available as an explicit premium adapter.

Tasks:

- Add ElevenLabs provider config.
- Add API key storage.
- Add cloud warning UI.
- Add per-action consent.
- Add `sent_off_device` audit flag.

Acceptance:

- Provider is disabled by default.
- User can enable with API key.
- Every cloud voice action is visibly marked.
- Audit log records off-device processing.

---

### 39.25 Testing requirements

Local AI tests:

```text
- provider interface tests with mock provider
- model registry schema validation
- checksum verification test
- download cancel/resume test with local fixture server
- capability routing tests
- cloud fallback prevention test
- grammar validation tests
- invalid source_quote rejection test
- generated note draft creation test
- no canonical mutation without review test
```

Voice tests:

```text
- audio asset creation test
- transcription provider mock test
- transcript segment persistence test
- TTS provider mock test
- TTS cache key test
- cloud provider disabled-by-default test
- sent_off_device audit test
```

Do not require large model downloads in CI.

CI should use:

```text
MockLLMProvider
MockEmbeddingProvider
MockSpeechToTextProvider
MockTextToSpeechProvider
small local fixture files
```

Manual local AI test script:

```bash
./scripts/test_local_ai.sh
```

Manual voice test script:

```bash
./scripts/test_voice_local.sh
```

---

### 39.26 UX copy requirements

Use plain labels.

Good:

```text
Runs on this device
May send data to cloud
Download local model
No model installed
Install tiny local model
Use for extraction
Use for voice dictation
```

Avoid:

```text
Inference backend
Quantized artifact
Provider abstraction
Context window exceeded
```

The user may be technical, but the product should not smell like a driver settings panel from a haunted printer.

---

### 39.27 Reference links for this addendum

- llama.cpp GBNF grammar documentation: https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md
- llama.cpp server documentation: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
- Electron local LLM package using node-llama-cpp: https://github.com/electron/llm
- Ollama Modelfile documentation: https://docs.ollama.com/modelfile
- Ollama API documentation: https://docs.ollama.com/api/introduction
- LM Studio local server documentation: https://lmstudio.ai/docs/developer/core/server
- Gemma 4 model overview: https://ai.google.dev/gemma/docs/core
- Gemma 4 E2B model card: https://huggingface.co/google/gemma-4-E2B
- Qwen3 collection: https://huggingface.co/collections/Qwen/qwen3
- Qwen3 Embedding 0.6B: https://huggingface.co/Qwen/Qwen3-Embedding-0.6B
- BGE-M3 model card: https://huggingface.co/BAAI/bge-m3
- Nomic Embed Text v1.5 GGUF: https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF
- Sentence Transformers MiniLM model card: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
- whisper.cpp repository: https://github.com/ggml-org/whisper.cpp
- Qwen3-ASR 0.6B model card: https://huggingface.co/Qwen/Qwen3-ASR-0.6B
- Piper local TTS repository: https://github.com/OHF-voice/piper1-gpl
- Piper TTS PyPI package: https://pypi.org/project/piper-tts/
- Piper voice samples: https://rhasspy.github.io/piper-samples/
- Kokoro-82M model card: https://huggingface.co/hexgrad/Kokoro-82M
- ElevenLabs TTS documentation: https://elevenlabs.io/docs/overview/capabilities/text-to-speech
- ElevenLabs STT documentation: https://elevenlabs.io/docs/overview/capabilities/speech-to-text
- ElevenLabs API intro: https://elevenlabs.io/docs/api-reference/introduction
