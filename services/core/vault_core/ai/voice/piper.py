from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from vault_core.ai.voice.tts_base import SpeechSynthesisResponse


class PiperTextToSpeechProvider:
    def __init__(
        self,
        *,
        binary_path: str,
        model_path: str,
        model_id: str,
        output_path: str,
        voice_id: str | None = None,
        config_path: str | None = None,
        timeout_seconds: float = 60,
    ) -> None:
        self.binary_path = Path(binary_path).expanduser()
        self.model_path = Path(model_path).expanduser()
        self.model_id = model_id
        self.output_path = Path(output_path).expanduser()
        self.voice_id = voice_id
        self.config_path = Path(config_path).expanduser() if config_path else None
        self.timeout_seconds = timeout_seconds

    def synthesize(self, text: str) -> SpeechSynthesisResponse:
        self._validate()
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        command = [
            str(self.binary_path),
            "--model",
            str(self.model_path),
            "--output_file",
            str(self.output_path),
        ]
        if self.config_path:
            command.extend(["--config", str(self.config_path)])
        env = os.environ.copy()
        env.setdefault("VAULT_PIPER_PYTHON", sys.executable)
        completed = subprocess.run(
            command,
            input=text,
            text=True,
            capture_output=True,
            timeout=self.timeout_seconds,
            check=False,
            env=env,
        )
        if completed.returncode != 0:
            message = (completed.stderr or completed.stdout or "Piper synthesis failed").strip()
            raise ValueError(message)
        if not self.output_path.exists() or self.output_path.stat().st_size == 0:
            raise ValueError("Piper did not create an audio file")
        return SpeechSynthesisResponse(
            audio_path=str(self.output_path),
            duration_ms=None,
            provider="piper",
            model_id=self.model_id,
            voice_id=self.voice_id,
        )

    def _validate(self) -> None:
        if not self.binary_path.exists() or not self.binary_path.is_file():
            raise ValueError("Piper binary_path is not configured or does not exist")
        if not self.model_path.exists() or not self.model_path.is_file():
            raise ValueError("Piper model_path is not configured or does not exist")
        if self.config_path and (not self.config_path.exists() or not self.config_path.is_file()):
            raise ValueError("Piper config_path is configured but does not exist")


class UnconfiguredPiperTextToSpeechProvider:
    async def synthesize(self, text: str, voice_id: str | None = None) -> SpeechSynthesisResponse:
        return SpeechSynthesisResponse(
            audio_path="mock://piper/not-installed.wav",
            duration_ms=max(400, len(text.split()) * 330),
            provider="piper",
            model_id="not_installed",
            voice_id=voice_id,
        )
