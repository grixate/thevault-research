from __future__ import annotations

import fnmatch
import hashlib
import json
import re
import shutil
import threading
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from vault_core.ai.models.registry import find_registry_model
from vault_core.ai.routing import DEFAULT_CAPABILITY_BINDINGS
from vault_core.config import Settings
from vault_core.db.session import VaultDatabase, dumps, loads, new_id, now_iso, rows_to_dicts

DOWNLOAD_CHUNK_SIZE = 1024 * 1024
DOWNLOAD_TIMEOUT_SECONDS = 30
DOWNLOAD_TERMINAL_STATES = {"installed", "failed", "cancelled"}
HUGGINGFACE_BASE_URL = "https://huggingface.co"
HUGGINGFACE_COMMIT_RE = re.compile(r"^[0-9a-f]{40}$", re.IGNORECASE)
HUGGINGFACE_REPO_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9][A-Za-z0-9._-]*$")
LICENSE_FIELDS = ("license_label", "license_url", "license_path")
_MODEL_DOWNLOAD_THREADS: dict[str, threading.Thread] = {}
_MODEL_DOWNLOAD_LOCK = threading.Lock()


def list_downloads(db: VaultDatabase) -> list[dict[str, Any]]:
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT * FROM ai_model_downloads WHERE workspace_id=? ORDER BY created_at DESC",
            (db.workspace_id,),
        ).fetchall()
    downloads = rows_to_dicts(rows)
    for download in downloads:
        download["source"] = loads(download.pop("source_json"), {})
    return downloads


def download_model(db: VaultDatabase, settings: Settings, model_id: str) -> dict[str, Any]:
    model = find_registry_model(model_id)
    if not model:
        raise ValueError(f"Unknown registry model: {model_id}")
    source = model.get("source") or {"type": "builtin"}
    if source.get("type") == "builtin" or model.get("installed"):
        return _mark_builtin_installed(db, model)
    first_file = _first_file(model)
    expected_sha = first_file.get("sha256")
    if not expected_sha or expected_sha == "REQUIRED_BEFORE_RELEASE":
        raise ValueError("Registry model is missing a release checksum")
    filename = str(first_file.get("filename") or "")
    if not _safe_registry_filename(filename):
        raise ValueError("Registry model file path is invalid")
    source = _prepare_download_source(source, first_file)
    download_id = new_id("dl")
    ts = now_iso()
    target_dir = settings.data_dir / "models" / _model_storage_kind(model["kind"]) / model_id
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / filename
    bytes_total = _source_bytes_total(source, first_file)
    with db.connect() as conn:
        conn.execute(
            """
            INSERT INTO ai_model_downloads
              (id, workspace_id, model_id, state, source_json, target_path, bytes_total,
               bytes_downloaded, sha256_expected, created_at, updated_at)
            VALUES (?, ?, ?, 'queued', ?, ?, ?, 0, ?, ?, ?)
            """,
            (
                download_id,
                db.workspace_id,
                model_id,
                dumps(source),
                str(target_path),
                bytes_total,
                expected_sha,
                ts,
                ts,
            ),
        )
        db.event(conn, "ai.model_download_started", "ai_model_download", download_id, {"model_id": model_id})
    start_model_download(db, settings, download_id)
    return get_download(db, download_id)


def import_local_model(
    db: VaultDatabase,
    settings: Settings,
    *,
    file_path: str,
    display_name: str | None = None,
    model_id: str | None = None,
    capabilities: list[str] | None = None,
    license_label: str | None = "manual import",
    license_url: str | None = None,
    license_path: str | None = None,
) -> dict[str, Any]:
    source_path = Path(file_path).expanduser().resolve()
    if not source_path.exists() or not source_path.is_file():
        raise ValueError("Local model file does not exist")
    if source_path.suffix.lower() != ".gguf":
        raise ValueError("Only local .gguf model files can be imported")
    resolved_model_id = _model_id_from_import(model_id, source_path)
    resolved_display_name = display_name.strip() if display_name and display_name.strip() else _display_name_from_file(source_path)
    target_dir = settings.data_dir / "models" / "llm" / resolved_model_id
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / source_path.name
    if source_path != target_path.resolve():
        shutil.copyfile(source_path, target_path)
    size_bytes = target_path.stat().st_size
    sha256 = _file_sha256(target_path)
    ts = now_iso()
    manifest = {
        "id": resolved_model_id,
        "display_name": resolved_display_name,
        "family": "manual-import",
        "kind": "llm",
        "runtime": "llama_cpp",
        "format": "gguf",
        "capabilities": capabilities or ["summarize", "generate_note", "grounded_answer"],
        "recommended_profile": "custom",
        "license_label": license_label or "manual import",
        "license_url": license_url,
        "license_path": license_path,
        "source": {"type": "local_import", "original_path": str(source_path)},
        "files": [{"filename": target_path.name, "sha256": sha256, "size_bytes": size_bytes}],
        "trust_level": "manual_import_untrusted",
        "runtime_tested_at": None,
        "canonical_extraction_enabled": False,
        "imported_at": ts,
    }
    _write_manifest(target_dir, manifest, sha256, size_bytes)
    with db.connect() as conn:
        conn.execute(
            """
            INSERT INTO ai_installed_models
              (id, workspace_id, model_id, display_name, kind, runtime, format, file_path,
               license_label, license_url, license_path, manifest_json, installed_at, verified_at,
               sha256, size_bytes, status)
            VALUES (?, ?, ?, ?, 'llm', 'llama_cpp', 'gguf', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'installed')
            ON CONFLICT(workspace_id, model_id) DO UPDATE SET
              display_name=excluded.display_name,
              kind=excluded.kind,
              runtime=excluded.runtime,
              format=excluded.format,
              file_path=excluded.file_path,
              license_label=excluded.license_label,
              license_url=excluded.license_url,
              license_path=excluded.license_path,
              manifest_json=excluded.manifest_json,
              verified_at=excluded.verified_at,
              sha256=excluded.sha256,
              size_bytes=excluded.size_bytes,
              status='installed'
            """,
            (
                new_id("aim"),
                db.workspace_id,
                resolved_model_id,
                resolved_display_name,
                str(target_path),
                manifest.get("license_label"),
                manifest.get("license_url"),
                manifest.get("license_path"),
                dumps(manifest),
                ts,
                ts,
                sha256,
                size_bytes,
            ),
        )
        db.event(
            conn,
            "ai.model_imported",
            "ai_model",
            resolved_model_id,
            {"sha256": sha256, "bytes": size_bytes, "source": "local_import"},
            "user",
        )
    return {
        "model_id": resolved_model_id,
        "display_name": resolved_display_name,
        "status": "installed",
        "runtime": "llama_cpp",
        "format": "gguf",
        "file_path": str(target_path),
        "sha256": sha256,
        "size_bytes": size_bytes,
        "manifest": manifest,
    }


def get_download(db: VaultDatabase, download_id: str) -> dict[str, Any]:
    with db.connect() as conn:
        row = conn.execute(
            "SELECT * FROM ai_model_downloads WHERE id=? AND workspace_id=?",
            (download_id, db.workspace_id),
        ).fetchone()
    if not row:
        raise ValueError(f"Unknown download: {download_id}")
    data = dict(row)
    data["source"] = loads(data.pop("source_json"), {})
    return data


def pause_download(db: VaultDatabase, download_id: str) -> dict[str, Any]:
    return _set_download_state(db, download_id, "paused", allowed={"queued", "downloading"})


def resume_download(db: VaultDatabase, settings: Settings, download_id: str) -> dict[str, Any]:
    current = _set_download_state(db, download_id, "queued", allowed={"paused", "failed"})
    model = find_registry_model(current["model_id"])
    if not model:
        raise ValueError(f"Registry model is no longer available: {current['model_id']}")
    source = model.get("source") or {"type": "builtin"}
    _prepare_download_source(source, _first_file(model))
    with db.connect() as conn:
        db.event(conn, "ai.model_download_resumed", "ai_model_download", download_id, {"model_id": current["model_id"]})
    start_model_download(db, settings, download_id)
    return get_download(db, download_id)


def cancel_download(db: VaultDatabase, download_id: str) -> dict[str, Any]:
    return _set_download_state(db, download_id, "cancelled", allowed={"queued", "downloading", "paused", "failed"})


def model_download_thread_key(db: VaultDatabase, download_id: str) -> str:
    return f"{db.db_path}:{download_id}"


def start_model_download(db: VaultDatabase, settings: Settings, download_id: str) -> bool:
    key = model_download_thread_key(db, download_id)
    with _MODEL_DOWNLOAD_LOCK:
        existing = _MODEL_DOWNLOAD_THREADS.get(key)
        if existing and existing.is_alive():
            return False
        if existing:
            _MODEL_DOWNLOAD_THREADS.pop(key, None)

    try:
        current = get_download(db, download_id)
    except ValueError:
        return False
    if current["state"] in DOWNLOAD_TERMINAL_STATES or current["state"] == "paused":
        return False
    model = find_registry_model(current["model_id"])
    if not model:
        _fail_download(db, download_id, None, f"Registry model is no longer available: {current['model_id']}")
        return False

    thread = threading.Thread(
        target=_run_model_download_thread,
        args=(db, settings, download_id, key),
        name=f"vault-model-download-{download_id}",
        daemon=True,
    )
    with _MODEL_DOWNLOAD_LOCK:
        existing = _MODEL_DOWNLOAD_THREADS.get(key)
        if existing and existing.is_alive():
            return False
        _MODEL_DOWNLOAD_THREADS[key] = thread
    thread.start()
    return True


def _run_model_download_thread(db: VaultDatabase, settings: Settings, download_id: str, key: str) -> None:
    try:
        current = get_download(db, download_id)
        model = find_registry_model(current["model_id"])
        if not model:
            _fail_download(db, download_id, None, f"Registry model is no longer available: {current['model_id']}")
            return
        _run_model_download(db, settings, download_id, model)
    finally:
        current_thread = threading.current_thread()
        with _MODEL_DOWNLOAD_LOCK:
            if _MODEL_DOWNLOAD_THREADS.get(key) is current_thread:
                _MODEL_DOWNLOAD_THREADS.pop(key, None)


def resume_interrupted_model_downloads(db: VaultDatabase, settings: Settings) -> list[str]:
    resumable_download_ids: list[str] = []
    with db.connect() as conn:
        rows = conn.execute(
            """
            SELECT * FROM ai_model_downloads
            WHERE workspace_id=? AND state IN ('queued', 'downloading')
            ORDER BY created_at ASC
            """,
            (db.workspace_id,),
        ).fetchall()
        for row in rows:
            key = model_download_thread_key(db, row["id"])
            with _MODEL_DOWNLOAD_LOCK:
                active_thread = _MODEL_DOWNLOAD_THREADS.get(key)
                if active_thread and active_thread.is_alive():
                    continue
                if active_thread:
                    _MODEL_DOWNLOAD_THREADS.pop(key, None)

            if row["state"] == "downloading":
                conn.execute(
                    """
                    UPDATE ai_model_downloads
                    SET state='queued', error=NULL, updated_at=?
                    WHERE id=?
                    """,
                    (now_iso(), row["id"]),
                )
                db.event(
                    conn,
                    "ai.model_download_resuming",
                    "ai_model_download",
                    row["id"],
                    {"model_id": row["model_id"]},
                )
            resumable_download_ids.append(row["id"])

    started_download_ids: list[str] = []
    for download_id in resumable_download_ids:
        if start_model_download(db, settings, download_id):
            started_download_ids.append(download_id)
    return started_download_ids


def verify_installed_model(db: VaultDatabase, model_id: str) -> dict[str, Any]:
    with db.connect() as conn:
        row = conn.execute(
            "SELECT * FROM ai_installed_models WHERE workspace_id=? AND model_id=?",
            (db.workspace_id, model_id),
        ).fetchone()
        if not row:
            raise ValueError(f"Model is not installed: {model_id}")
        data = dict(row)
        file_path = data.get("file_path")
        if file_path:
            path = Path(file_path)
            if not path.exists():
                conn.execute(
                    "UPDATE ai_installed_models SET status='failed' WHERE workspace_id=? AND model_id=?",
                    (db.workspace_id, model_id),
                )
                raise ValueError(f"Installed model file is missing: {model_id}")
            actual = _file_sha256(path)
            if data.get("sha256") and actual != data["sha256"]:
                conn.execute(
                    "UPDATE ai_installed_models SET status='failed' WHERE workspace_id=? AND model_id=?",
                    (db.workspace_id, model_id),
                )
                raise ValueError("Installed model checksum mismatch")
            verified = now_iso()
            conn.execute(
                "UPDATE ai_installed_models SET verified_at=?, status='installed' WHERE workspace_id=? AND model_id=?",
                (verified, db.workspace_id, model_id),
            )
            db.event(conn, "ai.model_verified", "ai_model", model_id, {"sha256": actual})
            data["verified_at"] = verified
            data["status"] = "installed"
            data["sha256"] = actual
        return data


def mark_model_runtime_tested(db: VaultDatabase, model_id: str) -> dict[str, Any]:
    ts = now_iso()
    with db.connect() as conn:
        row = conn.execute(
            "SELECT * FROM ai_installed_models WHERE workspace_id=? AND model_id=?",
            (db.workspace_id, model_id),
        ).fetchone()
        if not row:
            raise ValueError(f"Model is not installed: {model_id}")
        data = dict(row)
        manifest = loads(data.get("manifest_json"), {})
        manifest["runtime_tested_at"] = ts
        manifest["trust_level"] = "runtime_tested"
        if data.get("kind") == "llm":
            manifest["canonical_extraction_enabled"] = True
        conn.execute(
            """
            UPDATE ai_installed_models
            SET manifest_json=?, verified_at=?, status='installed'
            WHERE workspace_id=? AND model_id=?
            """,
            (dumps(manifest), ts, db.workspace_id, model_id),
        )
        db.event(conn, "ai.model_runtime_tested", "ai_model", model_id, {"runtime": data.get("runtime")})
        data["manifest_json"] = dumps(manifest)
        data["verified_at"] = ts
        data["status"] = "installed"
    data["manifest"] = manifest
    return data


def unload_model(db: VaultDatabase, model_id: str) -> dict[str, Any]:
    ts = now_iso()
    with db.connect() as conn:
        conn.execute(
            "UPDATE ai_installed_models SET status='unloaded' WHERE workspace_id=? AND model_id=?",
            (db.workspace_id, model_id),
        )
        db.event(conn, "ai.model_unloaded", "ai_model", model_id, {}, "user")
    return {"model_id": model_id, "status": "unloaded", "updated_at": ts}


def delete_installed_model(db: VaultDatabase, settings: Settings, model_id: str) -> dict[str, Any]:
    ts = now_iso()
    with db.connect() as conn:
        row = conn.execute(
            "SELECT * FROM ai_installed_models WHERE workspace_id=? AND model_id=?",
            (db.workspace_id, model_id),
        ).fetchone()
        if not row:
            raise ValueError(f"Model is not installed: {model_id}")
        data = dict(row)
        file_path = data.get("file_path")
        conn.execute(
            "DELETE FROM ai_installed_models WHERE workspace_id=? AND model_id=?",
            (db.workspace_id, model_id),
        )
        reset_count = _reset_bindings_for_model(conn, db, model_id, ts)
        db.event(
            conn,
            "ai.model_deleted",
            "ai_model",
            model_id,
            {"reset_capabilities": reset_count, "delete_files": True},
            "user",
        )
    removed_path = None
    if file_path:
        removed_path = _safe_remove_model_path(settings, Path(file_path))
    return {"model_id": model_id, "status": "deleted", "removed_path": removed_path, "updated_at": ts}


def _first_file(model: dict[str, Any]) -> dict[str, Any]:
    files = model.get("files") or []
    if not files:
        return {"filename": f"{model['id']}.model", "sha256": None, "size_bytes": None}
    return files[0]


def _model_storage_kind(kind: str) -> str:
    if kind == "embedding":
        return "embeddings"
    if kind in {"stt", "tts"}:
        return f"voice/{kind}"
    return "llm"


def _prepare_download_source(source: dict[str, Any], first_file: dict[str, Any]) -> dict[str, Any]:
    source_type = source.get("type")
    if source_type == "local_fixture":
        if not source.get("path"):
            raise ValueError("Registry fixture source is missing a path")
        return source
    if source_type == "url":
        parsed = urllib.parse.urlparse(str(source.get("url") or ""))
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Registry URL source must be http or https")
        return source
    if source_type == "huggingface":
        return _resolve_huggingface_source(source, first_file)
    raise NotImplementedError("Only registry local_fixture, URL, and Hugging Face downloads are enabled in this build")


def _resolve_huggingface_source(source: dict[str, Any], first_file: dict[str, Any]) -> dict[str, Any]:
    repo_id = str(source.get("repo_id") or "")
    revision = str(source.get("revision") or "")
    filename = str(first_file.get("filename") or "")
    allow_patterns = source.get("allow_patterns") or []
    if not HUGGINGFACE_REPO_RE.match(repo_id) or ".." in repo_id:
        raise ValueError("Hugging Face registry source must use an approved namespace/repo id")
    if not HUGGINGFACE_COMMIT_RE.match(revision):
        raise ValueError("Hugging Face registry source must pin a 40-character commit revision")
    if not _safe_registry_filename(filename):
        raise ValueError("Registry model file path is invalid")
    if not isinstance(allow_patterns, list) or not allow_patterns:
        raise ValueError("Hugging Face registry source must define allow_patterns")
    if not any(isinstance(pattern, str) and fnmatch.fnmatch(filename, pattern) for pattern in allow_patterns):
        raise ValueError("Registry model file is not allowlisted for this Hugging Face source")
    repo_path = urllib.parse.quote(repo_id, safe="/")
    revision_path = urllib.parse.quote(revision, safe="")
    file_path = urllib.parse.quote(filename, safe="/")
    return {
        **source,
        "filename": filename,
        "resolved_url": f"{HUGGINGFACE_BASE_URL.rstrip('/')}/{repo_path}/resolve/{revision_path}/{file_path}",
    }


def _safe_registry_filename(filename: str) -> bool:
    if not filename or filename.startswith(("/", "\\")) or "\\" in filename:
        return False
    parts = filename.split("/")
    return all(part not in {"", ".", ".."} for part in parts)


def _path_inside(root: Path, candidate: Path) -> bool:
    return candidate == root or root in candidate.parents


def _source_bytes_total(source: dict[str, Any], first_file: dict[str, Any]) -> int | None:
    if source.get("type") == "local_fixture":
        source_path = _resolve_fixture_path(str(source["path"]))
        if not source_path.exists():
            raise ValueError(f"Registry fixture source missing: {source['path']}")
        return source_path.stat().st_size
    size_bytes = first_file.get("size_bytes")
    return int(size_bytes) if size_bytes else None


def _download_paths(
    settings: Settings,
    model: dict[str, Any],
    download_id: str,
    target_path: str | None,
) -> tuple[Path, Path, Path]:
    first_file = _first_file(model)
    filename = str(first_file.get("filename") or "")
    if not _safe_registry_filename(filename):
        raise ValueError("Registry model file path is invalid")
    resolved_target = (
        Path(target_path)
        if target_path
        else settings.data_dir / "models" / _model_storage_kind(model["kind"]) / model["id"] / filename
    )
    model_root = (settings.data_dir / "models").resolve()
    if not _path_inside(model_root, resolved_target.resolve()):
        raise ValueError("Registry model target path is invalid")
    target_dir = resolved_target.parent
    cache_dir = settings.data_dir / "cache" / "model_downloads"
    target_dir.mkdir(parents=True, exist_ok=True)
    cache_dir.mkdir(parents=True, exist_ok=True)
    return target_dir, resolved_target, cache_dir / f"{download_id}-{resolved_target.name}"


def _run_model_download(
    db: VaultDatabase,
    settings: Settings,
    download_id: str,
    model: dict[str, Any],
) -> dict[str, Any]:
    current = get_download(db, download_id)
    if current["state"] not in {"queued", "downloading"}:
        return current
    source = current.get("source") or model.get("source") or {"type": "builtin"}
    first_file = _first_file(model)
    expected_sha = first_file.get("sha256")
    if source.get("type") == "huggingface" and not source.get("resolved_url"):
        try:
            source = _prepare_download_source(source, first_file)
        except (NotImplementedError, ValueError) as exc:
            _fail_download(db, download_id, None, str(exc))
            return get_download(db, download_id)
    target_dir, target_path, cache_path = _download_paths(settings, model, download_id, current.get("target_path"))
    bytes_total = current.get("bytes_total") or _source_bytes_total(source, first_file)
    bytes_downloaded = cache_path.stat().st_size if cache_path.exists() else 0
    if bytes_total and bytes_downloaded > bytes_total:
        cache_path.unlink()
        bytes_downloaded = 0

    ts = now_iso()
    with db.connect() as conn:
        conn.execute(
            """
            UPDATE ai_model_downloads
            SET state='downloading', bytes_downloaded=?, bytes_total=COALESCE(?, bytes_total),
                error=NULL, updated_at=?
            WHERE id=? AND state IN ('queued', 'downloading')
            """,
            (bytes_downloaded, bytes_total, ts, download_id),
        )
    if _download_should_stop(db, download_id):
        return get_download(db, download_id)

    try:
        completed = _stream_download_source(db, download_id, source, cache_path, bytes_downloaded, bytes_total)
    except Exception as exc:
        _fail_download(db, download_id, None, str(exc))
        return get_download(db, download_id)
    if not completed:
        return get_download(db, download_id)
    if _download_should_stop(db, download_id):
        return get_download(db, download_id)
    if not cache_path.exists():
        _fail_download(db, download_id, None, "Download cache file was not created")
        return get_download(db, download_id)

    final_size = cache_path.stat().st_size
    if bytes_total and final_size < bytes_total:
        _fail_download(db, download_id, None, f"Incomplete download: {final_size} of {bytes_total} bytes")
        return get_download(db, download_id)
    _update_download_progress(db, download_id, final_size, bytes_total or final_size)
    actual_sha = _file_sha256(cache_path)
    if actual_sha != expected_sha:
        _fail_download(db, download_id, actual_sha, f"Checksum mismatch for {model['id']}")
        return get_download(db, download_id)
    if _download_should_stop(db, download_id):
        return get_download(db, download_id)
    shutil.copyfile(cache_path, target_path)
    return _install_downloaded_model(db, download_id, model, target_dir, target_path, actual_sha, final_size)


def _stream_download_source(
    db: VaultDatabase,
    download_id: str,
    source: dict[str, Any],
    cache_path: Path,
    offset: int,
    bytes_total: int | None,
) -> bool:
    if source.get("type") == "local_fixture":
        source_path = _resolve_fixture_path(str(source["path"]))
        if not source_path.exists():
            raise ValueError(f"Registry fixture source missing: {source['path']}")
        return _stream_file_source(db, download_id, source_path, cache_path, offset, bytes_total)
    if source.get("type") == "url":
        return _stream_url_source(db, download_id, str(source["url"]), cache_path, offset, bytes_total)
    if source.get("type") == "huggingface":
        return _stream_url_source(db, download_id, str(source["resolved_url"]), cache_path, offset, bytes_total)
    raise NotImplementedError("Unsupported registry download source")


def _stream_file_source(
    db: VaultDatabase,
    download_id: str,
    source_path: Path,
    cache_path: Path,
    offset: int,
    bytes_total: int | None,
) -> bool:
    source_size = source_path.stat().st_size
    if offset > source_size:
        cache_path.unlink(missing_ok=True)
        offset = 0
    if offset == source_size:
        _update_download_progress(db, download_id, offset, bytes_total or source_size)
        return True
    downloaded = offset
    mode = "ab" if offset else "wb"
    with source_path.open("rb") as source_file, cache_path.open(mode) as cache_file:
        source_file.seek(offset)
        while True:
            chunk = source_file.read(DOWNLOAD_CHUNK_SIZE)
            if not chunk:
                return True
            cache_file.write(chunk)
            cache_file.flush()
            downloaded += len(chunk)
            _update_download_progress(db, download_id, downloaded, bytes_total or source_size)
            if _download_should_stop(db, download_id):
                return False


def _stream_url_source(
    db: VaultDatabase,
    download_id: str,
    url: str,
    cache_path: Path,
    offset: int,
    bytes_total: int | None,
) -> bool:
    headers = {"Range": f"bytes={offset}-"} if offset else {}
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response:
        status = response.getcode()
        if status not in {200, 206}:
            raise ValueError(f"Download failed with HTTP {status}")
        if offset and status != 206:
            cache_path.unlink(missing_ok=True)
            offset = 0
        response_total = _http_response_total(response, bytes_total, offset)
        downloaded = offset
        mode = "ab" if offset else "wb"
        _update_download_progress(db, download_id, downloaded, response_total)
        with cache_path.open(mode) as cache_file:
            while True:
                chunk = response.read(DOWNLOAD_CHUNK_SIZE)
                if not chunk:
                    return True
                cache_file.write(chunk)
                cache_file.flush()
                downloaded += len(chunk)
                _update_download_progress(db, download_id, downloaded, response_total)
                if _download_should_stop(db, download_id):
                    return False


def _http_response_total(response: Any, fallback: int | None, offset: int) -> int | None:
    content_range = response.headers.get("Content-Range")
    if content_range and "/" in content_range:
        total = content_range.rsplit("/", 1)[-1]
        if total.isdigit():
            return int(total)
    content_length = response.headers.get("Content-Length")
    if content_length and content_length.isdigit():
        return offset + int(content_length) if response.getcode() == 206 else int(content_length)
    return fallback


def _update_download_progress(
    db: VaultDatabase,
    download_id: str,
    bytes_downloaded: int,
    bytes_total: int | None,
) -> None:
    with db.connect() as conn:
        conn.execute(
            """
            UPDATE ai_model_downloads
            SET bytes_downloaded=?, bytes_total=COALESCE(?, bytes_total), updated_at=?
            WHERE id=?
            """,
            (bytes_downloaded, bytes_total, now_iso(), download_id),
        )


def _download_should_stop(db: VaultDatabase, download_id: str) -> bool:
    with db.connect() as conn:
        row = conn.execute("SELECT state FROM ai_model_downloads WHERE id=?", (download_id,)).fetchone()
    return bool(row and row["state"] in {"paused", "cancelled"})


def _install_downloaded_model(
    db: VaultDatabase,
    download_id: str,
    model: dict[str, Any],
    target_dir: Path,
    target_path: Path,
    actual_sha: str,
    size_bytes: int,
) -> dict[str, Any]:
    manifest = _write_manifest(target_dir, model, actual_sha, size_bytes)
    completed = now_iso()
    with db.connect() as conn:
        conn.execute(
            """
            UPDATE ai_model_downloads
            SET state='installed', bytes_downloaded=?, bytes_total=COALESCE(bytes_total, ?),
                sha256_actual=?, updated_at=?, completed_at=?
            WHERE id=?
            """,
            (size_bytes, size_bytes, actual_sha, completed, completed, download_id),
        )
        conn.execute(
            """
            INSERT INTO ai_installed_models
              (id, workspace_id, model_id, display_name, kind, runtime, format, file_path,
               license_label, license_url, license_path, manifest_json, installed_at, verified_at,
               sha256, size_bytes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'installed')
            ON CONFLICT(workspace_id, model_id) DO UPDATE SET
              display_name=excluded.display_name,
              kind=excluded.kind,
              runtime=excluded.runtime,
              format=excluded.format,
              file_path=excluded.file_path,
              license_label=excluded.license_label,
              license_url=excluded.license_url,
              license_path=excluded.license_path,
              manifest_json=excluded.manifest_json,
              verified_at=excluded.verified_at,
              sha256=excluded.sha256,
              size_bytes=excluded.size_bytes,
              status='installed'
            """,
            (
                new_id("aim"),
                db.workspace_id,
                model["id"],
                model["display_name"],
                model["kind"],
                model.get("runtime", "unknown"),
                model.get("format", "unknown"),
                str(target_path),
                manifest.get("license_label"),
                manifest.get("license_url"),
                manifest.get("license_path"),
                dumps(manifest),
                completed,
                completed,
                actual_sha,
                size_bytes,
            ),
        )
        db.event(
            conn,
            "ai.model_download_completed",
            "ai_model_download",
            download_id,
            {"model_id": model["id"], "sha256": actual_sha, "bytes": size_bytes},
        )
        db.event(conn, "ai.model_installed", "ai_model", model["id"], {"download_id": download_id})
    return get_download(db, download_id)


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        while True:
            chunk = file.read(DOWNLOAD_CHUNK_SIZE)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _model_id_from_import(model_id: str | None, source_path: Path) -> str:
    candidate = model_id.strip() if model_id else source_path.stem
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", candidate).strip("-._").lower()
    if not slug:
        slug = "imported-gguf"
    if not slug.startswith("imported-"):
        slug = f"imported-{slug}"
    return slug[:96]


def _display_name_from_file(source_path: Path) -> str:
    name = re.sub(r"[-_]+", " ", source_path.stem).strip()
    return name.title() if name else "Imported GGUF Model"


def _resolve_fixture_path(relative_path: str) -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / relative_path
        if candidate.exists():
            return candidate
    return Path(relative_path).expanduser()


def _write_manifest(target_dir: Path, model: dict[str, Any], sha256: str, size_bytes: int) -> dict[str, Any]:
    manifest = {**model, "installed_sha256": sha256, "installed_size_bytes": size_bytes}
    (target_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def _mark_builtin_installed(db: VaultDatabase, model: dict[str, Any]) -> dict[str, Any]:
    download_id = new_id("dl")
    ts = now_iso()
    with db.connect() as conn:
        conn.execute(
            """
            INSERT INTO ai_model_downloads
              (id, workspace_id, model_id, state, source_json, bytes_downloaded, created_at, updated_at, completed_at)
            VALUES (?, ?, ?, 'installed', ?, 0, ?, ?, ?)
            """,
            (download_id, db.workspace_id, model["id"], dumps({"type": "builtin"}), ts, ts, ts),
        )
        conn.execute(
            """
            INSERT INTO ai_installed_models
              (id, workspace_id, model_id, display_name, kind, runtime, format,
               license_label, license_url, license_path, manifest_json, installed_at, verified_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'installed')
            ON CONFLICT(workspace_id, model_id) DO UPDATE SET
              status='installed',
              license_label=excluded.license_label,
              license_url=excluded.license_url,
              license_path=excluded.license_path,
              manifest_json=excluded.manifest_json,
              verified_at=excluded.verified_at
            """,
            (
                new_id("aim"),
                db.workspace_id,
                model["id"],
                model["display_name"],
                model["kind"],
                model.get("runtime", "mock"),
                model.get("format", "test"),
                model.get("license_label"),
                model.get("license_url"),
                model.get("license_path"),
                dumps(model),
                ts,
                ts,
            ),
        )
        db.event(conn, "ai.model_installed", "ai_model", model["id"], {"download_id": download_id})
    return get_download(db, download_id)


def _fail_download(db: VaultDatabase, download_id: str, actual_sha: str | None, error: str) -> None:
    ts = now_iso()
    with db.connect() as conn:
        row = conn.execute("SELECT state FROM ai_model_downloads WHERE id=?", (download_id,)).fetchone()
        if row and row["state"] in {"paused", "cancelled"}:
            return
        conn.execute(
            """
            UPDATE ai_model_downloads
            SET state='failed', sha256_actual=?, error=?, updated_at=?
            WHERE id=?
            """,
            (actual_sha, error, ts, download_id),
        )


def _set_download_state(
    db: VaultDatabase,
    download_id: str,
    state: str,
    allowed: set[str],
) -> dict[str, Any]:
    current = get_download(db, download_id)
    if current["state"] not in allowed:
        raise ValueError(f"Cannot set download {download_id} to {state} from {current['state']}")
    ts = now_iso()
    completed_at = ts if state == "cancelled" else current.get("completed_at")
    with db.connect() as conn:
        conn.execute(
            "UPDATE ai_model_downloads SET state=?, updated_at=?, completed_at=? WHERE id=?",
            (state, ts, completed_at, download_id),
        )
        db.event(conn, f"ai.model_download_{state}", "ai_model_download", download_id, {"model_id": current["model_id"]})
    return get_download(db, download_id)


def _reset_bindings_for_model(conn: Any, db: VaultDatabase, model_id: str, ts: str) -> int:
    rows = conn.execute(
        "SELECT capability FROM ai_capability_bindings WHERE workspace_id=? AND model_id=?",
        (db.workspace_id, model_id),
    ).fetchall()
    for row in rows:
        capability = row["capability"]
        defaults = DEFAULT_CAPABILITY_BINDINGS.get(capability)
        if not defaults:
            continue
        conn.execute(
            """
            UPDATE ai_capability_bindings
            SET provider_id=?, model_id=?, local_only=1, settings_json=?, updated_at=?
            WHERE workspace_id=? AND capability=?
            """,
            (
                defaults["provider_id"],
                defaults["model_id"],
                dumps(defaults.get("settings", {})),
                ts,
                db.workspace_id,
                capability,
            ),
        )
    return len(rows)


def _safe_remove_model_path(settings: Settings, file_path: Path) -> str | None:
    model_root = (settings.data_dir / "models").resolve()
    resolved_file = file_path.resolve()
    if model_root not in resolved_file.parents:
        raise ValueError("Refusing to delete a model path outside the Vault models directory")
    model_dir = resolved_file.parent
    if model_dir.exists():
        shutil.rmtree(model_dir)
        return str(model_dir)
    if resolved_file.exists():
        resolved_file.unlink()
        return str(resolved_file)
    return None
