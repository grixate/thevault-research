from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Any

from vault_core.config import Settings
from vault_core.ai.models.runtime_installer import runtime_integrity_for_path
from vault_core.db.session import VaultDatabase, loads

LLAMA_CLI_BINARIES = ("llama-cli", "llama")
LLAMA_SERVER_BINARIES = ("llama-server",)
WHISPER_CLI_BINARIES = ("whisper-cli", "whisper-cpp", "main")
PIPER_BINARIES = ("piper",)
FIXTURE_MODEL_MAX_BYTES = 1024 * 1024


def runtime_health(settings: Settings, db: VaultDatabase, server_process: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "llama_cpp": llama_cpp_health(settings, db, server_process=server_process),
        "voice": voice_health(settings, db),
    }


def voice_health(settings: Settings, db: VaultDatabase) -> dict[str, Any]:
    with db.connect() as conn:
        stt_row = conn.execute(
            """
            SELECT provider_id, model_id, settings_json
            FROM ai_capability_bindings
            WHERE workspace_id=? AND capability='transcribe_audio'
            """,
            (db.workspace_id,),
        ).fetchone()
        tts_row = conn.execute(
            """
            SELECT provider_id, model_id, settings_json
            FROM ai_capability_bindings
            WHERE workspace_id=? AND capability='synthesize_speech'
            """,
            (db.workspace_id,),
        ).fetchone()
    binding_settings = loads(stt_row["settings_json"], {}) if stt_row else {}
    provider_id = stt_row["provider_id"] if stt_row else "mock_stt"
    model_id = stt_row["model_id"] if stt_row else "mock-local-stt"
    runtime_dir = settings.data_dir / "ai_runtime" / "whisper_cpp"
    configured_binary = binding_settings.get("binary_path") or settings.whisper_cpp_cli_path
    configured_model = binding_settings.get("model_path") or settings.whisper_cpp_model_path
    whisper_cli = _find_binary(str(configured_binary) if configured_binary else None, runtime_dir / "bin", WHISPER_CLI_BINARIES)
    whisper_cli = _apply_managed_integrity(db, "whisper_cpp", whisper_cli)
    model_status = _voice_model_status(configured_model)
    warnings: list[str] = []
    next_actions: list[str] = []
    if provider_id != "whisper_cpp":
        state = "mock_only"
        next_actions.append("Select whisper.cpp for transcribe_audio to run local STT.")
    elif not _is_usable(whisper_cli):
        state = "not_configured"
        next_actions.append("Install whisper.cpp or set the transcribe_audio binary_path.")
    elif not model_status["configured"]:
        state = "no_installed_model"
        next_actions.append("Select a local whisper.cpp model file for transcribe_audio.")
    elif model_status.get("error"):
        state = "degraded"
        warnings.append(str(model_status["error"]))
    else:
        state = "ready"
    return {
        "state": state,
        "stt": {
            "provider": provider_id,
            "model_id": model_id,
            "cli": whisper_cli,
            "model": model_status,
            "privacy_label": "Runs on this device" if provider_id == "whisper_cpp" else "Mock local response",
        },
        "tts": tts_health(settings, db, tts_row),
        "warnings": warnings,
        "next_actions": next_actions,
    }


def tts_health(settings: Settings, db: VaultDatabase, row: Any) -> dict[str, Any]:
    binding_settings = loads(row["settings_json"], {}) if row else {}
    provider_id = row["provider_id"] if row else "mock_tts"
    model_id = row["model_id"] if row else "mock-local-tts"
    runtime_dir = settings.data_dir / "ai_runtime" / "piper"
    configured_binary = binding_settings.get("binary_path")
    configured_model = binding_settings.get("model_path")
    piper_cli = _find_binary(str(configured_binary) if configured_binary else None, runtime_dir / "bin", PIPER_BINARIES)
    piper_cli = _apply_managed_integrity(db, "piper", piper_cli)
    model_status = _voice_model_status(configured_model)
    warnings: list[str] = []
    next_actions: list[str] = []
    if provider_id != "piper":
        state = "mock_only"
        next_actions.append("Select Piper for synthesize_speech to run local TTS.")
    elif not _is_usable(piper_cli):
        state = "not_configured"
        next_actions.append("Install Piper or set the synthesize_speech binary_path.")
    elif not model_status["configured"]:
        state = "no_installed_model"
        next_actions.append("Select a local Piper voice model for synthesize_speech.")
    elif model_status.get("error"):
        state = "degraded"
        warnings.append(str(model_status["error"]))
    else:
        state = "ready"
    return {
        "state": state,
        "provider": provider_id,
        "model_id": model_id,
        "cli": piper_cli,
        "model": model_status,
        "privacy_label": "Runs on this device" if provider_id == "piper" else "Mock local response",
        "warnings": warnings,
        "next_actions": next_actions,
    }


def llama_cpp_health(settings: Settings, db: VaultDatabase, server_process: dict[str, Any] | None = None) -> dict[str, Any]:
    runtime_dir = settings.data_dir / "ai_runtime" / "llama_cpp"
    cli = _find_binary(settings.llama_cpp_cli_path, runtime_dir / "bin", LLAMA_CLI_BINARIES)
    cli = _apply_managed_integrity(db, "llama_cpp", cli)
    server = _find_binary(settings.llama_cpp_server_path, runtime_dir / "bin", LLAMA_SERVER_BINARIES)
    server = _apply_managed_integrity(db, "llama_cpp", server)
    installed_models = _installed_llama_models(db)
    warnings: list[str] = []
    next_actions: list[str] = []
    cli_usable = _is_usable(cli)
    server_usable = _is_usable(server)

    if not cli_usable and not server_usable:
        state = "not_configured"
        next_actions.append("Install llama.cpp or set VAULT_LLAMA_CPP_CLI / VAULT_LLAMA_CPP_SERVER.")
    elif not installed_models:
        state = "no_installed_model"
        next_actions.append("Download or import an approved GGUF model before running local inference.")
    elif all(model["fixture_only"] for model in installed_models):
        state = "degraded"
        next_actions.append("Download or import a real approved GGUF model before running local inference.")
    elif not cli_usable:
        state = "degraded"
        warnings.append("llama.cpp server is available, but CLI extraction runtime is missing.")
        next_actions.append("Add llama-cli for grammar-constrained extraction jobs.")
    else:
        state = "ready"

    if any(model["fixture_only"] for model in installed_models):
        warnings.append("One or more installed models are checksum fixtures, not real inference-capable GGUF weights.")
    for binary in [cli, server]:
        if binary.get("integrity_status") in {"missing", "mismatch", "failed"} and binary.get("error"):
            warnings.append(str(binary["error"]))
            next_actions.append("Repair or reinstall the managed llama.cpp runtime from Settings.")

    return {
        "runtime": "llama_cpp",
        "state": state,
        "runtime_dir": str(runtime_dir),
        "cli": cli,
        "server": server,
        "server_process": server_process or {"state": "stopped"},
        "installed_models": installed_models,
        "warnings": warnings,
        "next_actions": next_actions,
    }


def llama_cpp_smoke_test(
    settings: Settings,
    db: VaultDatabase,
    *,
    model_id: str | None = None,
    prompt: str = "Reply with OK.",
    max_tokens: int = 16,
    dry_run: bool = True,
) -> dict[str, Any]:
    health = llama_cpp_health(settings, db)
    model = _select_model(health["installed_models"], model_id)
    if not _is_usable(health["cli"]):
        return {
            "runtime": "llama_cpp",
            "status": "not_configured",
            "model_id": model_id,
            "message": "llama.cpp CLI is not configured, so no local prompt was run.",
            "health": health,
        }
    if model is None:
        return {
            "runtime": "llama_cpp",
            "status": "no_installed_model",
            "model_id": model_id,
            "message": "No installed llama.cpp GGUF model is available for a smoke prompt.",
            "health": health,
        }
    if model["fixture_only"]:
        return {
            "runtime": "llama_cpp",
            "status": "fixture_only",
            "model_id": model["model_id"],
            "message": "The installed model is a tiny checksum fixture and is not inference-capable.",
            "health": health,
        }
    if dry_run:
        return {
            "runtime": "llama_cpp",
            "status": "ready",
            "model_id": model["model_id"],
            "message": "llama.cpp CLI and an installed GGUF model are present. Set dry_run=false to execute a prompt.",
            "health": health,
        }
    return _run_llama_cli(health["cli"]["path"], model, prompt, max_tokens, health)


def llama_cpp_generate_text(
    settings: Settings,
    db: VaultDatabase,
    *,
    model_id: str,
    prompt: str,
    max_tokens: int,
    grammar_path: Path | None = None,
) -> dict[str, Any]:
    health = llama_cpp_health(settings, db)
    model = _select_model(health["installed_models"], model_id)
    if not _is_usable(health["cli"]):
        return {
            "runtime": "llama_cpp",
            "status": "not_configured",
            "model_id": model_id,
            "message": "llama.cpp CLI is not configured, so no local generation was run.",
        }
    if model is None:
        return {
            "runtime": "llama_cpp",
            "status": "no_installed_model",
            "model_id": model_id,
            "message": "The selected llama.cpp model is not installed.",
        }
    if model["fixture_only"]:
        return {
            "runtime": "llama_cpp",
            "status": "fixture_only",
            "model_id": model["model_id"],
            "message": "The selected model is a tiny checksum fixture and is not inference-capable.",
        }
    if model.get("source_type") == "local_import" and not model.get("runtime_tested"):
        return {
            "runtime": "llama_cpp",
            "status": "untested",
            "model_id": model["model_id"],
            "message": "Imported local models must pass a runtime test before generation.",
        }
    return _run_llama_cli(health["cli"]["path"], model, prompt, max_tokens, health, grammar_path=grammar_path)


def _find_binary(configured_path: str | None, app_bin_dir: Path, names: tuple[str, ...]) -> dict[str, Any]:
    if configured_path:
        return _binary_status(Path(configured_path).expanduser(), "env")
    for name in names:
        app_candidate = app_bin_dir / name
        if app_candidate.exists():
            return _binary_status(app_candidate, "app_data")
    for name in names:
        path_candidate = shutil.which(name)
        if path_candidate:
            return _binary_status(Path(path_candidate), "path")
    return {"configured": False, "path": None, "source": "missing", "version": None, "error": None}


def _apply_managed_integrity(db: VaultDatabase, runtime: str, status: dict[str, Any]) -> dict[str, Any]:
    if not status.get("path"):
        return status
    integrity = runtime_integrity_for_path(db, runtime, str(status["path"]))
    if not integrity:
        if status.get("source") != "app_data":
            return status
        return {**status, "integrity_status": "unknown"}
    enriched = {
        **status,
        "managed_runtime_id": integrity["runtime_id"],
        "integrity_status": integrity["status"],
        "sha256_expected": integrity["sha256_expected"],
        "sha256_actual": integrity["sha256_actual"],
    }
    if integrity["status"] != "verified":
        return {**enriched, "configured": False, "error": integrity["error"]}
    return enriched


def _voice_model_status(configured_path: Any) -> dict[str, Any]:
    if not configured_path:
        return {"configured": False, "path": None, "source": "missing", "error": None}
    path = Path(str(configured_path)).expanduser()
    if not path.exists():
        return {"configured": False, "path": str(path), "source": "settings", "error": "model file not found"}
    if not path.is_file():
        return {"configured": False, "path": str(path), "source": "settings", "error": "model path is not a file"}
    return {"configured": True, "path": str(path), "source": "settings", "error": None, "size_bytes": path.stat().st_size}


def _binary_status(path: Path, source: str) -> dict[str, Any]:
    if not path.exists():
        return {"configured": False, "path": str(path), "source": source, "version": None, "error": "binary not found"}
    if not path.is_file():
        return {"configured": False, "path": str(path), "source": source, "version": None, "error": "path is not a file"}
    version, error = _binary_version(path)
    return {"configured": error is None, "path": str(path), "source": source, "version": version, "error": error}


def _binary_version(path: Path) -> tuple[str | None, str | None]:
    try:
        completed = subprocess.run(
            [str(path), "--version"],
            capture_output=True,
            text=True,
            timeout=2,
            check=False,
        )
    except OSError as exc:
        return None, str(exc)
    except subprocess.TimeoutExpired:
        return None, "version check timed out"
    output = (completed.stdout or completed.stderr).strip()
    first_line = output.splitlines()[0] if output else None
    if completed.returncode not in {0, 1} and not first_line:
        return None, f"version check failed with exit code {completed.returncode}"
    return first_line, None


def _installed_llama_models(db: VaultDatabase) -> list[dict[str, Any]]:
    with db.connect() as conn:
        rows = conn.execute(
            """
            SELECT model_id, display_name, kind, runtime, format, file_path, manifest_json,
                   verified_at, status, size_bytes
            FROM ai_installed_models
            WHERE workspace_id=? AND runtime='llama_cpp' AND status='installed'
            ORDER BY installed_at DESC
            """,
            (db.workspace_id,),
        ).fetchall()
    models: list[dict[str, Any]] = []
    for row in rows:
        data = dict(row)
        manifest = loads(data.pop("manifest_json"), {})
        source = manifest.get("source") or {}
        size_bytes = data.get("size_bytes")
        file_path = data.get("file_path")
        fixture_only = bool(size_bytes is not None and size_bytes < FIXTURE_MODEL_MAX_BYTES)
        if file_path and Path(file_path).exists():
            fixture_only = fixture_only or Path(file_path).stat().st_size < FIXTURE_MODEL_MAX_BYTES
        data["fixture_only"] = fixture_only
        data["source_type"] = source.get("type")
        data["trust_level"] = manifest.get("trust_level")
        data["runtime_tested"] = bool(manifest.get("runtime_tested_at"))
        models.append(data)
    return models


def _select_model(models: list[dict[str, Any]], model_id: str | None) -> dict[str, Any] | None:
    if not models:
        return None
    if not model_id:
        return models[0]
    return next((model for model in models if model["model_id"] == model_id), None)


def _is_usable(status: dict[str, Any]) -> bool:
    return bool(status.get("configured") and status.get("path") and not status.get("error"))


def _run_llama_cli(
    cli_path: str,
    model: dict[str, Any],
    prompt: str,
    max_tokens: int,
    health: dict[str, Any],
    grammar_path: Path | None = None,
) -> dict[str, Any]:
    grammar_args, grammar_mode = _grammar_args_for_cli(cli_path, grammar_path)
    command = [
        cli_path,
        "-m",
        str(model["file_path"]),
        "-p",
        prompt,
        "-n",
        str(max_tokens),
        "--single-turn",
        "--simple-io",
        "--no-display-prompt",
        "--no-warmup",
        "--no-perf",
        "--log-disable",
        "--reasoning",
        "off",
        *grammar_args,
    ]
    try:
        completed = subprocess.run(
            command,
            input="",
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except OSError as exc:
        return {
            "runtime": "llama_cpp",
            "status": "failed",
            "model_id": model["model_id"],
            "message": str(exc),
            "health": health,
        }
    except subprocess.TimeoutExpired:
        return {
            "runtime": "llama_cpp",
            "status": "failed",
            "model_id": model["model_id"],
            "message": "llama.cpp smoke prompt timed out.",
            "health": health,
        }
    raw_output = (completed.stdout or completed.stderr).strip()
    output = _clean_llama_cli_output(raw_output, prompt)
    return {
        "runtime": "llama_cpp",
        "status": "passed" if completed.returncode == 0 else "failed",
        "model_id": model["model_id"],
        "message": (output or raw_output)[:4000],
        "exit_code": completed.returncode,
        "health": health,
        "grammar_mode": grammar_mode,
    }


def _clean_llama_cli_output(output: str, prompt: str) -> str:
    if not output:
        return ""
    lines = output.replace("\r", "").splitlines()
    start_index = 0
    prompt_line = f"> {prompt}"
    for index, line in enumerate(lines):
        if line.strip() == prompt_line:
            start_index = index + 1
            break
    cleaned: list[str] = []
    for line in lines[start_index:]:
        stripped = line.strip()
        if not stripped:
            if cleaned and cleaned[-1] != "":
                cleaned.append("")
            continue
        if stripped == "Exiting..." or stripped.startswith("[ Prompt:") or stripped.startswith("[Start thinking]"):
            continue
        if stripped.startswith("Loading model"):
            continue
        cleaned.append(line)
    while cleaned and cleaned[0] == "":
        cleaned.pop(0)
    while cleaned and cleaned[-1] == "":
        cleaned.pop()
    return "\n".join(cleaned).strip()


def _grammar_args_for_cli(cli_path: str, grammar_path: Path | None) -> tuple[list[str], str | None]:
    if grammar_path is None:
        return [], None
    if not grammar_path.exists():
        return [], "missing"
    try:
        completed = subprocess.run(
            [cli_path, "--help"],
            capture_output=True,
            text=True,
            timeout=2,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return [], "unknown"
    help_text = f"{completed.stdout}\n{completed.stderr}"
    if "--grammar-file" in help_text:
        return ["--grammar-file", str(grammar_path)], "file"
    if "--grammar" in help_text:
        return ["--grammar", grammar_path.read_text()], "inline"
    return [], "unsupported"
