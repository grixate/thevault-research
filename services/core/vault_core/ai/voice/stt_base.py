from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel


class TranscriptionSegment(BaseModel):
    start_ms: int
    end_ms: int
    text: str
    confidence: float | None = None


class TranscriptionResponse(BaseModel):
    text: str
    segments: list[TranscriptionSegment]
    language_detected: str | None = None
    provider: str
    model_id: str
    sent_off_device: bool = False


class SpeechToTextProvider(Protocol):
    async def transcribe(self, audio_path: str) -> TranscriptionResponse: ...

