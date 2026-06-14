from __future__ import annotations

import copy
import fnmatch
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from pathlib import Path
from typing import Any

from vault_core.ai.models.release_plan import load_registry_json
from vault_core.db.session import now_iso

DEFAULT_HUGGINGFACE_API_BASE_URL = "https://huggingface.co/api/models"
DEFAULT_TIMEOUT_SECONDS = 15.0
USER_AGENT = "VaultResearchLab/0.1 AIRegistryMetadataHydrator"
PLACEHOLDER_VALUES = {"", "REQUIRED_BEFORE_RELEASE"}
COMMIT_SHA_RE = re.compile(r"^[a-fA-F0-9]{40}$")
SHA256_RE = re.compile(r"^[a-fA-F0-9]{64}$")

ModelInfoFetcher = Callable[[str, str, float], dict[str, Any]]


class HuggingFaceMetadataError(ValueError):
    """Raised when candidate Hugging Face metadata cannot be resolved safely."""


def hydrate_huggingface_model_registry(
    registry: dict[str, Any],
    *,
    model_ids: set[str] | None = None,
    revision: str = "main",
    refresh: bool = False,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    api_base_url: str = DEFAULT_HUGGINGFACE_API_BASE_URL,
    fetch_model_info: ModelInfoFetcher | None = None,
) -> dict[str, Any]:
    """Return a copied model registry with safe Hugging Face metadata filled in.

    This intentionally does not mutate approval records. Release approval remains
    a separate reviewer action enforced by the readiness and pinning gates.
    """

    patched = copy.deepcopy(registry)
    fetcher = fetch_model_info or (
        lambda repo_id, requested_revision, timeout: fetch_huggingface_model_info(
            repo_id,
            requested_revision,
            timeout_seconds=timeout,
            api_base_url=api_base_url,
        )
    )
    errors: list[str] = []
    warnings: list[str] = []
    updates: list[dict[str, Any]] = []
    skipped: list[dict[str, str]] = []

    for model in _as_list(patched.get("models")):
        if not isinstance(model, dict):
            continue
        model_id = str(model.get("id") or "<missing>")
        if model_ids is not None and model_id not in model_ids:
            continue
        source = model.get("source") if isinstance(model.get("source"), dict) else {}
        if source.get("type") != "huggingface":
            skipped.append({"id": model_id, "reason": "not a Hugging Face source"})
            continue
        repo_id = str(source.get("repo_id") or "")
        if _has_placeholder(repo_id) or "://" in repo_id:
            errors.append(f"{model_id}.source.repo_id must be a concrete Hugging Face repo id.")
            continue
        files = [file_info for file_info in _as_list(model.get("files")) if isinstance(file_info, dict)]
        if not files:
            errors.append(f"{model_id}.files must contain at least one artifact to hydrate.")
            continue
        requested_revision = _requested_revision(source, revision, refresh)
        try:
            info = fetcher(repo_id, requested_revision, timeout_seconds)
        except Exception as exc:  # noqa: BLE001 - report network/fixture failures as candidate errors.
            errors.append(f"{model_id}: failed to resolve {repo_id}@{requested_revision}: {exc}")
            continue

        resolved_revision = _resolved_commit_sha(info)
        if not resolved_revision:
            errors.append(f"{model_id}: Hugging Face response did not include a 40-character commit SHA.")
            continue
        if refresh or _has_placeholder(source.get("revision")):
            old_value = source.get("revision")
            source["revision"] = resolved_revision
            updates.append(_update(model_id, "source.revision", old_value, resolved_revision))
        elif str(source.get("revision")).lower() != resolved_revision.lower():
            warnings.append(
                f"{model_id}: requested revision resolved to {resolved_revision}; "
                f"registry already pins {source.get('revision')}."
            )

        license_label = _license_label(info)
        if license_label and (refresh or _has_placeholder_label(model.get("license_label"))):
            old_value = model.get("license_label")
            model["license_label"] = license_label
            updates.append(_update(model_id, "license_label", old_value, license_label))

        siblings = _siblings_by_filename(info)
        for index, file_info in enumerate(files):
            filename = str(file_info.get("filename") or "")
            if _has_placeholder(filename) or not _safe_relative_path(filename):
                errors.append(f"{model_id}.files[{index}].filename must be a concrete safe relative path.")
                continue
            if not _filename_allowed(filename, source.get("allow_patterns")):
                errors.append(f"{model_id}.files[{index}].filename is not allowed by source.allow_patterns.")
                continue
            sibling = siblings.get(filename)
            if not sibling:
                errors.append(f"{model_id}: {filename} was not found in {repo_id}@{requested_revision}.")
                continue
            size_bytes = _sibling_size(sibling)
            if size_bytes and (refresh or _missing_positive_int(file_info.get("size_bytes"))):
                old_value = file_info.get("size_bytes")
                file_info["size_bytes"] = size_bytes
                updates.append(_update(model_id, f"files[{index}].size_bytes", old_value, size_bytes))
            elif size_bytes and isinstance(file_info.get("size_bytes"), int) and file_info["size_bytes"] != size_bytes:
                warnings.append(
                    f"{model_id}: registry size_bytes for {filename} is {file_info['size_bytes']}, "
                    f"but Hugging Face reports {size_bytes}."
                )

            sha256 = _sibling_sha256(sibling)
            if sha256 and (refresh or _missing_sha256(file_info.get("sha256"))):
                old_value = file_info.get("sha256")
                file_info["sha256"] = sha256
                updates.append(_update(model_id, f"files[{index}].sha256", old_value, sha256))
            elif sha256 and _is_sha256(file_info.get("sha256")) and str(file_info["sha256"]).lower() != sha256:
                warnings.append(
                    f"{model_id}: registry SHA-256 for {filename} does not match Hugging Face LFS metadata."
                )
            elif not sha256:
                warnings.append(
                    f"{model_id}: {filename} does not expose LFS SHA-256 metadata; "
                    "full download verification must provide the checksum."
                )

    return {
        "generated_at": now_iso(),
        "status": "blocked" if errors else "hydrated",
        "summary": {
            "model_count": len(_as_list(patched.get("models"))),
            "updated_field_count": len(updates),
            "warning_count": len(warnings),
            "error_count": len(errors),
            "skipped_count": len(skipped),
        },
        "registry": patched,
        "updates": updates,
        "warnings": warnings,
        "errors": errors,
        "skipped": skipped,
    }


def hydrate_huggingface_model_registry_file(
    model_registry_path: Path,
    output_path: Path,
    *,
    model_ids: set[str] | None = None,
    revision: str = "main",
    refresh: bool = False,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    api_base_url: str = DEFAULT_HUGGINGFACE_API_BASE_URL,
) -> dict[str, Any]:
    registry = load_registry_json(model_registry_path)
    result = hydrate_huggingface_model_registry(
        registry,
        model_ids=model_ids,
        revision=revision,
        refresh=refresh,
        timeout_seconds=timeout_seconds,
        api_base_url=api_base_url,
    )
    if not result["errors"]:
        output = output_path.expanduser()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(f"{json.dumps(result['registry'], indent=2)}\n", encoding="utf-8")
    return result


def fetch_huggingface_model_info(
    repo_id: str,
    revision: str,
    *,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    api_base_url: str = DEFAULT_HUGGINGFACE_API_BASE_URL,
) -> dict[str, Any]:
    url = _model_info_url(api_base_url, repo_id, revision)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        raise HuggingFaceMetadataError(f"{url} returned HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise HuggingFaceMetadataError(f"{url} failed: {exc.reason}") from exc
    except TimeoutError as exc:
        raise HuggingFaceMetadataError(f"{url} timed out") from exc
    except json.JSONDecodeError as exc:
        raise HuggingFaceMetadataError(f"{url} did not return valid JSON: {exc}") from exc


def format_huggingface_hydration_summary(result: dict[str, Any]) -> str:
    summary = result["summary"]
    lines = [
        f"AI registry Hugging Face metadata hydration: {result['status']}",
        (
            "Updates: "
            f"{summary['updated_field_count']} fields / "
            f"{summary['warning_count']} warnings / "
            f"{summary['error_count']} errors"
        ),
    ]
    if result["updates"]:
        lines.extend(["", "Updated fields:"])
        lines.extend(
            f"- {update['model_id']}: {update['field']} = {update['new_value']}"
            for update in result["updates"]
        )
    if result["warnings"]:
        lines.extend(["", "Warnings:", *[f"- {warning}" for warning in result["warnings"]]])
    if result["errors"]:
        lines.extend(["", "Errors:", *[f"- {error}" for error in result["errors"]]])
    return "\n".join(lines)


def _model_info_url(api_base_url: str, repo_id: str, revision: str) -> str:
    base = api_base_url.rstrip("/")
    encoded_repo = urllib.parse.quote(repo_id.strip("/"), safe="/")
    encoded_revision = urllib.parse.quote(revision, safe="")
    return f"{base}/{encoded_repo}/revision/{encoded_revision}?blobs=true"


def _requested_revision(source: dict[str, Any], fallback_revision: str, refresh: bool) -> str:
    current = str(source.get("revision") or "")
    if refresh or _has_placeholder(current):
        return fallback_revision
    return current


def _resolved_commit_sha(info: dict[str, Any]) -> str | None:
    value = str(info.get("sha") or "")
    return value if COMMIT_SHA_RE.fullmatch(value) else None


def _license_label(info: dict[str, Any]) -> str | None:
    card_data = info.get("cardData") if isinstance(info.get("cardData"), dict) else {}
    value = card_data.get("license") or info.get("license")
    if isinstance(value, str) and value.strip():
        return value.strip()
    if isinstance(value, list):
        labels = [str(item).strip() for item in value if str(item).strip()]
        if labels:
            return ", ".join(labels)
    for tag in _as_list(info.get("tags")):
        if isinstance(tag, str) and tag.startswith("license:") and len(tag) > len("license:"):
            return tag.split(":", 1)[1]
    return None


def _siblings_by_filename(info: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(sibling.get("rfilename")): sibling
        for sibling in _as_list(info.get("siblings"))
        if isinstance(sibling, dict) and sibling.get("rfilename")
    }


def _sibling_size(sibling: dict[str, Any]) -> int | None:
    lfs = sibling.get("lfs") if isinstance(sibling.get("lfs"), dict) else {}
    for value in [lfs.get("size"), sibling.get("size")]:
        if isinstance(value, int) and value > 0:
            return value
    return None


def _sibling_sha256(sibling: dict[str, Any]) -> str | None:
    lfs = sibling.get("lfs") if isinstance(sibling.get("lfs"), dict) else {}
    value = str(lfs.get("sha256") or "")
    return value.lower() if SHA256_RE.fullmatch(value) else None


def _filename_allowed(filename: str, patterns: Any) -> bool:
    allow_patterns = [str(pattern) for pattern in _as_list(patterns) if isinstance(pattern, str) and pattern]
    if not allow_patterns:
        return False
    return any(fnmatch.fnmatch(filename, pattern) for pattern in allow_patterns)


def _update(model_id: str, field: str, old_value: Any, new_value: Any) -> dict[str, Any]:
    return {"model_id": model_id, "field": field, "old_value": old_value, "new_value": new_value}


def _has_placeholder(value: Any) -> bool:
    text = str(value or "")
    return text in PLACEHOLDER_VALUES or "REPLACE_WITH_APPROVED" in text


def _has_placeholder_label(value: Any) -> bool:
    text = str(value or "").strip().lower()
    return not text or text in {"required_before_release", "check upstream model card"} or "check upstream" in text


def _missing_positive_int(value: Any) -> bool:
    return not isinstance(value, int) or value <= 0


def _missing_sha256(value: Any) -> bool:
    return _has_placeholder(value) or not _is_sha256(value)


def _is_sha256(value: Any) -> bool:
    return SHA256_RE.fullmatch(str(value or "")) is not None


def _safe_relative_path(value: str) -> bool:
    if not value or value.startswith(("/", "\\")) or "\\" in value:
        return False
    parts = Path(value).parts
    return bool(parts) and all(part not in {"", ".", ".."} for part in parts)


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []
