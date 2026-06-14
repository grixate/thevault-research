from __future__ import annotations

from vault_core.ai.providers.base import (
    JsonGenerationRequest,
    JsonGenerationResponse,
    TextGenerationRequest,
    TextGenerationResponse,
)


class MockLLMProvider:
    async def generate_text(self, request: TextGenerationRequest) -> TextGenerationResponse:
        return TextGenerationResponse(text=request.prompt[: request.max_tokens], provider="mock")

    async def generate_json(self, request: JsonGenerationRequest) -> JsonGenerationResponse:
        return JsonGenerationResponse(data={"objects": []}, provider="mock")


class MockEmbeddingProvider:
    async def embed(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            total = sum(ord(ch) for ch in text) or 1
            vectors.append([(total % prime) / prime for prime in (101, 103, 107, 109, 113, 127)])
        return vectors

