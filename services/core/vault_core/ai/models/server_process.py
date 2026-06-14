from __future__ import annotations

import json
import subprocess
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, TextIO

from vault_core.ai.models.health import FIXTURE_MODEL_MAX_BYTES, llama_cpp_health
from vault_core.config import Settings
from vault_core.db.session import VaultDatabase, now_iso


class LlamaCppServerProcessManager:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._lock = threading.Lock()
        self._process: subprocess.Popen[str] | None = None
        self._log_handle: TextIO | None = None
        self._model_id: str | None = None
        self._endpoint: str | None = None
        self._mode: str | None = None
        self._started_at: str | None = None
        self._command: list[str] = []
        self._log_path = settings.data_dir / "ai_runtime" / "llama_cpp" / "logs" / "llama-server.log"

    def status(self) -> dict[str, Any]:
        with self._lock:
            return self._status_locked()

    def start(
        self,
        db: VaultDatabase,
        model_id: str,
        *,
        host: str = "127.0.0.1",
        port: int = 8767,
        mode: str = "generation",
    ) -> dict[str, Any]:
        if host not in {"127.0.0.1", "localhost"}:
            raise ValueError("llama.cpp server host must stay on loopback")
        if port < 1 or port > 65535:
            raise ValueError("llama.cpp server port must be between 1 and 65535")
        if mode not in {"generation", "embedding"}:
            raise ValueError("llama.cpp server mode must be generation or embedding")
        health = llama_cpp_health(self.settings, db)
        server = health.get("server") or {}
        if not _usable(server):
            raise ValueError("llama.cpp server binary is not configured")
        model = _select_server_model(health.get("installed_models") or [], model_id)
        if model is None:
            raise ValueError(f"Model is not installed for llama.cpp server: {model_id}")
        _assert_server_model_ready(model)
        model_path = str(model.get("file_path") or "")
        with self._lock:
            current = self._status_locked()
            if current["state"] == "running":
                if self._model_id == model_id and self._endpoint == f"http://{host}:{port}" and self._mode == mode:
                    return {**current, "already_running": True}
                raise ValueError("llama.cpp server is already running. Stop it before loading another model.")
            self._close_log_locked()
            self._log_path.parent.mkdir(parents=True, exist_ok=True)
            self._log_handle = self._log_path.open("a", encoding="utf-8")
            self._command = [
                str(server["path"]),
                "-m",
                model_path,
                "--host",
                host,
                "--port",
                str(port),
            ]
            if mode == "embedding":
                self._command.append("--embedding")
            self._log_handle.write(f"\n[{now_iso()}] starting {' '.join(self._command)}\n")
            self._log_handle.flush()
            try:
                self._process = subprocess.Popen(
                    self._command,
                    stdout=self._log_handle,
                    stderr=subprocess.STDOUT,
                    text=True,
                )
            except OSError as exc:
                self._close_log_locked()
                self._process = None
                raise ValueError(str(exc)) from exc
            self._model_id = model_id
            self._endpoint = f"http://{host}:{port}"
            self._mode = mode
            self._started_at = now_iso()
            return self._status_locked()

    def stop(self, *, reason: str = "user") -> dict[str, Any]:
        with self._lock:
            status = self._status_locked()
            if status["state"] != "running" or self._process is None:
                return status
            self._write_log_locked(f"[{now_iso()}] stopping llama.cpp server ({reason})\n")
            self._process.terminate()
            try:
                self._process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._write_log_locked(f"[{now_iso()}] killing unresponsive llama.cpp server\n")
                self._process.kill()
                self._process.wait(timeout=5)
            stopped = self._status_locked()
            self._process = None
            self._model_id = None
            self._endpoint = None
            self._mode = None
            self._started_at = None
            self._command = []
            self._close_log_locked()
            return {**stopped, "state": "stopped", "reason": reason}

    def shutdown(self) -> None:
        self.stop(reason="shutdown")

    def generate_text(
        self,
        db: VaultDatabase,
        model_id: str,
        *,
        prompt: str,
        max_tokens: int,
        host: str = "127.0.0.1",
        port: int = 8767,
        temperature: float | None = None,
        timeout_seconds: float = 60,
        startup_timeout_seconds: float = 20,
    ) -> dict[str, Any]:
        status = self.start(db, model_id, host=host, port=port, mode="generation")
        endpoint = str(status["endpoint"])
        try:
            text = _completion_request(
                endpoint,
                model_id=model_id,
                prompt=prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                timeout_seconds=timeout_seconds,
                startup_timeout_seconds=startup_timeout_seconds,
            )
        except ValueError as exc:
            return {
                "runtime": "llama_cpp",
                "provider": "llama_cpp_server",
                "status": "failed",
                "model_id": model_id,
                "message": str(exc),
                "server_process": self.status(),
            }
        return {
            "runtime": "llama_cpp",
            "provider": "llama_cpp_server",
            "status": "passed",
            "model_id": model_id,
            "message": text,
            "server_process": self.status(),
        }

    def embed_texts(
        self,
        db: VaultDatabase,
        model_id: str,
        *,
        texts: list[str],
        host: str = "127.0.0.1",
        port: int = 8767,
        timeout_seconds: float = 60,
        startup_timeout_seconds: float = 20,
    ) -> dict[str, Any]:
        status = self.start(db, model_id, host=host, port=port, mode="embedding")
        endpoint = str(status["endpoint"])
        try:
            vectors = _embedding_request(
                endpoint,
                model_id=model_id,
                texts=texts,
                timeout_seconds=timeout_seconds,
                startup_timeout_seconds=startup_timeout_seconds,
            )
        except ValueError as exc:
            return {
                "runtime": "llama_cpp",
                "provider": "llama_cpp_server_embeddings",
                "status": "failed",
                "model_id": model_id,
                "message": str(exc),
                "server_process": self.status(),
            }
        return {
            "runtime": "llama_cpp",
            "provider": "llama_cpp_server_embeddings",
            "status": "passed",
            "model_id": model_id,
            "vectors": vectors,
            "server_process": self.status(),
        }

    def _status_locked(self) -> dict[str, Any]:
        proc = self._process
        exit_code = proc.poll() if proc is not None else None
        if proc is None:
            state = "stopped"
        elif exit_code is None:
            state = "running"
        else:
            state = "exited"
            self._close_log_locked()
        return {
            "state": state,
            "pid": proc.pid if proc and exit_code is None else None,
            "exit_code": exit_code,
            "model_id": self._model_id,
            "endpoint": self._endpoint,
            "mode": self._mode,
            "started_at": self._started_at,
            "command": self._command,
            "log_path": str(self._log_path),
            "recent_logs": self._recent_logs(),
        }

    def _write_log_locked(self, text: str) -> None:
        if self._log_handle:
            self._log_handle.write(text)
            self._log_handle.flush()

    def _close_log_locked(self) -> None:
        if self._log_handle:
            self._log_handle.close()
            self._log_handle = None

    def _recent_logs(self, max_bytes: int = 4096) -> str:
        if not self._log_path.exists():
            return ""
        size = self._log_path.stat().st_size
        with self._log_path.open("rb") as handle:
            handle.seek(max(0, size - max_bytes))
            return handle.read().decode("utf-8", errors="replace")


def _usable(status: dict[str, Any]) -> bool:
    return bool(status.get("configured") and status.get("path") and not status.get("error"))


def _select_server_model(models: list[dict[str, Any]], model_id: str) -> dict[str, Any] | None:
    return next((model for model in models if model.get("model_id") == model_id), None)


def _assert_server_model_ready(model: dict[str, Any]) -> None:
    if model.get("fixture_only"):
        raise ValueError("Fixture GGUF models cannot be loaded into llama.cpp server mode")
    file_path = model.get("file_path")
    if not file_path or not Path(str(file_path)).exists():
        raise ValueError("Selected llama.cpp model file is missing")
    if Path(str(file_path)).stat().st_size < FIXTURE_MODEL_MAX_BYTES:
        raise ValueError("Selected llama.cpp model is too small to be an inference-capable GGUF")
    if model.get("source_type") == "local_import" and not model.get("runtime_tested"):
        raise ValueError("Imported local models must pass a runtime test before server mode")


def _completion_request(
    endpoint: str,
    *,
    model_id: str,
    prompt: str,
    max_tokens: int,
    temperature: float | None,
    timeout_seconds: float,
    startup_timeout_seconds: float,
) -> str:
    openai_payload = {
        "model": model_id,
        "prompt": prompt,
        "max_tokens": max_tokens,
    }
    native_payload = {
        "prompt": prompt,
        "n_predict": max_tokens,
    }
    if temperature is not None:
        openai_payload["temperature"] = temperature
        native_payload["temperature"] = temperature
    return _post_with_startup_retry(
        [
            (f"{endpoint}/v1/completions", openai_payload),
            (f"{endpoint}/completion", native_payload),
        ],
        timeout_seconds=timeout_seconds,
        startup_timeout_seconds=startup_timeout_seconds,
    )


def _embedding_request(
    endpoint: str,
    *,
    model_id: str,
    texts: list[str],
    timeout_seconds: float,
    startup_timeout_seconds: float,
) -> list[list[Any]]:
    if not texts:
        return []
    deadline = time.monotonic() + max(0.1, startup_timeout_seconds)
    last_error: Exception | None = None
    while True:
        try:
            data = _post_json(
                f"{endpoint}/v1/embeddings",
                {"model": model_id, "input": texts},
                timeout_seconds=timeout_seconds,
            )
            return _extract_embedding_vectors(data)
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code not in {404, 405}:
                pass
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            last_error = exc
        try:
            return [
                _extract_embedding_vectors(
                    _post_json(
                        f"{endpoint}/embedding",
                        {"content": text},
                        timeout_seconds=timeout_seconds,
                    )
                )[0]
                for text in texts
            ]
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError, IndexError) as exc:
            last_error = exc
        if time.monotonic() >= deadline:
            break
        time.sleep(0.25)
    detail = str(last_error) if last_error else "no response"
    raise ValueError(f"llama.cpp server embeddings failed: {detail}")


def _post_with_startup_retry(
    attempts: list[tuple[str, dict[str, Any]]],
    *,
    timeout_seconds: float,
    startup_timeout_seconds: float,
) -> str:
    deadline = time.monotonic() + max(0.1, startup_timeout_seconds)
    last_error: Exception | None = None
    while True:
        for url, payload in attempts:
            try:
                data = _post_json(url, payload, timeout_seconds=timeout_seconds)
                return _extract_completion_text(data)
            except urllib.error.HTTPError as exc:
                if exc.code not in {404, 405}:
                    last_error = exc
                    continue
                last_error = exc
            except (urllib.error.URLError, TimeoutError, ValueError) as exc:
                last_error = exc
        if time.monotonic() >= deadline:
            break
        time.sleep(0.25)
    detail = str(last_error) if last_error else "no response"
    raise ValueError(f"llama.cpp server generation failed: {detail}")


def _post_json(url: str, payload: dict[str, Any], *, timeout_seconds: float) -> Any:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        return json.loads(response.read().decode("utf-8"))


def _extract_completion_text(data: Any) -> str:
    if isinstance(data, dict):
        choices = data.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0]
            if isinstance(first, dict):
                text = first.get("text")
                if isinstance(text, str):
                    return text.strip()
                message = first.get("message")
                if isinstance(message, dict) and isinstance(message.get("content"), str):
                    return str(message["content"]).strip()
        for key in ("content", "completion", "response", "text"):
            value = data.get(key)
            if isinstance(value, str):
                return value.strip()
    if isinstance(data, str):
        return data.strip()
    raise ValueError("llama.cpp server returned an unsupported completion response")


def _extract_embedding_vectors(data: Any) -> list[list[Any]]:
    if isinstance(data, dict) and isinstance(data.get("data"), list):
        vectors = [item.get("embedding") for item in data["data"] if isinstance(item, dict)]
        if vectors:
            return vectors
    if isinstance(data, dict):
        for key in ("embeddings", "vectors"):
            value = data.get(key)
            if isinstance(value, list) and value and all(isinstance(item, list) for item in value):
                return value
        value = data.get("embedding")
        if isinstance(value, list):
            return [value]
    raise ValueError("llama.cpp server returned an unsupported embedding response")
