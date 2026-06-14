from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from vault_core.api.schemas import AIModelInfo, AIModelPackInfo, AIReadinessCheck, AIRuntimeInfo
from vault_core.db.session import VaultDatabase, loads

REGISTRY_PATH = Path(__file__).with_name("model_registry.json")
KIND_CAPABILITY_CONTRACT = {
    "llm": {
        "extract_objects",
        "extract_claims",
        "summarize",
        "generate_note",
        "grounded_answer",
        "create_learning_item",
    },
    "embedding": {"embed_text"},
    "reranker": {"rerank_results"},
    "stt": {"transcribe_audio"},
    "tts": {"synthesize_speech"},
}
KIND_RUNTIME_CONTRACT = {
    "llm": {"llama_cpp"},
    "embedding": {"local_embedding"},
    "reranker": {"local_cross_encoder"},
    "stt": {"whisper_cpp"},
    "tts": {"piper"},
}
PROFILE_RANK = {"tiny": 0, "standard": 1, "strong": 2}
LLM_EXTRACTION_CAPABILITIES = {"extract_objects", "extract_claims"}
LLM_GENERATION_CAPABILITIES = {"summarize", "generate_note", "grounded_answer", "create_learning_item"}


def load_model_registry() -> dict[str, Any]:
    return json.loads(REGISTRY_PATH.read_text())


def find_registry_model(model_id: str) -> dict[str, Any] | None:
    registry = load_model_registry()
    for model in registry.get("models", []):
        if model.get("id") == model_id:
            return model
    return None


def find_model_pack(pack_id: str) -> dict[str, Any] | None:
    registry = load_model_registry()
    for pack in registry.get("model_packs", []):
        if pack.get("id") == pack_id:
            return pack
    return None


def registry_model_readiness_checks(model: dict[str, Any]) -> list[AIReadinessCheck]:
    return _registry_model_readiness_checks(model)


def model_pack_contract_checks(pack: dict[str, Any], registry_models: dict[str, dict[str, Any]]) -> list[AIReadinessCheck]:
    return _model_pack_contract_checks(pack, registry_models)


def list_model_infos(db: VaultDatabase | None = None) -> list[AIModelInfo]:
    registry = load_model_registry()
    installed_by_id = _installed_by_id(db) if db else {}
    downloads_by_model = _latest_downloads_by_model(db) if db else {}
    models = []
    registry_model_ids: set[str] = set()
    for model in registry.get("models", []):
        registry_model_ids.add(model["id"])
        first_file = next(iter(model.get("files", [])), {})
        installed = installed_by_id.get(model["id"])
        installed_active = bool(installed and installed.get("status") == "installed")
        latest_download = downloads_by_model.get(model["id"])
        manifest = loads(installed.get("manifest_json"), {}) if installed else {}
        download_state = (
            installed.get("status")
            if installed_active
            else latest_download.get("state")
            if latest_download
            else model.get("download_state", "not_installed")
        )
        models.append(
            AIModelInfo(
                id=model["id"],
                display_name=model["display_name"],
                kind=model["kind"],
                installed=bool(model.get("installed")) or installed_active,
                download_state=download_state,
                capabilities=model.get("capabilities", []),
                downloadable=_is_downloadable_registry_model(model),
                size_bytes=(installed.get("size_bytes") if installed_active else first_file.get("size_bytes")),
                disk_path=installed.get("file_path") if installed_active else None,
                license_label=_effective_license_field("license_label", model, installed, manifest, installed_active),
                license_url=_effective_license_field("license_url", model, installed, manifest, installed_active),
                license_path=_effective_license_field("license_path", model, installed, manifest, installed_active),
                recommended_profile=model.get("recommended_profile", "tiny"),
                runtime=model.get("runtime"),
                format=model.get("format"),
                source_type=(manifest.get("source") or model.get("source") or {}).get("type"),
                trust_level=manifest.get("trust_level"),
                runtime_tested=bool(manifest.get("runtime_tested_at")),
                readiness_checks=_registry_model_readiness_checks(model),
            )
        )
    for installed_model_id, installed in installed_by_id.items():
        if installed_model_id in registry_model_ids:
            continue
        manifest = loads(installed.get("manifest_json"), {})
        source = manifest.get("source") or {}
        installed_active = installed.get("status") == "installed"
        models.append(
            AIModelInfo(
                id=installed_model_id,
                display_name=installed.get("display_name") or installed_model_id,
                kind=installed.get("kind", "llm"),
                installed=installed_active,
                download_state=installed.get("status", "installed"),
                capabilities=manifest.get("capabilities", []),
                downloadable=False,
                size_bytes=installed.get("size_bytes"),
                disk_path=installed.get("file_path"),
                license_label=installed.get("license_label") or manifest.get("license_label"),
                license_url=installed.get("license_url") or manifest.get("license_url"),
                license_path=installed.get("license_path") or manifest.get("license_path"),
                recommended_profile=manifest.get("recommended_profile", "custom"),
                runtime=installed.get("runtime"),
                format=installed.get("format"),
                source_type=source.get("type", "installed"),
                trust_level=manifest.get("trust_level"),
                runtime_tested=bool(manifest.get("runtime_tested_at")),
                readiness_checks=[],
            )
        )
    return models


def list_model_packs(db: VaultDatabase | None = None, runtime_infos: list[AIRuntimeInfo] | None = None) -> list[AIModelPackInfo]:
    registry = load_model_registry()
    model_infos = {model.id: model for model in list_model_infos(db)}
    registry_models = {model["id"]: model for model in registry.get("models", [])}
    packs: list[AIModelPackInfo] = []
    for pack in registry.get("model_packs", []):
        required_model_ids = list(pack.get("required_model_ids") or pack.get("model_ids") or [])
        optional_model_ids = list(pack.get("optional_model_ids") or [])
        model_ids = _dedupe([*required_model_ids, *optional_model_ids])
        release_channel = pack.get("release_channel", "production")
        capabilities = list(pack.get("capabilities") or [])
        if not capabilities:
            capabilities = [
                capability
                for model_id in model_ids
                if model_id in model_infos
                for capability in model_infos[model_id].capabilities
            ]
        capabilities = _dedupe(capabilities)
        installed_model_ids = [model_id for model_id in model_ids if model_infos.get(model_id) and model_infos[model_id].installed]
        missing_model_ids = [model_id for model_id in required_model_ids if model_id not in installed_model_ids]
        downloadable_model_ids = [
            model_id
            for model_id in model_ids
            if model_infos.get(model_id)
            and not model_infos[model_id].installed
            and model_infos[model_id].downloadable
        ]
        missing_required_non_downloadable = [
            model_id
            for model_id in missing_model_ids
            if model_id not in downloadable_model_ids
        ]
        blocked_reasons = _model_pack_blocked_reasons(
            pack,
            release_channel,
            model_ids,
            optional_model_ids,
            missing_required_non_downloadable,
            registry_models,
            model_infos,
            runtime_infos,
        )
        readiness_checks = _model_pack_readiness_checks(
            pack,
            release_channel,
            model_ids,
            optional_model_ids,
            missing_required_non_downloadable,
            registry_models,
            model_infos,
            runtime_infos,
        )
        installable = bool(downloadable_model_ids) and not missing_required_non_downloadable and (release_channel == "demo" or not blocked_reasons)
        release_status = _model_pack_release_status(
            release_channel=release_channel,
            installed=not missing_model_ids,
            installable=installable,
            blocked_reasons=blocked_reasons,
        )
        disk_bytes = pack.get("disk_bytes")
        if disk_bytes is None:
            sizes = [model_infos[model_id].size_bytes for model_id in model_ids if model_id in model_infos]
            known_sizes = [size for size in sizes if size is not None]
            disk_bytes = sum(known_sizes) if len(known_sizes) == len(sizes) else None
        packs.append(
            AIModelPackInfo(
                id=pack["id"],
                display_name=pack["display_name"],
                profile=pack.get("profile", "tiny"),
                release_channel=release_channel,
                release_status=release_status,
                description=pack.get("description", ""),
                privacy_label=pack.get("privacy_label", "Runs on this device"),
                model_ids=model_ids,
                required_model_ids=required_model_ids,
                optional_model_ids=optional_model_ids,
                capabilities=capabilities,
                disk_bytes=disk_bytes,
                installed_model_ids=installed_model_ids,
                missing_model_ids=missing_model_ids,
                downloadable_model_ids=downloadable_model_ids,
                blocked_reasons=blocked_reasons,
                installable=installable,
                installed=not missing_model_ids,
                readiness_checks=readiness_checks,
            )
        )
    return packs


def _installed_by_id(db: VaultDatabase | None) -> dict[str, dict[str, Any]]:
    if db is None:
        return {}
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT * FROM ai_installed_models WHERE workspace_id=?",
            (db.workspace_id,),
        ).fetchall()
    return {row["model_id"]: dict(row) for row in rows}


def _latest_downloads_by_model(db: VaultDatabase | None) -> dict[str, dict[str, Any]]:
    if db is None:
        return {}
    with db.connect() as conn:
        rows = conn.execute(
            """
            SELECT * FROM ai_model_downloads
            WHERE workspace_id=?
            ORDER BY created_at DESC
            """,
            (db.workspace_id,),
        ).fetchall()
    latest: dict[str, dict[str, Any]] = {}
    for row in rows:
        data = dict(row)
        data["source"] = loads(data.get("source_json"), {})
        latest.setdefault(data["model_id"], data)
    return latest


def _effective_license_field(
    field: str,
    registry_model: dict[str, Any],
    installed: dict[str, Any] | None,
    manifest: dict[str, Any],
    installed_active: bool,
) -> str | None:
    if installed_active and installed:
        return installed.get(field) or manifest.get(field) or registry_model.get(field)
    return registry_model.get(field)


def _is_downloadable_registry_model(model: dict[str, Any]) -> bool:
    if model.get("installed"):
        return False
    source_type = (model.get("source") or {}).get("type")
    if source_type not in {"local_fixture", "url", "huggingface"}:
        return False
    first_file = next(iter(model.get("files", [])), {})
    checksum = first_file.get("sha256")
    return bool(checksum and checksum != "REQUIRED_BEFORE_RELEASE")


def _model_pack_release_status(
    *,
    release_channel: str,
    installed: bool,
    installable: bool,
    blocked_reasons: list[str],
) -> str:
    if installed:
        return "installed"
    if release_channel == "demo":
        return "demo_ready"
    if installable and not blocked_reasons:
        return "ready"
    return "blocked"


def _model_pack_blocked_reasons(
    pack: dict[str, Any],
    release_channel: str,
    model_ids: list[str],
    optional_model_ids: list[str],
    missing_required_non_downloadable: list[str],
    registry_models: dict[str, dict[str, Any]],
    model_infos: dict[str, AIModelInfo],
    runtime_infos: list[AIRuntimeInfo] | None,
) -> list[str]:
    if release_channel == "demo":
        return ["Demo fixtures exercise local AI plumbing, but they are not release-approved production model weights."]
    checks = _model_pack_readiness_checks(
        pack,
        release_channel,
        model_ids,
        optional_model_ids,
        missing_required_non_downloadable,
        registry_models,
        model_infos,
        runtime_infos,
    )
    reasons = [check.detail for check in checks if check.status == "blocked"]
    return _dedupe(reasons)


def _model_pack_readiness_checks(
    pack: dict[str, Any],
    release_channel: str,
    model_ids: list[str],
    optional_model_ids: list[str] | None,
    missing_required_non_downloadable: list[str],
    registry_models: dict[str, dict[str, Any]],
    model_infos: dict[str, AIModelInfo],
    runtime_infos: list[AIRuntimeInfo] | None,
) -> list[AIReadinessCheck]:
    if release_channel == "demo":
        return [
            AIReadinessCheck(
                id=f"{pack['id']}:release-channel",
                label="Release channel",
                status="warn",
                detail="Demo fixtures exercise local AI plumbing, but they are not release-approved production model weights.",
                action="Use production packs for real local AI.",
            )
        ]
    checks: list[AIReadinessCheck] = []
    required_model_ids = [str(model_id) for model_id in pack.get("required_model_ids") or pack.get("model_ids") or []]
    optional_model_ids = [str(model_id) for model_id in (optional_model_ids or pack.get("optional_model_ids") or [])]
    required_id_set = set(required_model_ids)
    optional_id_set = set(optional_model_ids)
    if missing_required_non_downloadable:
        labels = [
            model_infos[model_id].display_name if model_id in model_infos else model_id
            for model_id in missing_required_non_downloadable
        ]
        checks.append(
            AIReadinessCheck(
                id=f"{pack['id']}:required-downloads",
                label="Required downloads",
                status="blocked",
                detail=f"Missing release-ready downloads: {', '.join(labels)}.",
                action="Approve sources, filenames, checksums, sizes, and licenses for required models.",
            )
        )
    else:
        checks.append(
            AIReadinessCheck(
                id=f"{pack['id']}:required-downloads",
                label="Required downloads",
                status="pass",
                detail="Every required model has an installed or release-ready downloadable artifact.",
            )
        )
    checks.extend(_model_pack_contract_checks(pack, registry_models))
    for model_id in required_model_ids:
        model = registry_models.get(model_id)
        if model is None:
            checks.append(
                AIReadinessCheck(
                    id=f"{pack['id']}:{model_id}:registry",
                    label=f"{model_id} registry entry",
                    status="blocked",
                    detail=f"Registry entry missing for {model_id}.",
                    action="Add the model entry to the app-pinned registry.",
                )
            )
            continue
        checks.extend(_pack_scoped_model_checks(pack["id"], model))
    for model_id in optional_model_ids:
        if model_id in required_id_set:
            continue
        model = registry_models.get(model_id)
        if model is None:
            checks.append(
                AIReadinessCheck(
                    id=f"{pack['id']}:{model_id}:optional-registry",
                    label=f"Optional {model_id} registry entry",
                    status="pending",
                    detail=f"Optional registry entry missing for {model_id}.",
                    action="Add the optional model entry before enabling the add-on capability.",
                )
            )
            continue
        checks.extend(_pack_scoped_model_checks(pack["id"], model, optional=True))
    if optional_id_set:
        optional_ready = [
            model_id
            for model_id in optional_id_set
            if model_infos.get(model_id) and (model_infos[model_id].installed or model_infos[model_id].downloadable)
        ]
        status = "pass" if len(optional_ready) == len(optional_id_set) else "pending"
        checks.append(
            AIReadinessCheck(
                id=f"{pack['id']}:optional-models",
                label="Optional model add-ons",
                status=status,
                detail=(
                    f"{len(optional_ready)}/{len(optional_id_set)} optional model add-ons are installed or release-ready."
                    if optional_id_set
                    else "No optional model add-ons are registered."
                ),
                action=None if status == "pass" else "Approve optional add-on artifacts before enabling optional capabilities by default.",
            )
        )
    if pack.get("requires_managed_runtime", True):
        runtime_ids = {
            str((registry_models.get(model_id) or {}).get("runtime") or "")
            for model_id in required_model_ids
        }
        production_runtime_ids = sorted(
            runtime_id
            for runtime_id in runtime_ids
            if runtime_id not in {"", "mock", "local_embedding", "local_cross_encoder"}
        )
        if production_runtime_ids:
            checks.append(_managed_runtime_pack_check(pack["id"], release_channel, production_runtime_ids, runtime_infos))
        else:
            checks.append(
                AIReadinessCheck(
                    id=f"{pack['id']}:managed-runtimes",
                    label="Managed runtimes",
                    status="pass",
                    detail="Required models use built-in or already-managed local providers.",
                )
            )
    return checks


def _managed_runtime_pack_check(
    pack_id: str,
    release_channel: str,
    runtime_ids: list[str],
    runtime_infos: list[AIRuntimeInfo] | None,
) -> AIReadinessCheck:
    missing_or_blocked: list[str] = []
    ready: list[str] = []
    for runtime_id in runtime_ids:
        candidates = [
            runtime
            for runtime in (runtime_infos or [])
            if runtime.runtime == runtime_id and runtime.release_channel == release_channel
        ]
        if candidates and any(candidate.installed or candidate.installable for candidate in candidates):
            ready.append(runtime_id)
            continue
        missing_or_blocked.append(runtime_id)
    if missing_or_blocked:
        return AIReadinessCheck(
            id=f"{pack_id}:managed-runtimes",
            label="Managed runtimes",
            status="blocked",
            detail=f"Managed runtime installer pending for {', '.join(missing_or_blocked)}.",
            action="Approve runtime manifests with pinned source, checksum, size, and license.",
        )
    return AIReadinessCheck(
        id=f"{pack_id}:managed-runtimes",
        label="Managed runtimes",
        status="pass",
        detail=f"Approved managed runtime manifests are available for {', '.join(ready)}.",
    )


def _model_pack_contract_checks(pack: dict[str, Any], registry_models: dict[str, dict[str, Any]]) -> list[AIReadinessCheck]:
    pack_id = str(pack.get("id") or "<missing-pack>")
    pack_profile = str(pack.get("profile") or "tiny")
    required_model_ids = [str(model_id) for model_id in pack.get("required_model_ids") or pack.get("model_ids") or []]
    pack_capabilities = set(str(capability) for capability in pack.get("capabilities") or [])
    covered_capabilities = {
        str(capability)
        for model_id in required_model_ids
        for capability in (registry_models.get(model_id) or {}).get("capabilities", [])
    }
    checks: list[AIReadinessCheck] = []
    missing_capabilities = sorted(pack_capabilities - covered_capabilities)
    if missing_capabilities:
        checks.append(
            AIReadinessCheck(
                id=f"{pack_id}:capability-coverage",
                label="Capability coverage",
                status="blocked",
                detail=f"Pack capabilities are not covered by required models: {', '.join(missing_capabilities)}.",
                action="Add an approved required model for each advertised pack capability or remove the unsupported capability.",
            )
        )
    else:
        checks.append(
            AIReadinessCheck(
                id=f"{pack_id}:capability-coverage",
                label="Capability coverage",
                status="pass",
                detail="Required models cover every advertised pack capability.",
            )
        )
    oversized_models = []
    pack_rank = PROFILE_RANK.get(pack_profile, 0)
    for model_id in required_model_ids:
        model = registry_models.get(model_id) or {}
        model_profile = str(model.get("recommended_profile") or "tiny")
        if PROFILE_RANK.get(model_profile, 0) > pack_rank:
            oversized_models.append(f"{model_id} ({model_profile})")
    if oversized_models:
        checks.append(
            AIReadinessCheck(
                id=f"{pack_id}:profile-fit",
                label="Profile fit",
                status="blocked",
                detail=f"{pack_profile} pack includes models from larger profiles: {', '.join(oversized_models)}.",
                action="Move larger models to the matching profile pack or lower the pack's advertised profile.",
            )
        )
    else:
        checks.append(
            AIReadinessCheck(
                id=f"{pack_id}:profile-fit",
                label="Profile fit",
                status="pass",
                detail=f"Required models fit the {pack_profile} profile target.",
            )
        )
    return checks


def _registry_model_release_issues(model: dict[str, Any]) -> list[str]:
    return _dedupe([check.detail for check in _registry_model_readiness_checks(model) if check.status == "blocked"])


def _pack_scoped_model_checks(pack_id: str, model: dict[str, Any], *, optional: bool = False) -> list[AIReadinessCheck]:
    scoped = []
    for check in _registry_model_readiness_checks(model):
        status = "pending" if optional and check.status == "blocked" else check.status
        label_prefix = "Optional " if optional else ""
        scoped.append(
            check.model_copy(
                update={
                    "id": f"{pack_id}:{model['id']}:{'optional-' if optional else ''}{check.id.rsplit(':', 1)[-1]}",
                    "label": f"{label_prefix}{model.get('display_name', model['id'])} / {check.label}",
                    "status": status,
                }
            )
        )
    return scoped


def _registry_model_readiness_checks(model: dict[str, Any]) -> list[AIReadinessCheck]:
    checks: list[AIReadinessCheck] = []
    if model.get("runtime") == "mock" or model.get("format") == "test":
        checks.append(
            AIReadinessCheck(
                id=f"{model['id']}:provider",
                label="Provider",
                status="blocked",
                detail="Uses a mock/test provider.",
                action="Replace with an approved local runtime-backed model.",
            )
        )
    else:
        checks.append(
            AIReadinessCheck(
                id=f"{model['id']}:provider",
                label="Provider",
                status="pass",
                detail=f"Uses {model.get('runtime', 'unknown')} runtime.",
            )
        )
        checks.extend(_model_contract_checks(model))
    source = model.get("source") or {}
    source_text = json.dumps(source)
    if source.get("type") == "huggingface":
        if "REPLACE_WITH_APPROVED" in source_text or source.get("revision") == "REQUIRED_BEFORE_RELEASE":
            checks.append(
                AIReadinessCheck(
                    id=f"{model['id']}:source",
                    label="Source",
                    status="blocked",
                    detail="Approved source and pinned revision pending.",
                    action="Pin an approved repository and 40-character commit revision.",
                )
            )
        else:
            checks.append(
                AIReadinessCheck(
                    id=f"{model['id']}:source",
                    label="Source",
                    status="pass",
                    detail=f"Hugging Face source is pinned to {source.get('revision')}.",
                )
            )
    elif not source and not model.get("installed"):
        checks.append(
            AIReadinessCheck(
                id=f"{model['id']}:source",
                label="Source",
                status="blocked",
                detail="Approved source pending.",
                action="Add an app-pinned local_fixture, URL, or Hugging Face source.",
            )
        )
    else:
        checks.append(
            AIReadinessCheck(
                id=f"{model['id']}:source",
                label="Source",
                status="pass",
                detail=f"{source.get('type', 'built-in')} source is registered.",
            )
        )
    files = model.get("files") or []
    if not files and not model.get("installed"):
        checks.append(
            AIReadinessCheck(
                id=f"{model['id']}:file-metadata",
                label="File metadata",
                status="blocked",
                detail="Model file metadata pending.",
                action="Add filename, SHA-256 checksum, and size in bytes.",
            )
        )
    for file_info in files:
        file_text = json.dumps(file_info)
        if "REPLACE_WITH_APPROVED" in file_text:
            checks.append(
                AIReadinessCheck(
                    id=f"{model['id']}:filename",
                    label="Filename",
                    status="blocked",
                    detail="Approved filename pending.",
                    action="Replace placeholder filenames with an allowlisted artifact path.",
                )
            )
        else:
            checks.append(
                AIReadinessCheck(
                    id=f"{model['id']}:filename",
                    label="Filename",
                    status="pass",
                    detail=f"{file_info.get('filename', 'artifact')} is pinned.",
                )
            )
        if not file_info.get("sha256") or file_info.get("sha256") == "REQUIRED_BEFORE_RELEASE":
            checks.append(
                AIReadinessCheck(
                    id=f"{model['id']}:checksum",
                    label="Checksum",
                    status="blocked",
                    detail="Checksum pending.",
                    action="Pin the SHA-256 checksum before release.",
                )
            )
        else:
            checks.append(
                AIReadinessCheck(
                    id=f"{model['id']}:checksum",
                    label="Checksum",
                    status="pass",
                    detail="SHA-256 checksum is pinned.",
                )
            )
        if file_info.get("size_bytes") is None:
            checks.append(
                AIReadinessCheck(
                    id=f"{model['id']}:size",
                    label="File size",
                    status="blocked",
                    detail="File size pending.",
                    action="Record the exact artifact size in bytes.",
                )
            )
        else:
            checks.append(
                AIReadinessCheck(
                    id=f"{model['id']}:size",
                    label="File size",
                    status="pass",
                    detail=f"{file_info['size_bytes']} bytes recorded.",
                )
            )
    license_label = str(model.get("license_label") or "").lower()
    if "check upstream" in license_label or "test fixture" in license_label:
        checks.append(
            AIReadinessCheck(
                id=f"{model['id']}:license",
                label="License",
                status="blocked",
                detail="License approval pending.",
                action="Review upstream license and pin approved license copy or label.",
            )
        )
    else:
        checks.append(
            AIReadinessCheck(
                id=f"{model['id']}:license",
                label="License",
                status="pass",
                detail=f"{model.get('license_label', 'license')} approved.",
            )
        )
    license_reference_check = _license_reference_check(model)
    checks.append(
        AIReadinessCheck(
            id=f"{model['id']}:license-artifact",
            label="License artifact",
            status=license_reference_check["status"],
            detail=license_reference_check["detail"],
            action=license_reference_check.get("action"),
        )
    )
    approval_check = _approval_record_check(model)
    checks.append(
        AIReadinessCheck(
            id=f"{model['id']}:release-approval",
            label="Release approval",
            status=approval_check["status"],
            detail=approval_check["detail"],
            action=approval_check.get("action"),
        )
    )
    return _dedupe_checks(checks)


def _model_contract_checks(model: dict[str, Any]) -> list[AIReadinessCheck]:
    model_id = str(model.get("id") or "<missing-model>")
    kind = str(model.get("kind") or "")
    runtime = str(model.get("runtime") or "")
    capabilities = set(str(capability) for capability in model.get("capabilities") or [])
    checks: list[AIReadinessCheck] = []
    allowed_capabilities = KIND_CAPABILITY_CONTRACT.get(kind)
    invalid_capabilities = sorted(capabilities - allowed_capabilities) if allowed_capabilities is not None else sorted(capabilities)
    if invalid_capabilities:
        checks.append(
            AIReadinessCheck(
                id=f"{model_id}:capability-fit",
                label="Capability fit",
                status="blocked",
                detail=f"{kind or 'Unknown'} model cannot serve: {', '.join(invalid_capabilities)}.",
                action="Align model kind with its capabilities before release approval.",
            )
        )
    else:
        checks.append(
            AIReadinessCheck(
                id=f"{model_id}:capability-fit",
                label="Capability fit",
                status="pass",
                detail=f"{kind or 'model'} capabilities match the model kind.",
            )
        )
    allowed_runtimes = KIND_RUNTIME_CONTRACT.get(kind)
    if allowed_runtimes is not None and runtime not in allowed_runtimes:
        checks.append(
            AIReadinessCheck(
                id=f"{model_id}:runtime-fit",
                label="Runtime fit",
                status="blocked",
                detail=f"{kind or 'Model'} must use one of: {', '.join(sorted(allowed_runtimes))}.",
                action="Use the local runtime expected for this model kind.",
            )
        )
    else:
        checks.append(
            AIReadinessCheck(
                id=f"{model_id}:runtime-fit",
                label="Runtime fit",
                status="pass",
                detail=f"{runtime or 'runtime'} is valid for {kind or 'model'} models.",
            )
        )
    checks.append(_model_defaults_check(model_id, kind, capabilities, model.get("defaults") if isinstance(model.get("defaults"), dict) else {}))
    return checks


def _model_defaults_check(
    model_id: str,
    kind: str,
    capabilities: set[str],
    defaults: dict[str, Any],
) -> AIReadinessCheck:
    missing: list[str] = []
    invalid: list[str] = []
    if kind == "llm":
        _require_positive_int(defaults, "context_tokens", missing, invalid)
        if capabilities & LLM_EXTRACTION_CAPABILITIES:
            _require_number(defaults, "temperature_extraction", missing, invalid)
            _require_positive_int(defaults, "max_tokens_extraction", missing, invalid)
        if capabilities & LLM_GENERATION_CAPABILITIES:
            _require_number(defaults, "temperature_generation", missing, invalid)
            _require_positive_int(defaults, "max_tokens_generation", missing, invalid)
    elif kind == "embedding":
        _require_positive_int(defaults, "dimensions", missing, invalid)
    elif kind == "reranker":
        _require_positive_int(defaults, "batch_size", missing, invalid)
        _require_positive_int(defaults, "max_length", missing, invalid)
        _require_positive_number(defaults, "timeout_seconds", missing, invalid)
    elif kind == "stt":
        _require_positive_number(defaults, "timeout_seconds", missing, invalid)
    elif kind == "tts":
        _require_positive_number(defaults, "timeout_seconds", missing, invalid)
        if str(defaults.get("format") or "") not in {"wav", "mp3"}:
            if "format" not in defaults:
                missing.append("format")
            else:
                invalid.append("format")
    if missing or invalid:
        details = []
        if missing:
            details.append(f"missing {', '.join(missing)}")
        if invalid:
            details.append(f"invalid {', '.join(invalid)}")
        return AIReadinessCheck(
            id=f"{model_id}:runtime-defaults",
            label="Runtime defaults",
            status="blocked",
            detail=f"Runtime defaults are not release-ready: {'; '.join(details)}.",
            action="Pin safe per-kind defaults so setup can test and route this model without manual flags.",
        )
    return AIReadinessCheck(
        id=f"{model_id}:runtime-defaults",
        label="Runtime defaults",
        status="pass",
        detail="Runtime defaults are pinned for setup and smoke testing.",
    )


def _require_positive_int(defaults: dict[str, Any], key: str, missing: list[str], invalid: list[str]) -> None:
    if key not in defaults:
        missing.append(key)
        return
    value = defaults.get(key)
    if not isinstance(value, int) or value <= 0:
        invalid.append(key)


def _require_number(defaults: dict[str, Any], key: str, missing: list[str], invalid: list[str]) -> None:
    if key not in defaults:
        missing.append(key)
        return
    value = defaults.get(key)
    if not isinstance(value, int | float):
        invalid.append(key)


def _require_positive_number(defaults: dict[str, Any], key: str, missing: list[str], invalid: list[str]) -> None:
    if key not in defaults:
        missing.append(key)
        return
    value = defaults.get(key)
    if not isinstance(value, int | float) or value <= 0:
        invalid.append(key)


def _approval_record_check(item: dict[str, Any]) -> dict[str, str | None]:
    approval = item.get("approval") or {}
    if not isinstance(approval, dict) or not approval:
        return {
            "status": "blocked",
            "detail": "Release approval record pending.",
            "action": "Add approval.status, approved_by, approved_at, and evidence before release.",
        }
    if approval.get("status") != "approved":
        return {
            "status": "blocked",
            "detail": "Release approval is not marked approved.",
            "action": "Set approval.status to approved after artifact, license, and runtime review.",
        }
    missing = [
        field
        for field in ["approved_by", "approved_at", "evidence"]
        if not str(approval.get(field) or "").strip()
    ]
    if missing:
        return {
            "status": "blocked",
            "detail": f"Release approval record is missing: {', '.join(missing)}.",
            "action": "Record reviewer, approval date, and evidence before release.",
        }
    return {
        "status": "pass",
        "detail": f"Release approved by {approval['approved_by']} on {approval['approved_at']}.",
        "action": None,
    }


def _license_reference_check(item: dict[str, Any]) -> dict[str, str | None]:
    license_url = str(item.get("license_url") or "")
    license_path = str(item.get("license_path") or "")
    if license_url and license_path:
        return {
            "status": "blocked",
            "detail": "License artifact has conflicting URL and path references.",
            "action": "Use exactly one license_url or license_path.",
        }
    reference = license_url or license_path
    if not reference:
        return {
            "status": "blocked",
            "detail": "License artifact pending.",
            "action": "Pin an approved license URL or bundled license text path.",
        }
    if reference == "REQUIRED_BEFORE_RELEASE" or "REPLACE_WITH_APPROVED" in reference:
        return {
            "status": "blocked",
            "detail": "License artifact pending.",
            "action": "Pin an approved license URL or bundled license text path.",
        }
    return {
        "status": "pass",
        "detail": f"License artifact is pinned: {reference}.",
        "action": None,
    }


def _dedupe_checks(values: list[AIReadinessCheck]) -> list[AIReadinessCheck]:
    seen: set[tuple[str, str]] = set()
    result: list[AIReadinessCheck] = []
    for value in values:
        key = (value.id, value.detail)
        if key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result
