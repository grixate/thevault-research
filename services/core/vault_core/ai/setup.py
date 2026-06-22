from __future__ import annotations

from typing import Any

from vault_core.api.schemas import AIModelPackInfo, AIRuntimeInfo, AISetupStatusResponse, AISetupStepInfo
from vault_core.ai.models.health import runtime_health
from vault_core.ai.models.registry import list_model_packs
from vault_core.ai.models.runtime_installer import list_runtime_infos
from vault_core.ai.routing import PROVIDERS_BY_ID, hardware_profile, list_capabilities
from vault_core.config import Settings
from vault_core.db.session import VaultDatabase


def ai_setup_status(db: VaultDatabase, settings: Settings) -> AISetupStatusResponse:
    hardware = hardware_profile()
    runtime = runtime_health(settings, db)
    runtime_infos = list_runtime_infos(db, settings)
    packs = list_model_packs(db, runtime_infos)
    capabilities = list_capabilities(db)

    production_pack = _recommended_production_pack(packs, hardware.recommended_profile)
    demo_pack = next((pack for pack in packs if pack.release_channel == "demo"), None)
    privacy_blockers = _privacy_blockers(capabilities)
    runtime_blockers = _runtime_blockers(runtime)
    production_blockers = production_pack.blocked_reasons if production_pack else ["No production local model pack is registered."]
    can_use_demo = bool(demo_pack and (demo_pack.installable or demo_pack.installed))

    steps = [
        _privacy_step(privacy_blockers),
        AISetupStepInfo(
            id="hardware",
            title="Hardware profile",
            status="done",
            summary=f"{hardware.recommended_profile.title()} profile recommended",
            detail=f"{hardware.os} / {hardware.arch} / {hardware.physical_ram_gb or '?'} GB RAM",
        ),
        _runtime_step(runtime, runtime_blockers, runtime_infos, production_pack),
        _production_pack_step(production_pack),
        _demo_pack_step(demo_pack),
        _capability_routes_step(capabilities, production_pack, demo_pack),
    ]
    blocked_reasons = [*privacy_blockers]
    if production_pack and production_pack.release_status == "blocked":
        blocked_reasons.extend(production_blockers[:4])
    if runtime_blockers:
        blocked_reasons.extend(runtime_blockers)
    blocked_reasons = _dedupe(blocked_reasons)

    overall_status = _overall_status(
        privacy_blockers=privacy_blockers,
        runtime_blockers=runtime_blockers,
        production_pack=production_pack,
        demo_pack=demo_pack,
    )
    return AISetupStatusResponse(
        overall_status=overall_status,
        recommended_profile=hardware.recommended_profile,
        recommended_pack_id=production_pack.id if production_pack else None,
        demo_pack_id=demo_pack.id if demo_pack else None,
        privacy_label="Local only: cloud fallback blocked unless explicitly enabled",
        next_action=_next_action(overall_status, production_pack, demo_pack, runtime_blockers, runtime_infos),
        can_use_demo=can_use_demo,
        blocked_reasons=blocked_reasons,
        steps=steps,
    )


def _recommended_production_pack(packs: list[AIModelPackInfo], profile: str) -> AIModelPackInfo | None:
    production_packs = [pack for pack in packs if pack.release_channel == "production"]
    starter = next((pack for pack in production_packs if pack.id == "starter-local-pack"), None)
    return starter or next((pack for pack in production_packs if pack.profile == profile), None) or next(iter(production_packs), None)


def _privacy_blockers(capabilities: list[Any]) -> list[str]:
    blockers: list[str] = []
    for binding in capabilities:
        provider = PROVIDERS_BY_ID.get(binding.provider_id)
        if provider and provider.locality == "cloud":
            blockers.append(f"{binding.capability} is routed to cloud provider {provider.display_name}.")
        if not binding.local_only:
            blockers.append(f"{binding.capability} has local_only disabled.")
    return blockers


def _runtime_blockers(runtime: dict[str, Any]) -> list[str]:
    blockers: list[str] = []
    llama = runtime.get("llama_cpp", {})
    if llama.get("state") == "not_configured":
        blockers.append("llama.cpp runtime is not configured.")
    voice = runtime.get("voice", {})
    stt_state = voice.get("state")
    tts_state = (voice.get("tts") or {}).get("state")
    if stt_state == "not_configured":
        blockers.append("whisper.cpp runtime is not configured.")
    if tts_state == "not_configured":
        blockers.append("Piper runtime is not configured.")
    return blockers


def _privacy_step(blockers: list[str]) -> AISetupStepInfo:
    return AISetupStepInfo(
        id="privacy",
        title="Privacy mode",
        status="blocked" if blockers else "done",
        summary="Cloud fallback is blocked" if not blockers else "Cloud-capable route needs review",
        detail="Every core AI route is local-only." if not blockers else " ".join(blockers[:2]),
    )


def _runtime_step(
    runtime: dict[str, Any],
    blockers: list[str],
    runtime_infos: list[AIRuntimeInfo],
    production_pack: AIModelPackInfo | None,
) -> AISetupStepInfo:
    llama = runtime.get("llama_cpp", {})
    state = str(llama.get("state", "not_configured"))
    status = "blocked" if blockers else "done"
    production_setup_available = bool(production_pack and (production_pack.installable or production_pack.installed))
    installable_llama = _installable_runtime(runtime_infos, "llama_cpp", release_channel="demo")
    action_label = "Open runtime settings"
    action_route = "settings.ai.runtime"
    action_payload: dict[str, Any] = {}
    if production_setup_available:
        action_label = "Install and test recommended setup"
        action_route = "ai.setup.run"
        action_payload = {"mode": "recommended", "packId": production_pack.id if production_pack else None}
    elif installable_llama and any("llama.cpp runtime is not configured." == blocker for blocker in blockers):
        action_label = "Install starter runtime"
        action_route = "ai.runtimes.install"
        action_payload = {"runtimeId": installable_llama.id}
    return AISetupStepInfo(
        id="runtime",
        title="Local runtimes",
        status=status,
        summary="Runtime repair needed" if blockers else f"llama.cpp state: {state}",
        detail=" ".join(blockers) if blockers else "Managed runtime discovery and verification are wired.",
        action_label=action_label if blockers else None,
        action_route=action_route if blockers else None,
        action_payload=action_payload if blockers else {},
    )


def _production_pack_step(pack: AIModelPackInfo | None) -> AISetupStepInfo:
    if not pack:
        return AISetupStepInfo(
            id="production_pack",
            title="Production pack",
            status="blocked",
            summary="No production pack registered",
            detail="Add Tiny, Standard, or Strong production pack metadata.",
        )
    if pack.installed:
        status = "done"
        action_label = None
    elif pack.installable:
        status = "ready"
        action_label = "Install and test"
    else:
        status = "blocked"
        action_label = None
    return AISetupStepInfo(
        id="production_pack",
        title=f"{pack.profile.title()} production pack",
        status=status,
        summary=pack.release_status.replace("_", " "),
        detail=(pack.blocked_reasons[0] if pack.blocked_reasons else pack.description),
        action_label=action_label,
        action_route="ai.setup.run" if action_label else None,
        action_payload={"mode": "recommended", "packId": pack.id} if action_label else {},
    )


def _demo_pack_step(pack: AIModelPackInfo | None) -> AISetupStepInfo:
    if not pack:
        return AISetupStepInfo(
            id="demo_fallback",
            title="Demo fallback",
            status="optional",
            summary="No demo fixture pack registered",
        )
    if pack.installed:
        status = "done"
        action_label = None
    elif pack.installable:
        status = "ready"
        action_label = "Download demo"
    else:
        status = "optional"
        action_label = None
    return AISetupStepInfo(
        id="demo_fallback",
        title="Demo fallback",
        status=status,
        summary="Fixture pack can exercise the pipeline" if not pack.installed else "Fixture pack installed",
        detail=pack.blocked_reasons[0] if pack.blocked_reasons else pack.description,
        action_label=action_label,
        action_route="ai.modelPacks.download" if action_label else None,
        action_payload={"packId": pack.id} if action_label else {},
    )


def _capability_routes_step(
    capabilities: list[Any],
    production_pack: AIModelPackInfo | None,
    demo_pack: AIModelPackInfo | None,
) -> AISetupStepInfo:
    routed = {binding.capability for binding in capabilities}
    expected = set((production_pack or demo_pack).capabilities if (production_pack or demo_pack) else [])
    missing = sorted(expected - routed)
    return AISetupStepInfo(
        id="capability_routes",
        title="Capability routes",
        status="done" if not missing else "blocked",
        summary=f"{len(routed)} routes configured",
        detail="All pack capabilities have bindings." if not missing else f"Missing bindings: {', '.join(missing)}.",
        action_label="Open routing" if missing else None,
        action_route="settings.routing" if missing else None,
    )


def _overall_status(
    *,
    privacy_blockers: list[str],
    runtime_blockers: list[str],
    production_pack: AIModelPackInfo | None,
    demo_pack: AIModelPackInfo | None,
) -> str:
    if privacy_blockers:
        return "blocked"
    if production_pack and production_pack.installed and not runtime_blockers:
        return "ready"
    if demo_pack and demo_pack.installed:
        return "demo_ready"
    if production_pack and production_pack.installable:
        return "not_started"
    if demo_pack and demo_pack.installable:
        return "not_started"
    return "blocked"


def _next_action(
    overall_status: str,
    production_pack: AIModelPackInfo | None,
    demo_pack: AIModelPackInfo | None,
    runtime_blockers: list[str],
    runtime_infos: list[AIRuntimeInfo],
) -> str:
    if overall_status == "ready":
        return "Local production AI is ready."
    if production_pack and production_pack.installable:
        return f"Install and test {production_pack.display_name}."
    if runtime_blockers and _installable_runtime(runtime_infos, "llama_cpp", release_channel="demo"):
        return "Install the starter llama.cpp runtime to unlock local pipeline testing."
    if demo_pack and demo_pack.installable and not demo_pack.installed:
        return f"Install {demo_pack.display_name} while production packs are blocked."
    if runtime_blockers:
        return runtime_blockers[0]
    if production_pack and production_pack.blocked_reasons:
        return production_pack.blocked_reasons[0]
    return "Review local AI setup blockers."


def _installable_runtime(
    runtime_infos: list[AIRuntimeInfo],
    runtime: str,
    *,
    release_channel: str | None = None,
) -> AIRuntimeInfo | None:
    return next(
        (
            item
            for item in runtime_infos
            if item.runtime == runtime
            and item.installable
            and not item.installed
            and (release_channel is None or item.release_channel == release_channel)
        ),
        None,
    )


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result
