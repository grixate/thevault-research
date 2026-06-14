from __future__ import annotations

from vault_core.ai.embeddings.index import DEFAULT_EMBEDDING_DIMENSIONS, embed_text


class MockEmbeddingProvider:
    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [embed_text(text, DEFAULT_EMBEDDING_DIMENSIONS) for text in texts]
