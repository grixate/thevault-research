from __future__ import annotations

from typing import Any


class MockRerankerProvider:
    async def rerank(self, query: str, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
        terms = set(query.lower().split())
        ranked = []
        for candidate in candidates:
            text = str(candidate.get("text") or candidate.get("snippet") or "")
            ranked.append({**candidate, "score": len(terms.intersection(text.lower().split()))})
        return sorted(ranked, key=lambda item: item["score"], reverse=True)

