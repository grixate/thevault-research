from __future__ import annotations

import json
import platform
import shutil
import subprocess
import time
import urllib.parse
import urllib.request
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from vault_core.api.schemas import AIProviderInfo, CapabilityBinding, HardwareProfile
from vault_core.ai.embeddings.index import (
    APP_MANAGED_LOCAL_EMBEDDING_PROVIDER,
    EmbeddingSpace,
    app_managed_local_embedding_fingerprint,
    coerce_embedding_dimensions,
    embed_texts_for_space,
)
from vault_core.ai.rerankers.local_cross_encoder import LocalCrossEncoderReranker
from vault_core.ai.voice.piper import PiperTextToSpeechProvider
from vault_core.ai.voice.whisper_cpp import WhisperCppSpeechToTextProvider
from vault_core.config import Settings
from vault_core.db.session import VaultDatabase, dumps, loads, new_id, now_iso
from vault_core.domain.chunking import content_hash

CAPABILITIES = [
    "extract_objects",
    "extract_claims",
    "summarize",
    "generate_note",
    "grounded_answer",
    "create_learning_item",
    "embed_text",
    "rerank_results",
    "transcribe_audio",
    "synthesize_speech",
]

DEFAULT_CAPABILITY_BINDINGS: dict[str, dict[str, Any]] = {
    "extract_objects": {"provider_id": "mock_llm", "model_id": "mock-local-llm", "settings": {"temperature": 0}},
    "extract_claims": {"provider_id": "mock_llm", "model_id": "mock-local-llm", "settings": {"temperature": 0}},
    "summarize": {"provider_id": "mock_llm", "model_id": "mock-local-llm", "settings": {"temperature": 0.2}},
    "generate_note": {"provider_id": "mock_llm", "model_id": "mock-local-llm", "settings": {"temperature": 0.4}},
    "grounded_answer": {"provider_id": "mock_llm", "model_id": "mock-local-llm", "settings": {"temperature": 0.1}},
    "create_learning_item": {"provider_id": "mock_llm", "model_id": "mock-local-llm", "settings": {"temperature": 0.3}},
    "embed_text": {"provider_id": "mock_embedding", "model_id": "mock-local-embedding", "settings": {"dimensions": 32}},
    "rerank_results": {"provider_id": "mock_reranker", "model_id": "mock-local-reranker", "settings": {}},
    "transcribe_audio": {"provider_id": "mock_stt", "model_id": "mock-local-stt", "settings": {"timestamps": True}},
    "synthesize_speech": {"provider_id": "mock_tts", "model_id": "mock-local-tts", "settings": {"format": "wav"}},
}

PROVIDERS = [
    AIProviderInfo(
        id="mock_llm",
        display_name="Mock Local LLM",
        kind="llm",
        locality="local",
        enabled=True,
        configured=True,
        privacy_label="Runs on this device",
    ),
    AIProviderInfo(
        id="mock_embedding",
        display_name="Mock Local Embeddings",
        kind="embedding",
        locality="local",
        enabled=True,
        configured=True,
        privacy_label="Runs on this device",
    ),
    AIProviderInfo(
        id="local_embedding",
        display_name="App-Managed Local Embeddings",
        kind="embedding",
        locality="local",
        enabled=True,
        configured=True,
        privacy_label="Runs on this device",
    ),
    AIProviderInfo(
        id="local_embedding_http",
        display_name="Local HTTP Embeddings",
        kind="embedding",
        locality="external_local",
        enabled=False,
        configured=False,
        privacy_label="External local process",
    ),
    AIProviderInfo(
        id="llama_cpp_server_embeddings",
        display_name="llama.cpp Server Embeddings",
        kind="embedding",
        locality="local",
        enabled=False,
        configured=False,
        privacy_label="Runs on this device",
    ),
    AIProviderInfo(
        id="mock_reranker",
        display_name="Mock Local Reranker",
        kind="reranker",
        locality="local",
        enabled=True,
        configured=True,
        privacy_label="Runs on this device",
    ),
    AIProviderInfo(
        id="local_reranker_http",
        display_name="Local HTTP Reranker",
        kind="reranker",
        locality="external_local",
        enabled=False,
        configured=False,
        privacy_label="External local process",
    ),
    AIProviderInfo(
        id="local_cross_encoder",
        display_name="App-Managed Local Reranker",
        kind="reranker",
        locality="local",
        enabled=False,
        configured=False,
        privacy_label="Runs on this device",
    ),
    AIProviderInfo(
        id="mock_stt",
        display_name="Mock Local Speech-to-Text",
        kind="stt",
        locality="local",
        enabled=True,
        configured=True,
        privacy_label="Runs on this device",
    ),
    AIProviderInfo(
        id="mock_tts",
        display_name="Mock Local Text-to-Speech",
        kind="tts",
        locality="local",
        enabled=True,
        configured=True,
        privacy_label="Runs on this device",
    ),
    AIProviderInfo(
        id="llama_cpp_cli",
        display_name="llama.cpp CLI",
        kind="llm",
        locality="local",
        enabled=False,
        configured=False,
        privacy_label="Runs on this device",
    ),
    AIProviderInfo(
        id="llama_cpp_server",
        display_name="llama.cpp Server",
        kind="llm",
        locality="local",
        enabled=False,
        configured=False,
        privacy_label="Runs on this device",
    ),
    AIProviderInfo(
        id="ollama",
        display_name="Ollama",
        kind="llm",
        locality="external_local",
        enabled=False,
        configured=False,
        privacy_label="External local process",
    ),
    AIProviderInfo(
        id="lmstudio",
        display_name="LM Studio",
        kind="llm",
        locality="external_local",
        enabled=False,
        configured=False,
        privacy_label="External local process",
    ),
    AIProviderInfo(
        id="openai_compatible",
        display_name="OpenAI-Compatible Endpoint",
        kind="llm",
        locality="cloud",
        enabled=False,
        configured=False,
        privacy_label="May send data to cloud",
    ),
    AIProviderInfo(
        id="whisper_cpp",
        display_name="whisper.cpp",
        kind="stt",
        locality="local",
        enabled=False,
        configured=False,
        privacy_label="Runs on this device",
    ),
    AIProviderInfo(
        id="piper",
        display_name="Piper",
        kind="tts",
        locality="local",
        enabled=False,
        configured=False,
        privacy_label="Runs on this device",
    ),
    AIProviderInfo(
        id="elevenlabs",
        display_name="ElevenLabs",
        kind="tts",
        locality="cloud",
        enabled=False,
        configured=False,
        privacy_label="May send data to cloud",
    ),
]

PROVIDERS_BY_ID = {provider.id: provider for provider in PROVIDERS}


@dataclass(frozen=True)
class AIRunResult:
    run_id: str
    provider_id: str
    model_id: str
    capability: str
    output: Any
    sent_off_device: bool


def ensure_ai_defaults(db: VaultDatabase) -> None:
    ts = now_iso()
    with db.connect() as conn:
        for capability, defaults in DEFAULT_CAPABILITY_BINDINGS.items():
            conn.execute(
                """
                INSERT INTO ai_capability_bindings
                  (id, workspace_id, capability, provider_id, model_id, local_only, settings_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
                ON CONFLICT(workspace_id, capability) DO NOTHING
                """,
                (
                    new_id("aib"),
                    db.workspace_id,
                    capability,
                    defaults["provider_id"],
                    defaults["model_id"],
                    dumps(defaults.get("settings", {})),
                    ts,
                    ts,
                ),
            )


def get_providers() -> list[AIProviderInfo]:
    return PROVIDERS


def list_capabilities(db: VaultDatabase) -> list[CapabilityBinding]:
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT * FROM ai_capability_bindings WHERE workspace_id=? ORDER BY capability",
            (db.workspace_id,),
        ).fetchall()
        return [
            CapabilityBinding(
                capability=row["capability"],
                provider_id=row["provider_id"],
                model_id=row["model_id"],
                local_only=bool(row["local_only"]),
                settings=loads(row["settings_json"], {}),
            )
            for row in rows
        ]


def get_capability(db: VaultDatabase, capability: str) -> CapabilityBinding:
    if capability not in CAPABILITIES:
        raise ValueError(f"Unknown AI capability: {capability}")
    with db.connect() as conn:
        row = conn.execute(
            "SELECT * FROM ai_capability_bindings WHERE workspace_id=? AND capability=?",
            (db.workspace_id, capability),
        ).fetchone()
    if not row:
        defaults = DEFAULT_CAPABILITY_BINDINGS[capability]
        return CapabilityBinding(
            capability=capability,
            provider_id=defaults["provider_id"],
            model_id=defaults["model_id"],
            local_only=True,
            settings=defaults.get("settings", {}),
        )
    return CapabilityBinding(
        capability=row["capability"],
        provider_id=row["provider_id"],
        model_id=row["model_id"],
        local_only=bool(row["local_only"]),
        settings=loads(row["settings_json"], {}),
    )


def update_capability(
    db: VaultDatabase,
    capability: str,
    provider_id: str | None,
    model_id: str | None,
    local_only: bool | None,
    settings: dict[str, Any] | None,
) -> CapabilityBinding:
    if capability not in CAPABILITIES:
        raise ValueError(f"Unknown AI capability: {capability}")
    current = get_capability(db, capability)
    next_provider_id = provider_id or current.provider_id
    provider = PROVIDERS_BY_ID.get(next_provider_id)
    if provider is None:
        raise ValueError(f"Unknown AI provider: {next_provider_id}")
    next_local_only = current.local_only if local_only is None else local_only
    if next_local_only and provider.locality == "cloud":
        raise ValueError("Cloud providers cannot be selected while local_only is true")
    next_model_id = model_id if model_id is not None else current.model_id
    next_settings = settings if settings is not None else current.settings
    ts = now_iso()
    with db.connect() as conn:
        conn.execute(
            """
            INSERT INTO ai_capability_bindings
              (id, workspace_id, capability, provider_id, model_id, local_only, settings_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(workspace_id, capability) DO UPDATE SET
              provider_id=excluded.provider_id,
              model_id=excluded.model_id,
              local_only=excluded.local_only,
              settings_json=excluded.settings_json,
              updated_at=excluded.updated_at
            """,
            (
                new_id("aib"),
                db.workspace_id,
                capability,
                next_provider_id,
                next_model_id,
                1 if next_local_only else 0,
                dumps(next_settings),
                ts,
                ts,
            ),
        )
        db.event(
            conn,
            "ai.capability_updated",
            "ai_capability",
            capability,
            {"provider_id": next_provider_id, "model_id": next_model_id, "local_only": next_local_only},
            "user",
        )
    return get_capability(db, capability)


def hardware_profile() -> HardwareProfile:
    system = platform.system().lower()
    os_name = "macos" if system == "darwin" else "windows" if system == "windows" else "linux"
    machine = platform.machine().lower()
    arch = "arm64" if machine in {"arm64", "aarch64"} else "x64" if machine in {"x86_64", "amd64"} else "unknown"
    cpu_brand = _command_text(["sysctl", "-n", "machdep.cpu.brand_string"]) if os_name == "macos" else platform.processor() or None
    ram_gb = _physical_ram_gb(os_name)
    apple_silicon = os_name == "macos" and arch == "arm64"
    metal_available = apple_silicon
    cuda_available = shutil.which("nvidia-smi") is not None
    rocm_available = shutil.which("rocminfo") is not None
    vulkan_available = shutil.which("vulkaninfo") is not None
    warnings: list[str] = []
    if ram_gb is None:
        warnings.append("Could not detect physical RAM. Defaulting to tiny model recommendations.")
        recommended = "tiny"
    elif ram_gb >= 32:
        recommended = "strong"
    elif ram_gb >= 12 or apple_silicon:
        recommended = "standard"
    else:
        recommended = "tiny"
    return HardwareProfile(
        os=os_name,
        arch=arch,
        cpu_brand=cpu_brand,
        physical_ram_gb=ram_gb,
        available_ram_gb=None,
        apple_silicon=apple_silicon,
        metal_available=metal_available,
        cuda_available=cuda_available,
        rocm_available=rocm_available,
        vulkan_available=vulkan_available,
        recommended_profile=recommended,
        warnings=warnings,
    )


def mock_generate_text(db: VaultDatabase, capability: str, prompt: str, max_tokens: int, local_only: bool) -> AIRunResult:
    binding = _validated_binding(db, capability, local_only)
    text = prompt.strip().replace("\n", " ")
    output = f"Mock local {capability}: {text[:max_tokens].strip() or 'No prompt supplied.'}"
    return _record_run(db, binding, prompt, output, "valid")


def record_text_generation(
    db: VaultDatabase,
    binding: CapabilityBinding,
    prompt: str,
    output: str,
    validation_status: str = "unvalidated",
) -> AIRunResult:
    return _record_run(db, binding, prompt, output, validation_status)


def validate_capability_binding(db: VaultDatabase, capability: str, requested_local_only: bool) -> CapabilityBinding:
    return _validated_binding(db, capability, requested_local_only)


def mock_generate_json(db: VaultDatabase, capability: str, prompt: str, schema_name: str, local_only: bool) -> AIRunResult:
    binding = _validated_binding(db, capability, local_only)
    output = {
        "schema": schema_name,
        "objects": [],
        "warnings": ["Mock provider returned no canonical objects."],
        "prompt_preview": prompt[:120],
    }
    return _record_run(db, binding, prompt, output, "valid")


def mock_embed(
    db: VaultDatabase,
    capability: str,
    texts: list[str],
    local_only: bool,
    *,
    llama_server: Any | None = None,
) -> AIRunResult:
    binding = _validated_binding(db, capability, local_only)
    dimensions = coerce_embedding_dimensions(binding.settings.get("dimensions"))
    space = EmbeddingSpace(
        provider=binding.provider_id,
        model=binding.model_id or "mock-local-embedding",
        dimensions=dimensions,
    )
    vectors = embed_texts_for_space(texts, space, binding.settings, llama_server=llama_server, db=db)
    output: dict[str, Any] = {"dimensions": dimensions, "vectors": vectors}
    if binding.provider_id == APP_MANAGED_LOCAL_EMBEDDING_PROVIDER:
        output["model_fingerprint"] = app_managed_local_embedding_fingerprint(binding.settings)
    return _record_run(db, binding, json.dumps({"count": len(texts)}), output, "valid")


def mock_rerank(db: VaultDatabase, capability: str, query: str, candidates: list[dict[str, Any]], local_only: bool) -> AIRunResult:
    binding = _validated_binding(db, capability, local_only)
    if binding.provider_id == "local_reranker_http":
        ranked = local_http_rerank(binding, query, candidates)
        return _record_run(db, binding, query, {"results": ranked}, "valid")
    if binding.provider_id == "local_cross_encoder":
        ranked = local_cross_encoder_rerank(binding, query, candidates)
        return _record_run(db, binding, query, {"results": ranked}, "valid")
    query_terms = set(query.lower().split())
    ranked = []
    for candidate in candidates:
        text = str(candidate.get("text") or candidate.get("snippet") or "")
        score = len(query_terms.intersection(text.lower().split()))
        ranked.append({**candidate, "score": score})
    ranked.sort(key=lambda item: item["score"], reverse=True)
    return _record_run(db, binding, query, {"results": ranked}, "valid")


def local_cross_encoder_rerank(binding: CapabilityBinding, query: str, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    model_path = str(binding.settings.get("model_path") or "").strip()
    if not model_path:
        raise ValueError("App-managed local reranker requires settings.model_path")
    provider = LocalCrossEncoderReranker(
        model_path=model_path,
        model_id=binding.model_id or "local-cross-encoder",
        max_length=int(binding.settings.get("max_length") or 512),
        batch_size=int(binding.settings.get("batch_size") or 8),
    )
    return provider.rerank_sync(query, candidates)


def local_http_rerank(binding: CapabilityBinding, query: str, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    endpoint_url = str(binding.settings.get("endpoint_url") or "").strip()
    if not endpoint_url:
        raise ValueError("Local reranker HTTP provider requires settings.endpoint_url")
    validate_local_reranker_endpoint(endpoint_url)
    payload_candidates = [
        {
            "index": index,
            "text": str(candidate.get("text") or candidate.get("snippet") or ""),
            "metadata": {
                key: candidate.get(key)
                for key in ("target_type", "target_id", "title", "locator", "status")
                if key in candidate
            },
        }
        for index, candidate in enumerate(candidates)
    ]
    payload = {
        "model": binding.model_id or "local-reranker",
        "query": query,
        "candidates": payload_candidates,
    }
    request = urllib.request.Request(
        endpoint_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    timeout = float(binding.settings.get("timeout_seconds") or 15)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise ValueError(f"Local reranker provider request failed: {exc}") from exc
    scores = parse_reranker_scores(data, len(candidates))
    ranked = []
    for index, candidate in enumerate(candidates):
        score = scores.get(index, float(candidate.get("score") or 0))
        ranked.append({**candidate, "score": score, "rerank_score": score})
    ranked.sort(key=lambda item: float(item.get("rerank_score") or item.get("score") or 0), reverse=True)
    return ranked


def validate_local_reranker_endpoint(endpoint_url: str) -> None:
    parsed = urllib.parse.urlparse(endpoint_url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Local reranker endpoint must use http or https")
    if parsed.username or parsed.password:
        raise ValueError("Local reranker endpoint must not include credentials")
    hostname = parsed.hostname
    if hostname is None or hostname.lower() not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("Local reranker endpoint must point to localhost or loopback")


def parse_reranker_scores(data: Any, candidate_count: int) -> dict[int, float]:
    if isinstance(data, dict) and isinstance(data.get("scores"), list):
        return {index: float(score) for index, score in enumerate(data["scores"][:candidate_count])}
    results = data.get("results") if isinstance(data, dict) else data
    if isinstance(results, list):
        scores: dict[int, float] = {}
        for fallback_index, item in enumerate(results):
            if isinstance(item, dict):
                raw_index = item.get("index", item.get("candidate_index", fallback_index))
                raw_score = item.get("score", item.get("relevance_score", item.get("rerank_score")))
                if raw_score is None:
                    continue
                scores[int(raw_index)] = float(raw_score)
            else:
                scores[fallback_index] = float(item)
        if scores:
            return scores
    raise ValueError("Local reranker provider returned an unsupported response shape")


def mock_transcribe(db: VaultDatabase, audio_path: str, local_only: bool) -> AIRunResult:
    binding = _validated_binding(db, "transcribe_audio", local_only)
    if binding.provider_id == "whisper_cpp":
        output = whisper_cpp_transcribe(binding, audio_path)
        return _record_run(db, binding, {"audio_path": audio_path}, output, "valid")
    filename = audio_path.rsplit("/", 1)[-1] or "audio"
    output = {
        "text": f"Mock local transcript for {filename}.",
        "segments": [
            {
                "start_ms": 0,
                "end_ms": 1800,
                "text": f"Mock local transcript for {filename}.",
                "confidence": 1.0,
            }
        ],
        "language_detected": None,
    }
    return _record_run(db, binding, audio_path, output, "valid")


def whisper_cpp_transcribe(binding: CapabilityBinding, audio_path: str) -> dict[str, Any]:
    binary_path = str(binding.settings.get("binary_path") or "").strip()
    model_path = str(binding.settings.get("model_path") or "").strip()
    if not binary_path:
        raise ValueError("whisper.cpp transcription requires settings.binary_path")
    if not model_path:
        raise ValueError("whisper.cpp transcription requires settings.model_path")
    timeout = float(binding.settings.get("timeout_seconds") or 120)
    provider = WhisperCppSpeechToTextProvider(
        binary_path=binary_path,
        model_path=model_path,
        model_id=binding.model_id or "whisper-cpp-local",
        language=str(binding.settings.get("language") or "") or None,
        translate_to_english=bool(binding.settings.get("translate_to_english")),
        timestamps=bool(binding.settings.get("timestamps", True)),
        timeout_seconds=timeout,
    )
    response = provider.transcribe(audio_path)
    return response.model_dump()


def synthesize_speech(
    db: VaultDatabase,
    settings: Settings,
    text: str,
    voice_id: str | None,
    speed: float,
    audio_format: str,
    language: str | None,
    local_only: bool,
    output_path: str | None = None,
) -> AIRunResult:
    binding = _validated_binding(db, "synthesize_speech", local_only)
    if binding.provider_id == "piper":
        output = piper_synthesize(binding, settings, text, voice_id, audio_format, output_path)
    elif binding.provider_id == "mock_tts":
        output = mock_tts_synthesize(binding, settings, text, voice_id, speed, audio_format, output_path)
    else:
        raise ValueError(f"Provider {binding.provider_id} is not implemented for synthesize_speech")
    output["language"] = language
    output["format"] = audio_format
    return _record_run(
        db,
        binding,
        {"text": text[:160], "voice_id": voice_id, "speed": speed, "language": language, "format": audio_format},
        output,
        "valid",
    )


def mock_tts_synthesize(
    binding: CapabilityBinding,
    settings: Settings,
    text: str,
    voice_id: str | None,
    speed: float,
    audio_format: str,
    output_path: str | None,
) -> dict[str, Any]:
    if audio_format != "wav":
        raise ValueError("Mock local TTS currently supports wav output")
    duration_ms = max(400, len(text.split()) * 330)
    resolved_output = output_path or str(settings.data_dir / "blobs" / "speech" / f"{content_hash(text + str(voice_id) + str(speed))}.wav")
    _write_mock_wav(Path(resolved_output), min(duration_ms, 3000))
    return {
        "audio_path": resolved_output,
        "duration_ms": duration_ms,
        "voice_id": voice_id or "mock-local-voice",
        "model_id": binding.model_id or "mock-local-tts",
    }


def _write_mock_wav(path: Path, duration_ms: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sample_rate = 16000
    frame_count = max(1, int(sample_rate * (duration_ms / 1000)))
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(b"\x00\x00" * frame_count)


def piper_synthesize(
    binding: CapabilityBinding,
    settings: Settings,
    text: str,
    voice_id: str | None,
    audio_format: str,
    output_path: str | None,
) -> dict[str, Any]:
    if audio_format != "wav":
        raise ValueError("Piper synthesis currently supports wav output")
    binary_path = str(binding.settings.get("binary_path") or "").strip()
    model_path = str(binding.settings.get("model_path") or "").strip()
    if not binary_path:
        raise ValueError("Piper synthesis requires settings.binary_path")
    if not model_path:
        raise ValueError("Piper synthesis requires settings.model_path")
    timeout = float(binding.settings.get("timeout_seconds") or 60)
    resolved_output = output_path or str(settings.data_dir / "blobs" / "speech" / f"{content_hash(text + model_path + str(voice_id))}.wav")
    provider = PiperTextToSpeechProvider(
        binary_path=binary_path,
        model_path=model_path,
        config_path=str(binding.settings.get("config_path") or "").strip() or None,
        model_id=binding.model_id or "piper-local",
        voice_id=voice_id or str(binding.settings.get("voice_id") or "") or None,
        output_path=resolved_output,
        timeout_seconds=timeout,
    )
    response = provider.synthesize(text)
    return response.model_dump()


def _validated_binding(db: VaultDatabase, capability: str, requested_local_only: bool) -> CapabilityBinding:
    binding = get_capability(db, capability)
    provider = PROVIDERS_BY_ID.get(binding.provider_id)
    if provider is None:
        raise ValueError(f"Unknown provider for capability {capability}")
    if requested_local_only and (not binding.local_only or provider.locality == "cloud"):
        raise ValueError("Cloud fallback is disabled. Select a local provider or explicitly disable local_only.")
    return binding


def _record_run(
    db: VaultDatabase,
    binding: CapabilityBinding,
    input_value: Any,
    output_value: Any,
    validation_status: str,
) -> AIRunResult:
    started = time.perf_counter()
    provider = PROVIDERS_BY_ID[binding.provider_id]
    run_id = new_id("airun")
    input_json = json.dumps(input_value, sort_keys=True, ensure_ascii=False)
    output_json = json.dumps(output_value, sort_keys=True, ensure_ascii=False)
    completed = now_iso()
    duration_ms = int((time.perf_counter() - started) * 1000)
    sent_off_device = provider.locality == "cloud"
    with db.connect() as conn:
        conn.execute(
            """
            INSERT INTO ai_model_runs
              (id, workspace_id, created_at, completed_at, provider, model_id, capability,
               input_hash, output_hash, status, duration_ms, validation_status, local_only, sent_off_device)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
            """,
            (
                run_id,
                db.workspace_id,
                completed,
                completed,
                binding.provider_id,
                binding.model_id or "mock",
                binding.capability,
                content_hash(input_json),
                content_hash(output_json),
                duration_ms,
                validation_status,
                1 if binding.local_only else 0,
                1 if sent_off_device else 0,
            ),
        )
        db.event(
            conn,
            "ai.run_completed",
            "ai_model_run",
            run_id,
            {
                "provider": binding.provider_id,
                "model_id": binding.model_id,
                "capability": binding.capability,
                "sent_off_device": sent_off_device,
            },
            "core",
        )
    return AIRunResult(
        run_id=run_id,
        provider_id=binding.provider_id,
        model_id=binding.model_id or "mock",
        capability=binding.capability,
        output=output_value,
        sent_off_device=sent_off_device,
    )


def _physical_ram_gb(os_name: str) -> float | None:
    if os_name == "macos":
        value = _command_text(["sysctl", "-n", "hw.memsize"])
        if value and value.isdigit():
            return round(int(value) / (1024**3), 1)
    return None


def _command_text(command: list[str]) -> str | None:
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=1, check=False)
    except Exception:
        return None
    text = result.stdout.strip()
    return text or None
