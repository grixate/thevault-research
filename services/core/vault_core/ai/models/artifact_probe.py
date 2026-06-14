from __future__ import annotations

import re
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from pathlib import Path
from typing import Any

from vault_core.ai.models.registry import load_model_registry
from vault_core.ai.models.runtime_installer import load_runtime_registry
from vault_core.ai.models.validation import validate_ai_registries
from vault_core.db.session import now_iso

ProbeFn = Callable[[str, float], dict[str, Any]]

PLACEHOLDER_MARKERS = {"", "REQUIRED_BEFORE_RELEASE"}
DEFAULT_TIMEOUT_SECONDS = 10.0
USER_AGENT = "VaultResearchLab/0.1 AIRegistryArtifactProbe"


def build_ai_registry_artifact_probe(
    model_registry: dict[str, Any] | None = None,
    runtime_registry: dict[str, Any] | None = None,
    *,
    root: Path | None = None,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    probe_url: ProbeFn | None = None,
) -> dict[str, Any]:
    model_registry = model_registry if model_registry is not None else load_model_registry()
    runtime_registry = runtime_registry if runtime_registry is not None else load_runtime_registry()
    root = root or _repo_root()
    validation = validate_ai_registries(model_registry, runtime_registry, root=root)
    probe = probe_url or _probe_http_url
    production_model_ids = _production_model_ids(model_registry)
    artifacts = [
        _probe_model_artifact(model, root, timeout_seconds, probe)
        for model in _as_list(model_registry.get("models"))
        if isinstance(model, dict) and model.get("id") in production_model_ids
    ]
    artifacts.extend(
        _probe_runtime_artifact(runtime, root, timeout_seconds, probe)
        for runtime in _as_list(runtime_registry.get("runtimes"))
        if isinstance(runtime, dict) and runtime.get("release_channel") == "production"
    )

    all_checks = [check for artifact in artifacts for check in artifact["checks"]]
    pass_count = sum(1 for check in all_checks if check["status"] == "pass")
    warn_count = sum(1 for check in all_checks if check["status"] == "warn")
    pending_count = sum(1 for check in all_checks if check["status"] == "pending")
    blocked_count = sum(1 for check in all_checks if check["status"] == "blocked")
    validation_error_count = len(validation["errors"])
    validation_warning_count = len(validation["warnings"])
    status = (
        "blocked"
        if blocked_count or validation_error_count
        else "warn"
        if warn_count or pending_count or validation_warning_count
        else "pass"
    )
    summary = {
        "status": status,
        "artifact_count": len(artifacts),
        "check_count": len(all_checks),
        "pass_count": pass_count,
        "warn_count": warn_count,
        "pending_count": pending_count,
        "blocked_count": blocked_count,
        "validation_error_count": validation_error_count,
        "validation_warning_count": validation_warning_count,
    }
    return {
        "generated_at": now_iso(),
        "status": status,
        "summary": summary,
        "validation": validation,
        "artifacts": artifacts,
        "next_actions": _next_actions(all_checks, validation),
    }


def format_artifact_probe_text(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        f"AI registry artifact probe: {report['status']}",
        (
            "Checks: "
            f"{summary['check_count']} total / "
            f"{summary['pass_count']} pass / "
            f"{summary['warn_count']} warn / "
            f"{summary['pending_count']} pending / "
            f"{summary['blocked_count']} blocked"
        ),
        (
            "Structural validation: "
            f"{report['validation']['status']} "
            f"({summary['validation_error_count']} errors, {summary['validation_warning_count']} warnings)"
        ),
    ]
    if report["next_actions"]:
        lines.extend(["", "Next actions:"])
        lines.extend(f"- {action}" for action in report["next_actions"])
    return "\n".join(lines)


def format_artifact_probe_markdown(
    report: dict[str, Any],
    *,
    model_registry_label: str | None = None,
    runtime_registry_label: str | None = None,
) -> str:
    summary = report["summary"]
    lines = [
        "# AI Registry Artifact Probe",
        "",
        f"- Status: **{report['status']}**",
        f"- Generated: `{report['generated_at']}`",
        f"- Structural validation: **{report['validation']['status']}**",
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
            f"| Checks | {summary['check_count']} |",
            f"| Passed | {summary['pass_count']} |",
            f"| Warnings | {summary['warn_count']} |",
            f"| Pending | {summary['pending_count']} |",
            f"| Blocked | {summary['blocked_count']} |",
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
        for check in artifact["checks"]:
            checkbox = "[x]" if check["status"] == "pass" else "[ ]"
            lines.append(f"- {checkbox} `{check['id']}` **{check['label']}** - {check['detail']}")
            if check.get("action"):
                lines.append(f"  - Action: {check['action']}")
        lines.append("")
    lines.extend(["## Next Actions", ""])
    if report["next_actions"]:
        lines.extend(f"- [ ] {action}" for action in report["next_actions"])
    else:
        lines.append("- [x] Candidate artifact sources and license URLs are reachable.")
    return "\n".join(lines).rstrip()


def _probe_model_artifact(model: dict[str, Any], root: Path, timeout_seconds: float, probe_url: ProbeFn) -> dict[str, Any]:
    return _probe_artifact(
        artifact_type="model",
        item=model,
        display_name=str(model.get("display_name") or model.get("id") or "Model"),
        root=root,
        timeout_seconds=timeout_seconds,
        probe_url=probe_url,
    )


def _probe_runtime_artifact(runtime: dict[str, Any], root: Path, timeout_seconds: float, probe_url: ProbeFn) -> dict[str, Any]:
    artifact = _probe_artifact(
        artifact_type="runtime",
        item=runtime,
        display_name=str(runtime.get("display_name") or runtime.get("id") or "Runtime"),
        root=root,
        timeout_seconds=timeout_seconds,
        probe_url=probe_url,
    )
    artifact["runtime_name"] = runtime.get("runtime")
    return artifact


def _probe_artifact(
    *,
    artifact_type: str,
    item: dict[str, Any],
    display_name: str,
    root: Path,
    timeout_seconds: float,
    probe_url: ProbeFn,
) -> dict[str, Any]:
    item_id = str(item.get("id") or "<missing>")
    source = item.get("source") if isinstance(item.get("source"), dict) else {}
    source_type = str(source.get("type") or "")
    checks: list[dict[str, Any]] = []
    files = [file_info for file_info in _as_list(item.get("files")) if isinstance(file_info, dict)]
    if not files:
        checks.append(
            _check(
                item_id,
                "files",
                "Artifact files",
                "blocked",
                "No registry files are available to probe.",
                "Add exact artifact filenames before probing candidate sources.",
            )
        )
    for index, file_info in enumerate(files):
        checks.extend(_probe_file(item_id, source, source_type, file_info, index, timeout_seconds, probe_url))
    checks.append(_probe_license(item_id, item, root, timeout_seconds, probe_url))
    status = _artifact_status(checks)
    return {
        "type": artifact_type,
        "id": item_id,
        "display_name": display_name,
        "source_type": source_type or None,
        "status": status,
        "checks": checks,
    }


def _probe_file(
    item_id: str,
    source: dict[str, Any],
    source_type: str,
    file_info: dict[str, Any],
    index: int,
    timeout_seconds: float,
    probe_url: ProbeFn,
) -> list[dict[str, Any]]:
    filename = str(file_info.get("filename") or "")
    expected_size = file_info.get("size_bytes")
    expected_sha256 = file_info.get("sha256")
    url = _artifact_url(source, source_type, filename)
    checks: list[dict[str, Any]] = []
    if not url:
        checks.append(
            _check(
                item_id,
                f"files[{index}]:source",
                "Artifact source",
                "pending" if _has_placeholder(source) or _has_placeholder(filename) else "blocked",
                "Artifact source is not yet a concrete remote URL.",
                "Pin an approved URL or Hugging Face repo/revision/filename before source probing.",
            )
        )
        return checks
    probe = probe_url(url, timeout_seconds)
    checks.append(_probe_result_check(item_id, f"files[{index}]:source", "Artifact source", url, probe))
    checks.append(_size_check(item_id, f"files[{index}]:size", expected_size, probe.get("content_length")))
    checks.append(_sha256_check(item_id, f"files[{index}]:sha256", expected_sha256, probe.get("sha256")))
    return checks


def _probe_license(item_id: str, item: dict[str, Any], root: Path, timeout_seconds: float, probe_url: ProbeFn) -> dict[str, Any]:
    license_url = str(item.get("license_url") or "")
    license_path = str(item.get("license_path") or "")
    if license_url and license_path:
        return _check(
            item_id,
            "license",
            "License artifact",
            "blocked",
            "License artifact has conflicting URL and path references.",
            "Use exactly one license_url or license_path.",
        )
    if license_url:
        if _has_placeholder(license_url):
            return _check(
                item_id,
                "license",
                "License URL",
                "pending",
                "License URL is not yet pinned.",
                "Pin an approved license URL before release review.",
            )
        probe = probe_url(license_url, timeout_seconds)
        return _probe_result_check(item_id, "license", "License URL", license_url, probe)
    if license_path:
        return _probe_license_path(item_id, license_path, root)
    return _check(
        item_id,
        "license",
        "License artifact",
        "pending",
        "License artifact is not yet pinned.",
        "Pin an approved license URL or bundled license path before release review.",
    )


def _probe_license_path(item_id: str, license_path: str, root: Path) -> dict[str, Any]:
    if _has_placeholder(license_path):
        return _check(
            item_id,
            "license",
            "License path",
            "pending",
            "License path is not yet pinned.",
            "Pin an approved bundled license path before release review.",
        )
    if license_path.startswith(("/", "\\")) or "\\" in license_path:
        return _check(
            item_id,
            "license",
            "License path",
            "blocked",
            "License path is not a safe relative repository path.",
            "Use a bundled license path inside the repository.",
        )
    parts = Path(license_path).parts
    if not parts or any(part in {"", ".", ".."} for part in parts):
        return _check(
            item_id,
            "license",
            "License path",
            "blocked",
            "License path is not a safe relative repository path.",
            "Use a bundled license path inside the repository.",
        )
    candidate = (root / license_path).resolve()
    if root.resolve() not in candidate.parents:
        return _check(
            item_id,
            "license",
            "License path",
            "blocked",
            "License path escapes the repository.",
            "Use a bundled license path inside the repository.",
        )
    if not candidate.exists() or not candidate.is_file():
        return _check(
            item_id,
            "license",
            "License path",
            "blocked",
            f"Bundled license path does not exist: {license_path}.",
            "Add the approved bundled license text before release review.",
        )
    return _check(item_id, "license", "License path", "pass", f"Bundled license path exists: {license_path}.")


def _probe_result_check(item_id: str, suffix: str, label: str, url: str, probe: dict[str, Any]) -> dict[str, Any]:
    status_code = probe.get("status_code")
    if probe.get("ok"):
        detail = f"{url} returned HTTP {status_code}."
        content_length = probe.get("content_length")
        if content_length is not None:
            detail = f"{detail} Content-Length: {content_length} bytes."
        return _check(item_id, suffix, label, "pass", detail)
    detail = str(probe.get("error") or f"{url} did not return a successful status.")
    return _check(item_id, suffix, label, "blocked", detail, "Confirm the pinned URL is reachable from a clean release environment.")


def _size_check(item_id: str, suffix: str, expected_size: Any, actual_size: Any) -> dict[str, Any]:
    if not isinstance(expected_size, int) or expected_size <= 0:
        return _check(
            item_id,
            suffix,
            "Content length",
            "pending",
            "Registry size_bytes is not pinned.",
            "Record the exact artifact size in bytes before release.",
        )
    if actual_size is None:
        return _check(
            item_id,
            suffix,
            "Content length",
            "warn",
            f"Remote source did not expose Content-Length; registry expects {expected_size} bytes.",
            "Verify size during artifact download/checksum approval.",
        )
    if actual_size != expected_size:
        return _check(
            item_id,
            suffix,
            "Content length",
            "blocked",
            f"Remote Content-Length is {actual_size} bytes, but registry expects {expected_size} bytes.",
            "Update size_bytes only after verifying the exact approved artifact.",
        )
    return _check(item_id, suffix, "Content length", "pass", f"Remote Content-Length matches {expected_size} bytes.")


def _sha256_check(item_id: str, suffix: str, expected_sha256: Any, remote_sha256: Any) -> dict[str, Any]:
    expected = str(expected_sha256 or "")
    if not re.fullmatch(r"[a-fA-F0-9]{64}", expected):
        return _check(
            item_id,
            suffix,
            "SHA-256 metadata",
            "pending",
            "Registry SHA-256 is not pinned.",
            "Pin the exact artifact SHA-256 before release.",
        )
    actual = str(remote_sha256 or "")
    if not actual:
        return _check(
            item_id,
            suffix,
            "SHA-256 metadata",
            "pass",
            "Registry SHA-256 is pinned; remote source did not expose checksum metadata, so full download verification remains the final gate.",
        )
    if actual.lower() != expected.lower():
        return _check(
            item_id,
            suffix,
            "SHA-256 metadata",
            "blocked",
            f"Remote checksum metadata is {actual}, but registry expects {expected}.",
            "Update the candidate only after verifying the exact approved artifact checksum.",
        )
    return _check(item_id, suffix, "SHA-256 metadata", "pass", "Remote checksum metadata matches the pinned SHA-256.")


def _probe_http_url(url: str, timeout_seconds: float) -> dict[str, Any]:
    head = _open_probe(url, timeout_seconds, method="HEAD")
    if head["ok"] or head.get("status_code") not in {403, 405, 501}:
        return head
    return _open_probe(url, timeout_seconds, method="GET")


def _open_probe(url: str, timeout_seconds: float, *, method: str) -> dict[str, Any]:
    headers = {"User-Agent": USER_AGENT}
    if method == "GET":
        headers["Range"] = "bytes=0-0"
    request = urllib.request.Request(url, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            status_code = int(getattr(response, "status", response.getcode()))
            content_length = _content_length(response.headers)
            return {
                "ok": 200 <= status_code < 400,
                "status_code": status_code,
                "content_length": content_length,
                "sha256": _sha256_from_headers(response.headers),
                "final_url": response.geturl(),
            }
    except urllib.error.HTTPError as exc:
        return {
            "ok": False,
            "status_code": exc.code,
            "content_length": _content_length(exc.headers),
            "sha256": _sha256_from_headers(exc.headers),
            "final_url": exc.url,
            "error": f"{url} returned HTTP {exc.code}.",
        }
    except urllib.error.URLError as exc:
        return {"ok": False, "status_code": None, "content_length": None, "sha256": None, "final_url": url, "error": str(exc.reason)}
    except TimeoutError:
        return {"ok": False, "status_code": None, "content_length": None, "sha256": None, "final_url": url, "error": "Request timed out."}


def _content_length(headers: Any) -> int | None:
    content_range = headers.get("Content-Range") if headers else None
    if content_range:
        match = re.search(r"/(\d+)$", content_range)
        if match:
            return int(match.group(1))
    value = headers.get("Content-Length") if headers else None
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _sha256_from_headers(headers: Any) -> str | None:
    if not headers:
        return None
    for header in ["X-Checksum-Sha256", "X-Checksum-SHA256"]:
        value = headers.get(header)
        if not value:
            continue
        match = re.search(r"[a-fA-F0-9]{64}", value)
        if match:
            return match.group(0).lower()
    return None


def _artifact_url(source: dict[str, Any], source_type: str, filename: str) -> str | None:
    if source_type == "url":
        url = str(source.get("url") or "")
        return None if _has_placeholder(url) else url
    if source_type == "huggingface":
        repo_id = str(source.get("repo_id") or "")
        revision = str(source.get("revision") or "")
        if _has_placeholder(repo_id) or _has_placeholder(revision) or _has_placeholder(filename):
            return None
        encoded_filename = "/".join(urllib.parse.quote(part) for part in filename.split("/"))
        return f"https://huggingface.co/{repo_id}/resolve/{revision}/{encoded_filename}"
    return None


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


def _artifact_status(checks: list[dict[str, Any]]) -> str:
    if any(check["status"] == "blocked" for check in checks):
        return "blocked"
    if any(check["status"] in {"warn", "pending"} for check in checks):
        return "warn"
    return "pass"


def _next_actions(checks: list[dict[str, Any]], validation: dict[str, Any]) -> list[str]:
    actions = []
    if validation["errors"]:
        actions.append("Resolve structural registry errors before probing candidate artifacts.")
    if validation["warnings"]:
        actions.append("Resolve registry placeholder warnings before candidate artifact approval.")
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
