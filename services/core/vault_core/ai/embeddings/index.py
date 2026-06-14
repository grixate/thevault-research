from __future__ import annotations

import hashlib
import json
import math
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Iterable

from vault_core.ai.embeddings.sentence_transformer import (
    AppManagedLocalEmbeddingProvider,
    local_embedding_model_fingerprint,
)
from vault_core.db.session import loads, new_id

DEFAULT_EMBEDDING_DIMENSIONS = 32
MIN_EMBEDDING_DIMENSIONS = 4
MAX_EMBEDDING_DIMENSIONS = 1024
APP_MANAGED_LOCAL_EMBEDDING_PROVIDER = "local_embedding"
LOCAL_HTTP_EMBEDDING_PROVIDER = "local_embedding_http"
LLAMA_CPP_SERVER_EMBEDDING_PROVIDER = "llama_cpp_server_embeddings"
DEFAULT_EMBEDDING_TIMEOUT_SECONDS = 15
LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}

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


@dataclass(frozen=True)
class EmbeddingSpace:
    provider: str
    model: str
    dimensions: int

    def as_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "model": self.model,
            "dimensions": self.dimensions,
            "space_id": f"{self.provider}:{self.model}:{self.dimensions}",
        }


def coerce_embedding_dimensions(value: Any) -> int:
    try:
        dimensions = int(value)
    except (TypeError, ValueError):
        return DEFAULT_EMBEDDING_DIMENSIONS
    if dimensions < MIN_EMBEDDING_DIMENSIONS:
        return DEFAULT_EMBEDDING_DIMENSIONS
    return min(dimensions, MAX_EMBEDDING_DIMENSIONS)


def current_embedding_space(conn: Any, workspace_id: str) -> EmbeddingSpace:
    space, _ = current_embedding_config(conn, workspace_id)
    return space


def current_embedding_config(conn: Any, workspace_id: str) -> tuple[EmbeddingSpace, dict[str, Any]]:
    row = conn.execute(
        """
        SELECT provider_id, model_id, settings_json
        FROM ai_capability_bindings
        WHERE workspace_id=? AND capability='embed_text'
        """,
        (workspace_id,),
    ).fetchone()
    if not row:
        return EmbeddingSpace("mock_embedding", "mock-local-embedding", DEFAULT_EMBEDDING_DIMENSIONS), {}
    settings = loads(row["settings_json"], {})
    provider = row["provider_id"] or "mock_embedding"
    model = row["model_id"] or "mock-local-embedding"
    dimensions = coerce_embedding_dimensions(settings.get("dimensions"))
    return EmbeddingSpace(provider=provider, model=model, dimensions=dimensions), settings


def embed_text(text: str, dimensions: int = DEFAULT_EMBEDDING_DIMENSIONS) -> list[float]:
    dimensions = coerce_embedding_dimensions(dimensions)
    vector = [0.0] * dimensions
    tokens = [token for token in tokenize(text) if token not in STOPWORDS]
    for token in tokens:
        add_token(vector, token, 1.0)
    for left, right in zip(tokens, tokens[1:]):
        add_token(vector, f"{left} {right}", 1.35)
    return normalize(vector)


def embed_texts_for_space(
    texts: Iterable[str],
    space: EmbeddingSpace,
    settings: dict[str, Any] | None = None,
    *,
    llama_server: Any | None = None,
    db: Any | None = None,
) -> list[list[float]]:
    text_rows = [str(text) for text in texts]
    if space.provider == APP_MANAGED_LOCAL_EMBEDDING_PROVIDER:
        return app_managed_local_embeddings(text_rows, space, settings or {})
    if space.provider == LOCAL_HTTP_EMBEDDING_PROVIDER:
        return local_http_embeddings(text_rows, space, settings or {})
    if space.provider == LLAMA_CPP_SERVER_EMBEDDING_PROVIDER:
        return llama_cpp_server_embeddings(text_rows, space, settings or {}, llama_server=llama_server, db=db)
    return [embed_text(text, space.dimensions) for text in text_rows]


def app_managed_local_embeddings(
    texts: list[str],
    space: EmbeddingSpace,
    settings: dict[str, Any],
) -> list[list[float]]:
    if not texts:
        return []
    model_path = str(settings.get("model_path") or "").strip()
    provider = AppManagedLocalEmbeddingProvider(
        model_path=model_path,
        model_id=space.model,
        dimensions=space.dimensions,
    )
    return provider.embed_sync(texts)


def app_managed_local_embedding_fingerprint(settings: dict[str, Any]) -> str:
    return local_embedding_model_fingerprint(str(settings.get("model_path") or "").strip())


def llama_cpp_server_embeddings(
    texts: list[str],
    space: EmbeddingSpace,
    settings: dict[str, Any],
    *,
    llama_server: Any | None,
    db: Any | None,
) -> list[list[float]]:
    if not texts:
        return []
    if llama_server is None or db is None:
        raise ValueError("llama.cpp server embedding provider requires the managed server runtime")
    result = llama_server.embed_texts(
        db,
        space.model,
        texts=texts,
        host=str(settings.get("server_host") or "127.0.0.1"),
        port=int(settings.get("server_port") or 8767),
        timeout_seconds=float(settings.get("timeout_seconds") or DEFAULT_EMBEDDING_TIMEOUT_SECONDS),
        startup_timeout_seconds=float(settings.get("startup_timeout_seconds") or 20),
    )
    if result.get("status") != "passed":
        raise ValueError(str(result.get("message") or "llama.cpp server embedding request failed"))
    vectors = result.get("vectors")
    if not isinstance(vectors, list):
        raise ValueError("llama.cpp server embedding provider returned malformed vectors")
    if len(vectors) != len(texts):
        raise ValueError("llama.cpp server embedding provider returned the wrong number of vectors")
    return [coerce_embedding_vector(vector, space.dimensions) for vector in vectors]


def local_http_embeddings(
    texts: list[str],
    space: EmbeddingSpace,
    settings: dict[str, Any],
) -> list[list[float]]:
    if not texts:
        return []
    endpoint_url = str(settings.get("endpoint_url") or "").strip()
    if not endpoint_url:
        raise ValueError("Local embedding HTTP provider requires settings.endpoint_url")
    validate_local_embedding_endpoint(endpoint_url)
    payload = {"model": space.model, "input": texts}
    request = urllib.request.Request(
        endpoint_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    timeout = float(settings.get("timeout_seconds") or DEFAULT_EMBEDDING_TIMEOUT_SECONDS)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise ValueError(f"Local embedding provider request failed: {exc}") from exc
    vectors = parse_embedding_response(data)
    if len(vectors) != len(texts):
        raise ValueError("Local embedding provider returned the wrong number of vectors")
    normalized_vectors = [coerce_embedding_vector(vector, space.dimensions) for vector in vectors]
    return normalized_vectors


def validate_local_embedding_endpoint(endpoint_url: str) -> None:
    parsed = urllib.parse.urlparse(endpoint_url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Local embedding endpoint must use http or https")
    if parsed.username or parsed.password:
        raise ValueError("Local embedding endpoint must not include credentials")
    hostname = parsed.hostname
    if hostname is None or hostname.lower() not in LOOPBACK_HOSTS:
        raise ValueError("Local embedding endpoint must point to localhost or loopback")


def parse_embedding_response(data: Any) -> list[list[Any]]:
    if isinstance(data, dict) and isinstance(data.get("data"), list):
        return [item.get("embedding") for item in data["data"] if isinstance(item, dict)]
    if isinstance(data, dict) and isinstance(data.get("embeddings"), list):
        return data["embeddings"]
    if isinstance(data, dict) and isinstance(data.get("vectors"), list):
        return data["vectors"]
    if isinstance(data, dict) and isinstance(data.get("embedding"), list):
        return [data["embedding"]]
    raise ValueError("Local embedding provider returned an unsupported response shape")


def coerce_embedding_vector(vector: Any, dimensions: int) -> list[float]:
    if not isinstance(vector, list):
        raise ValueError("Embedding vector must be a list")
    values = [float(value) for value in vector]
    if len(values) != dimensions:
        raise ValueError(f"Embedding vector dimensions mismatch: expected {dimensions}, got {len(values)}")
    return normalize(values)


def tokenize(text: str) -> list[str]:
    return [match.group(0).strip("_'-").lower() for match in TOKEN_RE.finditer(text) if match.group(0).strip("_'-")]


def add_token(vector: list[float], token: str, weight: float) -> None:
    digest = hashlib.sha256(token.encode("utf-8")).digest()
    index = int.from_bytes(digest[:4], "big") % len(vector)
    sign = 1.0 if digest[4] & 1 else -1.0
    vector[index] += sign * weight


def normalize(vector: list[float]) -> list[float]:
    magnitude = math.sqrt(sum(value * value for value in vector))
    if magnitude == 0:
        return vector
    return [value / magnitude for value in vector]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return sum(a * b for a, b in zip(left, right)) / (left_norm * right_norm)


def serialize_vector(vector: list[float]) -> bytes:
    return json.dumps(vector, separators=(",", ":")).encode("utf-8")


def deserialize_vector(blob: bytes | memoryview) -> list[float]:
    if isinstance(blob, memoryview):
        blob = blob.tobytes()
    return [float(value) for value in json.loads(blob.decode("utf-8"))]


def clear_embeddings_for_targets(conn: Any, workspace_id: str, target_type: str, target_ids: Iterable[str]) -> int:
    ids = list(dict.fromkeys(target_ids))
    if not ids:
        return 0
    deleted = 0
    for start in range(0, len(ids), 200):
        chunk = ids[start : start + 200]
        placeholders = ",".join("?" for _ in chunk)
        cursor = conn.execute(
            f"""
            DELETE FROM embeddings
            WHERE workspace_id=? AND target_type=? AND target_id IN ({placeholders})
            """,
            (workspace_id, target_type, *chunk),
        )
        deleted += cursor.rowcount
    return deleted


def index_source_block_embeddings(
    conn: Any,
    workspace_id: str,
    blocks: Iterable[dict[str, Any]],
    ts: str,
    *,
    llama_server: Any | None = None,
    db: Any | None = None,
) -> dict[str, Any]:
    block_rows = [{"id": str(block["id"]), "text": str(block.get("text") or "")} for block in blocks]
    space, settings = current_embedding_config(conn, workspace_id)
    if not block_rows:
        return {"indexed_blocks": 0, "embedding_space": space.as_dict()}
    vectors = embed_texts_for_space([block["text"] for block in block_rows], space, settings, llama_server=llama_server, db=db)
    for block, vector in zip(block_rows, vectors, strict=True):
        conn.execute(
            """
            DELETE FROM embeddings
            WHERE workspace_id=? AND target_type='source_block' AND target_id=?
              AND provider=? AND model=? AND dimensions=?
            """,
            (workspace_id, block["id"], space.provider, space.model, space.dimensions),
        )
        conn.execute(
            """
            INSERT INTO embeddings
              (id, workspace_id, target_type, target_id, provider, model, dimensions, vector_blob, created_at)
            VALUES (?, ?, 'source_block', ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id("emb"),
                workspace_id,
                block["id"],
                space.provider,
                space.model,
                space.dimensions,
                serialize_vector(vector),
                ts,
            ),
        )
    return {"indexed_blocks": len(block_rows), "embedding_space": space.as_dict()}


def vector_search_source_blocks(
    conn: Any,
    workspace_id: str,
    query: str,
    limit: int,
    min_score: float = 0.05,
    *,
    llama_server: Any | None = None,
    db: Any | None = None,
) -> list[dict[str, Any]]:
    space, settings = current_embedding_config(conn, workspace_id)
    query_vector = embed_texts_for_space([query], space, settings, llama_server=llama_server, db=db)[0]
    if not any(query_vector):
        return []
    rows = conn.execute(
        """
        SELECT e.target_id, e.vector_blob, b.source_id, b.text, b.locator, s.title
        FROM embeddings e
        JOIN source_blocks b ON b.id=e.target_id
        JOIN sources s ON s.id=b.source_id
        WHERE e.workspace_id=? AND e.target_type='source_block'
          AND e.provider=? AND e.model=? AND e.dimensions=? AND s.status='active'
        """,
        (workspace_id, space.provider, space.model, space.dimensions),
    ).fetchall()
    results: list[dict[str, Any]] = []
    for row in rows:
        score = max(0.0, cosine_similarity(query_vector, deserialize_vector(row["vector_blob"])))
        if score < min_score:
            continue
        results.append(
            {
                "target_type": "source_block",
                "target_id": row["target_id"],
                "title": row["title"],
                "text": row["text"],
                "score": score,
                "source_refs": [row["source_id"]],
                "locator": row["locator"],
                "embedding_space": space.as_dict(),
            }
        )
    results.sort(key=lambda item: item["score"], reverse=True)
    return results[:limit]
