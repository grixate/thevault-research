from __future__ import annotations

import fnmatch
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from vault_core.ai.models.registry import load_model_registry
from vault_core.ai.models.runtime_installer import load_runtime_registry
from vault_core.ai.models.validation import validate_ai_registries
from vault_core.db.session import now_iso

DEFAULT_TIMEOUT_SECONDS = 30.0
DEFAULT_MAX_BYTES = 10 * 1024 * 1024 * 1024
DEFAULT_DOWNLOAD_ATTEMPTS = 3
DOWNLOAD_RETRY_DELAY_SECONDS = 1.0
DOWNLOAD_CHUNK_SIZE = 1024 * 1024
USER_AGENT = "VaultResearchLab/0.1 AIRegistryArtifactVerifier"
PLACEHOLDER_MARKERS = {"", "REQUIRED_BEFORE_RELEASE"}
SHA256_RE = re.compile(r"^[a-fA-F0-9]{64}$")
HUGGINGFACE_REPO_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9][A-Za-z0-9._-]*$")
HUGGINGFACE_COMMIT_RE = re.compile(r"^[0-9a-f]{40}$", re.IGNORECASE)
HUGGINGFACE_BASE_URL = "https://huggingface.co"


def build_ai_registry_artifact_verification(
    model_registry: dict[str, Any] | None = None,
    runtime_registry: dict[str, Any] | None = None,
    *,
    root: Path | None = None,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    max_bytes: int = DEFAULT_MAX_BYTES,
    artifact_ids: Iterable[str] | None = None,
) -> dict[str, Any]:
    model_registry = model_registry if model_registry is not None else load_model_registry()
    runtime_registry = runtime_registry if runtime_registry is not None else load_runtime_registry()
    root = root or _repo_root()
    validation = validate_ai_registries(model_registry, runtime_registry, root=root)
    selected_ids = set(artifact_ids or [])
    download_cache: dict[str, dict[str, Any]] = {}
    artifacts = _candidate_artifacts(
        model_registry=model_registry,
        runtime_registry=runtime_registry,
        selected_ids=selected_ids,
        timeout_seconds=timeout_seconds,
        max_bytes=max_bytes,
        download_cache=download_cache,
    )
    all_checks = [check for artifact in artifacts for file_info in artifact["files"] for check in file_info["checks"]]
    blocked_count = sum(1 for check in all_checks if check["status"] == "blocked")
    pass_count = sum(1 for check in all_checks if check["status"] == "pass")
    warn_count = sum(1 for check in all_checks if check["status"] == "warn")
    pending_count = sum(1 for check in all_checks if check["status"] == "pending")
    file_count = sum(len(artifact["files"]) for artifact in artifacts)
    verified_file_count = sum(
        1 for artifact in artifacts for file_info in artifact["files"] if file_info["status"] == "pass"
    )
    if selected_ids and not artifacts:
        blocked_count += 1
        all_checks.append(
            _check(
                "selection",
                "artifact-id",
                "Artifact selection",
                "blocked",
                f"No production candidate artifacts matched: {', '.join(sorted(selected_ids))}.",
                "Select an artifact ID that exists in a production model pack or production runtime manifest.",
            )
        )
    validation_error_count = len(validation["errors"])
    validation_warning_count = len(validation["warnings"])
    status = (
        "blocked"
        if blocked_count or validation_error_count
        else "warn"
        if warn_count or pending_count or validation_warning_count
        else "pass"
    )
    evidence = _build_evidence_overlay(artifacts)
    summary = {
        "status": status,
        "artifact_count": len(artifacts),
        "file_count": file_count,
        "verified_file_count": verified_file_count,
        "check_count": len(all_checks),
        "pass_count": pass_count,
        "warn_count": warn_count,
        "pending_count": pending_count,
        "blocked_count": blocked_count,
        "validation_error_count": validation_error_count,
        "validation_warning_count": validation_warning_count,
        "evidence_model_count": len(evidence["models"]),
        "evidence_runtime_count": len(evidence["runtimes"]),
        "max_bytes": max_bytes,
    }
    return {
        "generated_at": now_iso(),
        "status": status,
        "summary": summary,
        "validation": validation,
        "artifacts": artifacts,
        "evidence": evidence,
        "next_actions": _next_actions(all_checks, validation),
    }


def format_artifact_verification_text(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        f"AI registry artifact byte verification: {report['status']}",
        (
            "Files: "
            f"{summary['file_count']} total / "
            f"{summary['verified_file_count']} verified / "
            f"{summary['blocked_count']} blocked"
        ),
        (
            "Checks: "
            f"{summary['check_count']} total / "
            f"{summary['pass_count']} pass / "
            f"{summary['warn_count']} warn / "
            f"{summary['pending_count']} pending"
        ),
        (
            "Structural validation: "
            f"{report['validation']['status']} "
            f"({summary['validation_error_count']} errors, {summary['validation_warning_count']} warnings)"
        ),
        (
            "Evidence entries: "
            f"{summary['evidence_model_count']} models / {summary['evidence_runtime_count']} runtimes"
        ),
    ]
    if report["next_actions"]:
        lines.extend(["", "Next actions:"])
        lines.extend(f"- {action}" for action in report["next_actions"])
    return "\n".join(lines)


def format_artifact_verification_markdown(
    report: dict[str, Any],
    *,
    model_registry_label: str | None = None,
    runtime_registry_label: str | None = None,
) -> str:
    summary = report["summary"]
    lines = [
        "# AI Registry Artifact Byte Verification",
        "",
        f"- Status: **{report['status']}**",
        f"- Generated: `{report['generated_at']}`",
        f"- Structural validation: **{report['validation']['status']}**",
        f"- Max bytes per file: `{summary['max_bytes']}`",
        "",
    ]
    source_lines = []
    if model_registry_label:
        source_lines.append(f"- Model registry: `{model_registry_label}`")
    if runtime_registry_label:
        source_lines.append(f"- Runtime registry: `{runtime_registry_label}`")
    if source_lines:
        lines.extend(["## Sources", "", *source_lines, ""])
    lines.extend(
        [
            "## Summary",
            "",
            "| Metric | Value |",
            "| --- | ---: |",
            f"| Artifacts | {summary['artifact_count']} |",
            f"| Files | {summary['file_count']} |",
            f"| Verified files | {summary['verified_file_count']} |",
            f"| Checks | {summary['check_count']} |",
            f"| Passed | {summary['pass_count']} |",
            f"| Warnings | {summary['warn_count']} |",
            f"| Pending | {summary['pending_count']} |",
            f"| Blocked | {summary['blocked_count']} |",
            f"| Evidence model entries | {summary['evidence_model_count']} |",
            f"| Evidence runtime entries | {summary['evidence_runtime_count']} |",
            f"| Validation errors | {summary['validation_error_count']} |",
            f"| Validation warnings | {summary['validation_warning_count']} |",
            "",
            "## Artifacts",
            "",
        ]
    )
    if not report["artifacts"]:
        lines.append("- No production artifacts found.")
    for artifact in report["artifacts"]:
        lines.extend(
            [
                f"### {artifact['display_name']}",
                "",
                f"- Type: `{artifact['type']}`",
                f"- ID: `{artifact['id']}`",
                f"- Source type: `{artifact['source_type'] or 'unknown'}`",
                f"- Status: **{artifact['status']}**",
                "",
            ]
        )
        for file_info in artifact["files"]:
            lines.extend(
                [
                    f"#### `{file_info['filename']}`",
                    "",
                    f"- Status: **{file_info['status']}**",
                    f"- Bytes: `{file_info.get('size_bytes') or 'not verified'}`",
                    f"- SHA-256: `{file_info.get('sha256') or 'not verified'}`",
                    "",
                ]
            )
            for check in file_info["checks"]:
                checkbox = "[x]" if check["status"] == "pass" else "[ ]"
                lines.append(f"- {checkbox} `{check['id']}` **{check['label']}** - {check['detail']}")
                if check.get("action"):
                    lines.append(f"  - Action: {check['action']}")
            lines.append("")
    lines.extend(["## Evidence Overlay", ""])
    if summary["evidence_model_count"] or summary["evidence_runtime_count"]:
        lines.extend(
            [
                "Use the generated JSON evidence with `apply_ai_registry_evidence.sh` after reviewer approval.",
                "",
                "```json",
                json.dumps(report["evidence"], indent=2),
                "```",
                "",
            ]
        )
    else:
        lines.append("- No verified artifact bytes are ready for evidence export.")
        lines.append("")
    lines.extend(["## Next Actions", ""])
    if report["next_actions"]:
        lines.extend(f"- [ ] {action}" for action in report["next_actions"])
    else:
        lines.append("- [x] Candidate artifact bytes are verified and evidence is ready for review.")
    return "\n".join(lines).rstrip()


def _candidate_artifacts(
    *,
    model_registry: dict[str, Any],
    runtime_registry: dict[str, Any],
    selected_ids: set[str],
    timeout_seconds: float,
    max_bytes: int,
    download_cache: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    production_model_ids = _production_model_ids(model_registry)
    artifacts = [
        _verify_artifact(
            artifact_type="model",
            item=model,
            display_name=str(model.get("display_name") or model.get("id") or "Model"),
            timeout_seconds=timeout_seconds,
            max_bytes=max_bytes,
            download_cache=download_cache,
        )
        for model in _as_list(model_registry.get("models"))
        if isinstance(model, dict)
        and model.get("id") in production_model_ids
        and (not selected_ids or model.get("id") in selected_ids)
    ]
    artifacts.extend(
        _verify_artifact(
            artifact_type="runtime",
            item=runtime,
            display_name=str(runtime.get("display_name") or runtime.get("id") or "Runtime"),
            timeout_seconds=timeout_seconds,
            max_bytes=max_bytes,
            download_cache=download_cache,
        )
        for runtime in _as_list(runtime_registry.get("runtimes"))
        if isinstance(runtime, dict)
        and runtime.get("release_channel") == "production"
        and (not selected_ids or runtime.get("id") in selected_ids)
    )
    return artifacts


def _verify_artifact(
    *,
    artifact_type: str,
    item: dict[str, Any],
    display_name: str,
    timeout_seconds: float,
    max_bytes: int,
    download_cache: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    item_id = str(item.get("id") or "<missing>")
    source = item.get("source") if isinstance(item.get("source"), dict) else {}
    source_type = str(source.get("type") or "")
    files: list[dict[str, Any]] = []
    registry_files = [file_info for file_info in _as_list(item.get("files")) if isinstance(file_info, dict)]
    if not registry_files:
        registry_files = [{"filename": ""}]
    for index, file_info in enumerate(registry_files):
        files.append(
            _verify_file(
                artifact_type=artifact_type,
                item_id=item_id,
                source=source,
                source_type=source_type,
                file_info=file_info,
                index=index,
                timeout_seconds=timeout_seconds,
                max_bytes=max_bytes,
                download_cache=download_cache,
            )
        )
    return {
        "type": artifact_type,
        "id": item_id,
        "display_name": display_name,
        "source_type": source_type or None,
        "status": _artifact_status([file_info["status"] for file_info in files]),
        "files": files,
    }


def _verify_file(
    *,
    artifact_type: str,
    item_id: str,
    source: dict[str, Any],
    source_type: str,
    file_info: dict[str, Any],
    index: int,
    timeout_seconds: float,
    max_bytes: int,
    download_cache: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    filename = str(file_info.get("filename") or "")
    checks: list[dict[str, Any]] = []
    url_result = _artifact_url(artifact_type, source, source_type, filename)
    if not url_result["ok"]:
        checks.append(
            _check(
                item_id,
                f"files[{index}]:source",
                "Artifact source",
                url_result["status"],
                url_result["detail"],
                url_result.get("action"),
            )
        )
        return _file_result(filename, None, None, checks)
    url = str(url_result["url"])
    checks.append(_check(item_id, f"files[{index}]:source", "Artifact source", "pass", f"Source is concrete: {url}."))
    stream = download_cache.get(url)
    reused_stream = stream is not None
    if stream is None:
        stream = _stream_remote_artifact(url, timeout_seconds, max_bytes)
        download_cache[url] = stream
    if not stream["ok"]:
        checks.append(
            _check(
                item_id,
                f"files[{index}]:download",
                "Artifact bytes",
                "blocked",
                str(stream["error"]),
                "Verify the candidate URL and max-bytes policy before release approval.",
            )
        )
        return _file_result(filename, None, None, checks)
    size_bytes = int(stream["size_bytes"])
    sha256 = str(stream["sha256"])
    checks.append(
        _check(
            item_id,
            f"files[{index}]:download",
            "Artifact bytes",
            "pass",
            _download_success_detail(stream, url, size_bytes, reused_stream),
        )
    )
    checks.append(_size_check(item_id, f"files[{index}]:size", file_info.get("size_bytes"), size_bytes))
    checks.append(_sha256_check(item_id, f"files[{index}]:sha256", file_info.get("sha256"), sha256))
    if _checks_pass(checks):
        checks.append(
            _check(
                item_id,
                f"files[{index}]:evidence",
                "Evidence overlay",
                "pass",
                "Computed filename, size_bytes, and sha256 evidence without installing or approving the artifact.",
            )
        )
    return _file_result(filename, size_bytes, sha256, checks)


def _stream_remote_artifact(url: str, timeout_seconds: float, max_bytes: int) -> dict[str, Any]:
    transient_errors: list[str] = []
    for attempt in range(1, DEFAULT_DOWNLOAD_ATTEMPTS + 1):
        result = _stream_remote_artifact_once(url, timeout_seconds, max_bytes)
        if result["ok"] or not result.get("transient"):
            if transient_errors and result["ok"]:
                result["attempts"] = attempt
                result["transient_errors"] = transient_errors
            return result
        transient_errors.append(str(result["error"]))
        if attempt < DEFAULT_DOWNLOAD_ATTEMPTS:
            time.sleep(DOWNLOAD_RETRY_DELAY_SECONDS)
    return {
        "ok": False,
        "error": (
            f"Download failed after {DEFAULT_DOWNLOAD_ATTEMPTS} attempts: "
            f"{transient_errors[-1] if transient_errors else 'unknown transient error'}."
        ),
        "transient_errors": transient_errors,
    }


def _download_success_detail(stream: dict[str, Any], url: str, size_bytes: int, reused_stream: bool) -> str:
    final_url = stream.get("final_url") or url
    if reused_stream:
        return f"Reused downloaded hash for {size_bytes} bytes from {final_url}."
    attempts = stream.get("attempts")
    if isinstance(attempts, int) and attempts > 1:
        return f"Downloaded and hashed {size_bytes} bytes from {final_url} after {attempts} attempts."
    return f"Downloaded and hashed {size_bytes} bytes from {final_url}."


def _stream_remote_artifact_once(url: str, timeout_seconds: float, max_bytes: int) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    sha256 = hashlib.sha256()
    downloaded = 0
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            status_code = int(getattr(response, "status", response.getcode()))
            if not 200 <= status_code < 400:
                return {"ok": False, "error": f"{url} returned HTTP {status_code}."}
            content_length = _content_length(response.headers)
            if content_length is not None and content_length > max_bytes:
                return {
                    "ok": False,
                    "error": f"Remote Content-Length is {content_length} bytes, which exceeds the {max_bytes} byte verification limit.",
                }
            while True:
                chunk = response.read(DOWNLOAD_CHUNK_SIZE)
                if not chunk:
                    break
                downloaded += len(chunk)
                if downloaded > max_bytes:
                    return {
                        "ok": False,
                        "error": f"Downloaded bytes exceeded the {max_bytes} byte verification limit.",
                    }
                sha256.update(chunk)
            return {
                "ok": True,
                "status_code": status_code,
                "size_bytes": downloaded,
                "sha256": sha256.hexdigest(),
                "content_length": content_length,
                "final_url": response.geturl(),
            }
    except urllib.error.HTTPError as exc:
        return {"ok": False, "error": f"{url} returned HTTP {exc.code}."}
    except urllib.error.URLError as exc:
        return {"ok": False, "error": f"Download failed: {exc.reason}."}
    except TimeoutError:
        return {"ok": False, "error": "Download timed out.", "transient": True}
    except OSError as exc:
        return {"ok": False, "error": f"Download stream failed: {exc}.", "transient": True}


def _artifact_url(artifact_type: str, source: dict[str, Any], source_type: str, filename: str) -> dict[str, Any]:
    if not _safe_registry_filename(filename):
        return {
            "ok": False,
            "status": "pending" if _has_placeholder(filename) else "blocked",
            "detail": "Artifact filename is not a safe concrete registry path.",
            "action": "Pin a safe artifact filename before byte verification.",
        }
    if source_type == "url":
        url = str(source.get("url") or "")
        if _has_placeholder(url):
            return {
                "ok": False,
                "status": "pending",
                "detail": "Artifact URL source is not yet pinned.",
                "action": "Pin an approved HTTP(S) URL before byte verification.",
            }
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return {
                "ok": False,
                "status": "blocked",
                "detail": "Artifact URL source must be HTTP(S).",
                "action": "Use an approved HTTP(S) artifact URL.",
            }
        if parsed.username or parsed.password:
            return {
                "ok": False,
                "status": "blocked",
                "detail": "Artifact URL source must not contain embedded credentials.",
                "action": "Use a credential-free release URL.",
            }
        return {"ok": True, "url": url}
    if source_type == "huggingface" and artifact_type == "model":
        repo_id = str(source.get("repo_id") or "")
        revision = str(source.get("revision") or "")
        allow_patterns = source.get("allow_patterns") or []
        if _has_placeholder(repo_id) or _has_placeholder(revision):
            return {
                "ok": False,
                "status": "pending",
                "detail": "Hugging Face source is not pinned to a concrete repo and commit revision.",
                "action": "Resolve Hugging Face metadata before byte verification.",
            }
        if not HUGGINGFACE_REPO_RE.match(repo_id) or ".." in repo_id:
            return {
                "ok": False,
                "status": "blocked",
                "detail": "Hugging Face source repo_id is not an approved namespace/repo id.",
                "action": "Use a validated Hugging Face namespace/repo id.",
            }
        if not HUGGINGFACE_COMMIT_RE.match(revision):
            return {
                "ok": False,
                "status": "blocked",
                "detail": "Hugging Face source must pin a 40-character commit revision.",
                "action": "Hydrate or pin an immutable Hugging Face commit revision.",
            }
        if not isinstance(allow_patterns, list) or not any(
            isinstance(pattern, str) and fnmatch.fnmatch(filename, pattern) for pattern in allow_patterns
        ):
            return {
                "ok": False,
                "status": "blocked",
                "detail": "Hugging Face artifact filename is not allowlisted by source.allow_patterns.",
                "action": "Add a precise allow_patterns entry for the approved artifact filename.",
            }
        repo_path = urllib.parse.quote(repo_id, safe="/")
        revision_path = urllib.parse.quote(revision, safe="")
        file_path = urllib.parse.quote(filename, safe="/")
        return {"ok": True, "url": f"{HUGGINGFACE_BASE_URL.rstrip('/')}/{repo_path}/resolve/{revision_path}/{file_path}"}
    return {
        "ok": False,
        "status": "blocked",
        "detail": f"{source_type or 'missing'} sources are not supported for production byte verification.",
        "action": "Use URL sources for runtimes and URL or pinned Hugging Face sources for models.",
    }


def _file_result(filename: str, size_bytes: int | None, sha256: str | None, checks: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "filename": filename,
        "status": _checks_status(checks),
        "size_bytes": size_bytes,
        "sha256": sha256,
        "checks": checks,
    }


def _size_check(item_id: str, suffix: str, expected_size: Any, actual_size: int) -> dict[str, Any]:
    if not isinstance(expected_size, int) or expected_size <= 0:
        return _check(
            item_id,
            suffix,
            "Byte size",
            "pass",
            f"Computed artifact size_bytes: {actual_size}.",
        )
    if actual_size != expected_size:
        return _check(
            item_id,
            suffix,
            "Byte size",
            "blocked",
            f"Downloaded artifact is {actual_size} bytes, but registry expects {expected_size} bytes.",
            "Update size_bytes only after verifying the exact approved artifact.",
        )
    return _check(item_id, suffix, "Byte size", "pass", f"Downloaded size matches {expected_size} bytes.")


def _sha256_check(item_id: str, suffix: str, expected_sha256: Any, actual_sha256: str) -> dict[str, Any]:
    expected = str(expected_sha256 or "")
    if not SHA256_RE.fullmatch(expected):
        return _check(item_id, suffix, "SHA-256 bytes", "pass", f"Computed artifact SHA-256: {actual_sha256}.")
    if actual_sha256.lower() != expected.lower():
        return _check(
            item_id,
            suffix,
            "SHA-256 bytes",
            "blocked",
            f"Downloaded artifact SHA-256 is {actual_sha256}, but registry expects {expected}.",
            "Treat this as a candidate substitution until the source and checksum are re-reviewed.",
        )
    return _check(item_id, suffix, "SHA-256 bytes", "pass", "Downloaded SHA-256 matches the pinned registry checksum.")


def _build_evidence_overlay(artifacts: list[dict[str, Any]]) -> dict[str, Any]:
    evidence: dict[str, Any] = {"schema_version": 1, "generated_at": now_iso(), "models": {}, "runtimes": {}}
    for artifact in artifacts:
        verified_files = [
            {
                "filename": file_info["filename"],
                "sha256": file_info["sha256"],
                "size_bytes": file_info["size_bytes"],
            }
            for file_info in artifact["files"]
            if file_info["status"] == "pass" and file_info.get("sha256") and file_info.get("size_bytes")
        ]
        if not verified_files:
            continue
        patch = {"files": verified_files, **verified_files[0]}
        if artifact["type"] == "model":
            evidence["models"][artifact["id"]] = patch
        elif artifact["type"] == "runtime":
            evidence["runtimes"][artifact["id"]] = patch
    return evidence


def _check(
    owner_id: str,
    suffix: str,
    label: str,
    status: str,
    detail: str,
    action: str | None = None,
) -> dict[str, Any]:
    return {
        "id": f"{owner_id}:{suffix}",
        "label": label,
        "status": status,
        "detail": detail,
        "action": action,
    }


def _checks_status(checks: list[dict[str, Any]]) -> str:
    if any(check["status"] == "blocked" for check in checks):
        return "blocked"
    if any(check["status"] in {"warn", "pending"} for check in checks):
        return "warn"
    return "pass"


def _checks_pass(checks: list[dict[str, Any]]) -> bool:
    return all(check["status"] == "pass" for check in checks)


def _artifact_status(statuses: list[str]) -> str:
    if any(status == "blocked" for status in statuses):
        return "blocked"
    if any(status in {"warn", "pending"} for status in statuses):
        return "warn"
    return "pass"


def _next_actions(checks: list[dict[str, Any]], validation: dict[str, Any]) -> list[str]:
    actions = []
    if validation["errors"]:
        actions.append("Resolve structural registry errors before verifying candidate artifact bytes.")
    if validation["warnings"]:
        actions.append("Review registry placeholder warnings before applying generated byte evidence.")
    for check in checks:
        action = check.get("action")
        if action and action not in actions:
            actions.append(action)
    return actions


def _production_model_ids(model_registry: dict[str, Any]) -> set[str]:
    model_ids: set[str] = set()
    for pack in _as_list(model_registry.get("model_packs")):
        if not isinstance(pack, dict) or pack.get("release_channel", "production") != "production":
            continue
        for model_id in [*_as_list(pack.get("required_model_ids")), *_as_list(pack.get("optional_model_ids"))]:
            if isinstance(model_id, str):
                model_ids.add(model_id)
    return model_ids


def _content_length(headers: Any) -> int | None:
    value = headers.get("Content-Length") if headers else None
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _safe_registry_filename(filename: str) -> bool:
    if not filename or filename.startswith(("/", "\\")) or "\\" in filename:
        return False
    parts = filename.split("/")
    return all(part not in {"", ".", ".."} for part in parts)


def _has_placeholder(value: Any) -> bool:
    text = str(value or "")
    return text in PLACEHOLDER_MARKERS or "REPLACE_WITH_APPROVED" in text


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _repo_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "pnpm-workspace.yaml").exists():
            return parent
    return Path(__file__).resolve().parents[5]
