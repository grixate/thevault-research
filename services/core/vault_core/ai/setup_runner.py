from __future__ import annotations

import tempfile
import time
import wave
from typing import Any

from vault_core.api.schemas import AIModelPackInfo, AISetupRunRequest, AISetupRunResponse, AISetupRunStep
from vault_core.ai.embeddings.index import EmbeddingSpace, coerce_embedding_dimensions, embed_texts_for_space
from vault_core.ai.models.downloader import (
    download_model,
    get_download,
    mark_model_runtime_tested,
    verify_installed_model,
)
from vault_core.ai.models.health import llama_cpp_smoke_test, runtime_health
from vault_core.ai.models.registry import list_model_infos, list_model_packs, load_model_registry
from vault_core.ai.models.runtime_installer import install_runtime, list_runtime_infos
from vault_core.ai.rerankers.local_cross_encoder import LocalCrossEncoderReranker
from vault_core.ai.routing import hardware_profile, update_capability
from vault_core.ai.setup import ai_setup_status
from vault_core.ai.voice.piper import PiperTextToSpeechProvider
from vault_core.ai.voice.whisper_cpp import WhisperCppSpeechToTextProvider
from vault_core.config import Settings
from vault_core.db.session import VaultDatabase, loads


def run_ai_setup(db: VaultDatabase, settings: Settings, req: AISetupRunRequest) -> AISetupRunResponse:
    runtime_infos = list_runtime_infos(db, settings)
    packs = list_model_packs(db, runtime_infos)
    pack = _resolve_pack(req, packs)
    if not pack.installed and not pack.installable:
        return _blocked_pack_response(db, settings, req, pack)

    registry_models = {model["id"]: model for model in load_model_registry().get("models", [])}
    setup_model_ids = _setup_model_ids(pack, include_optional_models=req.include_optional_models)
    if req.dry_run:
        return _dry_run_setup_response(db, settings, req, pack, registry_models, setup_model_ids)

    steps: list[AISetupRunStep] = []
    downloads: list[dict[str, Any]] = []
    selected_capabilities: list[str] = []

    if req.install_runtimes:
        steps.extend(_install_pack_runtimes(db, settings, pack, registry_models, setup_model_ids))
    else:
        steps.append(
            AISetupRunStep(
                id="runtime-install-skipped",
                title="Runtime installation",
                status="skipped",
                detail="Runtime installation was disabled for this setup run.",
            )
        )

    if req.download_models:
        download_steps, downloads = _download_pack_models(db, settings, setup_model_ids, req.timeout_seconds)
        steps.extend(download_steps)
    else:
        steps.append(
            AISetupRunStep(
                id="model-download-skipped",
                title="Model download",
                status="skipped",
                detail="Model downloads were disabled for this setup run.",
            )
        )

    if req.activate_routes:
        activation_steps, selected_capabilities = _activate_ready_pack_routes(
            db,
            settings,
            pack,
            registry_models,
            setup_model_ids,
        )
        steps.extend(activation_steps)
    else:
        steps.append(
            AISetupRunStep(
                id="route-activation-skipped",
                title="Route activation",
                status="skipped",
                detail="Capability route activation was disabled for this setup run.",
            )
        )

    status = _run_status(pack, steps, selected_capabilities, include_optional_models=req.include_optional_models)
    with db.connect() as conn:
        db.event(
            conn,
            "ai.setup_run_completed",
            "ai_setup",
            pack.id,
            {
                "mode": req.mode,
                "release_channel": pack.release_channel,
                "status": status,
                "selected_capabilities": selected_capabilities,
                "include_optional_models": req.include_optional_models,
            },
            "user",
        )
    return AISetupRunResponse(
        mode=req.mode,
        pack_id=pack.id,
        release_channel=pack.release_channel,
        status=status,
        dry_run=False,
        selected_capabilities=selected_capabilities,
        downloads=downloads,
        steps=steps,
        setup=ai_setup_status(db, settings),
    )


def _resolve_pack(req: AISetupRunRequest, packs: list[AIModelPackInfo]) -> AIModelPackInfo:
    if req.pack_id:
        pack = next((item for item in packs if item.id == req.pack_id), None)
        if not pack:
            raise ValueError(f"Model pack not found: {req.pack_id}")
        return pack
    if req.mode == "demo":
        pack = next((item for item in packs if item.release_channel == "demo"), None)
        if not pack:
            raise ValueError("No demo model pack is registered.")
        return pack
    setup_profile = hardware_profile().recommended_profile
    production = [item for item in packs if item.release_channel == "production"]
    pack = (
        next((item for item in production if item.id == "starter-local-pack"), None)
        or next((item for item in production if item.profile == setup_profile), None)
        or next(iter(production), None)
    )
    if not pack:
        raise ValueError("No production model pack is registered.")
    return pack


def _blocked_pack_response(
    db: VaultDatabase,
    settings: Settings,
    req: AISetupRunRequest,
    pack: AIModelPackInfo,
) -> AISetupRunResponse:
    blocked_checks = [check for check in pack.readiness_checks if check.status == "blocked"]
    steps = [
        AISetupRunStep(
            id=f"pack-blocker-{index}",
            title=check.label,
            status="blocked",
            detail=_check_detail(check),
        )
        for index, check in enumerate(blocked_checks[:12], start=1)
    ]
    if len(blocked_checks) > 12:
        steps.append(
            AISetupRunStep(
                id="pack-blocker-more",
                title="Additional release blockers",
                status="blocked",
                detail=f"{len(blocked_checks) - 12} more model-pack checks are still blocked.",
            )
        )
    if not steps:
        steps = [
            AISetupRunStep(
                id=f"pack-blocker-{index}",
                title="Production pack blocker",
                status="blocked",
                detail=reason,
            )
            for index, reason in enumerate(pack.blocked_reasons or ["This model pack has no release-ready downloadable models."], start=1)
        ]
    with db.connect() as conn:
        db.event(
            conn,
            "ai.setup_run_blocked",
            "ai_setup",
            pack.id,
            {"mode": req.mode, "release_channel": pack.release_channel, "blocked_steps": len(steps)},
            "user",
        )
    return AISetupRunResponse(
        mode=req.mode,
        pack_id=pack.id,
        release_channel=pack.release_channel,
        status="blocked",
        dry_run=req.dry_run,
        selected_capabilities=[],
        downloads=[],
        steps=steps,
        setup=ai_setup_status(db, settings),
    )


def _dry_run_setup_response(
    db: VaultDatabase,
    settings: Settings,
    req: AISetupRunRequest,
    pack: AIModelPackInfo,
    registry_models: dict[str, dict[str, Any]],
    model_ids: list[str],
) -> AISetupRunResponse:
    steps: list[AISetupRunStep] = []
    if req.install_runtimes:
        steps.extend(_plan_pack_runtimes(db, settings, pack, registry_models, model_ids))
    else:
        steps.append(
            AISetupRunStep(
                id="runtime-install-skipped",
                title="Runtime installation",
                status="skipped",
                detail="Runtime installation would be skipped.",
            )
        )
    if req.download_models:
        steps.extend(_plan_pack_models(db, model_ids))
    else:
        steps.append(
            AISetupRunStep(
                id="model-download-skipped",
                title="Model download",
                status="skipped",
                detail="Model downloads would be skipped.",
            )
        )
    if req.activate_routes:
        activation_steps, selected_capabilities = _plan_route_activation(pack, registry_models, model_ids)
        steps.extend(activation_steps)
    else:
        selected_capabilities = []
        steps.append(
            AISetupRunStep(
                id="route-activation-skipped",
                title="Route activation",
                status="skipped",
                detail="Capability route activation would be skipped.",
            )
        )

    status = "blocked" if any(step.status in {"blocked", "failed"} for step in steps) else "partial"
    with db.connect() as conn:
        db.event(
            conn,
            "ai.setup_run_planned",
            "ai_setup",
            pack.id,
            {
                "mode": req.mode,
                "release_channel": pack.release_channel,
                "status": status,
                "include_optional_models": req.include_optional_models,
                "step_count": len(steps),
            },
            "user",
        )
    return AISetupRunResponse(
        mode=req.mode,
        pack_id=pack.id,
        release_channel=pack.release_channel,
        status=status,
        dry_run=True,
        selected_capabilities=selected_capabilities,
        downloads=[],
        steps=steps,
        setup=ai_setup_status(db, settings),
    )


def _check_detail(check: Any) -> str:
    if check.action:
        return f"{check.detail} Action: {check.action}"
    return check.detail


def _plan_pack_runtimes(
    db: VaultDatabase,
    settings: Settings,
    pack: AIModelPackInfo,
    registry_models: dict[str, dict[str, Any]],
    model_ids: list[str],
) -> list[AISetupRunStep]:
    steps: list[AISetupRunStep] = []
    runtime_infos = list_runtime_infos(db, settings)
    for runtime in _pack_runtime_ids(pack, registry_models, model_ids):
        if runtime in {"mock", "local_embedding", "local_cross_encoder"}:
            steps.append(
                AISetupRunStep(
                    id=f"runtime-{runtime}",
                    title=f"{runtime} runtime",
                    status="done",
                    detail="Built-in local provider is already available.",
                )
            )
            continue
        candidates = [
            item
            for item in runtime_infos
            if item.runtime == runtime and item.release_channel == pack.release_channel
        ]
        installed = next((item for item in candidates if item.installed), None)
        installable = next((item for item in candidates if item.installable), None)
        if installed:
            steps.append(
                AISetupRunStep(
                    id=f"runtime-{runtime}",
                    title=f"{runtime} runtime",
                    status="done",
                    runtime_id=installed.id,
                    detail=f"{installed.display_name} is already installed and verified.",
                )
            )
        elif installable:
            steps.append(
                AISetupRunStep(
                    id=f"runtime-{runtime}",
                    title=f"{runtime} runtime",
                    status="queued",
                    runtime_id=installable.id,
                    detail=f"Would install and verify {installable.display_name}.",
                )
            )
        else:
            steps.append(
                AISetupRunStep(
                    id=f"runtime-{runtime}",
                    title=f"{runtime} runtime",
                    status="blocked",
                    detail=f"No approved installable {runtime} runtime is available yet.",
                )
            )
    return steps


def _install_pack_runtimes(
    db: VaultDatabase,
    settings: Settings,
    pack: AIModelPackInfo,
    registry_models: dict[str, dict[str, Any]],
    model_ids: list[str],
) -> list[AISetupRunStep]:
    steps: list[AISetupRunStep] = []
    needed_runtimes = _pack_runtime_ids(pack, registry_models, model_ids)
    runtime_infos = list_runtime_infos(db, settings)
    for runtime in needed_runtimes:
        if runtime in {"mock", "local_embedding", "local_cross_encoder"}:
            steps.append(
                AISetupRunStep(
                    id=f"runtime-{runtime}",
                    title=f"{runtime} runtime",
                    status="done",
                    detail="Built-in local provider is already available.",
                )
            )
            continue
        candidates = [
            item
            for item in runtime_infos
            if item.runtime == runtime and item.release_channel == pack.release_channel
        ]
        installable = next((item for item in candidates if item.installable), None)
        installed = next((item for item in candidates if item.installed), None)
        if installed:
            steps.append(
                AISetupRunStep(
                    id=f"runtime-{runtime}",
                    title=f"{runtime} runtime",
                    status="done",
                    runtime_id=installed.id,
                    detail=f"{installed.display_name} is installed and checksum verified.",
                )
            )
            continue
        if not installable:
            steps.append(
                AISetupRunStep(
                    id=f"runtime-{runtime}",
                    title=f"{runtime} runtime",
                    status="blocked",
                    detail=f"No approved installable {runtime} runtime is available yet.",
                )
            )
            continue
        try:
            result = install_runtime(db, settings, installable.id)
            steps.append(
                AISetupRunStep(
                    id=f"runtime-{runtime}",
                    title=f"{runtime} runtime",
                    status="done",
                    runtime_id=installable.id,
                    detail=f"Installed {installable.display_name} at {result.get('binary_path')}.",
                )
            )
        except ValueError as exc:
            steps.append(
                AISetupRunStep(
                    id=f"runtime-{runtime}",
                    title=f"{runtime} runtime",
                    status="failed",
                    runtime_id=installable.id,
                    detail=str(exc),
                )
            )
    return steps


def _plan_pack_models(db: VaultDatabase, model_ids: list[str]) -> list[AISetupRunStep]:
    steps: list[AISetupRunStep] = []
    infos = {model.id: model for model in list_model_infos(db)}
    for model_id in model_ids:
        info = infos.get(model_id)
        if not info:
            steps.append(
                AISetupRunStep(
                    id=f"model-{model_id}",
                    title=model_id,
                    status="blocked",
                    model_id=model_id,
                    detail="Model is not in the registry.",
                )
            )
            continue
        if info.installed:
            steps.append(
                AISetupRunStep(
                    id=f"model-{model_id}",
                    title=info.display_name,
                    status="done",
                    model_id=model_id,
                    detail="Model is already installed.",
                )
            )
            continue
        if info.downloadable:
            size_detail = f" ({info.size_bytes} bytes)" if info.size_bytes else ""
            steps.append(
                AISetupRunStep(
                    id=f"model-{model_id}",
                    title=info.display_name,
                    status="queued",
                    model_id=model_id,
                    detail=f"Would download and verify {info.display_name}{size_detail}.",
                )
            )
            continue
        steps.append(
            AISetupRunStep(
                id=f"model-{model_id}",
                title=info.display_name,
                status="blocked",
                model_id=model_id,
                detail="No release-ready downloadable artifact is available.",
            )
        )
    return steps


def _download_pack_models(
    db: VaultDatabase,
    settings: Settings,
    model_ids: list[str],
    timeout_seconds: float,
) -> tuple[list[AISetupRunStep], list[dict[str, Any]]]:
    steps: list[AISetupRunStep] = []
    downloads: list[dict[str, Any]] = []
    infos = {model.id: model for model in list_model_infos(db)}
    for model_id in model_ids:
        info = infos.get(model_id)
        if info and info.installed:
            if not info.disk_path:
                steps.append(
                    AISetupRunStep(
                        id=f"model-{model_id}",
                        title=info.display_name,
                        status="done",
                        model_id=model_id,
                        detail="Built-in local provider is already available.",
                    )
                )
                continue
            try:
                verify_installed_model(db, model_id)
                steps.append(
                    AISetupRunStep(
                        id=f"model-{model_id}",
                        title=info.display_name,
                        status="done",
                        model_id=model_id,
                        detail="Already installed and checksum verified.",
                    )
                )
            except ValueError as exc:
                steps.append(
                    AISetupRunStep(
                        id=f"model-{model_id}",
                        title=info.display_name,
                        status="failed",
                        model_id=model_id,
                        detail=str(exc),
                    )
                )
            continue
        if not info or not info.downloadable:
            steps.append(
                AISetupRunStep(
                    id=f"model-{model_id}",
                    title=info.display_name if info else model_id,
                    status="blocked",
                    model_id=model_id,
                    detail="No release-ready downloadable artifact is available.",
                )
            )
            continue
        try:
            started = download_model(db, settings, model_id)
            finished = _wait_for_download(db, started["id"], timeout_seconds)
            downloads.append(finished)
            status = "done" if finished["state"] == "installed" else "queued" if finished["state"] in {"queued", "downloading"} else "failed"
            steps.append(
                AISetupRunStep(
                    id=f"model-{model_id}",
                    title=info.display_name,
                    status=status,
                    model_id=model_id,
                    detail=f"Download state: {finished['state']}.",
                )
            )
        except (NotImplementedError, ValueError) as exc:
            steps.append(
                AISetupRunStep(
                    id=f"model-{model_id}",
                    title=info.display_name,
                    status="failed",
                    model_id=model_id,
                    detail=str(exc),
                )
            )
    return steps, downloads


def _plan_route_activation(
    pack: AIModelPackInfo,
    registry_models: dict[str, dict[str, Any]],
    model_ids: list[str],
) -> tuple[list[AISetupRunStep], list[str]]:
    steps: list[AISetupRunStep] = []
    selected_capabilities: list[str] = []
    target_capabilities = _setup_capabilities(pack, registry_models, model_ids)
    for model_id in model_ids:
        model = registry_models.get(model_id)
        if not model:
            steps.append(
                AISetupRunStep(
                    id=f"activate-{model_id}",
                    title=model_id,
                    status="blocked",
                    model_id=model_id,
                    detail="Model definition is missing.",
                )
            )
            continue
        capabilities = [
            capability
            for capability in model.get("capabilities", [])
            if capability in target_capabilities
        ]
        if not capabilities:
            continue
        selected_capabilities.extend(capabilities)
        provider_id = _provider_for_model(model)
        steps.append(
            AISetupRunStep(
                id=f"activate-{model_id}",
                title=model.get("display_name", model_id),
                status="queued",
                model_id=model_id,
                detail=f"Would smoke-test {provider_id} and activate {', '.join(capabilities)}.",
            )
        )
    return steps, sorted(set(selected_capabilities))


def _activate_ready_pack_routes(
    db: VaultDatabase,
    settings: Settings,
    pack: AIModelPackInfo,
    registry_models: dict[str, dict[str, Any]],
    model_ids: list[str],
) -> tuple[list[AISetupRunStep], list[str]]:
    steps: list[AISetupRunStep] = []
    selected_capabilities: list[str] = []
    installed = _installed_models_by_id(db)
    current_runtime_health = runtime_health(settings, db)
    target_capabilities = _setup_capabilities(pack, registry_models, model_ids)
    for model_id in model_ids:
        model = _model_definition(model_id, registry_models, installed)
        if not model:
            steps.append(
                AISetupRunStep(
                    id=f"activate-{model_id}",
                    title=model_id,
                    status="blocked",
                    model_id=model_id,
                    detail="Model definition is missing.",
                )
            )
            continue
        installed_or_builtin = bool(model.get("installed") or model_id in installed)
        if not installed_or_builtin:
            steps.append(
                AISetupRunStep(
                    id=f"activate-{model_id}",
                    title=model.get("display_name", model_id),
                    status="blocked",
                    model_id=model_id,
                    detail="Model is not installed yet.",
                )
            )
            continue
        provider_id = _provider_for_model(model)
        settings_payloads = {
            capability: _settings_for_selected_model(model, capability, current_runtime_health)
            for capability in model.get("capabilities", [])
            if capability in target_capabilities
        }
        ready, detail = _model_ready_for_activation(settings, db, model, current_runtime_health, settings_payloads)
        if not ready:
            steps.append(
                AISetupRunStep(
                    id=f"activate-{model_id}",
                    title=model.get("display_name", model_id),
                    status="skipped",
                    model_id=model_id,
                    detail=detail,
                )
            )
            continue
        activated: list[str] = []
        for capability, settings_payload in settings_payloads.items():
            try:
                update_capability(
                    db,
                    capability,
                    provider_id=provider_id,
                    model_id=model_id,
                    local_only=True,
                    settings=settings_payload,
                )
                selected_capabilities.append(capability)
                activated.append(capability)
            except ValueError as exc:
                steps.append(
                    AISetupRunStep(
                        id=f"activate-{model_id}-{capability}",
                        title=f"{capability} route",
                        status="failed",
                        model_id=model_id,
                        capability=capability,
                        detail=str(exc),
                    )
                )
        if activated:
            steps.append(
                AISetupRunStep(
                    id=f"activate-{model_id}",
                    title=model.get("display_name", model_id),
                    status="done",
                    model_id=model_id,
                    detail=f"{detail} Activated {', '.join(activated)}.",
                )
            )
    return steps, sorted(set(selected_capabilities))


def _model_ready_for_activation(
    settings: Settings,
    db: VaultDatabase,
    model: dict[str, Any],
    current_runtime_health: dict[str, Any],
    settings_payloads: dict[str, dict[str, Any]],
) -> tuple[bool, str]:
    runtime = model.get("runtime")
    kind = model.get("kind")
    model_id = model["id"]
    if runtime == "mock":
        return True, "Built-in deterministic local provider is ready."
    if runtime == "llama_cpp":
        smoke = llama_cpp_smoke_test(settings, db, model_id=model_id, dry_run=False, max_tokens=64)
        if smoke["status"] == "passed":
            mark_model_runtime_tested(db, model_id)
            return True, "llama.cpp smoke test passed."
        return False, f"Not activated: {smoke['status']} - {smoke['message']}"
    if runtime == "whisper_cpp":
        ready, detail = _voice_model_smoke_test(
            model,
            current_runtime_health.get("voice", {}).get("stt", {}).get("cli", {}),
            settings_payloads.get("transcribe_audio", {}),
        )
        if ready:
            mark_model_runtime_tested(db, model_id)
        return ready, detail
    if runtime == "piper":
        ready, detail = _voice_model_smoke_test(
            model,
            current_runtime_health.get("voice", {}).get("tts", {}).get("cli", {}),
            settings_payloads.get("synthesize_speech", {}),
        )
        if ready:
            mark_model_runtime_tested(db, model_id)
        return ready, detail
    if kind == "embedding" and runtime in {"local_embedding"}:
        ready, detail = _local_embedding_smoke_test(model, settings_payloads.get("embed_text", {}))
        if ready:
            mark_model_runtime_tested(db, model_id)
        return ready, detail
    if kind == "reranker" and runtime == "local_cross_encoder":
        ready, detail = _local_reranker_smoke_test(model, settings_payloads.get("rerank_results", {}))
        if ready:
            mark_model_runtime_tested(db, model_id)
        return ready, detail
    return False, f"Not activated: {runtime or 'unknown'} runtime is not ready."


def _wait_for_download(db: VaultDatabase, download_id: str, timeout_seconds: float) -> dict[str, Any]:
    deadline = time.time() + max(0.5, timeout_seconds)
    last = get_download(db, download_id)
    while time.time() < deadline:
        last = get_download(db, download_id)
        if last["state"] in {"installed", "failed", "cancelled", "paused"}:
            return last
        time.sleep(0.02)
    return last


def _setup_model_ids(pack: AIModelPackInfo, *, include_optional_models: bool) -> list[str]:
    model_ids = list(pack.required_model_ids)
    if include_optional_models:
        model_ids.extend(pack.optional_model_ids)
    return _dedupe(model_ids)


def _setup_capabilities(
    pack: AIModelPackInfo,
    registry_models: dict[str, dict[str, Any]],
    model_ids: list[str],
) -> set[str]:
    capabilities = set(pack.capabilities)
    for model_id in model_ids:
        capabilities.update(str(capability) for capability in (registry_models.get(model_id) or {}).get("capabilities", []))
    return capabilities


def _pack_runtime_ids(
    pack: AIModelPackInfo,
    registry_models: dict[str, dict[str, Any]],
    model_ids: list[str],
) -> list[str]:
    runtimes = [
        str((registry_models.get(model_id) or {}).get("runtime") or "")
        for model_id in model_ids
    ]
    return _dedupe([runtime for runtime in runtimes if runtime])


def _installed_models_by_id(db: VaultDatabase) -> dict[str, dict[str, Any]]:
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT * FROM ai_installed_models WHERE workspace_id=? AND status='installed'",
            (db.workspace_id,),
        ).fetchall()
    installed: dict[str, dict[str, Any]] = {}
    for row in rows:
        data = dict(row)
        manifest = loads(data.get("manifest_json"), {})
        installed[data["model_id"]] = {**manifest, **data, "id": data["model_id"], "file_path": data.get("file_path")}
    return installed


def _model_definition(
    model_id: str,
    registry_models: dict[str, dict[str, Any]],
    installed: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
    if model_id in installed:
        registry = registry_models.get(model_id, {})
        return {**registry, **installed[model_id], "id": model_id}
    registry = registry_models.get(model_id)
    if registry:
        return registry
    return None


def _provider_for_model(model: dict[str, Any]) -> str:
    if model.get("runtime") == "whisper_cpp" and model.get("kind") == "stt":
        return "whisper_cpp"
    if model.get("runtime") == "piper" and model.get("kind") == "tts":
        return "piper"
    if model.get("runtime") == "mock":
        kind = model.get("kind")
        if kind == "embedding":
            return "mock_embedding"
        if kind == "reranker":
            return "mock_reranker"
        if kind == "stt":
            return "mock_stt"
        if kind == "tts":
            return "mock_tts"
        return "mock_llm"
    if model.get("runtime") == "local_embedding" and model.get("kind") == "embedding":
        return "local_embedding"
    if model.get("runtime") == "local_cross_encoder" and model.get("kind") == "reranker":
        return "local_cross_encoder"
    if model.get("runtime") == "llama_cpp":
        return "llama_cpp_cli"
    return "mock_llm"


def _voice_model_smoke_test(
    model: dict[str, Any],
    cli_status: dict[str, Any],
    route_settings: dict[str, Any],
) -> tuple[bool, str]:
    runtime = model.get("runtime")
    model_id = model["id"]
    binary_path = str(route_settings.get("binary_path") or cli_status.get("path") or "").strip()
    model_path = str(route_settings.get("model_path") or model.get("file_path") or "").strip()
    if not binary_path:
        return False, f"Not activated: {runtime} managed binary is not installed or configured."
    if cli_status.get("error"):
        return False, f"Not activated: {runtime} binary is not usable: {cli_status['error']}"
    if cli_status.get("integrity_status") in {"missing", "mismatch", "failed"}:
        return False, f"Not activated: {runtime} managed binary integrity check failed."
    if not model_path:
        return False, f"Not activated: {runtime} model file is not installed."

    try:
        if runtime == "whisper_cpp":
            _run_whisper_smoke(binary_path, model_path, model_id, route_settings)
            return True, "whisper.cpp local transcription smoke test passed."
        if runtime == "piper":
            _run_piper_smoke(binary_path, model_path, model_id, route_settings)
            return True, "Piper local speech synthesis smoke test passed."
    except ValueError as exc:
        return False, f"Not activated: {runtime} smoke test failed: {exc}"
    return False, f"Not activated: {runtime or 'unknown'} runtime is not ready."


def _run_whisper_smoke(binary_path: str, model_path: str, model_id: str, route_settings: dict[str, Any]) -> None:
    with tempfile.TemporaryDirectory(prefix="vault-whisper-smoke-") as temp_dir:
        audio_path = f"{temp_dir}/smoke.wav"
        with wave.open(audio_path, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(b"\x00\x00" * 1600)
        provider = WhisperCppSpeechToTextProvider(
            binary_path=binary_path,
            model_path=model_path,
            model_id=model_id,
            language=_route_language(route_settings),
            translate_to_english=bool(route_settings.get("translate_to_english")),
            timestamps=bool(route_settings.get("timestamps", True)),
            timeout_seconds=float(route_settings.get("timeout_seconds") or 120),
        )
        provider.transcribe(audio_path)


def _run_piper_smoke(binary_path: str, model_path: str, model_id: str, route_settings: dict[str, Any]) -> None:
    with tempfile.TemporaryDirectory(prefix="vault-piper-smoke-") as temp_dir:
        output_path = f"{temp_dir}/smoke.wav"
        provider = PiperTextToSpeechProvider(
            binary_path=binary_path,
            model_path=model_path,
            config_path=str(route_settings.get("config_path") or "").strip() or None,
            model_id=model_id,
            voice_id=str(route_settings.get("voice_id") or "").strip() or None,
            output_path=output_path,
            timeout_seconds=float(route_settings.get("timeout_seconds") or 60),
        )
        provider.synthesize("Vault local voice smoke test.")


def _local_embedding_smoke_test(model: dict[str, Any], route_settings: dict[str, Any]) -> tuple[bool, str]:
    model_id = model["id"]
    if not model.get("file_path") and not model.get("installed"):
        return False, "Not activated: local embedding model is not installed."
    dimensions = coerce_embedding_dimensions(route_settings.get("dimensions"))
    try:
        vectors = embed_texts_for_space(
            ["Vault local embedding smoke test."],
            EmbeddingSpace(provider="local_embedding", model=model_id, dimensions=dimensions),
            route_settings,
        )
    except ValueError as exc:
        return False, f"Not activated: local embedding smoke test failed: {exc}"
    if len(vectors) != 1 or len(vectors[0]) != dimensions:
        return False, "Not activated: local embedding smoke test returned malformed vectors."
    return True, f"App-managed local embedding smoke test passed at {dimensions} dimensions."


def _local_reranker_smoke_test(model: dict[str, Any], route_settings: dict[str, Any]) -> tuple[bool, str]:
    model_id = model["id"]
    if not model.get("file_path") and not model.get("installed"):
        return False, "Not activated: local reranker model is not installed."
    try:
        provider = LocalCrossEncoderReranker(
            model_path=str(route_settings.get("model_path") or model.get("file_path") or ""),
            model_id=model_id,
            max_length=int(route_settings.get("max_length") or 512),
            batch_size=int(route_settings.get("batch_size") or 8),
        )
        ranked = provider.rerank_sync(
            "preferred local reranker smoke",
            [
                {"id": "preferred", "text": "preferred local reranker smoke candidate"},
                {"id": "other", "text": "unrelated candidate"},
            ],
        )
    except ValueError as exc:
        return False, f"Not activated: local reranker smoke test failed: {exc}"
    if not ranked or ranked[0].get("id") != "preferred":
        return False, "Not activated: local reranker smoke test returned an unexpected ranking."
    return True, "App-managed local reranker smoke test passed."


def _route_language(route_settings: dict[str, Any]) -> str | None:
    language = str(route_settings.get("language") or "").strip()
    return None if not language or language == "auto" else language


def _settings_for_selected_model(
    model: dict[str, Any],
    capability: str,
    current_runtime_health: dict[str, Any],
) -> dict[str, Any]:
    settings = dict(model.get("defaults", {}) or {})
    if capability == "embed_text" and model.get("runtime") == "local_embedding":
        settings["dimensions"] = coerce_embedding_dimensions(settings.get("dimensions"))
        file_path = model.get("file_path")
        if file_path:
            settings["model_path"] = file_path
    if capability == "rerank_results" and model.get("runtime") == "local_cross_encoder":
        file_path = model.get("file_path")
        if file_path:
            settings["model_path"] = file_path
        settings.setdefault("batch_size", 8)
        settings.setdefault("max_length", 512)
        settings.setdefault("timeout_seconds", 15)
    if capability == "transcribe_audio" and model.get("runtime") == "whisper_cpp":
        file_path = model.get("file_path")
        if file_path:
            settings["model_path"] = file_path
        binary_path = current_runtime_health.get("voice", {}).get("stt", {}).get("cli", {}).get("path")
        if binary_path:
            settings["binary_path"] = binary_path
        settings.setdefault("timestamps", True)
        settings.setdefault("timeout_seconds", 120)
    if capability == "synthesize_speech" and model.get("runtime") == "piper":
        file_path = model.get("file_path")
        if file_path:
            settings["model_path"] = file_path
        binary_path = current_runtime_health.get("voice", {}).get("tts", {}).get("cli", {}).get("path")
        if binary_path:
            settings["binary_path"] = binary_path
        settings.setdefault("format", "wav")
        settings.setdefault("timeout_seconds", 120)
    return settings


def _run_status(
    pack: AIModelPackInfo,
    steps: list[AISetupRunStep],
    selected_capabilities: list[str],
    *,
    include_optional_models: bool = False,
) -> str:
    if any(step.status == "failed" for step in steps):
        return "failed"
    required_blocked = [step for step in steps if step.status == "blocked" and not step.id.startswith("runtime-whisper_cpp")]
    if required_blocked and not selected_capabilities:
        return "blocked"
    expected = set(pack.capabilities)
    selected = set(selected_capabilities)
    if expected and expected.issubset(selected):
        if include_optional_models and required_blocked:
            return "partial"
        return "demo_ready" if pack.release_channel == "demo" else "ready"
    return "partial"


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result
