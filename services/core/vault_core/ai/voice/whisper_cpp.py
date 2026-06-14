from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from vault_core.ai.voice.stt_base import TranscriptionResponse, TranscriptionSegment


class WhisperCppSpeechToTextProvider:
    def __init__(
        self,
        *,
        binary_path: str,
        model_path: str,
        model_id: str,
        language: str | None = None,
        translate_to_english: bool = False,
        timestamps: bool = True,
        timeout_seconds: float = 120,
    ) -> None:
        self.binary_path = Path(binary_path).expanduser()
        self.model_path = Path(model_path).expanduser()
        self.model_id = model_id
        self.language = language
        self.translate_to_english = translate_to_english
        self.timestamps = timestamps
        self.timeout_seconds = timeout_seconds

    def transcribe(self, audio_path: str) -> TranscriptionResponse:
        audio = Path(audio_path).expanduser()
        self._validate(audio)
        with tempfile.TemporaryDirectory(prefix="vault-whisper-") as temp_dir:
            output_base = Path(temp_dir) / "transcript"
            command = [
                str(self.binary_path),
                "-m",
                str(self.model_path),
                "-f",
                str(audio),
                "-oj",
                "-of",
                str(output_base),
            ]
            if self.language:
                command.extend(["-l", self.language])
            if self.translate_to_english:
                command.append("-tr")
            if not self.timestamps:
                command.append("-nt")
            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
                check=False,
            )
            if completed.returncode != 0:
                message = (completed.stderr or completed.stdout or "whisper.cpp transcription failed").strip()
                raise ValueError(message[:1000])
            json_path = output_base.with_suffix(".json")
            raw_output = json_path.read_text() if json_path.exists() else completed.stdout or completed.stderr
        return parse_whisper_cpp_output(raw_output, self.model_id)

    def _validate(self, audio_path: Path) -> None:
        if not self.binary_path.exists() or not self.binary_path.is_file():
            raise ValueError("whisper.cpp binary_path is not configured or does not exist")
        if not self.model_path.exists() or not self.model_path.is_file():
            raise ValueError("whisper.cpp model_path is not configured or does not exist")
        if not audio_path.exists() or not audio_path.is_file():
            raise ValueError("Audio file for whisper.cpp transcription does not exist")


def parse_whisper_cpp_output(raw_output: str, model_id: str) -> TranscriptionResponse:
    raw_output = raw_output.strip()
    if not raw_output:
        raise ValueError("whisper.cpp produced no transcript output")
    try:
        data = json.loads(raw_output)
    except json.JSONDecodeError:
        return _plain_text_response(raw_output, model_id)
    if isinstance(data, dict):
        segments = _segments_from_data(data)
        text = str(data.get("text") or " ".join(segment.text for segment in segments)).strip()
        language = data.get("language") or data.get("language_detected")
        if not text and not segments:
            return _plain_text_response(raw_output, model_id)
        if not segments and text:
            segments = [TranscriptionSegment(start_ms=0, end_ms=0, text=text)]
        return TranscriptionResponse(
            text=text,
            segments=segments,
            language_detected=str(language) if language else None,
            provider="whisper_cpp",
            model_id=model_id,
        )
    if isinstance(data, list):
        segments = [_segment_from_item(item, index) for index, item in enumerate(data) if isinstance(item, dict)]
        segments = [segment for segment in segments if segment.text]
        text = " ".join(segment.text for segment in segments).strip()
        return TranscriptionResponse(text=text, segments=segments, provider="whisper_cpp", model_id=model_id)
    return _plain_text_response(raw_output, model_id)


def _segments_from_data(data: dict[str, Any]) -> list[TranscriptionSegment]:
    rows = data.get("segments")
    if rows is None:
        rows = data.get("transcription")
    if not isinstance(rows, list):
        return []
    segments = [_segment_from_item(item, index) for index, item in enumerate(rows) if isinstance(item, dict)]
    return [segment for segment in segments if segment.text]


def _segment_from_item(item: dict[str, Any], index: int) -> TranscriptionSegment:
    timestamps = item.get("timestamps") if isinstance(item.get("timestamps"), dict) else {}
    start_ms = _coerce_ms(
        item.get("start_ms")
        or item.get("t0")
        or item.get("start")
        or item.get("from")
        or timestamps.get("from")
        or 0
    )
    end_ms = _coerce_ms(
        item.get("end_ms")
        or item.get("t1")
        or item.get("end")
        or item.get("to")
        or timestamps.get("to")
        or start_ms
    )
    text = str(item.get("text") or item.get("sentence") or "").strip()
    confidence = item.get("confidence")
    return TranscriptionSegment(
        start_ms=start_ms,
        end_ms=end_ms,
        text=text,
        confidence=float(confidence) if confidence is not None else None,
    )


def _coerce_ms(value: Any) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value * 1000) if value < 10_000 else int(value)
    text = str(value).strip()
    if not text:
        return 0
    if text.isdigit():
        parsed = int(text)
        return parsed
    if re.match(r"^\d+(\.\d+)?$", text):
        number = float(text)
        return int(number * 1000) if number < 10_000 else int(number)
    match = re.match(r"(?:(\d+):)?(\d+):(\d+)[,.](\d+)", text)
    if match:
        hours = int(match.group(1) or 0)
        minutes = int(match.group(2))
        seconds = int(match.group(3))
        millis = int(match.group(4).ljust(3, "0")[:3])
        return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis
    return 0


def _plain_text_response(text: str, model_id: str) -> TranscriptionResponse:
    cleaned = text.strip()
    return TranscriptionResponse(
        text=cleaned,
        segments=[TranscriptionSegment(start_ms=0, end_ms=0, text=cleaned)],
        provider="whisper_cpp",
        model_id=model_id,
    )
