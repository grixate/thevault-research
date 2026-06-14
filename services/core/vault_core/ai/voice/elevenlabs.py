from __future__ import annotations

from vault_core.ai.voice.tts_base import SpeechSynthesisResponse


class ElevenLabsTextToSpeechProvider:
    async def synthesize(self, text: str, voice_id: str | None = None) -> SpeechSynthesisResponse:
        return SpeechSynthesisResponse(
            audio_path="cloud://elevenlabs/disabled",
            duration_ms=None,
            provider="elevenlabs",
            model_id="disabled",
            voice_id=voice_id,
            sent_off_device=True,
        )
