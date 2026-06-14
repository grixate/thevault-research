from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from vault_core.ai.models.registry import load_model_registry, model_pack_contract_checks, registry_model_readiness_checks
from vault_core.ai.models.runtime_installer import load_runtime_registry, runtime_readiness_checks
from vault_core.ai.models.validation import current_registry_policy, validate_ai_registries
from vault_core.api.schemas import AIReadinessCheck

LOCAL_RUNTIME_NAMES = {"llama_cpp", "whisper_cpp", "piper"}
APP_MANAGED_RUNTIME_NAMES = {"local_embedding", "local_cross_encoder"}


def load_registry_json(path: Path) -> dict[str, Any]:
    return json.loads(path.expanduser().read_text(encoding="utf-8"))


def registry_file_sha256(path: Path) -> str:
    return hashlib.sha256(path.expanduser().read_bytes()).hexdigest()


def build_registry_pin_preview(
    *,
    model_registry: dict[str, Any] | None = None,
    runtime_registry: dict[str, Any] | None = None,
    model_registry_sha256: str | None = None,
    runtime_registry_sha256: str | None = None,
) -> dict[str, Any] | None:
    policy = current_registry_policy()
    previews = []
    if model_registry is not None:
        previews.append(
            _registry_preview(
                "model_registry",
                "model_registry.json",
                policy["registries"]["model_registry"]["sha256"],
                model_registry,
                load_model_registry(),
                model_registry_sha256,
                [("model", "models"), ("model_pack", "model_packs")],
            )
        )
    if runtime_registry is not None:
        previews.append(
            _registry_preview(
                "runtime_registry",
                "runtime_registry.json",
                policy["registries"]["runtime_registry"]["sha256"],
                runtime_registry,
                load_runtime_registry(),
                runtime_registry_sha256,
                [("runtime", "runtimes")],
            )
        )
    if not previews:
        return None
    return {
        "registries": previews,
        "total_added": sum(preview["total_added"] for preview in previews),
        "total_changed": sum(preview["total_changed"] for preview in previews),
        "total_removed": sum(preview["total_removed"] for preview in previews),
    }


def build_ai_registry_release_plan(
    model_registry: dict[str, Any] | None = None,
    runtime_registry: dict[str, Any] | None = None,
    *,
    root: Path | None = None,
) -> dict[str, Any]:
    model_registry = model_registry if model_registry is not None else load_model_registry()
    runtime_registry = runtime_registry if runtime_registry is not None else load_runtime_registry()
    validation = validate_ai_registries(model_registry, runtime_registry, root=root)

    production_model_ids = _production_model_ids(model_registry)
    model_artifacts = _model_artifacts(model_registry, production_model_ids)
    runtime_artifacts = _runtime_artifacts(runtime_registry)
    pack_artifacts = _pack_artifacts(model_registry, model_artifacts, runtime_artifacts)
    artifacts = [*pack_artifacts, *model_artifacts, *runtime_artifacts]
    all_checks = [
        check
        for artifact in artifacts
        for check in artifact["readiness_checks"]
    ]
    blocked_count = sum(1 for check in all_checks if check["status"] == "blocked")
    warn_count = sum(1 for check in all_checks if check["status"] == "warn")
    validation_warnings = len(validation["warnings"])
    ready_to_pin = (
        validation["status"] == "pass"
        and validation_warnings == 0
        and blocked_count == 0
        and warn_count == 0
        and bool(pack_artifacts)
    )

    summary = {
        "status": "ready_to_pin" if ready_to_pin else "blocked",
        "ready_to_pin": ready_to_pin,
        "total_checks": len(all_checks),
        "blocked_count": blocked_count,
        "artifact_warning_count": warn_count,
        "warning_count": warn_count + validation_warnings,
        "validation_error_count": len(validation["errors"]),
        "validation_warning_count": validation_warnings,
        "production_pack_count": len(pack_artifacts),
        "ready_production_pack_count": _ready_count(pack_artifacts),
        "production_model_count": len(model_artifacts),
        "ready_production_model_count": _ready_count(model_artifacts),
        "production_runtime_count": len(runtime_artifacts),
        "ready_production_runtime_count": _ready_count(runtime_artifacts),
    }
    return {
        "status": summary["status"],
        "summary": summary,
        "validation": validation,
        "artifacts": artifacts,
        "promotion_stages": _promotion_stages(summary, validation),
        "next_actions": _next_actions(all_checks, validation),
    }


def format_release_plan_text(plan: dict[str, Any]) -> str:
    summary = plan["summary"]
    lines = [
        f"AI registry release plan: {plan['status']}",
        (
            "Structural validation: "
            f"{plan['validation']['status']} "
            f"({summary['validation_error_count']} errors, {summary['validation_warning_count']} warnings)"
        ),
        (
            "Checks: "
            f"{summary['total_checks']} total / "
            f"{summary['blocked_count']} blocked / "
            f"{summary['artifact_warning_count']} check warnings"
        ),
        (
            "Production packs: "
            f"{summary['ready_production_pack_count']}/{summary['production_pack_count']} ready"
        ),
        (
            "Production models: "
            f"{summary['ready_production_model_count']}/{summary['production_model_count']} ready"
        ),
        (
            "Production runtimes: "
            f"{summary['ready_production_runtime_count']}/{summary['production_runtime_count']} ready"
        ),
    ]
    pin_preview = plan.get("pin_preview")
    if pin_preview:
        lines.extend(["", "Pin preview:"])
        for registry in pin_preview["registries"]:
            lines.append(
                f"- {registry['registry']}: {registry['candidate_sha256']} "
                f"({registry['total_added']} added / {registry['total_changed']} changed / {registry['total_removed']} removed)"
            )
    if plan["next_actions"]:
        lines.extend(["", "Next actions:"])
        lines.extend(f"- {action}" for action in plan["next_actions"])
    return "\n".join(lines)


def format_release_plan_markdown(
    plan: dict[str, Any],
    *,
    model_registry_label: str | None = None,
    runtime_registry_label: str | None = None,
) -> str:
    summary = plan["summary"]
    lines = [
        "# AI Registry Release Plan",
        "",
        f"- Status: **{plan['status']}**",
        f"- Ready to pin: **{'yes' if summary['ready_to_pin'] else 'no'}**",
        f"- Structural validation: **{plan['validation']['status']}**",
        "",
    ]
    source_lines = []
    if model_registry_label:
        source_lines.append(f"- Model registry: `{model_registry_label}`")
    if runtime_registry_label:
        source_lines.append(f"- Runtime registry: `{runtime_registry_label}`")
    if source_lines:
        lines.extend(["## Sources", "", *source_lines, ""])
    pin_preview = plan.get("pin_preview")
    if pin_preview:
        lines.extend(
            [
                "## Pin Preview",
                "",
                "| Registry | Candidate SHA-256 | Added | Changed | Removed |",
                "| --- | --- | ---: | ---: | ---: |",
            ]
        )
        for registry in pin_preview["registries"]:
            lines.append(
                f"| `{registry['registry']}` | `{registry['candidate_sha256']}` | "
                f"{registry['total_added']} | {registry['total_changed']} | {registry['total_removed']} |"
            )
        lines.append("")
        for registry in pin_preview["registries"]:
            for change_set in registry["changes"]:
                if not change_set["added"] and not change_set["changed"] and not change_set["removed"]:
                    continue
                lines.extend([f"### {change_set['artifact_type'].replace('_', ' ').title()} Changes", ""])
                if change_set["added"]:
                    lines.append(f"- Added: {', '.join(f'`{item}`' for item in change_set['added'])}")
                if change_set["changed"]:
                    lines.append(f"- Changed: {', '.join(f'`{item}`' for item in change_set['changed'])}")
                if change_set["removed"]:
                    lines.append(f"- Removed: {', '.join(f'`{item}`' for item in change_set['removed'])}")
                lines.append("")
    lines.extend(
        [
            "## Summary",
            "",
            "| Metric | Value |",
            "| --- | ---: |",
            f"| Total checks | {summary['total_checks']} |",
            f"| Blocked checks | {summary['blocked_count']} |",
            f"| Check warnings | {summary['artifact_warning_count']} |",
            f"| Total warnings | {summary['warning_count']} |",
            f"| Validation errors | {summary['validation_error_count']} |",
            f"| Validation warnings | {summary['validation_warning_count']} |",
            f"| Production packs ready | {summary['ready_production_pack_count']}/{summary['production_pack_count']} |",
            f"| Production models ready | {summary['ready_production_model_count']}/{summary['production_model_count']} |",
            f"| Production runtimes ready | {summary['ready_production_runtime_count']}/{summary['production_runtime_count']} |",
            "",
            "## Promotion Pipeline",
            "",
            "| Stage | Status | Detail | Action |",
            "| --- | --- | --- | --- |",
        ]
    )
    for stage in plan.get("promotion_stages", []):
        lines.append(
            f"| {stage['title']} | `{stage['status']}` | "
            f"{stage['detail']} | {stage['action']} |"
        )
    lines.extend(
        [
            "",
            "## Artifacts",
            "",
        ]
    )
    if not plan["artifacts"]:
        lines.append("- No production artifacts found.")
    for artifact in plan["artifacts"]:
        lines.extend(
            [
                f"### {artifact['display_name']}",
                "",
                f"- Type: `{artifact['type']}`",
                f"- ID: `{artifact['id']}`",
                f"- Status: **{artifact['status']}**",
                f"- Blockers: **{artifact['blocked_count']}**",
                "",
            ]
        )
        for check in artifact["readiness_checks"]:
            checkbox = "[x]" if check["status"] == "pass" else "[ ]"
            lines.append(f"- {checkbox} `{check['id']}` **{check['label']}** - {check['detail']}")
            if check.get("action"):
                lines.append(f"  - Action: {check['action']}")
        lines.append("")
    lines.extend(["## Next Actions", ""])
    if plan["next_actions"]:
        lines.extend(f"- [ ] {action}" for action in plan["next_actions"])
    else:
        lines.append("- [x] Ready to pin approved registries.")
    return "\n".join(lines).rstrip()


def _registry_preview(
    registry_id: str,
    path: str,
    current_sha256: str,
    candidate_registry: dict[str, Any],
    current_registry: dict[str, Any],
    candidate_sha256: str | None,
    sections: list[tuple[str, str]],
) -> dict[str, Any]:
    changes = [
        _registry_change_set(artifact_type, section_key, candidate_registry, current_registry)
        for artifact_type, section_key in sections
    ]
    digest = candidate_sha256 or _canonical_registry_sha256(candidate_registry)
    return {
        "registry": registry_id,
        "path": path,
        "current_sha256": current_sha256,
        "candidate_sha256": digest,
        "changed": digest != current_sha256
        or any(change["added"] or change["changed"] or change["removed"] for change in changes),
        "total_added": sum(len(change["added"]) for change in changes),
        "total_changed": sum(len(change["changed"]) for change in changes),
        "total_removed": sum(len(change["removed"]) for change in changes),
        "changes": changes,
    }


def _registry_change_set(
    artifact_type: str,
    section_key: str,
    candidate_registry: dict[str, Any],
    current_registry: dict[str, Any],
) -> dict[str, Any]:
    candidate = _items_by_id(candidate_registry.get(section_key))
    current = _items_by_id(current_registry.get(section_key))
    candidate_ids = set(candidate)
    current_ids = set(current)
    shared_ids = candidate_ids & current_ids
    return {
        "artifact_type": artifact_type,
        "added": sorted(candidate_ids - current_ids),
        "changed": sorted(
            item_id
            for item_id in shared_ids
            if _canonical_json(candidate[item_id]) != _canonical_json(current[item_id])
        ),
        "removed": sorted(current_ids - candidate_ids),
        "unchanged": sorted(
            item_id
            for item_id in shared_ids
            if _canonical_json(candidate[item_id]) == _canonical_json(current[item_id])
        ),
    }


def _items_by_id(items: Any) -> dict[str, dict[str, Any]]:
    return {
        str(item["id"]): item
        for item in _as_list(items)
        if isinstance(item, dict) and item.get("id")
    }


def _canonical_registry_sha256(registry: dict[str, Any]) -> str:
    return hashlib.sha256(_canonical_json(registry).encode("utf-8")).hexdigest()


def _canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _model_artifacts(registry: dict[str, Any], production_model_ids: list[str]) -> list[dict[str, Any]]:
    models_by_id = {model.get("id"): model for model in _as_list(registry.get("models")) if isinstance(model, dict)}
    artifacts: list[dict[str, Any]] = []
    for model_id in production_model_ids:
        model = models_by_id.get(model_id)
        if not model:
            checks = [
                AIReadinessCheck(
                    id=f"{model_id}:registry",
                    label="Registry entry",
                    status="blocked",
                    detail=f"Production model {model_id} is missing from the registry.",
                    action="Add the model entry to the app-pinned registry.",
                )
            ]
            artifacts.append(_artifact("model", model_id, model_id, checks))
            continue
        artifacts.append(
            _artifact(
                "model",
                str(model["id"]),
                str(model.get("display_name") or model["id"]),
                registry_model_readiness_checks(model),
            )
        )
    return artifacts


def _runtime_artifacts(registry: dict[str, Any]) -> list[dict[str, Any]]:
    artifacts: list[dict[str, Any]] = []
    for runtime in _as_list(registry.get("runtimes")):
        if not isinstance(runtime, dict) or runtime.get("release_channel") != "production":
            continue
        runtime_id = str(runtime.get("id") or "<missing-runtime>")
        artifacts.append(
            _artifact(
                "runtime",
                runtime_id,
                str(runtime.get("display_name") or runtime_id),
                runtime_readiness_checks(runtime),
                runtime_name=str(runtime.get("runtime") or ""),
            )
        )
    return artifacts


def _pack_artifacts(
    model_registry: dict[str, Any],
    model_artifacts: list[dict[str, Any]],
    runtime_artifacts: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    model_status = {artifact["id"]: artifact["status"] for artifact in model_artifacts}
    runtime_status_by_name: dict[str, list[str]] = {}
    for artifact in runtime_artifacts:
        runtime_status_by_name.setdefault(artifact.get("runtime_name") or "", []).append(artifact["status"])
    models_by_id = {model.get("id"): model for model in _as_list(model_registry.get("models")) if isinstance(model, dict)}
    artifacts: list[dict[str, Any]] = []
    for pack in _as_list(model_registry.get("model_packs")):
        if not isinstance(pack, dict) or pack.get("release_channel") != "production":
            continue
        pack_id = str(pack.get("id") or "<missing-pack>")
        required_model_ids = [str(model_id) for model_id in _as_list(pack.get("required_model_ids"))]
        checks: list[AIReadinessCheck] = [*model_pack_contract_checks(pack, models_by_id)]
        missing_or_blocked_models = [
            model_id
            for model_id in required_model_ids
            if model_status.get(model_id) != "ready"
        ]
        if missing_or_blocked_models:
            checks.append(
                AIReadinessCheck(
                    id=f"{pack_id}:required-models",
                    label="Required models",
                    status="blocked",
                    detail=f"Required production models are not release-ready: {', '.join(missing_or_blocked_models)}.",
                    action="Resolve source, checksum, size, license, runtime, and approval blockers for required models.",
                )
            )
        else:
            checks.append(
                AIReadinessCheck(
                    id=f"{pack_id}:required-models",
                    label="Required models",
                    status="pass",
                    detail="Every required model is release-ready.",
                )
            )
        runtime_names = sorted(
            {
                str((models_by_id.get(model_id) or {}).get("runtime") or "")
                for model_id in required_model_ids
            }
            & (LOCAL_RUNTIME_NAMES - APP_MANAGED_RUNTIME_NAMES)
        )
        blocked_runtime_names = [
            runtime_name
            for runtime_name in runtime_names
            if "ready" not in runtime_status_by_name.get(runtime_name, [])
        ]
        if blocked_runtime_names:
            checks.append(
                AIReadinessCheck(
                    id=f"{pack_id}:managed-runtimes",
                    label="Managed runtimes",
                    status="blocked",
                    detail=f"Managed runtime manifests are not release-ready: {', '.join(blocked_runtime_names)}.",
                    action="Resolve source, checksum, size, license, and approval blockers for required runtimes.",
                )
            )
        elif runtime_names:
            checks.append(
                AIReadinessCheck(
                    id=f"{pack_id}:managed-runtimes",
                    label="Managed runtimes",
                    status="pass",
                    detail=f"Managed runtimes are release-ready: {', '.join(runtime_names)}.",
                )
            )
        else:
            checks.append(
                AIReadinessCheck(
                    id=f"{pack_id}:managed-runtimes",
                    label="Managed runtimes",
                    status="pass",
                    detail="Required models do not need an external managed runtime manifest.",
                )
            )
        artifacts.append(
            _artifact(
                "model_pack",
                pack_id,
                str(pack.get("display_name") or pack_id),
                checks,
            )
        )
    return artifacts


def _artifact(
    artifact_type: str,
    artifact_id: str,
    display_name: str,
    checks: Iterable[AIReadinessCheck],
    **extra: Any,
) -> dict[str, Any]:
    readiness_checks = [check.model_dump(mode="json") for check in checks]
    blocked_count = sum(1 for check in readiness_checks if check["status"] == "blocked")
    warn_count = sum(1 for check in readiness_checks if check["status"] == "warn")
    status = "blocked" if blocked_count else "warn" if warn_count else "ready"
    return {
        "type": artifact_type,
        "id": artifact_id,
        "display_name": display_name,
        "status": status,
        "blocked_count": blocked_count,
        "warning_count": warn_count,
        "readiness_checks": readiness_checks,
        **extra,
    }


def _production_model_ids(registry: dict[str, Any]) -> list[str]:
    ids: list[str] = []
    for pack in _as_list(registry.get("model_packs")):
        if not isinstance(pack, dict) or pack.get("release_channel") != "production":
            continue
        ids.extend(str(model_id) for model_id in _as_list(pack.get("required_model_ids")))
        ids.extend(str(model_id) for model_id in _as_list(pack.get("optional_model_ids")))
    return _dedupe(ids)


def _next_actions(checks: list[dict[str, Any]], validation: dict[str, Any]) -> list[str]:
    actions: list[str] = []
    if validation["errors"]:
        actions.append("Fix structural registry validation errors before release review.")
    if validation["warnings"]:
        actions.append("Resolve registry warnings before pinning approved production registries.")
    actions.extend(str(check.get("action") or "") for check in checks if check.get("status") == "blocked")
    return _dedupe([action for action in actions if action])


def _ready_count(artifacts: list[dict[str, Any]]) -> int:
    return sum(1 for artifact in artifacts if artifact["status"] == "ready")


def _promotion_stages(summary: dict[str, Any], validation: dict[str, Any]) -> list[dict[str, str]]:
    ready_to_pin = bool(summary["ready_to_pin"])
    validation_error_count = int(summary["validation_error_count"])
    validation_warning_count = int(summary["validation_warning_count"])
    blocked_count = int(summary["blocked_count"])
    manifest_status = (
        "done"
        if ready_to_pin
        else "blocked"
        if validation_error_count
        else "active"
    )
    manifest_detail = (
        "Candidate manifests are pin-ready."
        if ready_to_pin
        else f"{blocked_count} manifest blockers and {validation_warning_count} validation warnings remain."
        if validation_warning_count
        else f"{blocked_count} manifest blockers remain."
    )
    metadata_status = "done" if ready_to_pin else "pending"
    metadata_detail = (
        "Pinned source revisions, file metadata, and license labels are present."
        if ready_to_pin
        else "Hugging Face revision, size, checksum, and license label metadata have not been fully hydrated."
    )
    pin_handoff_status = "active" if ready_to_pin else "pending"
    final_pin_status = "active" if ready_to_pin else "pending"
    return [
        {
            "id": "manifest-evidence",
            "title": "Manifest evidence",
            "status": manifest_status,
            "detail": manifest_detail,
            "action": "Evaluate candidate manifests and clear registry validation.",
        },
        {
            "id": "metadata-hydration",
            "title": "Metadata hydration",
            "status": metadata_status,
            "detail": metadata_detail,
            "action": "Hydrate upstream metadata before reviewer evidence.",
        },
        {
            "id": "source-probe",
            "title": "Source probe",
            "status": "pending",
            "detail": "Candidate artifact sources and license references have not been probed.",
            "action": "Probe source, size, checksum, and license evidence.",
        },
        {
            "id": "byte-verification",
            "title": "Byte verification",
            "status": "pending",
            "detail": "Candidate artifact bytes have not been hashed into evidence.",
            "action": "Verify artifact bytes before reviewer evidence.",
        },
        {
            "id": "evidence-overlay",
            "title": "Evidence overlay",
            "status": "pending",
            "detail": "Reviewer evidence has not been applied to candidate registries.",
            "action": "Apply reviewer evidence JSON.",
        },
        {
            "id": "pin-handoff",
            "title": "Pin handoff",
            "status": pin_handoff_status,
            "detail": (
                "Candidate registries are ready for guarded pin handoff generation."
                if ready_to_pin
                else "Patched registry handoff is not ready."
            ),
            "action": "Export patched registries and handoff.",
        },
        {
            "id": "final-pin",
            "title": "Final pin",
            "status": final_pin_status,
            "detail": (
                "Candidate registries can be passed to the guarded pin command."
                if ready_to_pin
                else "Bundled registries still reflect blocked production placeholders."
            ),
            "action": "Run guarded registry pin command.",
        },
        {
            "id": "readiness-gate",
            "title": "Readiness gate",
            "status": "pending",
            "detail": "Strict local-AI readiness has not passed with the pinned registries.",
            "action": "Run strict local-AI readiness gate.",
        },
    ]


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
