from __future__ import annotations

import hashlib
import json
import os
import platform as py_platform
import shutil
import stat
import subprocess
import sys
import tarfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path
from typing import Any

from vault_core.api.schemas import AIRuntimeInfo, AIReadinessCheck
from vault_core.config import Settings
from vault_core.db.session import VaultDatabase, dumps, loads, new_id, now_iso, rows_to_dicts

REGISTRY_PATH = Path(__file__).with_name("runtime_registry.json")
RUNTIME_DOWNLOAD_CHUNK_SIZE = 1024 * 1024
RUNTIME_DOWNLOAD_TIMEOUT_SECONDS = 30
RUNTIME_SMOKE_TIMEOUT_SECONDS = 3
RUNTIME_PLATFORMS = {"any", "macos", "windows", "linux"}
RUNTIME_ARCHES = {"any", "arm64", "x64"}


def load_runtime_registry() -> dict[str, Any]:
    return json.loads(REGISTRY_PATH.read_text())


def find_runtime(runtime_id: str) -> dict[str, Any] | None:
    for runtime in load_runtime_registry().get("runtimes", []):
        if runtime.get("id") == runtime_id:
            return runtime
    return None


def runtime_readiness_checks(runtime: dict[str, Any]) -> list[AIReadinessCheck]:
    return _runtime_readiness_checks(runtime)


def current_runtime_target() -> dict[str, str]:
    system = py_platform.system().lower()
    os_name = "macos" if system == "darwin" else "windows" if system == "windows" else "linux"
    machine = py_platform.machine().lower()
    arch = "arm64" if machine in {"arm64", "aarch64"} else "x64" if machine in {"x86_64", "amd64"} else "unknown"
    return {"platform": os_name, "arch": arch}


def runtime_compatibility(runtime: dict[str, Any], target: dict[str, str] | None = None) -> dict[str, Any]:
    target = target or current_runtime_target()
    runtime_platform = str(runtime.get("platform") or "any").lower()
    runtime_arch = str(runtime.get("arch") or "any").lower()
    host_platform = target.get("platform", "unknown")
    host_arch = target.get("arch", "unknown")
    if runtime_platform not in RUNTIME_PLATFORMS:
        return {
            "compatible": False,
            "reason": f"Runtime platform is unsupported: {runtime_platform}.",
            "host_platform": host_platform,
            "host_arch": host_arch,
        }
    if runtime_arch not in RUNTIME_ARCHES:
        return {
            "compatible": False,
            "reason": f"Runtime architecture is unsupported: {runtime_arch}.",
            "host_platform": host_platform,
            "host_arch": host_arch,
        }
    if runtime_platform != "any" and runtime_platform != host_platform:
        return {
            "compatible": False,
            "reason": (
                f"Runtime target {runtime_platform}/{runtime_arch} does not match this host "
                f"{host_platform}/{host_arch}."
            ),
            "host_platform": host_platform,
            "host_arch": host_arch,
        }
    if runtime_arch != "any" and runtime_arch != host_arch:
        return {
            "compatible": False,
            "reason": (
                f"Runtime target {runtime_platform}/{runtime_arch} does not match this host "
                f"{host_platform}/{host_arch}."
            ),
            "host_platform": host_platform,
            "host_arch": host_arch,
        }
    return {"compatible": True, "reason": None, "host_platform": host_platform, "host_arch": host_arch}


def list_runtime_infos(db: VaultDatabase, settings: Settings) -> list[AIRuntimeInfo]:
    installed = _installed_by_runtime_id(db)
    infos: list[AIRuntimeInfo] = []
    target = current_runtime_target()
    for runtime in load_runtime_registry().get("runtimes", []):
        row = installed.get(runtime["id"])
        first_file = _first_file(runtime)
        source = runtime.get("source") or {}
        readiness_checks = _runtime_readiness_checks(runtime)
        blocked_reasons = _runtime_blocked_reasons(runtime)
        compatibility = runtime_compatibility(runtime, target)
        integrity = _runtime_integrity(row) if row else _empty_integrity()
        row_status = row.get("status") if row else "not_installed"
        status = "failed" if row and integrity["status"] != "verified" else row_status
        runtime_blockers = [*blocked_reasons]
        if compatibility["reason"]:
            runtime_blockers.append(str(compatibility["reason"]))
        if row and integrity["error"]:
            runtime_blockers.append(str(integrity["error"]))
        installable = not blocked_reasons and compatibility["compatible"] and source.get("type") in {"local_fixture", "url"}
        infos.append(
            AIRuntimeInfo(
                id=runtime["id"],
                display_name=runtime["display_name"],
                runtime=runtime["runtime"],
                release_channel=runtime.get("release_channel", "production"),
                version=runtime.get("version"),
                platform=runtime.get("platform", "any"),
                arch=runtime.get("arch", "any"),
                compatible=bool(compatibility["compatible"]),
                host_platform=compatibility["host_platform"],
                host_arch=compatibility["host_arch"],
                compatibility_error=compatibility["reason"],
                binary_name=runtime.get("binary_name") or first_file.get("filename", runtime["id"]),
                installed=bool(row and status == "installed" and integrity["status"] == "verified"),
                install_state=status,
                installable=installable,
                source_type=source.get("type"),
                binary_path=row.get("binary_path") if row else None,
                size_bytes=row.get("size_bytes") if row else first_file.get("size_bytes"),
                sha256=row.get("sha256") if row else first_file.get("sha256"),
                sha256_actual=integrity["sha256_actual"],
                integrity_status=integrity["status"],
                integrity_error=integrity["error"],
                license_label=runtime.get("license_label"),
                license_url=runtime.get("license_url"),
                license_path=runtime.get("license_path"),
                blocked_reasons=_dedupe(runtime_blockers),
                readiness_checks=readiness_checks,
                install_log=_install_log(row),
            )
        )
    return infos


def runtime_integrity_for_path(db: VaultDatabase, runtime: str, binary_path: str | None) -> dict[str, Any] | None:
    if not binary_path:
        return None
    with db.connect() as conn:
        row = conn.execute(
            """
            SELECT *
            FROM ai_runtime_installs
            WHERE workspace_id=? AND runtime=? AND binary_path=?
            """,
            (db.workspace_id, runtime, binary_path),
        ).fetchone()
    if not row:
        return None
    data = dict(row)
    integrity = _runtime_integrity(data)
    return {
        "runtime_id": data["runtime_id"],
        "status": integrity["status"],
        "error": integrity["error"],
        "sha256_expected": data.get("sha256"),
        "sha256_actual": integrity["sha256_actual"],
    }


def install_runtime(db: VaultDatabase, settings: Settings, runtime_id: str) -> dict[str, Any]:
    runtime = find_runtime(runtime_id)
    if not runtime:
        raise ValueError(f"Unknown runtime: {runtime_id}")
    compatibility = runtime_compatibility(runtime)
    blocked_reasons = [*_runtime_blocked_reasons(runtime)]
    if compatibility["reason"]:
        blocked_reasons.append(str(compatibility["reason"]))
    if blocked_reasons:
        raise ValueError(" ".join(blocked_reasons))
    first_file = _first_file(runtime)
    source = runtime.get("source") or {}
    artifact_filename = str(first_file.get("filename") or runtime.get("binary_name") or runtime_id)
    if not _safe_registry_filename(artifact_filename):
        if _runtime_archive_member(source):
            raise ValueError("Registry runtime artifact path is invalid")
        raise ValueError("Registry runtime binary path is invalid")
    target_filename = _runtime_target_filename(runtime, source, artifact_filename)
    if not _safe_registry_filename(target_filename):
        raise ValueError("Registry runtime binary path is invalid")
    prepared = _prepare_runtime_source(settings, runtime, source, first_file, artifact_filename)
    target_dir = _runtime_bin_dir(settings, runtime["runtime"])
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / target_filename
    if not _path_inside(target_dir.resolve(), target_path.resolve()):
        raise ValueError("Registry runtime target path is invalid")
    target_path.parent.mkdir(parents=True, exist_ok=True)
    if prepared.get("archive_member"):
        _copy_extracted_runtime_tree(Path(prepared["binary_path"]).parent, target_dir)
        if Path(prepared["binary_path"]).name != target_filename:
            shutil.copyfile(prepared["binary_path"], target_path)
    else:
        shutil.copyfile(prepared["binary_path"], target_path)
    if first_file.get("executable"):
        target_path.chmod(target_path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    size_bytes = target_path.stat().st_size
    actual_sha = _file_sha256(target_path)
    _write_runtime_manifest(target_dir.parent, runtime, actual_sha, size_bytes, target_path)
    ts = now_iso()
    install_log = [
        _runtime_log_entry(
            "install",
            "installed",
            f"Copied {runtime['display_name']} to managed runtime storage.",
            binary_path=str(target_path),
            source_type=source.get("type"),
            sha256=actual_sha,
            size_bytes=size_bytes,
            source_artifact_path=str(prepared["artifact_path"]),
            source_artifact_sha256=prepared["artifact_sha256"],
            source_artifact_size_bytes=prepared["artifact_size_bytes"],
            archive_member=prepared.get("archive_member"),
        )
    ]
    with db.connect() as conn:
        conn.execute(
            """
            INSERT INTO ai_runtime_installs
              (id, workspace_id, runtime_id, display_name, runtime, version, binary_path,
               manifest_json, installed_at, verified_at, sha256, size_bytes, status, install_log_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'installed', ?)
            ON CONFLICT(workspace_id, runtime_id) DO UPDATE SET
              display_name=excluded.display_name,
              runtime=excluded.runtime,
              version=excluded.version,
              binary_path=excluded.binary_path,
              manifest_json=excluded.manifest_json,
              installed_at=excluded.installed_at,
              verified_at=excluded.verified_at,
              sha256=excluded.sha256,
              size_bytes=excluded.size_bytes,
              status='installed',
              install_log_json=excluded.install_log_json
            """,
            (
                new_id("air"),
                db.workspace_id,
                runtime["id"],
                runtime["display_name"],
                runtime["runtime"],
                runtime.get("version"),
                str(target_path),
                dumps(runtime),
                ts,
                ts,
                actual_sha,
                size_bytes,
                dumps(install_log),
            ),
        )
        db.event(
            conn,
            "ai.runtime_installed",
            "ai_runtime",
            runtime["id"],
            {
                "runtime": runtime["runtime"],
                "binary_path": str(target_path),
                "sha256": actual_sha,
                "source_type": source.get("type"),
            },
            "user",
        )
    return verify_runtime(db, runtime_id)


def verify_runtime(db: VaultDatabase, runtime_id: str) -> dict[str, Any]:
    failure: str | None = None
    result: dict[str, Any] | None = None
    with db.connect() as conn:
        row = conn.execute(
            "SELECT * FROM ai_runtime_installs WHERE workspace_id=? AND runtime_id=?",
            (db.workspace_id, runtime_id),
        ).fetchone()
        if not row:
            raise ValueError(f"Runtime is not installed: {runtime_id}")
        data = dict(row)
        path = Path(data["binary_path"])
        if not path.exists() or not path.is_file():
            logs = _append_runtime_log(
                conn,
                db,
                runtime_id,
                data,
                _runtime_log_entry(
                    "verify",
                    "failed",
                    f"Installed runtime binary is missing: {runtime_id}.",
                    binary_path=str(path),
                ),
            )
            conn.execute(
                """
                UPDATE ai_runtime_installs
                SET status='failed', install_log_json=?
                WHERE workspace_id=? AND runtime_id=?
                """,
                (dumps(logs), db.workspace_id, runtime_id),
            )
            failure = f"Installed runtime binary is missing: {runtime_id}"
        else:
            actual_sha = _file_sha256(path)
            if data.get("sha256") and actual_sha != data["sha256"]:
                logs = _append_runtime_log(
                    conn,
                    db,
                    runtime_id,
                    data,
                    _runtime_log_entry(
                        "verify",
                        "failed",
                        "Installed runtime checksum mismatch.",
                        binary_path=str(path),
                        sha256_expected=data.get("sha256"),
                        sha256_actual=actual_sha,
                    ),
                )
                conn.execute(
                    """
                    UPDATE ai_runtime_installs
                    SET status='failed', install_log_json=?
                    WHERE workspace_id=? AND runtime_id=?
                    """,
                    (dumps(logs), db.workspace_id, runtime_id),
                )
                failure = "Installed runtime checksum mismatch"
            else:
                manifest = loads(data.get("manifest_json"), {})
                smoke = _runtime_binary_smoke(manifest, path)
                if smoke["status"] != "pass":
                    logs = _append_runtime_log(
                        conn,
                        db,
                        runtime_id,
                        data,
                        _runtime_log_entry(
                            "verify",
                            "failed",
                            "Runtime executable smoke check failed.",
                            binary_path=str(path),
                            sha256=actual_sha,
                            smoke_error=smoke.get("error"),
                            exit_code=smoke.get("exit_code"),
                            stdout=smoke.get("stdout"),
                            stderr=smoke.get("stderr"),
                        ),
                    )
                    conn.execute(
                        """
                        UPDATE ai_runtime_installs
                        SET status='failed', size_bytes=?, sha256=?, install_log_json=?
                        WHERE workspace_id=? AND runtime_id=?
                        """,
                        (path.stat().st_size, actual_sha, dumps(logs), db.workspace_id, runtime_id),
                    )
                    failure = f"Runtime executable smoke check failed: {smoke['error']}"
                else:
                    verified_at = now_iso()
                    size_bytes = path.stat().st_size
                    logs = _append_runtime_log(
                        conn,
                        db,
                        runtime_id,
                        data,
                        _runtime_log_entry(
                            "verify",
                            "installed",
                            "Runtime binary checksum and executable smoke verified.",
                            binary_path=str(path),
                            sha256=actual_sha,
                            size_bytes=size_bytes,
                            version=smoke.get("version"),
                            command=smoke.get("command"),
                            exit_code=smoke.get("exit_code"),
                        ),
                    )
                    conn.execute(
                        """
                        UPDATE ai_runtime_installs
                        SET verified_at=?, status='installed', size_bytes=?, sha256=?, install_log_json=?
                        WHERE workspace_id=? AND runtime_id=?
                        """,
                        (verified_at, size_bytes, actual_sha, dumps(logs), db.workspace_id, runtime_id),
                    )
                    db.event(
                        conn,
                        "ai.runtime_verified",
                        "ai_runtime",
                        runtime_id,
                        {"sha256": actual_sha, "version": smoke.get("version")},
                    )
                    result = {
                        "runtime_id": runtime_id,
                        "status": "installed",
                        "binary_path": str(path),
                        "sha256": actual_sha,
                        "verified_at": verified_at,
                        "version": smoke.get("version"),
                    }
    if failure:
        raise ValueError(failure)
    if result:
        return result
    raise ValueError(f"Runtime verification failed: {runtime_id}")


def delete_runtime(db: VaultDatabase, settings: Settings, runtime_id: str) -> dict[str, Any]:
    with db.connect() as conn:
        row = conn.execute(
            "SELECT * FROM ai_runtime_installs WHERE workspace_id=? AND runtime_id=?",
            (db.workspace_id, runtime_id),
        ).fetchone()
        if not row:
            raise ValueError(f"Runtime is not installed: {runtime_id}")
        data = dict(row)
        conn.execute(
            "DELETE FROM ai_runtime_installs WHERE workspace_id=? AND runtime_id=?",
            (db.workspace_id, runtime_id),
        )
        db.event(conn, "ai.runtime_deleted", "ai_runtime", runtime_id, {}, "user")
    removed_path = _safe_remove_runtime_path(settings, Path(data["binary_path"]))
    removed_manifest = _safe_remove_runtime_path(settings, settings.data_dir / "ai_runtime" / data["runtime"] / f"{runtime_id}.manifest.json")
    return {"runtime_id": runtime_id, "status": "deleted", "removed_path": removed_path, "removed_manifest": removed_manifest}


def _installed_by_runtime_id(db: VaultDatabase) -> dict[str, dict[str, Any]]:
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT * FROM ai_runtime_installs WHERE workspace_id=?",
            (db.workspace_id,),
        ).fetchall()
    installed = rows_to_dicts(rows)
    for row in installed:
        row["manifest"] = loads(row.get("manifest_json"), {})
        row["install_log"] = _install_log(row)
    return {row["runtime_id"]: row for row in installed}


def _install_log(row: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not row:
        return []
    try:
        data = loads(row.get("install_log_json"), [])
    except json.JSONDecodeError:
        return []
    return data if isinstance(data, list) else []


def _runtime_log_entry(action: str, status: str, detail: str, **metadata: Any) -> dict[str, Any]:
    return {
        "created_at": now_iso(),
        "action": action,
        "status": status,
        "detail": detail,
        **{key: value for key, value in metadata.items() if value is not None},
    }


def _append_runtime_log(
    conn: Any,
    db: VaultDatabase,
    runtime_id: str,
    row: dict[str, Any],
    entry: dict[str, Any],
) -> list[dict[str, Any]]:
    logs = [*_install_log(row), entry][-50:]
    conn.execute(
        """
        UPDATE ai_runtime_installs
        SET install_log_json=?
        WHERE workspace_id=? AND runtime_id=?
        """,
        (dumps(logs), db.workspace_id, runtime_id),
    )
    return logs


def _empty_integrity() -> dict[str, Any]:
    return {"status": "unknown", "error": None, "sha256_actual": None}


def _runtime_integrity(row: dict[str, Any] | None) -> dict[str, Any]:
    if not row:
        return _empty_integrity()
    path = Path(row["binary_path"])
    row_status = row.get("status")
    if row_status == "failed":
        return {
            "status": "failed",
            "error": "Managed runtime is marked failed. Reinstall or delete it before use.",
            "sha256_actual": None,
        }
    if not path.exists() or not path.is_file():
        return {
            "status": "missing",
            "error": "Installed runtime binary is missing. Reinstall or delete it before use.",
            "sha256_actual": None,
        }
    actual_sha = _file_sha256(path)
    expected_sha = row.get("sha256")
    if expected_sha and actual_sha != expected_sha:
        return {
            "status": "mismatch",
            "error": "Installed runtime checksum mismatch. Reinstall or delete it before use.",
            "sha256_actual": actual_sha,
        }
    return {"status": "verified", "error": None, "sha256_actual": actual_sha}


def _runtime_blocked_reasons(runtime: dict[str, Any]) -> list[str]:
    if runtime.get("release_channel") == "demo":
        return []
    return _dedupe([check.detail for check in _runtime_readiness_checks(runtime) if check.status == "blocked"])


def _runtime_readiness_checks(runtime: dict[str, Any]) -> list[AIReadinessCheck]:
    if runtime.get("release_channel") == "demo":
        return [
            AIReadinessCheck(
                id=f"{runtime['id']}:release-channel",
                label="Release channel",
                status="warn",
                detail="Demo runtime fixture is not a release-approved production binary.",
                action="Use production runtime manifests for real local AI.",
            )
        ]
    checks: list[AIReadinessCheck] = []
    source = runtime.get("source") or {}
    source_text = json.dumps(source)
    if not source:
        checks.append(
            AIReadinessCheck(
                id=f"{runtime['id']}:source",
                label="Source",
                status="blocked",
                detail="Approved runtime source pending.",
                action="Pin an approved runtime URL or bundled artifact.",
            )
        )
    elif "REPLACE_WITH_APPROVED" in source_text:
        checks.append(
            AIReadinessCheck(
                id=f"{runtime['id']}:source",
                label="Source",
                status="blocked",
                detail="Approved runtime source pending.",
                action="Replace placeholder runtime source with a release URL.",
            )
        )
    else:
        checks.append(
            AIReadinessCheck(
                id=f"{runtime['id']}:source",
                label="Source",
                status="pass",
                detail=f"{source.get('type', 'runtime')} source is pinned.",
            )
        )
    first_file = _first_file(runtime)
    if first_file.get("sha256") in {None, "REQUIRED_BEFORE_RELEASE"}:
        checks.append(
            AIReadinessCheck(
                id=f"{runtime['id']}:checksum",
                label="Checksum",
                status="blocked",
                detail="Runtime checksum pending.",
                action="Pin the runtime binary SHA-256 checksum before release.",
            )
        )
    else:
        checks.append(
            AIReadinessCheck(
                id=f"{runtime['id']}:checksum",
                label="Checksum",
                status="pass",
                detail="Runtime SHA-256 checksum is pinned.",
            )
        )
    if first_file.get("size_bytes") is None:
        checks.append(
            AIReadinessCheck(
                id=f"{runtime['id']}:size",
                label="File size",
                status="blocked",
                detail="Runtime file size pending.",
                action="Record the exact runtime artifact size in bytes.",
            )
        )
    else:
        checks.append(
            AIReadinessCheck(
                id=f"{runtime['id']}:size",
                label="File size",
                status="pass",
                detail=f"{first_file['size_bytes']} bytes recorded.",
            )
        )
    license_label = str(runtime.get("license_label") or "").lower()
    if "check upstream" in license_label:
        checks.append(
            AIReadinessCheck(
                id=f"{runtime['id']}:license",
                label="License",
                status="blocked",
                detail="Runtime license approval pending.",
                action="Review upstream runtime license and pin approval metadata.",
            )
        )
    else:
        checks.append(
            AIReadinessCheck(
                id=f"{runtime['id']}:license",
                label="License",
                status="pass",
                detail=f"{runtime.get('license_label', 'license')} approved.",
            )
        )
    license_reference_check = _license_reference_check(runtime)
    checks.append(
        AIReadinessCheck(
            id=f"{runtime['id']}:license-artifact",
            label="License artifact",
            status=license_reference_check["status"],
            detail=license_reference_check["detail"],
            action=license_reference_check.get("action"),
        )
    )
    approval_check = _approval_record_check(runtime)
    checks.append(
        AIReadinessCheck(
            id=f"{runtime['id']}:release-approval",
            label="Release approval",
            status=approval_check["status"],
            detail=approval_check["detail"],
            action=approval_check.get("action"),
        )
    )
    return checks


def _approval_record_check(item: dict[str, Any]) -> dict[str, str | None]:
    approval = item.get("approval") or {}
    if not isinstance(approval, dict) or not approval:
        return {
            "status": "blocked",
            "detail": "Runtime release approval record pending.",
            "action": "Add approval.status, approved_by, approved_at, and evidence before release.",
        }
    if approval.get("status") != "approved":
        return {
            "status": "blocked",
            "detail": "Runtime release approval is not marked approved.",
            "action": "Set approval.status to approved after artifact, license, and platform review.",
        }
    missing = [
        field
        for field in ["approved_by", "approved_at", "evidence"]
        if not str(approval.get(field) or "").strip()
    ]
    if missing:
        return {
            "status": "blocked",
            "detail": f"Runtime release approval record is missing: {', '.join(missing)}.",
            "action": "Record reviewer, approval date, and evidence before release.",
        }
    return {
        "status": "pass",
        "detail": f"Runtime release approved by {approval['approved_by']} on {approval['approved_at']}.",
        "action": None,
    }


def _license_reference_check(item: dict[str, Any]) -> dict[str, str | None]:
    license_url = str(item.get("license_url") or "")
    license_path = str(item.get("license_path") or "")
    if license_url and license_path:
        return {
            "status": "blocked",
            "detail": "Runtime license artifact has conflicting URL and path references.",
            "action": "Use exactly one license_url or license_path.",
        }
    reference = license_url or license_path
    if not reference:
        return {
            "status": "blocked",
            "detail": "Runtime license artifact pending.",
            "action": "Pin an approved runtime license URL or bundled license text path.",
        }
    if reference == "REQUIRED_BEFORE_RELEASE" or "REPLACE_WITH_APPROVED" in reference:
        return {
            "status": "blocked",
            "detail": "Runtime license artifact pending.",
            "action": "Pin an approved runtime license URL or bundled license text path.",
        }
    return {
        "status": "pass",
        "detail": f"Runtime license artifact is pinned: {reference}.",
        "action": None,
    }


def _first_file(runtime: dict[str, Any]) -> dict[str, Any]:
    files = runtime.get("files") or []
    if files:
        return files[0]
    return {"filename": runtime.get("binary_name") or runtime["id"], "sha256": None, "size_bytes": None}


def _prepare_runtime_source(
    settings: Settings,
    runtime: dict[str, Any],
    source: dict[str, Any],
    first_file: dict[str, Any],
    filename: str,
) -> dict[str, Any]:
    source_type = source.get("type")
    if source_type == "local_fixture":
        source_path = _resolve_fixture_path(str(source.get("path") or ""))
        if not source_path.exists() or not source_path.is_file():
            raise ValueError(f"Runtime fixture source missing: {source.get('path')}")
        artifact_sha, artifact_size = _verify_runtime_artifact(runtime["id"], source_path, first_file)
        return {
            "artifact_path": source_path,
            "artifact_sha256": artifact_sha,
            "artifact_size_bytes": artifact_size,
            "binary_path": source_path,
            "archive_member": None,
        }
    if source_type == "url":
        artifact_path = _download_runtime_url(settings, runtime, source, first_file, filename)
        artifact_sha, artifact_size = _verify_runtime_artifact(runtime["id"], artifact_path, first_file)
        member = _runtime_archive_member(source)
        binary_path = (
            _extract_runtime_archive(settings, runtime, source, artifact_path)
            if member
            else artifact_path
        )
        return {
            "artifact_path": artifact_path,
            "artifact_sha256": artifact_sha,
            "artifact_size_bytes": artifact_size,
            "binary_path": binary_path,
            "archive_member": member,
        }
    raise ValueError("Only registry local_fixture and URL runtimes are enabled in this build")


def _download_runtime_url(
    settings: Settings,
    runtime: dict[str, Any],
    source: dict[str, Any],
    first_file: dict[str, Any],
    filename: str,
) -> Path:
    url = str(source.get("url") or "")
    _validate_runtime_source_url(url)
    cache_dir = settings.data_dir / "cache" / "runtime_downloads"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_key = hashlib.sha256(str(runtime.get("id") or filename).encode("utf-8")).hexdigest()[:16]
    cache_path = cache_dir / f"{cache_key}-{Path(filename).name}"
    tmp_path = cache_path.with_suffix(f"{cache_path.suffix}.download")
    expected_size = _expected_runtime_size(first_file)
    downloaded = 0
    request = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(request, timeout=RUNTIME_DOWNLOAD_TIMEOUT_SECONDS) as response:
            status = response.getcode()
            if status != 200:
                raise ValueError(f"Runtime download failed with HTTP {status}")
            response_size = response.headers.get("Content-Length")
            if response_size and response_size.isdigit() and int(response_size) != expected_size:
                raise ValueError(f"Size mismatch for {runtime['id']}")
            with tmp_path.open("wb") as file:
                while True:
                    chunk = response.read(RUNTIME_DOWNLOAD_CHUNK_SIZE)
                    if not chunk:
                        break
                    file.write(chunk)
                    downloaded += len(chunk)
                    if downloaded > expected_size:
                        raise ValueError(f"Size mismatch for {runtime['id']}")
    except urllib.error.URLError as exc:
        tmp_path.unlink(missing_ok=True)
        raise ValueError(f"Runtime download failed: {exc}") from exc
    except ValueError:
        tmp_path.unlink(missing_ok=True)
        raise
    tmp_path.replace(cache_path)
    return cache_path


def _extract_runtime_archive(
    settings: Settings,
    runtime: dict[str, Any],
    source: dict[str, Any],
    artifact_path: Path,
) -> Path:
    member = _runtime_archive_member(source)
    if not member:
        return artifact_path
    if not _safe_archive_member(member):
        raise ValueError("Runtime archive member path is invalid")
    cache_dir = settings.data_dir / "cache" / "runtime_downloads"
    extract_key = hashlib.sha256(f"{runtime.get('id')}:{artifact_path}".encode("utf-8")).hexdigest()[:16]
    extract_dir = cache_dir / f"{extract_key}-extracted"
    if extract_dir.exists():
        shutil.rmtree(extract_dir)
    extract_dir.mkdir(parents=True, exist_ok=True)
    target_path = extract_dir / Path(member).name
    archive = source.get("archive") if isinstance(source.get("archive"), dict) else {}
    archive_format = str(source.get("archive_format") or archive.get("format") or "").lower()
    if not archive_format:
        archive_format = _infer_archive_format(artifact_path)
    if archive_format == "zip":
        _extract_zip_member(artifact_path, member, target_path)
    elif archive_format in {"tar", "tar.gz", "tgz"}:
        _extract_tar_member(artifact_path, member, target_path)
    else:
        raise ValueError("Runtime archive format must be zip, tar, tar.gz, or tgz")
    if not target_path.exists() or not target_path.is_file():
        raise ValueError("Runtime archive extraction did not produce a binary file")
    return target_path


def _copy_extracted_runtime_tree(source_dir: Path, target_dir: Path) -> None:
    source_root = source_dir.resolve()
    target_root = target_dir.resolve()
    for source_path in source_root.rglob("*"):
        if not source_path.is_file():
            continue
        rel = source_path.relative_to(source_root)
        if not _safe_registry_filename(rel.as_posix()):
            raise ValueError("Runtime archive member path is invalid")
        target_path = target_root / rel
        if not _path_inside(target_root, target_path.resolve()):
            raise ValueError("Runtime archive member path is invalid")
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, target_path)


def _extract_zip_member(archive_path: Path, member: str, target_path: Path) -> None:
    member_parent = Path(member).parent.as_posix()
    try:
        with zipfile.ZipFile(archive_path) as archive:
            infos = archive.infolist()
            if not any(info.filename == member and not info.is_dir() for info in infos):
                raise ValueError(f"Runtime archive member not found: {member}")
            for info in infos:
                if info.is_dir():
                    continue
                if not _archive_entry_under_member_parent(info.filename, member_parent):
                    continue
                mode = (info.external_attr >> 16) & 0o170000
                if mode == stat.S_IFLNK:
                    raise ValueError("Runtime archive member must not be a symlink")
                rel = _archive_entry_relative_path(info.filename, member_parent)
                output_path = target_path.parent / rel
                if not _path_inside(target_path.parent.resolve(), output_path.resolve()):
                    raise ValueError("Runtime archive member path is invalid")
                output_path.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(info, "r") as source, output_path.open("wb") as target:
                    shutil.copyfileobj(source, target)
                mode_bits = (info.external_attr >> 16) & 0o777
                if mode_bits:
                    output_path.chmod(mode_bits)
    except zipfile.BadZipFile as exc:
        raise ValueError("Runtime archive is not a valid zip file") from exc


def _extract_tar_member(archive_path: Path, member: str, target_path: Path) -> None:
    member_parent = Path(member).parent.as_posix()
    try:
        with tarfile.open(archive_path) as archive:
            members = archive.getmembers()
            members_by_name = {info.name: info for info in members}
            if not any(info.name == member and info.isfile() for info in members):
                raise ValueError(f"Runtime archive member not found: {member}")
            for info in members:
                if info.isdir():
                    continue
                if not _archive_entry_under_member_parent(info.name, member_parent):
                    continue
                source_info = info
                if info.issym() or info.islnk():
                    source_info = _resolve_tar_link_info(info, members_by_name, member_parent)
                if not source_info.isfile():
                    raise ValueError("Runtime archive member must be a regular file")
                rel = _archive_entry_relative_path(info.name, member_parent)
                output_path = target_path.parent / rel
                if not _path_inside(target_path.parent.resolve(), output_path.resolve()):
                    raise ValueError("Runtime archive member path is invalid")
                output_path.parent.mkdir(parents=True, exist_ok=True)
                source = archive.extractfile(source_info)
                if source is None:
                    raise ValueError("Runtime archive member could not be read")
                with source, output_path.open("wb") as target:
                    shutil.copyfileobj(source, target)
                output_path.chmod(source_info.mode & 0o777)
    except tarfile.TarError as exc:
        raise ValueError("Runtime archive is not a valid tar file") from exc


def _archive_entry_under_member_parent(entry: str, member_parent: str) -> bool:
    if not _safe_archive_member(entry):
        raise ValueError("Runtime archive member path is invalid")
    if member_parent in {"", "."}:
        return True
    return entry.startswith(f"{member_parent}/")


def _archive_entry_relative_path(entry: str, member_parent: str) -> Path:
    rel = Path(entry)
    if member_parent not in {"", "."}:
        rel = rel.relative_to(member_parent)
    if not _safe_archive_member(rel.as_posix()):
        raise ValueError("Runtime archive member path is invalid")
    return rel


def _archive_link_target_name(entry: str, linkname: str) -> str:
    if not linkname:
        raise ValueError("Runtime archive link target path is invalid")
    link_path = Path(linkname)
    if link_path.is_absolute():
        raise ValueError("Runtime archive link target path is invalid")
    target = (Path(entry).parent / link_path).as_posix()
    if not _safe_archive_member(target):
        raise ValueError("Runtime archive link target path is invalid")
    return target


def _resolve_tar_link_info(
    info: tarfile.TarInfo,
    members_by_name: dict[str, tarfile.TarInfo],
    member_parent: str,
    seen: set[str] | None = None,
) -> tarfile.TarInfo:
    seen = set(seen or set())
    if info.name in seen:
        raise ValueError("Runtime archive link cycle is invalid")
    seen.add(info.name)
    source_name = _archive_link_target_name(info.name, info.linkname)
    if not _archive_entry_under_member_parent(source_name, member_parent):
        raise ValueError("Runtime archive link target path is invalid")
    source_info = members_by_name.get(source_name)
    if source_info is None:
        raise ValueError("Runtime archive link target must be a regular file")
    if source_info.issym() or source_info.islnk():
        return _resolve_tar_link_info(source_info, members_by_name, member_parent, seen)
    if not source_info.isfile():
        raise ValueError("Runtime archive link target must be a regular file")
    return source_info


def _runtime_archive_member(source: dict[str, Any]) -> str | None:
    archive = source.get("archive")
    if isinstance(archive, dict) and archive.get("member"):
        return str(archive.get("member") or "")
    member = source.get("archive_member")
    return str(member) if member else None


def _runtime_target_filename(runtime: dict[str, Any], source: dict[str, Any], artifact_filename: str) -> str:
    binary_name = str(runtime.get("binary_name") or "")
    if binary_name:
        return binary_name
    member = _runtime_archive_member(source)
    if member:
        return Path(member).name
    return artifact_filename


def _infer_archive_format(path: Path) -> str:
    name = path.name.lower()
    if name.endswith(".zip"):
        return "zip"
    if name.endswith(".tar.gz") or name.endswith(".tgz"):
        return "tar.gz"
    if name.endswith(".tar"):
        return "tar"
    return ""


def _runtime_binary_smoke(runtime: dict[str, Any], path: Path) -> dict[str, Any]:
    smoke_config = runtime.get("smoke_test") if isinstance(runtime.get("smoke_test"), dict) else {}
    args = smoke_config.get("args")
    if not isinstance(args, list) or not all(isinstance(arg, str) for arg in args):
        args = ["--version"]
    allowed_exit_codes = smoke_config.get("allowed_exit_codes")
    if not isinstance(allowed_exit_codes, list) or not all(isinstance(code, int) for code in allowed_exit_codes):
        allowed_exit_codes = [0, 1]
    timeout_seconds = smoke_config.get("timeout_seconds")
    if not isinstance(timeout_seconds, int | float) or timeout_seconds <= 0:
        timeout_seconds = RUNTIME_SMOKE_TIMEOUT_SECONDS
    if not os.access(path, os.X_OK):
        return {"status": "failed", "error": "runtime binary is not executable", "command": [str(path), *args]}
    command = [str(path), *args]
    env = None
    if runtime.get("runtime") == "piper":
        env = os.environ.copy()
        env.setdefault("VAULT_PIPER_PYTHON", sys.executable)
    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=float(timeout_seconds),
            check=False,
            env=env,
        )
    except OSError as exc:
        return {"status": "failed", "error": str(exc), "command": command}
    except subprocess.TimeoutExpired:
        return {"status": "failed", "error": "runtime smoke check timed out", "command": command}
    stdout = (completed.stdout or "").strip()
    stderr = (completed.stderr or "").strip()
    output = stdout or stderr
    first_line = output.splitlines()[0] if output else None
    if completed.returncode not in allowed_exit_codes:
        return {
            "status": "failed",
            "error": f"runtime smoke check exited with {completed.returncode}",
            "command": command,
            "exit_code": completed.returncode,
            "stdout": stdout[:1000] or None,
            "stderr": stderr[:1000] or None,
        }
    if not first_line:
        return {
            "status": "failed",
            "error": "runtime smoke check returned no version output",
            "command": command,
            "exit_code": completed.returncode,
        }
    return {
        "status": "pass",
        "version": first_line[:500],
        "command": command,
        "exit_code": completed.returncode,
        "stdout": stdout[:1000] or None,
        "stderr": stderr[:1000] or None,
    }


def _validate_runtime_source_url(url: str) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Registry runtime URL source must be http or https")
    if parsed.username or parsed.password:
        raise ValueError("Registry runtime URL source must not contain embedded credentials")


def _verify_runtime_artifact(runtime_id: str, source_path: Path, first_file: dict[str, Any]) -> tuple[str, int]:
    expected_sha = str(first_file.get("sha256") or "")
    if not expected_sha or expected_sha == "REQUIRED_BEFORE_RELEASE":
        raise ValueError("Registry runtime is missing a release checksum")
    expected_size = _expected_runtime_size(first_file)
    actual_size = source_path.stat().st_size
    if actual_size != expected_size:
        raise ValueError(f"Size mismatch for {runtime_id}")
    actual_sha = _file_sha256(source_path)
    if actual_sha != expected_sha:
        raise ValueError(f"Checksum mismatch for {runtime_id}")
    return actual_sha, actual_size


def _expected_runtime_size(first_file: dict[str, Any]) -> int:
    size_bytes = first_file.get("size_bytes")
    if not isinstance(size_bytes, int) or size_bytes <= 0:
        raise ValueError("Registry runtime is missing a release file size")
    return size_bytes


def _safe_registry_filename(filename: str) -> bool:
    if not filename or filename.startswith(("/", "\\")) or "\\" in filename:
        return False
    parts = filename.split("/")
    return all(part not in {"", ".", ".."} for part in parts)


def _safe_archive_member(member: str) -> bool:
    return _safe_registry_filename(member)


def _path_inside(root: Path, candidate: Path) -> bool:
    return candidate == root or root in candidate.parents


def _runtime_bin_dir(settings: Settings, runtime: str) -> Path:
    return settings.data_dir / "ai_runtime" / runtime / "bin"


def _resolve_fixture_path(relative_path: str) -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / relative_path
        if candidate.exists():
            return candidate
    return Path(relative_path).expanduser()


def _write_runtime_manifest(target_dir: Path, runtime: dict[str, Any], sha256: str, size_bytes: int, binary_path: Path) -> None:
    manifest = {
        **runtime,
        "installed_sha256": sha256,
        "installed_size_bytes": size_bytes,
        "binary_path": str(binary_path),
    }
    (target_dir / f"{runtime['id']}.manifest.json").write_text(json.dumps(manifest, indent=2))


def _safe_remove_runtime_path(settings: Settings, path: Path) -> str | None:
    runtime_root = (settings.data_dir / "ai_runtime").resolve()
    resolved = path.resolve()
    if runtime_root not in resolved.parents:
        return None
    resolved.unlink(missing_ok=True)
    return str(resolved)


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result
