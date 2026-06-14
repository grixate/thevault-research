from __future__ import annotations

from pathlib import Path
from typing import Any

from vault_core.ai.models.downloader import verify_installed_model
from vault_core.ai.models.health import llama_cpp_generate_text
from vault_core.ai.routing import AIRunResult, mock_generate_text, record_text_generation, validate_capability_binding
from vault_core.config import Settings
from vault_core.db.session import VaultDatabase


def generate_text_for_capability(
    db: VaultDatabase,
    settings: Settings,
    *,
    capability: str,
    prompt: str,
    max_tokens: int,
    local_only: bool,
    grammar_path: Path | None = None,
    llama_server: Any | None = None,
) -> AIRunResult:
    binding = validate_capability_binding(db, capability, local_only)
    if binding.provider_id not in {"llama_cpp_cli", "llama_cpp_server"}:
        return mock_generate_text(db, capability, prompt, max_tokens, local_only)
    if not binding.model_id:
        raise ValueError("No llama.cpp model is selected for this capability")
    verify_installed_model(db, binding.model_id)
    if binding.provider_id == "llama_cpp_server":
        if grammar_path is not None:
            raise ValueError("llama.cpp server does not support grammar-constrained extraction; use llama.cpp CLI")
        if llama_server is None:
            raise ValueError("llama.cpp server process manager is not available")
        temperature = binding.settings.get("temperature")
        if temperature is not None:
            temperature = float(temperature)
        generated = llama_server.generate_text(
            db,
            binding.model_id,
            prompt=prompt,
            max_tokens=max_tokens,
            host=str(binding.settings.get("server_host") or "127.0.0.1"),
            port=int(binding.settings.get("server_port") or 8767),
            temperature=temperature,
            timeout_seconds=float(binding.settings.get("timeout_seconds") or 60),
            startup_timeout_seconds=float(binding.settings.get("startup_timeout_seconds") or 20),
        )
        if generated["status"] != "passed":
            raise ValueError(generated["message"])
        return record_text_generation(db, binding, prompt, generated["message"], "unvalidated")
    generated = llama_cpp_generate_text(
        settings,
        db,
        model_id=binding.model_id,
        prompt=prompt,
        max_tokens=max_tokens,
        grammar_path=grammar_path,
    )
    if generated["status"] != "passed":
        raise ValueError(generated["message"])
    return record_text_generation(db, binding, prompt, generated["message"], "unvalidated")
