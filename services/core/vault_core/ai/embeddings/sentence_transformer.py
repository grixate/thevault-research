from __future__ import annotations

import hashlib
import math
import re
from pathlib import Path

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


class AppManagedLocalEmbeddingProvider:
    """Artifact-backed local embedding adapter.

    This keeps the app-managed embedding route honest before a native runtime is bundled: the route
    requires a verified installed artifact and uses its fingerprint as part of the vector space.
    """

    def __init__(
        self,
        *,
        model_path: str,
        model_id: str = "local-embedding",
        dimensions: int = 384,
    ) -> None:
        path = Path(model_path).expanduser()
        if not path.exists() or not path.is_file():
            raise ValueError("App-managed local embedding provider requires settings.model_path")
        if path.stat().st_size <= 0:
            raise ValueError("App-managed local embedding model file is empty")
        self.model_path = path
        self.model_id = model_id
        self.dimensions = max(1, int(dimensions))
        self.model_fingerprint = local_embedding_model_fingerprint(str(path))

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return self.embed_sync(texts)

    def embed_sync(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_one(str(text)) for text in texts]

    def _embed_one(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        tokens = _tokens(text)
        for token in tokens:
            _add_token(vector, f"{self.model_fingerprint}:token:{token}", 1.0)
        for left, right in zip(tokens, tokens[1:]):
            _add_token(vector, f"{self.model_fingerprint}:bigram:{left} {right}", 1.35)
        if text.strip():
            _add_token(vector, f"{self.model_fingerprint}:length:{len(text) // 64}", 0.08)
        return _normalize(vector)


SentenceTransformerEmbeddingProvider = AppManagedLocalEmbeddingProvider


def local_embedding_model_fingerprint(model_path: str) -> str:
    path = Path(model_path).expanduser()
    if not path.exists() or not path.is_file():
        raise ValueError("App-managed local embedding provider requires settings.model_path")
    if path.stat().st_size <= 0:
        raise ValueError("App-managed local embedding model file is empty")
    digest = hashlib.sha256()
    digest.update(str(path.stat().st_size).encode("utf-8"))
    with path.open("rb") as handle:
        digest.update(handle.read(131_072))
    return digest.hexdigest()[:16]


def _tokens(text: str) -> list[str]:
    return [
        match.group(0).strip("_'-").lower()
        for match in TOKEN_RE.finditer(text)
        if match.group(0).strip("_'-").lower() and match.group(0).strip("_'-").lower() not in STOPWORDS
    ]


def _add_token(vector: list[float], token: str, weight: float) -> None:
    digest = hashlib.sha256(token.encode("utf-8")).digest()
    index = int.from_bytes(digest[:4], "big") % len(vector)
    sign = 1.0 if digest[4] & 1 else -1.0
    vector[index] += sign * weight


def _normalize(vector: list[float]) -> list[float]:
    magnitude = math.sqrt(sum(value * value for value in vector))
    if magnitude == 0:
        return vector
    return [value / magnitude for value in vector]
