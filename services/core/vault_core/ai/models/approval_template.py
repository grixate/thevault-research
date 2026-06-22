from __future__ import annotations

import json
from collections.abc import Iterable
from typing import Any

from vault_core.ai.models.registry import load_model_registry
from vault_core.ai.models.runtime_installer import load_runtime_registry
from vault_core.db.session import now_iso

PENDING_MARKERS = ("REQUIRED_BEFORE_RELEASE", "REPLACE_WITH_APPROVED", "check upstream")
LLM_EXTRACTION_CAPABILITIES = {"extract_objects", "extract_claims"}
LLM_GENERATION_CAPABILITIES = {"summarize", "generate_note", "grounded_answer", "create_learning_item"}


def build_ai_approval_template(
    model_registry: dict[str, Any] | None = None,
    runtime_registry: dict[str, Any] | None = None,
) -> dict[str, Any]:
    model_registry = model_registry if model_registry is not None else load_model_registry()
    runtime_registry = runtime_registry if runtime_registry is not None else load_runtime_registry()
    artifacts = [
        *_model_artifacts(model_registry),
        *_runtime_artifacts(runtime_registry),
    ]
    pending_field_count = sum(artifact["pending_field_count"] for artifact in artifacts)
    return {
        "generated_at": now_iso(),
        "status": "ready" if pending_field_count == 0 else "pending",
        "artifact_count": len(artifacts),
        "pending_field_count": pending_field_count,
        "artifacts": artifacts,
        "next_actions": _next_actions(artifacts),
    }


def format_approval_template_markdown(
    template: dict[str, Any],
    *,
    model_registry_label: str | None = None,
    runtime_registry_label: str | None = None,
) -> str:
    lines = [
        "# Local AI Approval Template",
        "",
        f"- Generated: `{template['generated_at']}`",
        f"- Status: **{template['status']}**",
        f"- Release artifacts: **{template['artifact_count']}**",
        f"- Pending fields: **{template['pending_field_count']}**",
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
            "| Artifact | Type | Pending fields |",
            "| --- | --- | ---: |",
        ]
    )
    for artifact in template["artifacts"]:
        lines.append(f"| `{artifact['id']}` | {artifact['type']} | {artifact['pending_field_count']} |")

    lines.extend(["", "## Manifest Fields", ""])
    for artifact in template["artifacts"]:
        lines.extend(
            [
                f"### {artifact['display_name']}",
                "",
                f"- Type: `{artifact['type']}`",
                f"- ID: `{artifact['id']}`",
                f"- Pending fields: **{artifact['pending_field_count']}**",
                "",
                "| Field | Status | Current value | Required evidence |",
                "| --- | --- | --- | --- |",
            ]
        )
        for field in artifact["fields"]:
            current = _markdown_value(field.get("current_value"))
            required = _markdown_value(field.get("required_value"))
            lines.append(f"| `{field['path']}` | {field['status']} | {current} | {required} |")
        lines.append("")
        guidance = [field for field in artifact["fields"] if field["status"] != "present"]
        if guidance:
            lines.append("Checklist:")
            lines.extend(f"- [ ] {field['guidance']}" for field in guidance)
            lines.append("")

    lines.extend(["## Next Actions", ""])
    if template["next_actions"]:
        lines.extend(f"- [ ] {action}" for action in template["next_actions"])
    else:
        lines.append("- [x] All production manifest approval fields are filled.")
    return "\n".join(lines).rstrip()


def build_ai_evidence_overlay_template(
    template: dict[str, Any],
    *,
    model_registry_label: str | None = None,
    runtime_registry_label: str | None = None,
) -> dict[str, Any]:
    evidence: dict[str, Any] = {
        "schema_version": 1,
        "generated_at": now_iso(),
        "source_template_generated_at": template.get("generated_at"),
        "status": template.get("status"),
        "instructions": (
            "Fill the model and runtime evidence values, then apply this JSON with "
            "/ai/registry/evidence/apply or scripts/apply_ai_registry_evidence.sh."
        ),
        "model_registry_label": model_registry_label,
        "runtime_registry_label": runtime_registry_label,
        "models": {},
        "runtimes": {},
    }
    for artifact in template.get("artifacts", []):
        if not isinstance(artifact, dict) or artifact.get("pending_field_count", 0) <= 0:
            continue
        patch = _evidence_patch_for_artifact(artifact)
        if not patch:
            continue
        section = "models" if artifact.get("type") == "model" else "runtimes"
        evidence[section][str(artifact.get("id"))] = patch
    return evidence


def _model_artifacts(registry: dict[str, Any]) -> list[dict[str, Any]]:
    models_by_id = {
        str(model.get("id")): model
        for model in _as_list(registry.get("models"))
        if isinstance(model, dict) and model.get("id")
    }
    artifacts = []
    for model_id in _production_model_ids(registry):
        model = models_by_id.get(model_id)
        if not model:
            artifacts.append(
                _artifact(
                    "model",
                    model_id,
                    model_id,
                    [
                        _field(
                            "models[].id",
                            None,
                            model_id,
                            "Add this production model entry to model_registry.json.",
                        )
                    ],
                )
            )
            continue
        artifacts.append(
            _artifact(
                "model",
                model_id,
                str(model.get("display_name") or model_id),
                _model_fields(model),
            )
        )
    return artifacts


def _runtime_artifacts(registry: dict[str, Any]) -> list[dict[str, Any]]:
    artifacts = []
    for runtime in _as_list(registry.get("runtimes")):
        if not isinstance(runtime, dict) or runtime.get("release_channel") != "production":
            continue
        runtime_id = str(runtime.get("id") or "<missing-runtime>")
        artifacts.append(
            _artifact(
                "runtime",
                runtime_id,
                str(runtime.get("display_name") or runtime_id),
                _runtime_fields(runtime),
            )
        )
    return artifacts


def _model_fields(model: dict[str, Any]) -> list[dict[str, Any]]:
    source = model.get("source") or {}
    file0 = _first_file(model)
    fields = [
        _field(
            "source.type",
            source.get("type"),
            "huggingface or url",
            "Use an approved non-fixture source type for the production artifact.",
        ),
    ]
    if source.get("type") == "huggingface":
        fields.extend(
            [
                _field(
                    "source.repo_id",
                    source.get("repo_id"),
                    "approved-owner/approved-repo",
                    "Pin the approved Hugging Face repository.",
                ),
                _field(
                    "source.revision",
                    source.get("revision"),
                    "40-character commit SHA",
                    "Pin an immutable upstream commit revision.",
                ),
                _field(
                    "source.allow_patterns",
                    source.get("allow_patterns"),
                    ["approved-artifact.gguf"],
                    "Allow only the approved artifact filename pattern.",
                ),
            ]
        )
    elif source.get("type") == "url":
        fields.append(
            _field(
                "source.url",
                source.get("url"),
                "https://approved.example/artifact",
                "Pin the approved HTTPS artifact URL.",
            )
        )
    else:
        fields.append(
            _field(
                "source",
                source,
                {"type": "huggingface", "repo_id": "approved-owner/approved-repo", "revision": "40-character commit SHA"},
                "Replace placeholder source metadata with an approved production source.",
            )
        )
    fields.extend(_model_default_fields(model))
    fields.extend(_common_artifact_fields(file0, model, artifact_label="model"))
    return fields


def _runtime_fields(runtime: dict[str, Any]) -> list[dict[str, Any]]:
    source = runtime.get("source") or {}
    file0 = _first_file(runtime)
    fields = [
        _field(
            "version",
            runtime.get("version"),
            "approved upstream version",
            "Record the approved runtime release version.",
        ),
        _field(
            "source.url",
            source.get("url"),
            "https://approved.example/runtime-binary",
            "Pin the approved runtime binary URL.",
        ),
    ]
    fields.extend(_common_artifact_fields(file0, runtime, artifact_label="runtime"))
    return fields


def _common_artifact_fields(file0: dict[str, Any], artifact: dict[str, Any], *, artifact_label: str) -> list[dict[str, Any]]:
    return [
        _field(
            "files[0].filename",
            file0.get("filename"),
            f"approved-{artifact_label}-artifact",
            "Replace placeholder filenames with the approved artifact path.",
        ),
        _field(
            "files[0].sha256",
            file0.get("sha256"),
            "64-character SHA-256 digest",
            "Record the verified SHA-256 digest.",
        ),
        _field(
            "files[0].size_bytes",
            file0.get("size_bytes"),
            "exact artifact size in bytes",
            "Record the exact artifact size in bytes.",
        ),
        _field(
            "license_label",
            artifact.get("license_label"),
            "approved license label",
            "Record the approved upstream license label.",
        ),
        _field(
            "license_url or license_path",
            artifact.get("license_url") or artifact.get("license_path"),
            "approved license URL or bundled license text path",
            "Pin an approved license artifact.",
        ),
        _field(
            "approval.status",
            (artifact.get("approval") or {}).get("status"),
            "approved",
            "Set approval.status after release review.",
        ),
        _field(
            "approval.approved_by",
            (artifact.get("approval") or {}).get("approved_by"),
            "reviewer or release authority",
            "Record who approved this artifact.",
        ),
        _field(
            "approval.approved_at",
            (artifact.get("approval") or {}).get("approved_at"),
            "YYYY-MM-DD",
            "Record the approval date.",
        ),
        _field(
            "approval.evidence",
            (artifact.get("approval") or {}).get("evidence"),
            "review note, ticket, checksum log, or release dossier link",
            "Attach evidence for source, checksum, size, license, and runtime review.",
        ),
    ]


def _model_default_fields(model: dict[str, Any]) -> list[dict[str, Any]]:
    required_defaults = _required_model_defaults(model)
    if not required_defaults:
        return []
    defaults = model.get("defaults") if isinstance(model.get("defaults"), dict) else {}
    current = defaults if _defaults_cover_required(defaults, required_defaults) else None
    return [
        _field(
            "defaults",
            current,
            required_defaults,
            "Pin safe per-kind defaults so setup can test and route this model without manual flags.",
        )
    ]


def _required_model_defaults(model: dict[str, Any]) -> dict[str, Any]:
    kind = str(model.get("kind") or "")
    capabilities = set(str(capability) for capability in model.get("capabilities") or [])
    if kind == "llm":
        defaults: dict[str, Any] = {"context_tokens": 4096}
        if capabilities & LLM_EXTRACTION_CAPABILITIES:
            defaults.update({"temperature_extraction": 0, "max_tokens_extraction": 384})
        if capabilities & LLM_GENERATION_CAPABILITIES:
            defaults.update({"temperature_generation": 0.3, "max_tokens_generation": 1200})
        return defaults
    if kind == "embedding":
        return {"dimensions": 384}
    if kind == "stt":
        return {"language": "auto", "timestamps": True, "timeout_seconds": 120}
    if kind == "tts":
        return {"format": "wav", "speed": 1.0, "timeout_seconds": 120}
    return {}


def _defaults_cover_required(defaults: dict[str, Any], required: dict[str, Any]) -> bool:
    for key, required_value in required.items():
        value = defaults.get(key)
        if value is None:
            return False
        if isinstance(required_value, int):
            if not isinstance(value, int):
                return False
            if required_value > 0 and value <= 0:
                return False
            if required_value == 0 and value != 0:
                return False
        if isinstance(required_value, float) and (not isinstance(value, int | float) or value <= 0):
            return False
    return True


def _artifact(artifact_type: str, artifact_id: str, display_name: str, fields: list[dict[str, Any]]) -> dict[str, Any]:
    pending_count = sum(1 for field in fields if field["status"] != "present")
    return {
        "type": artifact_type,
        "id": artifact_id,
        "display_name": display_name,
        "field_count": len(fields),
        "pending_field_count": pending_count,
        "fields": fields,
    }


def _field(path: str, current_value: Any, required_value: Any, guidance: str) -> dict[str, Any]:
    return {
        "path": path,
        "label": path.replace("_", " "),
        "current_value": current_value,
        "required_value": required_value,
        "status": _field_status(current_value),
        "guidance": guidance,
    }


def _field_status(value: Any) -> str:
    if value is None or value == "" or value == [] or value == {}:
        return "missing"
    text = json.dumps(value, sort_keys=True).lower()
    if any(marker.lower() in text for marker in PENDING_MARKERS):
        return "pending"
    return "present"


def _production_model_ids(registry: dict[str, Any]) -> list[str]:
    ids = []
    for pack in _as_list(registry.get("model_packs")):
        if not isinstance(pack, dict) or pack.get("release_channel") != "production":
            continue
        ids.extend(str(model_id) for model_id in _as_list(pack.get("required_model_ids")))
        ids.extend(str(model_id) for model_id in _as_list(pack.get("optional_model_ids")))
    return _dedupe(ids)


def _first_file(artifact: dict[str, Any]) -> dict[str, Any]:
    files = _as_list(artifact.get("files"))
    return files[0] if files and isinstance(files[0], dict) else {}


def _next_actions(artifacts: list[dict[str, Any]]) -> list[str]:
    return _dedupe(
        field["guidance"]
        for artifact in artifacts
        for field in artifact["fields"]
        if field["status"] != "present"
    )


def _markdown_value(value: Any) -> str:
    if value is None:
        return "`null`"
    if isinstance(value, str):
        return f"`{value}`"
    return f"`{json.dumps(value, sort_keys=True)}`"


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _dedupe(values: Iterable[str]) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        unique.append(value)
    return unique


def _evidence_patch_for_artifact(artifact: dict[str, Any]) -> dict[str, Any]:
    fields = [field for field in _as_list(artifact.get("fields")) if isinstance(field, dict)]
    pending_paths = {field.get("path") for field in fields if field.get("status") != "present"}
    patch: dict[str, Any] = {}
    source_patch = _evidence_source_patch(str(artifact.get("type")), fields, pending_paths)
    if source_patch:
        patch["source"] = source_patch
    if "version" in pending_paths:
        patch["version"] = _evidence_value(_field_by_path(fields, "version"), "REPLACE_WITH_APPROVED_RUNTIME_VERSION")
    if "defaults" in pending_paths:
        field = _field_by_path(fields, "defaults")
        patch["defaults"] = field.get("required_value") if field else {}
    for path, key, placeholder in [
        ("files[0].filename", "filename", "REPLACE_WITH_APPROVED_ARTIFACT_FILENAME"),
        ("files[0].sha256", "sha256", "REPLACE_WITH_64_CHARACTER_SHA256"),
        ("files[0].size_bytes", "size_bytes", None),
    ]:
        if path in pending_paths:
            patch[key] = _evidence_value(_field_by_path(fields, path), placeholder)
    if "license_label" in pending_paths:
        patch["license_label"] = _evidence_value(_field_by_path(fields, "license_label"), "REPLACE_WITH_APPROVED_LICENSE_LABEL")
    if "license_url or license_path" in pending_paths:
        patch["license_url"] = "https://example.test/REPLACE_WITH_APPROVED_LICENSE"
    approval_patch = _evidence_approval_patch(fields, pending_paths)
    if approval_patch:
        patch["approval"] = approval_patch
    return patch


def _evidence_source_patch(artifact_type: str, fields: list[dict[str, Any]], pending_paths: set[Any]) -> dict[str, Any]:
    if not any(path == "source" or (isinstance(path, str) and path.startswith("source.")) for path in pending_paths):
        return {}
    source_field = _field_by_path(fields, "source")
    if source_field and isinstance(source_field.get("current_value"), dict):
        return _replace_pending_source_values(dict(source_field["current_value"]), fields, pending_paths, artifact_type)
    source_type = _source_type(fields, pending_paths, artifact_type)
    source: dict[str, Any] = {"type": source_type}
    if source_type == "url":
        source["url"] = _evidence_value(_field_by_path(fields, "source.url"), "https://example.test/REPLACE_WITH_APPROVED_ARTIFACT")
    else:
        source["repo_id"] = _evidence_value(_field_by_path(fields, "source.repo_id"), "REPLACE_WITH_APPROVED_REPO")
        source["revision"] = _evidence_value(_field_by_path(fields, "source.revision"), "REPLACE_WITH_40_CHARACTER_COMMIT_SHA")
        source["allow_patterns"] = (
            ["REPLACE_WITH_APPROVED_ARTIFACT_FILENAME"]
            if "files[0].filename" in pending_paths
            else _evidence_value(_field_by_path(fields, "source.allow_patterns"), ["REPLACE_WITH_APPROVED_ARTIFACT_FILENAME"])
        )
    return source


def _replace_pending_source_values(
    source: dict[str, Any],
    fields: list[dict[str, Any]],
    pending_paths: set[Any],
    artifact_type: str,
) -> dict[str, Any]:
    source.setdefault("type", _source_type(fields, pending_paths, artifact_type))
    replacements = {
        "source.url": ("url", "https://example.test/REPLACE_WITH_APPROVED_ARTIFACT"),
        "source.repo_id": ("repo_id", "REPLACE_WITH_APPROVED_REPO"),
        "source.revision": ("revision", "REPLACE_WITH_40_CHARACTER_COMMIT_SHA"),
        "source.allow_patterns": ("allow_patterns", ["REPLACE_WITH_APPROVED_ARTIFACT_FILENAME"]),
    }
    for path, (key, placeholder) in replacements.items():
        if path in pending_paths:
            source[key] = _evidence_value(_field_by_path(fields, path), placeholder)
    if source.get("type") == "huggingface" and "files[0].filename" in pending_paths:
        source["allow_patterns"] = ["REPLACE_WITH_APPROVED_ARTIFACT_FILENAME"]
    return source


def _source_type(fields: list[dict[str, Any]], pending_paths: set[Any], artifact_type: str) -> str:
    source_type_field = _field_by_path(fields, "source.type")
    current = source_type_field.get("current_value") if source_type_field else None
    if current in {"huggingface", "url"}:
        return str(current)
    if "source.url" in pending_paths or artifact_type == "runtime":
        return "url"
    return "huggingface"


def _evidence_approval_patch(fields: list[dict[str, Any]], pending_paths: set[Any]) -> dict[str, Any]:
    approval_paths = ["approval.status", "approval.approved_by", "approval.approved_at", "approval.evidence"]
    if not any(path in pending_paths for path in approval_paths):
        return {}
    status_field = _field_by_path(fields, "approval.status")
    current_status = status_field.get("current_value") if status_field else None
    return {
        "status": current_status if current_status == "approved" else "approved",
        "approved_by": _evidence_value(_field_by_path(fields, "approval.approved_by"), "REPLACE_WITH_APPROVER"),
        "approved_at": _evidence_value(_field_by_path(fields, "approval.approved_at"), "YYYY-MM-DD"),
        "evidence": _evidence_value(
            _field_by_path(fields, "approval.evidence"),
            "REPLACE_WITH_REVIEW_NOTE_TICKET_OR_DOSSIER_LINK",
        ),
    }


def _field_by_path(fields: list[dict[str, Any]], path: str) -> dict[str, Any] | None:
    return next((field for field in fields if field.get("path") == path), None)


def _evidence_value(field: dict[str, Any] | None, placeholder: Any) -> Any:
    if field and field.get("status") == "present":
        return field.get("current_value")
    return placeholder
