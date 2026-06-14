from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel


class SpeechSynthesisResponse(BaseModel):
    audio_path: str
    duration_ms: int | None
    provider: str
    model_id: str
    voice_id: str | None
    sent_off_device: bool = False


class TextToSpeechProvider(Protocol):
    async def synthesize(self, text: str, voice_id: str | None = None) -> SpeechSynthesisResponse: ...

