from __future__ import annotations

import copy
import hashlib
import json
import shlex
from collections.abc import Iterable
from typing import Any

from vault_core.ai.models.approval_template import (
    build_ai_approval_template,
    format_approval_template_markdown,
)
from vault_core.ai.models.registry import load_model_registry
from vault_core.ai.models.release_plan import (
    build_ai_registry_release_plan,
    build_registry_pin_preview,
    format_release_plan_markdown,
)
from vault_core.ai.models.runtime_installer import load_runtime_registry
from vault_core.ai.models.validation import validate_ai_registries
from vault_core.db.session import now_iso

MODEL_FIELD_PATHS = {
    "source",
    "defaults",
    "files[0].filename",
    "files[0].sha256",
    "files[0].size_bytes",
    "license_label",
    "license_url",
    "license_path",
    "approval",
}
RUNTIME_FIELD_PATHS = MODEL_FIELD_PATHS | {"version"}


def apply_ai_registry_evidence_overlay(
    *,
    evidence: dict[str, Any],
    model_registry: dict[str, Any] | None = None,
    runtime_registry: dict[str, Any] | None = None,
    model_registry_label: str | None = None,
    runtime_registry_label: str | None = None,
    evidence_label: str | None = None,
) -> dict[str, Any]:
    patched_model_registry = copy.deepcopy(model_registry if model_registry is not None else load_model_registry())
    patched_runtime_registry = copy.deepcopy(
        runtime_registry if runtime_registry is not None else load_runtime_registry()
    )
    result = _apply_overlay(
        evidence=evidence,
        model_registry=patched_model_registry,
        runtime_registry=patched_runtime_registry,
    )
    model_registry_filename = _patched_registry_filename(model_registry_label, "candidate-model-registry.json")
    runtime_registry_filename = _patched_registry_filename(runtime_registry_label, "candidate-runtime-registry.json")
    model_registry_json = json.dumps(patched_model_registry, indent=2)
    runtime_registry_json = json.dumps(patched_runtime_registry, indent=2)
    patched_model_registry_sha256 = _text_sha256(model_registry_json)
    patched_runtime_registry_sha256 = _text_sha256(runtime_registry_json)
    validation = validate_ai_registries(patched_model_registry, patched_runtime_registry)
    release_plan = build_ai_registry_release_plan(patched_model_registry, patched_runtime_registry)
    release_plan["pin_preview"] = build_registry_pin_preview(
        model_registry=patched_model_registry if model_registry is not None else None,
        runtime_registry=patched_runtime_registry if runtime_registry is not None else None,
        model_registry_sha256=patched_model_registry_sha256 if model_registry is not None else None,
        runtime_registry_sha256=patched_runtime_registry_sha256 if runtime_registry is not None else None,
    )
    approval_template = build_ai_approval_template(patched_model_registry, patched_runtime_registry)
    status = "invalid" if result["errors"] or validation["errors"] else "applied"
    generated_at = now_iso()
    release_plan_markdown = format_release_plan_markdown(
        release_plan,
        model_registry_label=model_registry_label,
        runtime_registry_label=runtime_registry_label,
    )
    approval_template_markdown = format_approval_template_markdown(
        approval_template,
        model_registry_label=model_registry_label,
        runtime_registry_label=runtime_registry_label,
    )
    release_plan_filename = "candidate-ai-registry-release-plan.applied.md"
    approval_template_filename = "candidate-local-ai-approval-template.applied.md"
    pin_handoff_filename = "candidate-ai-registry-pin-handoff.applied.md"
    pin_handoff = _build_pin_handoff(
        release_plan=release_plan,
        model_registry_filename=model_registry_filename,
        runtime_registry_filename=runtime_registry_filename,
        patched_model_registry_sha256=patched_model_registry_sha256,
        patched_runtime_registry_sha256=patched_runtime_registry_sha256,
        release_plan_filename=release_plan_filename,
        approval_template_filename=approval_template_filename,
        model_registry_label=model_registry_label,
        runtime_registry_label=runtime_registry_label,
        evidence_label=evidence_label,
    )
    pin_handoff_markdown = _format_pin_handoff_markdown(pin_handoff)
    bundle = {
        "generated_at": generated_at,
        "status": status,
        "applied_count": len(result["applied_fields"]),
        "applied_fields": result["applied_fields"],
        "errors": result["errors"],
        "warnings": result["warnings"],
        "evidence_label": evidence_label,
        "model_registry_label": model_registry_label,
        "runtime_registry_label": runtime_registry_label,
        "model_registry": patched_model_registry,
        "runtime_registry": patched_runtime_registry,
        "model_registry_filename": model_registry_filename,
        "runtime_registry_filename": runtime_registry_filename,
        "model_registry_json": model_registry_json,
        "runtime_registry_json": runtime_registry_json,
        "patched_model_registry_sha256": patched_model_registry_sha256,
        "patched_runtime_registry_sha256": patched_runtime_registry_sha256,
        "release_plan_filename": release_plan_filename,
        "release_plan_mime_type": "text/markdown",
        "approval_template_filename": approval_template_filename,
        "approval_template_mime_type": "text/markdown",
        "pin_handoff_filename": pin_handoff_filename,
        "pin_handoff_mime_type": "text/markdown",
        "validation": validation,
        "release_plan": release_plan,
        "approval_template": approval_template,
        "pin_handoff": pin_handoff,
        "release_plan_markdown": release_plan_markdown,
        "approval_template_markdown": approval_template_markdown,
        "pin_handoff_markdown": pin_handoff_markdown,
    }
    return {
        **bundle,
        "filename": "candidate-ai-registry-evidence-bundle.json",
        "mime_type": "application/json",
        "bundle_json": json.dumps(bundle, indent=2),
    }


def _apply_overlay(
    *,
    evidence: dict[str, Any],
    model_registry: dict[str, Any],
    runtime_registry: dict[str, Any],
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    applied_fields: list[dict[str, str]] = []
    if not isinstance(evidence, dict):
        return {"errors": ["Evidence overlay must be a JSON object."], "warnings": [], "applied_fields": []}

    models_by_id = _items_by_id(model_registry.get("models"))
    runtimes_by_id = _items_by_id(runtime_registry.get("runtimes"))
    for artifact_id, patch in _entries(evidence.get("models"), section="models", errors=errors):
        model = models_by_id.get(artifact_id)
        if model is None:
            errors.append(f"models.{artifact_id} does not match a candidate model id.")
            continue
        _apply_artifact_patch(
            artifact_type="model",
            artifact_id=artifact_id,
            artifact=model,
            patch=patch,
            allowed_paths=MODEL_FIELD_PATHS,
            errors=errors,
            warnings=warnings,
            applied_fields=applied_fields,
        )

    for artifact_id, patch in _entries(evidence.get("runtimes"), section="runtimes", errors=errors):
        runtime = runtimes_by_id.get(artifact_id)
        if runtime is None:
            errors.append(f"runtimes.{artifact_id} does not match a candidate runtime id.")
            continue
        _apply_artifact_patch(
            artifact_type="runtime",
            artifact_id=artifact_id,
            artifact=runtime,
            patch=patch,
            allowed_paths=RUNTIME_FIELD_PATHS,
            errors=errors,
            warnings=warnings,
            applied_fields=applied_fields,
        )

    if not applied_fields and not errors:
        warnings.append("Evidence overlay did not contain any recognized model or runtime fields.")
    return {"errors": errors, "warnings": warnings, "applied_fields": applied_fields}


def _apply_artifact_patch(
    *,
    artifact_type: str,
    artifact_id: str,
    artifact: dict[str, Any],
    patch: dict[str, Any],
    allowed_paths: set[str],
    errors: list[str],
    warnings: list[str],
    applied_fields: list[dict[str, str]],
) -> None:
    if not isinstance(patch, dict):
        errors.append(f"{artifact_type}s.{artifact_id} evidence must be an object.")
        return
    recognized = False
    source = patch.get("source")
    if "source" in patch:
        recognized = True
        if not isinstance(source, dict):
            errors.append(f"{artifact_type}s.{artifact_id}.source must be an object.")
        else:
            artifact["source"] = copy.deepcopy(source)
            filename = _first_present(patch, "filename", "files[0].filename")
            if source.get("type") == "huggingface" and filename and not source.get("allow_patterns"):
                artifact["source"]["allow_patterns"] = [filename]
            _record(applied_fields, artifact_type, artifact_id, "source")

    if "version" in patch and "version" in allowed_paths:
        recognized = True
        artifact["version"] = patch["version"]
        _record(applied_fields, artifact_type, artifact_id, "version")

    if "defaults" in patch and "defaults" in allowed_paths:
        recognized = True
        if not isinstance(patch["defaults"], dict):
            errors.append(f"{artifact_type}s.{artifact_id}.defaults must be an object.")
        else:
            artifact["defaults"] = copy.deepcopy(patch["defaults"])
            _record(applied_fields, artifact_type, artifact_id, "defaults")

    file_patches = _file_patches(patch, artifact.get("files"))
    if file_patches:
        recognized = True
        files = artifact.setdefault("files", [{}])
        if not isinstance(files, list) or not files:
            artifact["files"] = [{}]
            files = artifact["files"]
        for index, file_patch in file_patches:
            while len(files) <= index:
                files.append({})
            if not isinstance(files[index], dict):
                files[index] = {}
            for key, value in file_patch.items():
                files[index][key] = value
                _record(applied_fields, artifact_type, artifact_id, f"files[{index}].{key}")

    for key in ["license_label", "license_url", "license_path", "approval"]:
        if key not in patch:
            continue
        path = key
        if path not in allowed_paths:
            errors.append(f"{artifact_type}s.{artifact_id}.{path} cannot be set by evidence overlay.")
            continue
        recognized = True
        if key == "approval" and not isinstance(patch[key], dict):
            errors.append(f"{artifact_type}s.{artifact_id}.approval must be an object.")
            continue
        artifact[key] = copy.deepcopy(patch[key])
        if key == "license_url":
            artifact.pop("license_path", None)
        elif key == "license_path":
            artifact.pop("license_url", None)
        _record(applied_fields, artifact_type, artifact_id, key)

    unsupported = sorted(set(patch) - _supported_overlay_keys(artifact_type))
    for key in unsupported:
        warnings.append(f"{artifact_type}s.{artifact_id}.{key} is not used by the evidence overlay.")
    if not recognized:
        warnings.append(f"{artifact_type}s.{artifact_id} did not contain any supported evidence fields.")


def _file_patches(patch: dict[str, Any], existing_files: Any) -> list[tuple[int, dict[str, Any]]]:
    patches_by_index: dict[int, dict[str, Any]] = {}
    existing_indices_by_filename = {
        str(file_info.get("filename") or ""): index
        for index, file_info in enumerate(existing_files if isinstance(existing_files, list) else [])
        if isinstance(file_info, dict) and file_info.get("filename")
    }
    files = patch.get("files")
    if isinstance(files, list):
        for index, file_info in enumerate(files):
            if not isinstance(file_info, dict):
                continue
            target_index = existing_indices_by_filename.get(str(file_info.get("filename") or ""), index)
            file_patch = patches_by_index.setdefault(target_index, {})
            for key in ["filename", "sha256", "size_bytes"]:
                if key in file_info:
                    file_patch[key] = file_info[key]
    first_file_patch = patches_by_index.setdefault(0, {})
    for key in ["filename", "sha256", "size_bytes"]:
        if key in patch:
            first_file_patch[key] = patch[key]
    for path, key in [
        ("files[0].filename", "filename"),
        ("files[0].sha256", "sha256"),
        ("files[0].size_bytes", "size_bytes"),
    ]:
        if path in patch:
            first_file_patch[key] = patch[path]
    return [(index, file_patch) for index, file_patch in sorted(patches_by_index.items()) if file_patch]


def _entries(value: Any, *, section: str, errors: list[str]) -> Iterable[tuple[str, dict[str, Any]]]:
    if value is None:
        return []
    if isinstance(value, dict):
        return [(str(item_id), patch) for item_id, patch in value.items()]
    if isinstance(value, list):
        entries = []
        for index, patch in enumerate(value):
            if not isinstance(patch, dict) or not patch.get("id"):
                errors.append(f"{section}[{index}] must be an object with an id.")
                continue
            patch_copy = dict(patch)
            item_id = str(patch_copy.pop("id"))
            entries.append((item_id, patch_copy))
        return entries
    errors.append(f"{section} must be an object keyed by id or a list of id-bearing objects.")
    return []


def _items_by_id(items: Any) -> dict[str, dict[str, Any]]:
    if not isinstance(items, list):
        return {}
    return {
        str(item["id"]): item
        for item in items
        if isinstance(item, dict) and item.get("id")
    }


def _first_present(values: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in values:
            value = values[key]
            if value is not None and value != "":
                return value
    return None


def _record(applied_fields: list[dict[str, str]], artifact_type: str, artifact_id: str, path: str) -> None:
    applied_fields.append({"type": artifact_type, "id": artifact_id, "path": path})


def _supported_overlay_keys(artifact_type: str) -> set[str]:
    keys = {
        "id",
        "source",
        "defaults",
        "files",
        "filename",
        "sha256",
        "size_bytes",
        "files[0].filename",
        "files[0].sha256",
        "files[0].size_bytes",
        "license_label",
        "license_url",
        "license_path",
        "approval",
    }
    if artifact_type == "runtime":
        keys.add("version")
    return keys


def _patched_registry_filename(label: str | None, default_name: str) -> str:
    name = (label or default_name).replace("\\", "/").rsplit("/", 1)[-1].strip() or default_name
    if name.endswith(".json"):
        name = name[:-5]
    safe = "".join(char if char.isalnum() or char in {"-", "_", "."} else "-" for char in name).strip(".-")
    if not safe:
        safe = default_name[:-5]
    return f"{safe}.patched.json"


def _text_sha256(contents: str) -> str:
    return hashlib.sha256(contents.encode("utf-8")).hexdigest()


def _build_pin_handoff(
    *,
    release_plan: dict[str, Any],
    model_registry_filename: str,
    runtime_registry_filename: str,
    patched_model_registry_sha256: str,
    patched_runtime_registry_sha256: str,
    release_plan_filename: str,
    approval_template_filename: str,
    model_registry_label: str | None,
    runtime_registry_label: str | None,
    evidence_label: str | None,
) -> dict[str, Any]:
    ready_to_pin = bool(release_plan["summary"]["ready_to_pin"])
    acceptance_report_filename = "candidate-ai-registry-acceptance.applied.md"
    artifact_probe_filename = "candidate-ai-registry-artifact-probe.applied.md"
    artifact_verification_filename = "candidate-ai-registry-artifact-byte-verification.applied.md"
    artifact_verification_evidence_filename = "candidate-ai-byte-evidence.applied.json"
    release_packet_dir = "candidate-ai-registry-release-packet"
    return {
        "status": "ready_to_pin" if ready_to_pin else "blocked",
        "ready_to_pin": ready_to_pin,
        "model_registry_filename": model_registry_filename,
        "runtime_registry_filename": runtime_registry_filename,
        "patched_model_registry_sha256": patched_model_registry_sha256,
        "patched_runtime_registry_sha256": patched_runtime_registry_sha256,
        "release_plan_filename": release_plan_filename,
        "approval_template_filename": approval_template_filename,
        "artifact_probe_filename": artifact_probe_filename,
        "artifact_verification_filename": artifact_verification_filename,
        "artifact_verification_evidence_filename": artifact_verification_evidence_filename,
        "acceptance_report_filename": acceptance_report_filename,
        "release_packet_dir": release_packet_dir,
        "commands": {
            "artifact_probe": _shell_command(
                "./scripts/probe_ai_registry_artifacts.sh",
                "--model-registry",
                model_registry_filename,
                "--runtime-registry",
                runtime_registry_filename,
                "--format",
                "markdown",
                "--output",
                artifact_probe_filename,
            ),
            "artifact_verification": _shell_command(
                "./scripts/verify_ai_registry_artifacts.sh",
                "--model-registry",
                model_registry_filename,
                "--runtime-registry",
                runtime_registry_filename,
                "--format",
                "markdown",
                "--output",
                artifact_verification_filename,
                "--evidence-output",
                artifact_verification_evidence_filename,
            ),
            "release_packet": _shell_command(
                "./scripts/prepare_ai_registry_release_candidate.sh",
                "--model-registry",
                model_registry_label or "candidate-model-registry.json",
                "--runtime-registry",
                runtime_registry_label or "candidate-runtime-registry.json",
                "--evidence",
                evidence_label or "candidate-evidence.json",
                "--output-dir",
                release_packet_dir,
                "--probe-sources",
                "--verify-bytes",
            ),
            "release_plan": _shell_command(
                "./scripts/plan_ai_registry_release.sh",
                "--model-registry",
                model_registry_filename,
                "--runtime-registry",
                runtime_registry_filename,
                "--format",
                "markdown",
                "--output",
                release_plan_filename,
            ),
            "acceptance_report": _shell_command(
                "./scripts/pin_ai_registries.sh",
                "--check",
                "--model-registry",
                model_registry_filename,
                "--runtime-registry",
                runtime_registry_filename,
                "--format",
                "markdown",
                "--output",
                acceptance_report_filename,
            ),
            "pin_check": _shell_command(
                "./scripts/pin_ai_registries.sh",
                "--check",
                "--model-registry",
                model_registry_filename,
                "--runtime-registry",
                runtime_registry_filename,
                "--format",
                "json",
            ),
            "pin": _shell_command(
                "./scripts/pin_ai_registries.sh",
                "--model-registry",
                model_registry_filename,
                "--runtime-registry",
                runtime_registry_filename,
            ),
            "readiness": _shell_command("./scripts/check_ai_readiness.sh", "--format", "text"),
        },
        "next_actions": release_plan.get("next_actions", []),
    }


def _format_pin_handoff_markdown(handoff: dict[str, Any]) -> str:
    lines = [
        "# Candidate AI Registry Pin Handoff",
        "",
        f"- Status: **{handoff['status']}**",
        f"- Ready to pin: **{'yes' if handoff['ready_to_pin'] else 'no'}**",
        f"- Model registry: `{handoff['model_registry_filename']}`",
        f"- Model registry SHA-256: `{handoff['patched_model_registry_sha256']}`",
        f"- Runtime registry: `{handoff['runtime_registry_filename']}`",
        f"- Runtime registry SHA-256: `{handoff['patched_runtime_registry_sha256']}`",
        f"- Applied release plan: `{handoff['release_plan_filename']}`",
        f"- Applied approval checklist: `{handoff['approval_template_filename']}`",
        f"- Artifact probe: `{handoff['artifact_probe_filename']}`",
        f"- Artifact byte verification: `{handoff['artifact_verification_filename']}`",
        f"- Artifact byte evidence: `{handoff['artifact_verification_evidence_filename']}`",
        f"- Acceptance report: `{handoff['acceptance_report_filename']}`",
        f"- Release packet directory: `{handoff['release_packet_dir']}`",
        "",
        "## Commands",
        "",
        "```sh",
        handoff["commands"]["artifact_probe"],
        handoff["commands"]["artifact_verification"],
        handoff["commands"]["release_packet"],
        handoff["commands"]["release_plan"],
        handoff["commands"]["acceptance_report"],
        handoff["commands"]["pin_check"],
        handoff["commands"]["pin"],
        handoff["commands"]["readiness"],
        "```",
        "",
        "## Next Actions",
        "",
    ]
    if handoff["next_actions"]:
        lines.extend(f"- [ ] {action}" for action in handoff["next_actions"])
    else:
        lines.append("- [x] Candidate registries are ready for the guarded pin command.")
    return "\n".join(lines).rstrip()


def _shell_command(*parts: str) -> str:
    return " ".join(shlex.quote(part) for part in parts)
