from __future__ import annotations

from typing import Any, Protocol


class RerankerProvider(Protocol):
    async def rerank(self, query: str, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]: ...

