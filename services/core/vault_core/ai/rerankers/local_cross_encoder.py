from __future__ import annotations

import hashlib
import math
import re
from pathlib import Path
from typing import Any

TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9_'-]*", re.IGNORECASE)
STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "with",
}


class LocalCrossEncoderReranker:
    """App-managed local reranker adapter for installed cross-encoder artifacts.

    The current implementation is deterministic and dependency-free, but it enforces the same
    installed-artifact path used by production model packs. A real cross-encoder backend can replace
    the scoring internals without changing routing, setup, or readiness contracts.
    """

    def __init__(
        self,
        *,
        model_path: str,
        model_id: str = "local-cross-encoder",
        max_length: int = 512,
        batch_size: int = 8,
    ) -> None:
        path = Path(model_path).expanduser()
        if not path.exists() or not path.is_file():
            raise ValueError("Local cross-encoder reranker requires an installed model file")
        if path.stat().st_size <= 0:
            raise ValueError("Local cross-encoder reranker model file is empty")
        self.model_path = path
        self.model_id = model_id
        self.max_length = max(16, int(max_length or 512))
        self.batch_size = max(1, int(batch_size or 8))
        digest = hashlib.sha256()
        digest.update(str(path.stat().st_size).encode("utf-8"))
        with path.open("rb") as handle:
            digest.update(handle.read(65_536))
        self._model_fingerprint = digest.hexdigest()[:12]

    async def rerank(self, query: str, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return self.rerank_sync(query, candidates)

    def rerank_sync(self, query: str, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
        query_tokens = _tokens(query)[: self.max_length]
        ranked = []
        for index, candidate in enumerate(candidates):
            score = self._score_candidate(query, query_tokens, candidate, index)
            ranked.append(
                {
                    **candidate,
                    "score": score,
                    "rerank_score": score,
                    "reranker_model": self.model_id,
                }
            )
        ranked.sort(key=lambda item: float(item.get("rerank_score") or item.get("score") or 0), reverse=True)
        return ranked

    def _score_candidate(
        self,
        query: str,
        query_tokens: list[str],
        candidate: dict[str, Any],
        index: int,
    ) -> float:
        text = str(candidate.get("text") or candidate.get("snippet") or "")
        title = str(candidate.get("title") or "")
        candidate_tokens = _tokens(f"{title} {text}")[: self.max_length]
        if not query_tokens or not candidate_tokens:
            return 0.0

        query_terms = set(query_tokens)
        candidate_terms = set(candidate_tokens)
        overlap = query_terms & candidate_terms
        precision = len(overlap) / max(1, len(query_terms))
        recallish = len(overlap) / max(1, math.sqrt(len(candidate_terms)))
        ordered_bonus = _ordered_bigram_bonus(query_tokens, candidate_tokens)
        phrase_bonus = 0.2 if query.strip().lower() and query.strip().lower() in f"{title} {text}".lower() else 0.0
        title_bonus = 0.15 * len(overlap & set(_tokens(title)))
        # Stable tie-breaker keeps runs deterministic while avoiding input-order dominance.
        tie_breaker = int(hashlib.sha256(f"{self._model_fingerprint}:{index}:{text[:80]}".encode("utf-8")).hexdigest()[:6], 16) / 10_000_000_000
        return round(precision * 2.0 + recallish + ordered_bonus + phrase_bonus + title_bonus + tie_breaker, 6)


def _tokens(text: str) -> list[str]:
    return [
        match.group(0).strip("_'-").lower()
        for match in TOKEN_RE.finditer(text)
        if match.group(0).strip("_'-").lower() and match.group(0).strip("_'-").lower() not in STOPWORDS
    ]


def _ordered_bigram_bonus(query_tokens: list[str], candidate_tokens: list[str]) -> float:
    if len(query_tokens) < 2 or len(candidate_tokens) < 2:
        return 0.0
    query_bigrams = set(zip(query_tokens, query_tokens[1:]))
    candidate_bigrams = set(zip(candidate_tokens, candidate_tokens[1:]))
    return 0.35 * len(query_bigrams & candidate_bigrams) / max(1, len(query_bigrams))
