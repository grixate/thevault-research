from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class TextGenerationRequest:
    prompt: str
    max_tokens: int = 800


@dataclass
class TextGenerationResponse:
    text: str
    provider: str


@dataclass
class JsonGenerationRequest:
    prompt: str
    schema_name: str


@dataclass
class JsonGenerationResponse:
    data: dict
    provider: str


class LLMProvider(Protocol):
    async def generate_text(self, request: TextGenerationRequest) -> TextGenerationResponse: ...
    async def generate_json(self, request: JsonGenerationRequest) -> JsonGenerationResponse: ...


class EmbeddingProvider(Protocol):
    async def embed(self, texts: list[str]) -> list[list[float]]: ...

