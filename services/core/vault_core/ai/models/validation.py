from __future__ import annotations

import hashlib
import json
import re
import urllib.parse
from pathlib import Path
from typing import Any

from vault_core.ai.models import registry as model_registry_module
from vault_core.ai.models import runtime_installer as runtime_registry_module

KNOWN_CAPABILITIES = {
    "extract_objects",
    "extract_claims",
    "summarize",
    "generate_note",
    "grounded_answer",
    "create_learning_item",
    "embed_text",
    "rerank_results",
    "transcribe_audio",
    "synthesize_speech",
}
MODEL_KINDS = {"llm", "embedding", "reranker", "stt", "tts"}
MODEL_PROFILES = {"tiny", "standard", "strong"}
RELEASE_CHANNELS = {"demo", "production"}
MODEL_SOURCE_TYPES = {"local_fixture", "url", "huggingface"}
RUNTIME_SOURCE_TYPES = {"local_fixture", "url"}
SPECIAL_CHECKSUMS = {"REQUIRED_BEFORE_RELEASE"}
SPECIAL_APPROVAL_VALUES = {"REQUIRED_BEFORE_RELEASE"}
LOCAL_RUNTIME_NAMES = {"llama_cpp", "whisper_cpp", "piper"}
RUNTIME_PLATFORMS = {"any", "macos", "windows", "linux"}
RUNTIME_ARCHES = {"any", "arm64", "x64"}
APPROVAL_STATUSES = {"approved", "pending", "rejected"}
ID_RE = re.compile(r"^[a-z0-9][a-z0-9_.-]*$")
SHA256_RE = re.compile(r"^[a-fA-F0-9]{64}$")
HF_REVISION_RE = re.compile(r"^[a-fA-F0-9]{40}$")
APPROVAL_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}(?:[T ].*)?$")
POLICY_PATH = Path(__file__).with_name("registry_policy.json")
POLICY_REGISTRY_FILENAMES = {
    "model_registry": "model_registry.json",
    "runtime_registry": "runtime_registry.json",
}


def validate_ai_registries(
    model_registry: dict[str, Any] | None = None,
    runtime_registry: dict[str, Any] | None = None,
    *,
    root: Path | None = None,
) -> dict[str, Any]:
    check_policy = model_registry is None and runtime_registry is None
    model_registry = model_registry if model_registry is not None else model_registry_module.load_model_registry()
    runtime_registry = runtime_registry if runtime_registry is not None else runtime_registry_module.load_runtime_registry()
    root = root or _repo_root()
    errors: list[str] = []
    warnings: list[str] = []

    _validate_model_registry(model_registry, runtime_registry, root, errors, warnings)
    _validate_runtime_registry(runtime_registry, root, errors, warnings)
    policy = _validate_registry_policy(errors, warnings) if check_policy else _skipped_policy_report()

    model_count = len(_as_list(model_registry.get("models")))
    pack_count = len(_as_list(model_registry.get("model_packs")))
    runtime_count = len(_as_list(runtime_registry.get("runtimes")))
    return {
        "status": "fail" if errors else "pass",
        "summary": {
            "model_count": model_count,
            "model_pack_count": pack_count,
            "runtime_count": runtime_count,
            "error_count": len(errors),
            "warning_count": len(warnings),
        },
        "policy": policy,
        "errors": errors,
        "warnings": warnings,
    }


def load_registry_policy(path: Path | None = None) -> dict[str, Any]:
    policy_path = path or POLICY_PATH
    return json.loads(policy_path.read_text())


def current_registry_policy() -> dict[str, Any]:
    return {
        "schema_version": 1,
        "pin_mode": "app_pinned",
        "registries": {
            "model_registry": {
                "path": POLICY_REGISTRY_FILENAMES["model_registry"],
                "sha256": _file_sha256(model_registry_module.REGISTRY_PATH),
            },
            "runtime_registry": {
                "path": POLICY_REGISTRY_FILENAMES["runtime_registry"],
                "sha256": _file_sha256(runtime_registry_module.REGISTRY_PATH),
            },
        },
    }


def write_registry_policy(path: Path | None = None) -> dict[str, Any]:
    policy = current_registry_policy()
    policy_path = path or POLICY_PATH
    policy_path.write_text(f"{json.dumps(policy, indent=2)}\n", encoding="utf-8")
    return policy


def _validate_model_registry(
    registry: dict[str, Any],
    runtime_registry: dict[str, Any],
    root: Path,
    errors: list[str],
    warnings: list[str],
) -> None:
    if registry.get("schema_version") != 1:
        errors.append("model_registry.schema_version must be 1.")
    models = _as_list(registry.get("models"))
    packs = _as_list(registry.get("model_packs"))
    if not models:
        errors.append("model_registry.models must contain at least one model.")
    if not packs:
        errors.append("model_registry.model_packs must contain at least one pack.")

    model_ids = _ids(models, "model", errors)
    production_model_ids = _production_model_ids(packs)
    runtime_names_by_channel = _runtime_names_by_channel(runtime_registry)
    for index, model in enumerate(models):
        path = f"models[{index}]"
        model_id = str(model.get("id") or f"<missing:{index}>")
        _validate_id(model_id, f"{path}.id", errors)
        _validate_enum(model.get("kind"), MODEL_KINDS, f"{model_id}.kind", errors)
        _validate_enum(model.get("recommended_profile"), MODEL_PROFILES, f"{model_id}.recommended_profile", errors)
        capabilities = _required_list(model, "capabilities", f"{model_id}.capabilities", errors)
        for capability in capabilities:
            if capability not in KNOWN_CAPABILITIES:
                errors.append(f"{model_id}.capabilities contains unknown capability: {capability}.")
        source = model.get("source") or {}
        files = _as_list(model.get("files"))
        installed = bool(model.get("installed"))
        runtime = str(model.get("runtime") or "")
        if not runtime:
            errors.append(f"{model_id}.runtime is required.")
        if not installed and runtime != "mock":
            if not source:
                errors.append(f"{model_id}.source is required for non-installed registry models.")
            if not files:
                errors.append(f"{model_id}.files must contain at least one artifact.")
        if source:
            _validate_model_source(model_id, source, root, errors, warnings)
        _validate_files(model_id, files, errors, warnings)
        _validate_license_reference(
            model_id,
            model,
            root,
            errors,
            warnings,
            required=model_id in production_model_ids,
        )
        _validate_approval_record(
            model_id,
            model,
            errors,
            warnings,
            required=model_id in production_model_ids,
        )
        if not isinstance(model.get("defaults", {}), dict):
            errors.append(f"{model_id}.defaults must be an object.")

    _ids(packs, "model pack", errors)
    for index, pack in enumerate(packs):
        path = f"model_packs[{index}]"
        pack_id = str(pack.get("id") or f"<missing:{index}>")
        _validate_id(pack_id, f"{path}.id", errors)
        _validate_enum(pack.get("profile"), MODEL_PROFILES, f"{pack_id}.profile", errors)
        release_channel = str(pack.get("release_channel") or "production")
        _validate_enum(release_channel, RELEASE_CHANNELS, f"{pack_id}.release_channel", errors)
        required_model_ids = _required_list(pack, "required_model_ids", f"{pack_id}.required_model_ids", errors)
        optional_model_ids = _as_list(pack.get("optional_model_ids"))
        for model_id in [*required_model_ids, *optional_model_ids]:
            if model_id not in model_ids:
                errors.append(f"{pack_id} references missing model: {model_id}.")
        capabilities = _as_list(pack.get("capabilities"))
        for capability in capabilities:
            if capability not in KNOWN_CAPABILITIES:
                errors.append(f"{pack_id}.capabilities contains unknown capability: {capability}.")
        if release_channel == "production":
            for model in models:
                if model.get("id") not in required_model_ids:
                    continue
                if model.get("runtime") == "mock" or model.get("format") == "test":
                    errors.append(f"{pack_id} cannot include mock/test model {model['id']} in production.")
                runtime = str(model.get("runtime") or "")
                if runtime in LOCAL_RUNTIME_NAMES and runtime not in runtime_names_by_channel["production"]:
                    errors.append(f"{pack_id} requires production runtime manifest for {runtime}.")


def _validate_runtime_registry(
    registry: dict[str, Any],
    root: Path,
    errors: list[str],
    warnings: list[str],
) -> None:
    if registry.get("schema_version") != 1:
        errors.append("runtime_registry.schema_version must be 1.")
    runtimes = _as_list(registry.get("runtimes"))
    if not runtimes:
        errors.append("runtime_registry.runtimes must contain at least one runtime.")
    _ids(runtimes, "runtime", errors)
    for index, runtime in enumerate(runtimes):
        path = f"runtimes[{index}]"
        runtime_id = str(runtime.get("id") or f"<missing:{index}>")
        _validate_id(runtime_id, f"{path}.id", errors)
        _validate_enum(runtime.get("release_channel"), RELEASE_CHANNELS, f"{runtime_id}.release_channel", errors)
        _validate_enum(runtime.get("platform", "any"), RUNTIME_PLATFORMS, f"{runtime_id}.platform", errors)
        _validate_enum(runtime.get("arch", "any"), RUNTIME_ARCHES, f"{runtime_id}.arch", errors)
        if not runtime.get("runtime"):
            errors.append(f"{runtime_id}.runtime is required.")
        source = runtime.get("source") or {}
        if not source:
            errors.append(f"{runtime_id}.source is required.")
        else:
            _validate_runtime_source(runtime_id, source, root, errors, warnings)
        files = _as_list(runtime.get("files"))
        if not files:
            errors.append(f"{runtime_id}.files must contain at least one artifact.")
        _validate_files(runtime_id, files, errors, warnings)
        _validate_license_reference(
            runtime_id,
            runtime,
            root,
            errors,
            warnings,
            required=runtime.get("release_channel") == "production",
        )
        _validate_approval_record(
            runtime_id,
            runtime,
            errors,
            warnings,
            required=runtime.get("release_channel") == "production",
        )


def _validate_model_source(
    model_id: str,
    source: dict[str, Any],
    root: Path,
    errors: list[str],
    warnings: list[str],
) -> None:
    source_type = source.get("type")
    _validate_enum(source_type, MODEL_SOURCE_TYPES, f"{model_id}.source.type", errors)
    if source_type == "local_fixture":
        _validate_fixture_path(model_id, source, root, errors)
    elif source_type == "huggingface":
        repo_id = str(source.get("repo_id") or "")
        revision = str(source.get("revision") or "")
        if not repo_id:
            errors.append(f"{model_id}.source.repo_id is required for Hugging Face sources.")
        if not revision:
            errors.append(f"{model_id}.source.revision is required for Hugging Face sources.")
        elif revision not in SPECIAL_CHECKSUMS and not HF_REVISION_RE.match(revision):
            errors.append(f"{model_id}.source.revision must be REQUIRED_BEFORE_RELEASE or a 40-character commit.")
        if not _as_list(source.get("allow_patterns")):
            errors.append(f"{model_id}.source.allow_patterns must not be empty for Hugging Face sources.")
        if "REPLACE_WITH_APPROVED" in repo_id or revision in SPECIAL_CHECKSUMS:
            warnings.append(f"{model_id} has placeholder Hugging Face source metadata.")
    elif source_type == "url":
        url = str(source.get("url") or "")
        if not url:
            errors.append(f"{model_id}.source.url is required for URL sources.")
        elif url in SPECIAL_APPROVAL_VALUES or "REPLACE_WITH_APPROVED" in url:
            warnings.append(f"{model_id} has placeholder URL source metadata.")
        else:
            _validate_source_url(model_id, url, f"{model_id}.source.url", errors)


def _validate_runtime_source(
    runtime_id: str,
    source: dict[str, Any],
    root: Path,
    errors: list[str],
    warnings: list[str],
) -> None:
    source_type = source.get("type")
    _validate_enum(source_type, RUNTIME_SOURCE_TYPES, f"{runtime_id}.source.type", errors)
    if source_type == "local_fixture":
        _validate_fixture_path(runtime_id, source, root, errors)
    elif source_type == "url":
        url = str(source.get("url") or "")
        if not url:
            errors.append(f"{runtime_id}.source.url is required for URL sources.")
        elif url in SPECIAL_APPROVAL_VALUES or "REPLACE_WITH_APPROVED" in url:
            warnings.append(f"{runtime_id} has placeholder URL source metadata.")
        else:
            _validate_source_url(runtime_id, url, f"{runtime_id}.source.url", errors)
        _validate_runtime_archive_source(runtime_id, source, errors, warnings)


def _validate_runtime_archive_source(
    runtime_id: str,
    source: dict[str, Any],
    errors: list[str],
    warnings: list[str],
) -> None:
    archive = source.get("archive")
    archive_member = source.get("archive_member")
    member: Any | None = None
    if archive is not None:
        if not isinstance(archive, dict):
            errors.append(f"{runtime_id}.source.archive must be an object.")
            return
        member = archive.get("member")
    if archive_member is not None:
        member = archive_member
    if member is None:
        return
    member_text = str(member or "")
    if not member_text or member_text in SPECIAL_APPROVAL_VALUES or "REPLACE_WITH_APPROVED" in member_text:
        warnings.append(f"{runtime_id}.source archive member is pending release approval.")
    elif not _safe_relative_path(member_text):
        errors.append(f"{runtime_id}.source archive member must be a safe relative path.")
    archive_format = source.get("archive_format")
    if archive_format is None and isinstance(archive, dict):
        archive_format = archive.get("format")
    if archive_format is None:
        return
    if str(archive_format).lower() not in {"zip", "tar", "tar.gz", "tgz"}:
        errors.append(f"{runtime_id}.source archive format must be one of: zip, tar, tar.gz, tgz.")


def _validate_files(
    owner_id: str,
    files: list[Any],
    errors: list[str],
    warnings: list[str],
) -> None:
    for index, file_info in enumerate(files):
        path = f"{owner_id}.files[{index}]"
        if not isinstance(file_info, dict):
            errors.append(f"{path} must be an object.")
            continue
        filename = str(file_info.get("filename") or "")
        if not filename:
            errors.append(f"{path}.filename is required.")
        elif not _safe_relative_path(filename):
            errors.append(f"{path}.filename must be a safe relative artifact path.")
        elif "REPLACE_WITH_APPROVED" in filename:
            warnings.append(f"{path}.filename still uses a release placeholder.")
        checksum = file_info.get("sha256")
        if checksum is None:
            errors.append(f"{path}.sha256 is required.")
        elif checksum not in SPECIAL_CHECKSUMS and not SHA256_RE.match(str(checksum)):
            errors.append(f"{path}.sha256 must be REQUIRED_BEFORE_RELEASE or a 64-character hex digest.")
        elif checksum in SPECIAL_CHECKSUMS:
            warnings.append(f"{path}.sha256 is pending release approval.")
        size_bytes = file_info.get("size_bytes")
        if size_bytes is not None and (not isinstance(size_bytes, int) or size_bytes <= 0):
            errors.append(f"{path}.size_bytes must be a positive integer or null.")
        if size_bytes is None:
            warnings.append(f"{path}.size_bytes is pending release approval.")


def _validate_license_reference(
    owner_id: str,
    item: dict[str, Any],
    root: Path,
    errors: list[str],
    warnings: list[str],
    *,
    required: bool,
) -> None:
    license_url = str(item.get("license_url") or "")
    license_path = str(item.get("license_path") or "")
    if license_url and license_path:
        errors.append(f"{owner_id} must use either license_url or license_path, not both.")
        return
    if not license_url and not license_path:
        if required:
            warnings.append(f"{owner_id}.license_url or license_path is pending release approval.")
        return
    if license_url:
        if license_url in SPECIAL_APPROVAL_VALUES or "REPLACE_WITH_APPROVED" in license_url:
            warnings.append(f"{owner_id}.license_url is pending release approval.")
            return
        parsed = urllib.parse.urlparse(license_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            errors.append(f"{owner_id}.license_url must be an https/http URL or REQUIRED_BEFORE_RELEASE.")
        return
    if license_path in SPECIAL_APPROVAL_VALUES or "REPLACE_WITH_APPROVED" in license_path:
        warnings.append(f"{owner_id}.license_path is pending release approval.")
        return
    if license_path.startswith(("/", "\\")) or "\\" in license_path:
        errors.append(f"{owner_id}.license_path must be a relative repository path.")
        return
    parts = Path(license_path).parts
    if not parts or any(part in {"", ".", ".."} for part in parts):
        errors.append(f"{owner_id}.license_path must be a safe relative repository path.")
        return
    candidate = (root / license_path).resolve()
    if root.resolve() not in candidate.parents:
        errors.append(f"{owner_id}.license_path must stay inside the repository.")
    elif not candidate.exists() or not candidate.is_file():
        errors.append(f"{owner_id}.license_path does not exist: {license_path}.")


def _validate_approval_record(
    owner_id: str,
    item: dict[str, Any],
    errors: list[str],
    warnings: list[str],
    *,
    required: bool,
) -> None:
    approval = item.get("approval")
    if approval is None:
        if required:
            warnings.append(f"{owner_id}.approval is pending release approval.")
        return
    if not isinstance(approval, dict):
        errors.append(f"{owner_id}.approval must be an object.")
        return

    status = approval.get("status")
    if not isinstance(status, str) or not status.strip():
        errors.append(f"{owner_id}.approval.status is required.")
        return
    normalized_status = status.strip().lower()
    if normalized_status not in APPROVAL_STATUSES:
        errors.append(f"{owner_id}.approval.status must be one of: approved, pending, rejected.")
        return
    if required and normalized_status != "approved":
        warnings.append(f"{owner_id}.approval.status is pending release approval.")

    for field in ["approved_by", "approved_at", "evidence"]:
        value = approval.get(field)
        if value is None:
            if normalized_status == "approved":
                errors.append(f"{owner_id}.approval.{field} is required when approval.status is approved.")
            continue
        if not isinstance(value, str):
            errors.append(f"{owner_id}.approval.{field} must be a string.")
            continue
        if normalized_status == "approved" and not value.strip():
            errors.append(f"{owner_id}.approval.{field} is required when approval.status is approved.")
    approved_at = approval.get("approved_at")
    if isinstance(approved_at, str) and approved_at.strip() and not APPROVAL_DATE_RE.match(approved_at.strip()):
        errors.append(f"{owner_id}.approval.approved_at must start with an ISO date like YYYY-MM-DD.")


def _validate_fixture_path(owner_id: str, source: dict[str, Any], root: Path, errors: list[str]) -> None:
    fixture_path = str(source.get("path") or "")
    if not fixture_path:
        errors.append(f"{owner_id}.source.path is required for local fixtures.")
        return
    if not _safe_relative_path(fixture_path):
        errors.append(f"{owner_id}.source.path must be a safe relative repository path.")
        return
    candidate = (root / fixture_path).resolve()
    if not _path_inside(root, candidate):
        errors.append(f"{owner_id}.source.path must stay inside the repository.")
        return
    if not candidate.exists() or not candidate.is_file():
        errors.append(f"{owner_id}.source.path does not exist: {fixture_path}.")


def _validate_source_url(owner_id: str, url: str, path: str, errors: list[str]) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        errors.append(f"{path} must be an https/http URL or REQUIRED_BEFORE_RELEASE.")
    if parsed.username or parsed.password:
        errors.append(f"{owner_id}.source.url must not contain embedded credentials.")


def _validate_registry_policy(errors: list[str], warnings: list[str]) -> dict[str, Any]:
    actual = current_registry_policy()
    if not POLICY_PATH.exists():
        errors.append("registry_policy.json is missing; run ./scripts/pin_ai_registries.sh after approving registry edits.")
        return {"status": "missing", "path": str(POLICY_PATH), "actual": actual, "expected": None}
    try:
        expected = load_registry_policy()
    except json.JSONDecodeError as exc:
        errors.append(f"registry_policy.json is invalid JSON: {exc}.")
        return {"status": "fail", "path": str(POLICY_PATH), "actual": actual, "expected": None}

    if expected.get("schema_version") != 1:
        errors.append("registry_policy.schema_version must be 1.")
    if expected.get("pin_mode") != "app_pinned":
        errors.append("registry_policy.pin_mode must be app_pinned.")

    expected_registries = expected.get("registries")
    if not isinstance(expected_registries, dict):
        errors.append("registry_policy.registries must be an object.")
        expected_registries = {}

    mismatches: list[str] = []
    for registry_id, filename in POLICY_REGISTRY_FILENAMES.items():
        expected_info = expected_registries.get(registry_id)
        actual_info = actual["registries"][registry_id]
        if not isinstance(expected_info, dict):
            errors.append(f"registry_policy.registries.{registry_id} must be an object.")
            continue
        if expected_info.get("path") != filename:
            errors.append(f"registry_policy.registries.{registry_id}.path must be {filename}.")
        expected_sha = str(expected_info.get("sha256") or "")
        if not SHA256_RE.match(expected_sha):
            errors.append(f"registry_policy.registries.{registry_id}.sha256 must be a 64-character hex digest.")
            continue
        if expected_sha != actual_info["sha256"]:
            mismatches.append(registry_id)
            errors.append(
                f"{filename} digest does not match registry_policy.json; "
                "run ./scripts/pin_ai_registries.sh after approving the manifest change."
            )

    if expected.get("schema_version") == 1 and not mismatches and not any(
        error.startswith("registry_policy") for error in errors
    ):
        return {"status": "pass", "path": str(POLICY_PATH), "actual": actual, "expected": expected}
    if not mismatches:
        warnings.append("registry_policy.json was found but contains policy metadata that needs review.")
    return {"status": "fail", "path": str(POLICY_PATH), "actual": actual, "expected": expected}


def _skipped_policy_report() -> dict[str, Any]:
    return {"status": "skipped", "path": str(POLICY_PATH), "actual": None, "expected": None}


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_relative_path(value: str) -> bool:
    if not value or value.startswith(("/", "\\")) or "\\" in value:
        return False
    parts = Path(value).parts
    return bool(parts) and all(part not in {"", ".", ".."} for part in parts)


def _path_inside(root: Path, candidate: Path) -> bool:
    resolved_root = root.resolve()
    resolved_candidate = candidate.resolve()
    return resolved_candidate == resolved_root or resolved_root in resolved_candidate.parents


def _runtime_names_by_channel(runtime_registry: dict[str, Any]) -> dict[str, set[str]]:
    result = {"demo": set(), "production": set()}
    for runtime in _as_list(runtime_registry.get("runtimes")):
        channel = str(runtime.get("release_channel") or "production")
        name = str(runtime.get("runtime") or "")
        if channel in result and name:
            result[channel].add(name)
    return result


def _production_model_ids(packs: list[Any]) -> set[str]:
    ids: set[str] = set()
    for pack in packs:
        if not isinstance(pack, dict) or pack.get("release_channel", "production") != "production":
            continue
        ids.update(str(model_id) for model_id in _as_list(pack.get("required_model_ids")))
        ids.update(str(model_id) for model_id in _as_list(pack.get("optional_model_ids")))
    return ids


def _required_list(item: dict[str, Any], key: str, path: str, errors: list[str]) -> list[Any]:
    values = _as_list(item.get(key))
    if not values:
        errors.append(f"{path} must not be empty.")
    return values


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _ids(items: list[Any], label: str, errors: list[str]) -> set[str]:
    seen: set[str] = set()
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            errors.append(f"{label}[{index}] must be an object.")
            continue
        item_id = item.get("id")
        if not isinstance(item_id, str) or not item_id:
            errors.append(f"{label}[{index}].id is required.")
            continue
        if item_id in seen:
            errors.append(f"Duplicate {label} id detected: {item_id}.")
        seen.add(item_id)
    return seen


def _validate_id(value: str, path: str, errors: list[str]) -> None:
    if not value or value.startswith("<missing"):
        errors.append(f"{path} is required.")
    elif not ID_RE.match(value):
        errors.append(f"{path} must use lowercase letters, numbers, dots, dashes, or underscores.")


def _validate_enum(value: Any, allowed: set[str], path: str, errors: list[str]) -> None:
    if value not in allowed:
        errors.append(f"{path} must be one of {', '.join(sorted(allowed))}.")


def _repo_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "pnpm-workspace.yaml").exists():
            return parent
    return Path(__file__).resolve().parents[5]
