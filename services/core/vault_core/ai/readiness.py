from __future__ import annotations

from collections.abc import Iterable

from vault_core.ai.models.registry import list_model_infos, list_model_packs
from vault_core.ai.models.runtime_installer import list_runtime_infos
from vault_core.ai.routing import PROVIDERS_BY_ID, list_capabilities
from vault_core.ai.setup import ai_setup_status
from vault_core.api.schemas import (
    AIReadinessApprovalItem,
    AIProductionReadinessReport,
    AIReadinessCheck,
    AIReadinessReportSection,
    AIReadinessSummary,
)
from vault_core.config import Settings
from vault_core.db.session import VaultDatabase, now_iso

PRODUCTION_CAPABILITIES = [
    "extract_objects",
    "extract_claims",
    "summarize",
    "generate_note",
    "grounded_answer",
    "create_learning_item",
    "embed_text",
    "transcribe_audio",
    "synthesize_speech",
]

OPTIONAL_PRODUCTION_CAPABILITIES = {"rerank_results"}


def ai_production_readiness_report(db: VaultDatabase, settings: Settings) -> AIProductionReadinessReport:
    setup = ai_setup_status(db, settings)
    runtimes = list_runtime_infos(db, settings)
    packs = list_model_packs(db, runtimes)
    models = list_model_infos(db)
    capabilities = list_capabilities(db)

    production_packs = [pack for pack in packs if pack.release_channel == "production"]
    production_runtimes = [runtime for runtime in runtimes if runtime.release_channel == "production"]
    sections = [
        _production_pack_section(production_packs),
        _production_runtime_section(production_runtimes),
        _privacy_section(capabilities),
        _capability_route_section(capabilities, {model.id: model for model in models}),
    ]

    all_checks = [check for section in sections for check in section.checks]
    blocked_count = sum(1 for check in all_checks if check.status == "blocked")
    warn_count = sum(1 for check in all_checks if check.status == "warn")
    ready_pack_count = sum(1 for pack in production_packs if pack.release_status in {"ready", "installed"})
    ready_runtime_count = sum(1 for runtime in production_runtimes if not runtime.blocked_reasons)
    status = "blocked" if blocked_count else "warn" if warn_count else "ready"

    return AIProductionReadinessReport(
        generated_at=now_iso(),
        status=status,
        production_ready=status == "ready" and ready_pack_count > 0,
        demo_available=setup.can_use_demo,
        recommended_profile=setup.recommended_profile,
        recommended_pack_id=setup.recommended_pack_id,
        summary=AIReadinessSummary(
            total_checks=len(all_checks),
            pass_count=sum(1 for check in all_checks if check.status == "pass"),
            warn_count=warn_count,
            pending_count=sum(1 for check in all_checks if check.status == "pending"),
            blocked_count=blocked_count,
            production_pack_count=len(production_packs),
            ready_production_pack_count=ready_pack_count,
            production_runtime_count=len(production_runtimes),
            ready_production_runtime_count=ready_runtime_count,
        ),
        sections=sections,
        next_actions=_next_actions(all_checks),
        approval_items=_approval_items(sections),
    )


def format_production_readiness_report(
    report: AIProductionReadinessReport,
    *,
    output_format: str,
    allow_demo: bool = False,
) -> str:
    if output_format == "markdown":
        return format_production_readiness_markdown(report, allow_demo=allow_demo)
    return format_production_readiness_text(report, allow_demo=allow_demo)


def format_production_readiness_text(
    report: AIProductionReadinessReport,
    *,
    allow_demo: bool = False,
) -> str:
    lines = [
        f"Local AI readiness: {report.status}",
        f"Production ready: {_yes_no(report.production_ready)}",
        f"Demo fallback: {_yes_no(report.demo_available)}",
        f"Gate mode: {'demo allowed' if allow_demo else 'strict production'}",
        f"Recommended profile: {report.recommended_profile}",
        f"Recommended pack: {report.recommended_pack_id}",
        (
            "Checks: "
            f"{report.summary.total_checks} total / "
            f"{report.summary.pass_count} pass / "
            f"{report.summary.warn_count} warn / "
            f"{report.summary.pending_count} pending / "
            f"{report.summary.blocked_count} blocked"
        ),
        (
            "Production packs: "
            f"{report.summary.ready_production_pack_count}/"
            f"{report.summary.production_pack_count} ready"
        ),
        (
            "Production runtimes: "
            f"{report.summary.ready_production_runtime_count}/"
            f"{report.summary.production_runtime_count} ready"
        ),
        "",
        "Sections:",
    ]
    for section in report.sections:
        lines.append(f"- {section.title}: {section.status} ({section.blocked_count} blockers)")

    if report.approval_items:
        lines.extend(["", "Approval board:"])
        for item in _visible_approval_items(report.approval_items, limit=8):
            lines.append(f"- {item.title}: {item.blocker_count} blockers")
            lines.append(f"  {item.next_action}")

    if report.next_actions:
        lines.extend(["", "Next release gates:"])
        lines.extend(f"- {action}" for action in report.next_actions)

    return "\n".join(lines)


def format_production_readiness_markdown(
    report: AIProductionReadinessReport,
    *,
    allow_demo: bool = False,
) -> str:
    lines = [
        "# Local AI Production Readiness",
        "",
        f"- Generated: `{report.generated_at}`",
        f"- Status: **{report.status}**",
        f"- Production ready: **{_yes_no(report.production_ready)}**",
        f"- Demo fallback: **{_yes_no(report.demo_available)}**",
        f"- Gate mode: **{'demo allowed' if allow_demo else 'strict production'}**",
        f"- Recommended profile: **{report.recommended_profile}**",
        f"- Recommended pack: **{report.recommended_pack_id or 'none'}**",
        "",
        "## Summary",
        "",
        "| Metric | Value |",
        "| --- | ---: |",
        f"| Total checks | {report.summary.total_checks} |",
        f"| Passed | {report.summary.pass_count} |",
        f"| Warnings | {report.summary.warn_count} |",
        f"| Pending | {report.summary.pending_count} |",
        f"| Blocked | {report.summary.blocked_count} |",
        f"| Production packs ready | {report.summary.ready_production_pack_count}/{report.summary.production_pack_count} |",
        (
            "| Production runtimes ready | "
            f"{report.summary.ready_production_runtime_count}/{report.summary.production_runtime_count} |"
        ),
        "",
        "## Approval Board",
        "",
    ]
    if report.approval_items:
        for item in report.approval_items:
            lines.extend(
                [
                    f"- [ ] **{item.title}** ({item.blocker_count} blockers)",
                    f"  - Category: {_approval_category_label(item.category)}",
                    f"  - Action: {item.next_action}",
                ]
            )
            if item.sample_details:
                lines.append("  - Samples:")
                lines.extend(f"    - {detail}" for detail in item.sample_details)
            if item.check_ids:
                lines.append("  - Checks:")
                lines.extend(f"    - `{check_id}`" for check_id in item.check_ids[:8])
                if len(item.check_ids) > 8:
                    lines.append(f"    - ...and {len(item.check_ids) - 8} more")
    else:
        lines.append("- [x] No grouped approval blockers.")

    lines.extend(["", "## Readiness Sections", ""])
    for section in report.sections:
        lines.extend(
            [
                f"### {section.title}",
                "",
                f"- Status: **{section.status}**",
                f"- Blockers: **{section.blocked_count}**",
                f"- Summary: {section.summary}",
                "",
            ]
        )
        if section.checks:
            for check in section.checks:
                checkbox = "[x]" if check.status == "pass" else "[ ]"
                lines.append(f"- {checkbox} `{check.id}` **{check.label}** - {check.detail}")
                if check.action:
                    lines.append(f"  - Action: {check.action}")
        else:
            lines.append("- [x] No checks registered.")
        lines.append("")

    lines.extend(["## Next Release Gates", ""])
    if report.next_actions:
        lines.extend(f"- [ ] {action}" for action in report.next_actions)
    else:
        lines.append("- [x] No next release gates.")
    return "\n".join(lines).rstrip()


def _production_pack_section(packs: list) -> AIReadinessReportSection:
    checks: list[AIReadinessCheck] = []
    for pack in packs:
        if pack.release_status in {"ready", "installed"} and not pack.readiness_checks:
            checks.append(
                AIReadinessCheck(
                    id=f"{pack.id}:release",
                    label=f"{pack.display_name} release",
                    status="pass",
                    detail=f"{pack.display_name} is release-ready.",
                )
            )
        checks.extend(
            check.model_copy(update={"id": f"pack:{check.id}", "label": f"{pack.display_name} / {check.label}"})
            for check in pack.readiness_checks
        )
    return _section(
        "production-packs",
        "Production model packs",
        checks,
        empty_summary="No production model packs are registered.",
        ready_summary="Production model packs have release-ready metadata.",
        blocked_summary="Production model packs still have release blockers.",
    )


def _production_runtime_section(runtimes: list) -> AIReadinessReportSection:
    checks: list[AIReadinessCheck] = []
    for runtime in runtimes:
        checks.extend(
            check.model_copy(update={"id": f"runtime:{check.id}", "label": f"{runtime.display_name} / {check.label}"})
            for check in runtime.readiness_checks
        )
        if runtime.integrity_error:
            checks.append(
                AIReadinessCheck(
                    id=f"runtime:{runtime.id}:integrity",
                    label=f"{runtime.display_name} / Integrity",
                    status="blocked",
                    detail=runtime.integrity_error,
                    action="Repair, reinstall, or delete the managed runtime before release.",
                )
            )
    return _section(
        "production-runtimes",
        "Production runtimes",
        checks,
        empty_summary="No production runtime manifests are registered.",
        ready_summary="Production runtime manifests are pinned and approved.",
        blocked_summary="Production runtime manifests still have release blockers.",
    )


def _privacy_section(capabilities: list) -> AIReadinessReportSection:
    cloud_routes = [
        binding
        for binding in capabilities
        if not binding.local_only or PROVIDERS_BY_ID.get(binding.provider_id, None)
        and PROVIDERS_BY_ID[binding.provider_id].locality == "cloud"
    ]
    if cloud_routes:
        checks = [
            AIReadinessCheck(
                id=f"privacy:{binding.capability}",
                label=f"{binding.capability} privacy",
                status="blocked",
                detail=_privacy_detail(binding),
                action="Keep production routes local-only unless the user explicitly enables cloud for that action.",
            )
            for binding in cloud_routes
        ]
    else:
        checks = [
            AIReadinessCheck(
                id="privacy:local-only",
                label="Local-only default",
                status="pass",
                detail="All configured AI routes are local-only.",
            )
        ]
    return _section(
        "privacy-boundary",
        "Privacy boundary",
        checks,
        empty_summary="No AI routes are configured.",
        ready_summary="Cloud fallback is blocked by default.",
        blocked_summary="One or more routes can send data off-device.",
    )


def _privacy_detail(binding: object) -> str:
    provider = PROVIDERS_BY_ID.get(getattr(binding, "provider_id", ""))
    if provider and provider.locality == "cloud":
        return f"{getattr(binding, 'capability')} is routed to cloud provider {provider.display_name}."
    return f"{getattr(binding, 'capability')} may leave the device."


def _capability_route_section(capabilities: list, models_by_id: dict) -> AIReadinessReportSection:
    by_capability = {binding.capability: binding for binding in capabilities}
    checks: list[AIReadinessCheck] = []
    for capability in [*PRODUCTION_CAPABILITIES, *sorted(OPTIONAL_PRODUCTION_CAPABILITIES)]:
        binding = by_capability.get(capability)
        optional = capability in OPTIONAL_PRODUCTION_CAPABILITIES
        label = f"{capability} route"
        if binding is None:
            checks.append(
                AIReadinessCheck(
                    id=f"capability:{capability}",
                    label=label,
                    status="warn" if optional else "blocked",
                    detail=f"{capability} is not configured.",
                    action="Configure a local provider and model for this capability.",
                )
            )
            continue
        provider = PROVIDERS_BY_ID.get(binding.provider_id)
        if provider is None:
            checks.append(
                AIReadinessCheck(
                    id=f"capability:{capability}",
                    label=label,
                    status="warn" if optional else "blocked",
                    detail=f"{capability} uses unknown provider {binding.provider_id}.",
                    action="Select an approved local provider for this capability.",
                )
            )
            continue
        if not binding.local_only:
            checks.append(
                AIReadinessCheck(
                    id=f"capability:{capability}",
                    label=label,
                    status="warn" if optional else "blocked",
                    detail=f"{capability} has local_only disabled.",
                    action="Keep production routes local-only unless the user explicitly enables cloud for that action.",
                )
            )
            continue
        if provider.locality == "cloud":
            checks.append(
                AIReadinessCheck(
                    id=f"capability:{capability}",
                    label=label,
                    status="warn" if optional else "blocked",
                    detail=f"{capability} is routed to cloud provider {provider.display_name}.",
                    action="Route this capability to an approved local production model before release.",
                )
            )
            continue
        if binding.provider_id.startswith("mock_"):
            checks.append(
                AIReadinessCheck(
                    id=f"capability:{capability}",
                    label=label,
                    status="warn" if optional else "blocked",
                    detail=f"{capability} still uses the {binding.provider_id} demo provider.",
                    action="Route this capability to an approved local production model before release.",
                )
            )
            continue
        if not binding.model_id:
            checks.append(
                AIReadinessCheck(
                    id=f"capability:{capability}",
                    label=label,
                    status="warn" if optional else "blocked",
                    detail=f"{capability} has no selected model.",
                    action="Select a tested local model for this capability.",
                )
            )
            continue
        model_check = _production_route_model_check(capability, binding, provider, models_by_id)
        if model_check:
            checks.append(model_check.model_copy(update={"status": "warn" if optional else model_check.status}))
            continue
        checks.append(
            AIReadinessCheck(
                id=f"capability:{capability}",
                label=label,
                status="pass",
                detail=f"{capability} routes to approved local model {binding.provider_id} / {binding.model_id}.",
            )
        )
    return _section(
        "capability-routes",
        "Capability routes",
        checks,
        empty_summary="No production capability routes are configured.",
        ready_summary="Required production capabilities are mapped to local providers.",
        blocked_summary="Required production capabilities are not fully mapped to approved local models.",
    )


def _production_route_model_check(capability: str, binding: object, provider: object, models_by_id: dict) -> AIReadinessCheck | None:
    model_id = getattr(binding, "model_id", None)
    model = models_by_id.get(model_id)
    label = f"{capability} route"
    if model is None:
        return AIReadinessCheck(
            id=f"capability:{capability}",
            label=label,
            status="blocked",
            detail=f"{capability} selected model {model_id} is not in the approved model inventory.",
            action="Select an installed model from the app-pinned production registry.",
        )
    expected_kind = _expected_model_kind(capability)
    if expected_kind and model.kind != expected_kind:
        return AIReadinessCheck(
            id=f"capability:{capability}",
            label=label,
            status="blocked",
            detail=f"{capability} expects a {expected_kind} model but {model.id} is {model.kind}.",
            action="Select a model whose kind matches this production capability.",
        )
    provider_kind = getattr(provider, "kind", None)
    if expected_kind and provider_kind != expected_kind:
        return AIReadinessCheck(
            id=f"capability:{capability}",
            label=label,
            status="blocked",
            detail=f"{capability} uses {provider_kind} provider {getattr(provider, 'display_name', getattr(binding, 'provider_id', 'unknown'))}, expected {expected_kind}.",
            action="Select an approved local provider that matches this capability.",
        )
    if not model.installed:
        return AIReadinessCheck(
            id=f"capability:{capability}",
            label=label,
            status="blocked",
            detail=f"{capability} selected model {model.id} is not installed.",
            action="Install and verify the approved production model before routing this capability.",
        )
    if model.source_type in {"local_fixture"} or str(model.trust_level or "").startswith("fixture"):
        return AIReadinessCheck(
            id=f"capability:{capability}",
            label=label,
            status="blocked",
            detail=f"{capability} selected model {model.id} is a demo fixture.",
            action="Route this capability to an approved production model, not a fixture.",
        )
    if model.source_type in {"local_import", "installed"} or str(model.trust_level or "").startswith("manual_import"):
        return AIReadinessCheck(
            id=f"capability:{capability}",
            label=label,
            status="blocked",
            detail=f"{capability} selected model {model.id} is a manual import, not an app-approved production model.",
            action="Add this model to the app-pinned production registry with source, license, checksum, and size approvals.",
        )
    if model.runtime in {"llama_cpp", "local_embedding", "local_cross_encoder", "whisper_cpp", "piper"} and not model.runtime_tested:
        return AIReadinessCheck(
            id=f"capability:{capability}",
            label=label,
            status="blocked",
            detail=f"{capability} selected model {model.id} has not passed a local runtime test.",
            action="Run the model through the setup runner or model test before production routing.",
        )
    return None


def _expected_model_kind(capability: str) -> str | None:
    if capability in {"extract_objects", "extract_claims", "summarize", "generate_note", "grounded_answer", "create_learning_item"}:
        return "llm"
    if capability == "embed_text":
        return "embedding"
    if capability == "rerank_results":
        return "reranker"
    if capability == "transcribe_audio":
        return "stt"
    if capability == "synthesize_speech":
        return "tts"
    return None


def _section(
    section_id: str,
    title: str,
    checks: list[AIReadinessCheck],
    *,
    empty_summary: str,
    ready_summary: str,
    blocked_summary: str,
) -> AIReadinessReportSection:
    blocked_count = sum(1 for check in checks if check.status == "blocked")
    status = _section_status(checks)
    summary = empty_summary if not checks else blocked_summary if blocked_count else ready_summary
    return AIReadinessReportSection(
        id=section_id,
        title=title,
        status=status,
        summary=summary,
        blocked_count=blocked_count,
        checks=checks,
    )


def _section_status(checks: list[AIReadinessCheck]) -> str:
    if any(check.status == "blocked" for check in checks):
        return "blocked"
    if any(check.status == "pending" for check in checks):
        return "pending"
    if any(check.status == "warn" for check in checks):
        return "warn"
    return "ready"


def _next_actions(checks: Iterable[AIReadinessCheck]) -> list[str]:
    actions: list[str] = []
    seen: set[str] = set()
    for check in checks:
        if check.status != "blocked":
            continue
        action = check.action or check.detail
        if action in seen:
            continue
        seen.add(action)
        actions.append(action)
        if len(actions) >= 8:
            break
    return actions


def _approval_items(sections: list[AIReadinessReportSection]) -> list[AIReadinessApprovalItem]:
    grouped: dict[tuple[str, str], list[AIReadinessCheck]] = {}
    category_by_section = {
        "production-packs": "model_pack",
        "production-runtimes": "runtime",
        "privacy-boundary": "privacy",
        "capability-routes": "capability_route",
    }
    for section in sections:
        category = category_by_section.get(section.id)
        if not category:
            continue
        for check in section.checks:
            if check.status != "blocked":
                continue
            action = check.action or check.detail
            grouped.setdefault((category, action), []).append(check)

    items: list[AIReadinessApprovalItem] = []
    for (category, action), checks in grouped.items():
        slug = _approval_slug(action)
        items.append(
            AIReadinessApprovalItem(
                id=f"{category}:{slug}",
                category=category,  # type: ignore[arg-type]
                title=_approval_title(category, action),
                blocker_count=len(checks),
                next_action=action,
                check_ids=[check.id for check in checks],
                sample_details=_dedupe([check.detail for check in checks])[:3],
            )
        )
    return sorted(items, key=lambda item: (-item.blocker_count, item.category, item.title))


def _visible_approval_items(items: list[AIReadinessApprovalItem], *, limit: int) -> list[AIReadinessApprovalItem]:
    if len(items) <= limit:
        return items
    selected = list(items[:limit])
    selected_categories = {item.category for item in selected}
    for item in items[limit:]:
        if item.category in selected_categories:
            continue
        replace_index = _least_costly_replacement_index(selected)
        selected[replace_index] = item
        selected_categories.add(item.category)
    return sorted(selected, key=lambda item: (-item.blocker_count, item.category, item.title))


def _least_costly_replacement_index(items: list[AIReadinessApprovalItem]) -> int:
    category_counts: dict[str, int] = {}
    for item in items:
        category_counts[item.category] = category_counts.get(item.category, 0) + 1
    replaceable = [index for index, item in enumerate(items) if category_counts[item.category] > 1]
    candidates = replaceable or list(range(len(items)))
    lowest_blocker_count = min(items[index].blocker_count for index in candidates)
    lowest_priority_candidates = [index for index in candidates if items[index].blocker_count == lowest_blocker_count]
    return max(lowest_priority_candidates, key=lambda index: items[index].title)


def _approval_title(category: str, action: str) -> str:
    normalized = action.lower()
    if category == "model_pack":
        if "approval.status" in normalized or "record reviewer" in normalized:
            return "Record production model approval evidence"
        if normalized.startswith("approve sources, filenames, checksums"):
            return "Approve production model downloads"
        if normalized.startswith("approve runtime manifests"):
            return "Approve managed runtimes for packs"
        if "license url" in normalized or "license text path" in normalized or "license artifact" in normalized:
            return "Pin production model license artifacts"
        if "checksum" in normalized:
            return "Pin production model checksums"
        if "license" in normalized:
            return "Approve production model licenses"
        if "source" in normalized or "repository" in normalized:
            return "Approve production model sources"
        if "size" in normalized:
            return "Record production model sizes"
        if "filename" in normalized or "artifact" in normalized:
            return "Approve production model artifacts"
        if "runtime" in normalized:
            return "Approve managed runtimes for packs"
        return "Approve production model packs"
    if category == "runtime":
        if "approval.status" in normalized or "record reviewer" in normalized:
            return "Record production runtime approval evidence"
        if "checksum" in normalized:
            return "Pin production runtime checksums"
        if "license url" in normalized or "license text path" in normalized or "license artifact" in normalized:
            return "Pin production runtime license artifacts"
        if "license" in normalized:
            return "Approve production runtime licenses"
        if "source" in normalized or "url" in normalized:
            return "Approve production runtime sources"
        if "size" in normalized:
            return "Record production runtime sizes"
        return "Approve production runtimes"
    if category == "privacy":
        return "Keep production routes local-only"
    return "Route production capabilities"


def _approval_slug(action: str) -> str:
    slug = "".join(char.lower() if char.isalnum() else "-" for char in action)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")[:72] or "approval"


def _approval_category_label(category: str) -> str:
    labels = {
        "model_pack": "Model pack",
        "runtime": "Runtime",
        "privacy": "Privacy",
        "capability_route": "Capability route",
    }
    return labels.get(category, category)


def _yes_no(value: bool) -> str:
    return "yes" if value else "no"


def _dedupe(values: Iterable[str]) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        unique.append(value)
    return unique
