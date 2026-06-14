from __future__ import annotations

import copy
import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from vault_core.ai.models.registry import REGISTRY_PATH, load_model_registry
from vault_core.ai.models.runtime_installer import REGISTRY_PATH as RUNTIME_REGISTRY_PATH
from vault_core.ai.models.runtime_installer import load_runtime_registry

SHORTLIST_PATH = Path(__file__).with_name("candidate_shortlist.json")


def load_candidate_shortlist(path: Path | None = None) -> dict[str, Any]:
    shortlist_path = (path or SHORTLIST_PATH).expanduser()
    return json.loads(shortlist_path.read_text(encoding="utf-8"))


def build_candidate_shortlist_report(
    shortlist: dict[str, Any] | None = None,
    *,
    model_registry: dict[str, Any] | None = None,
    runtime_registry: dict[str, Any] | None = None,
) -> dict[str, Any]:
    shortlist = shortlist if shortlist is not None else load_candidate_shortlist()
    model_registry = model_registry if model_registry is not None else load_model_registry()
    runtime_registry = runtime_registry if runtime_registry is not None else load_runtime_registry()

    model_targets = _production_model_targets(model_registry)
    runtime_targets = _production_runtime_targets(runtime_registry)
    model_candidates = _as_list(shortlist.get("model_candidates"))
    runtime_candidates = _as_list(shortlist.get("runtime_candidates"))

    model_coverage = _coverage(
        target_ids=model_targets,
        candidates=model_candidates,
        replacement_key="replaces_model_ids",
    )
    runtime_coverage = _coverage(
        target_ids=runtime_targets,
        candidates=runtime_candidates,
        replacement_key="replaces_runtime_ids",
    )
    lifecycle_counts = _lifecycle_counts([*model_candidates, *runtime_candidates])
    hydration_ready = [
        candidate["id"]
        for candidate in model_candidates
        if isinstance(candidate, dict)
        and _candidate_id(candidate)
        and (candidate.get("source") or {}).get("type") == "huggingface"
        and candidate.get("lifecycle_status") == "needs_hydration"
    ]
    open_gate_candidates = [
        candidate["id"]
        for candidate in [*model_candidates, *runtime_candidates]
        if isinstance(candidate, dict)
        and _candidate_id(candidate)
        and str(candidate.get("lifecycle_status") or "").startswith("needs_")
    ]
    source_confirmation_needed = [
        candidate["id"]
        for candidate in [*model_candidates, *runtime_candidates]
        if isinstance(candidate, dict)
        and _candidate_id(candidate)
        and candidate.get("lifecycle_status")
        in {"needs_source_confirmation", "needs_archive_member_review", "needs_release_asset_selection"}
    ]
    release_evidence_needed = [
        candidate["id"]
        for candidate in [*model_candidates, *runtime_candidates]
        if isinstance(candidate, dict)
        and _candidate_id(candidate)
        and candidate.get("lifecycle_status") == "needs_release_evidence"
    ]
    runtime_distribution_decision_needed = [
        candidate["id"]
        for candidate in runtime_candidates
        if isinstance(candidate, dict)
        and _candidate_id(candidate)
        and candidate.get("lifecycle_status") == "needs_runtime_distribution_decision"
    ]
    runtime_distribution_decisions = [
        _runtime_distribution_decision(candidate)
        for candidate in runtime_candidates
        if isinstance(candidate, dict)
        and _candidate_id(candidate)
        and candidate.get("lifecycle_status") == "needs_runtime_distribution_decision"
    ]
    errors = [
        *model_coverage["errors"],
        *runtime_coverage["errors"],
        *_candidate_shape_errors(shortlist),
    ]
    warnings = _candidate_warnings(shortlist)
    status = "ready_for_hydration" if not errors and hydration_ready else "blocked"
    next_actions = _next_actions(
        errors=errors,
        warnings=warnings,
        hydration_ready=hydration_ready,
        source_confirmation_needed=source_confirmation_needed,
        release_evidence_needed=release_evidence_needed,
        runtime_distribution_decision_needed=runtime_distribution_decision_needed,
        runtime_distribution_decisions=runtime_distribution_decisions,
    )
    return {
        "status": status,
        "summary": {
            "model_target_count": len(model_targets),
            "covered_model_target_count": len(model_coverage["covered"]),
            "runtime_target_count": len(runtime_targets),
            "covered_runtime_target_count": len(runtime_coverage["covered"]),
            "model_candidate_count": len(model_candidates),
            "runtime_candidate_count": len(runtime_candidates),
            "hydration_ready_count": len(hydration_ready),
            "open_gate_count": len(open_gate_candidates),
            "source_confirmation_needed_count": len(source_confirmation_needed),
            "release_evidence_needed_count": len(release_evidence_needed),
            "runtime_distribution_decision_needed_count": len(runtime_distribution_decision_needed),
            "error_count": len(errors),
            "warning_count": len(warnings),
        },
        "model_coverage": model_coverage,
        "runtime_coverage": runtime_coverage,
        "lifecycle_counts": lifecycle_counts,
        "hydration_ready_candidate_ids": hydration_ready,
        "open_gate_candidate_ids": open_gate_candidates,
        "source_confirmation_needed_candidate_ids": source_confirmation_needed,
        "release_evidence_needed_candidate_ids": release_evidence_needed,
        "runtime_distribution_decision_needed_candidate_ids": runtime_distribution_decision_needed,
        "runtime_distribution_decisions": runtime_distribution_decisions,
        "errors": errors,
        "warnings": warnings,
        "next_actions": next_actions,
        "sources": {
            "shortlist": str(SHORTLIST_PATH),
            "model_registry": str(REGISTRY_PATH),
            "runtime_registry": str(RUNTIME_REGISTRY_PATH),
        },
    }


def build_candidate_model_registry_from_shortlist(
    shortlist: dict[str, Any] | None = None,
    *,
    model_registry: dict[str, Any] | None = None,
    hydration_ready_only: bool = True,
) -> dict[str, Any]:
    shortlist = shortlist if shortlist is not None else load_candidate_shortlist()
    patched = copy.deepcopy(model_registry if model_registry is not None else load_model_registry())
    models_by_id = {
        str(model.get("id")): model
        for model in _as_list(patched.get("models"))
        if isinstance(model, dict) and model.get("id")
    }
    applied: list[dict[str, str]] = []
    skipped: list[dict[str, str]] = []
    errors: list[str] = []

    for candidate in _as_list(shortlist.get("model_candidates")):
        if not isinstance(candidate, dict):
            continue
        candidate_id = _candidate_id(candidate)
        source = candidate.get("source") if isinstance(candidate.get("source"), dict) else {}
        if hydration_ready_only and candidate.get("lifecycle_status") != "needs_hydration":
            skipped.append({"id": candidate_id, "reason": "not hydration-ready"})
            continue
        if source.get("type") != "huggingface":
            skipped.append({"id": candidate_id, "reason": "not a Hugging Face candidate"})
            continue
        replacements = [str(model_id) for model_id in _as_list(candidate.get("replaces_model_ids"))]
        if not replacements:
            errors.append(f"{candidate_id}.replaces_model_ids is empty.")
            continue
        for model_id in replacements:
            model = models_by_id.get(model_id)
            if not model:
                errors.append(f"{candidate_id} replaces unknown model `{model_id}`.")
                continue
            _apply_huggingface_candidate(model, candidate)
            applied.append({"candidate_id": candidate_id, "model_id": model_id})

    patched.setdefault("candidate_generation", {})
    patched["candidate_generation"] = {
        "source": "candidate_shortlist",
        "status": "hydration_candidate",
        "hydration_ready_only": hydration_ready_only,
        "applied_count": len(applied),
        "skipped_count": len(skipped),
        "warning": (
            "Generated from shortlist for metadata hydration. This is not release approval "
            "and must still pass source probe, byte verification, license review, approval overlay, and pin checks."
        ),
    }
    return {
        "status": "blocked" if errors else "generated",
        "registry": patched,
        "applied": applied,
        "skipped": skipped,
        "errors": errors,
        "summary": {
            "applied_count": len(applied),
            "skipped_count": len(skipped),
            "error_count": len(errors),
        },
    }


def build_candidate_runtime_registry_from_shortlist(
    shortlist: dict[str, Any] | None = None,
    *,
    runtime_registry: dict[str, Any] | None = None,
    selected_assets_only: bool = True,
) -> dict[str, Any]:
    shortlist = shortlist if shortlist is not None else load_candidate_shortlist()
    patched = copy.deepcopy(runtime_registry if runtime_registry is not None else load_runtime_registry())
    runtimes_by_id = {
        str(runtime.get("id")): runtime
        for runtime in _as_list(patched.get("runtimes"))
        if isinstance(runtime, dict) and runtime.get("id")
    }
    applied: list[dict[str, str]] = []
    skipped: list[dict[str, str]] = []
    errors: list[str] = []

    for candidate in _as_list(shortlist.get("runtime_candidates")):
        if not isinstance(candidate, dict):
            continue
        candidate_id = _candidate_id(candidate)
        source = candidate.get("source") if isinstance(candidate.get("source"), dict) else {}
        if selected_assets_only and not _runtime_candidate_has_selected_asset(candidate):
            skipped.append({"id": candidate_id, "reason": _runtime_candidate_skip_reason(candidate)})
            continue
        if source.get("type") != "github_release":
            skipped.append({"id": candidate_id, "reason": "not a GitHub release candidate"})
            continue
        replacements = [str(runtime_id) for runtime_id in _as_list(candidate.get("replaces_runtime_ids"))]
        if not replacements:
            errors.append(f"{candidate_id}.replaces_runtime_ids is empty.")
            continue
        for runtime_id in replacements:
            runtime = runtimes_by_id.get(runtime_id)
            if not runtime:
                errors.append(f"{candidate_id} replaces unknown runtime `{runtime_id}`.")
                continue
            _apply_github_release_runtime_candidate(runtime, candidate)
            applied.append({"candidate_id": candidate_id, "runtime_id": runtime_id})

    patched.setdefault("candidate_generation", {})
    patched["candidate_generation"] = {
        "source": "candidate_shortlist",
        "status": "runtime_candidate",
        "selected_assets_only": selected_assets_only,
        "applied_count": len(applied),
        "skipped_count": len(skipped),
        "warning": (
            "Generated from shortlist for runtime source review. This is not release approval "
            "and must still pass archive-member review, source probe, byte verification, license review, "
            "approval overlay, smoke testing, and pin checks."
        ),
    }
    return {
        "status": "blocked" if errors else "generated",
        "registry": patched,
        "applied": applied,
        "skipped": skipped,
        "errors": errors,
        "summary": {
            "applied_count": len(applied),
            "skipped_count": len(skipped),
            "error_count": len(errors),
        },
    }


def write_candidate_model_registry_from_shortlist(
    output_path: Path,
    shortlist: dict[str, Any] | None = None,
    *,
    model_registry: dict[str, Any] | None = None,
    hydration_ready_only: bool = True,
) -> dict[str, Any]:
    result = build_candidate_model_registry_from_shortlist(
        shortlist,
        model_registry=model_registry,
        hydration_ready_only=hydration_ready_only,
    )
    if not result["errors"]:
        output = output_path.expanduser()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(f"{json.dumps(result['registry'], indent=2)}\n", encoding="utf-8")
    return result


def write_candidate_runtime_registry_from_shortlist(
    output_path: Path,
    shortlist: dict[str, Any] | None = None,
    *,
    runtime_registry: dict[str, Any] | None = None,
    selected_assets_only: bool = True,
) -> dict[str, Any]:
    result = build_candidate_runtime_registry_from_shortlist(
        shortlist,
        runtime_registry=runtime_registry,
        selected_assets_only=selected_assets_only,
    )
    if not result["errors"]:
        output = output_path.expanduser()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(f"{json.dumps(result['registry'], indent=2)}\n", encoding="utf-8")
    return result


def format_candidate_model_registry_summary(result: dict[str, Any]) -> str:
    summary = result["summary"]
    lines = [
        f"AI candidate model registry: {result['status']}",
        (
            "Applied: "
            f"{summary['applied_count']} models / "
            f"{summary['skipped_count']} skipped / "
            f"{summary['error_count']} errors"
        ),
    ]
    if result["applied"]:
        lines.extend(["", "Applied candidates:"])
        lines.extend(
            f"- {item['candidate_id']} -> {item['model_id']}"
            for item in result["applied"]
        )
    if result["skipped"]:
        lines.extend(["", "Skipped candidates:"])
        lines.extend(f"- {item['id']}: {item['reason']}" for item in result["skipped"])
    if result["errors"]:
        lines.extend(["", "Errors:"])
        lines.extend(f"- {error}" for error in result["errors"])
    return "\n".join(lines)


def format_candidate_runtime_registry_summary(result: dict[str, Any]) -> str:
    summary = result["summary"]
    lines = [
        f"AI candidate runtime registry: {result['status']}",
        (
            "Applied: "
            f"{summary['applied_count']} runtimes / "
            f"{summary['skipped_count']} skipped / "
            f"{summary['error_count']} errors"
        ),
    ]
    if result["applied"]:
        lines.extend(["", "Applied candidates:"])
        lines.extend(
            f"- {item['candidate_id']} -> {item['runtime_id']}"
            for item in result["applied"]
        )
    if result["skipped"]:
        lines.extend(["", "Skipped candidates:"])
        lines.extend(f"- {item['id']}: {item['reason']}" for item in result["skipped"])
    if result["errors"]:
        lines.extend(["", "Errors:"])
        lines.extend(f"- {error}" for error in result["errors"])
    return "\n".join(lines)


def format_candidate_shortlist_text(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        f"AI candidate shortlist: {report['status']}",
        (
            "Model targets: "
            f"{summary['covered_model_target_count']}/{summary['model_target_count']} covered"
        ),
        (
            "Runtime targets: "
            f"{summary['covered_runtime_target_count']}/{summary['runtime_target_count']} covered"
        ),
        (
            "Candidates: "
            f"{summary['model_candidate_count']} models / "
            f"{summary['runtime_candidate_count']} runtimes"
        ),
        (
            "Gates: "
            f"{summary['hydration_ready_count']} ready for metadata hydration / "
            f"{summary['source_confirmation_needed_count']} need source confirmation / "
            f"{summary['release_evidence_needed_count']} need release evidence / "
            f"{summary['runtime_distribution_decision_needed_count']} need runtime distribution decision / "
            f"{summary['open_gate_count']} total open"
        ),
    ]
    if report["errors"]:
        lines.extend(["", "Errors:"])
        lines.extend(f"- {error}" for error in report["errors"])
    if report["warnings"]:
        lines.extend(["", "Warnings:"])
        lines.extend(f"- {warning}" for warning in report["warnings"])
    if report["next_actions"]:
        lines.extend(["", "Next actions:"])
        lines.extend(f"- {action}" for action in report["next_actions"])
    return "\n".join(lines)


def format_candidate_shortlist_markdown(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        "# AI Candidate Shortlist",
        "",
        f"- Status: **{report['status']}**",
        (
            "- Model targets covered: "
            f"**{summary['covered_model_target_count']}/{summary['model_target_count']}**"
        ),
        (
            "- Runtime targets covered: "
            f"**{summary['covered_runtime_target_count']}/{summary['runtime_target_count']}**"
        ),
        (
            "- Candidates: "
            f"**{summary['model_candidate_count']} models / "
            f"{summary['runtime_candidate_count']} runtimes**"
        ),
        (
            "- Ready for metadata hydration: "
            f"**{summary['hydration_ready_count']}**"
        ),
        (
            "- Need source confirmation: "
            f"**{summary['source_confirmation_needed_count']}**"
        ),
        (
            "- Need release evidence: "
            f"**{summary['release_evidence_needed_count']}**"
        ),
        (
            "- Need runtime distribution decision: "
            f"**{summary['runtime_distribution_decision_needed_count']}**"
        ),
        f"- Total open candidate gates: **{summary['open_gate_count']}**",
        "",
        "## Coverage",
        "",
        "| Target type | Covered | Missing | Unknown replacements | Duplicate replacements |",
        "| --- | ---: | --- | --- | --- |",
        _coverage_row("Model", report["model_coverage"]),
        _coverage_row("Runtime", report["runtime_coverage"]),
        "",
        "## Lifecycle",
        "",
        "| Status | Count |",
        "| --- | ---: |",
    ]
    for status, count in sorted(report["lifecycle_counts"].items()):
        lines.append(f"| `{status}` | {count} |")
    lines.extend(["", "## Hydration Ready Candidates", ""])
    if report["hydration_ready_candidate_ids"]:
        lines.extend(f"- `{candidate_id}`" for candidate_id in report["hydration_ready_candidate_ids"])
    else:
        lines.append("- None yet.")
    lines.extend(["", "## Release Evidence Needed", ""])
    if report["release_evidence_needed_candidate_ids"]:
        lines.extend(f"- `{candidate_id}`" for candidate_id in report["release_evidence_needed_candidate_ids"])
    else:
        lines.append("- None.")
    lines.extend(["", "## Runtime Distribution Decisions", ""])
    if report["runtime_distribution_decision_needed_candidate_ids"]:
        lines.extend(f"- `{candidate_id}`" for candidate_id in report["runtime_distribution_decision_needed_candidate_ids"])
        decisions = report.get("runtime_distribution_decisions") or []
        if decisions:
            lines.extend(
                [
                    "",
                    "| Candidate | Checked | Recommended path | Latest release assets seen |",
                    "| --- | --- | --- | --- |",
                ]
            )
            for decision in decisions:
                lines.append(
                    "| "
                    f"`{decision['id']}` | "
                    f"{decision['latest_release_checked_at'] or 'not recorded'} | "
                    f"`{decision['recommended_distribution_path'] or 'not selected'}` | "
                    f"{_code_list(decision['latest_release_assets_seen'])} |"
                )
    else:
        lines.append("- None.")
    lines.extend(["", "## Errors", ""])
    if report["errors"]:
        lines.extend(f"- {error}" for error in report["errors"])
    else:
        lines.append("- None.")
    lines.extend(["", "## Warnings", ""])
    if report["warnings"]:
        lines.extend(f"- {warning}" for warning in report["warnings"])
    else:
        lines.append("- None.")
    lines.extend(["", "## Next Actions", ""])
    if report["next_actions"]:
        lines.extend(f"- [ ] {action}" for action in report["next_actions"])
    else:
        lines.append("- [x] Candidate shortlist is ready for metadata hydration.")
    return "\n".join(lines)


def _coverage_row(label: str, coverage: dict[str, Any]) -> str:
    return (
        f"| {label} | {len(coverage['covered'])}/{len(coverage['target_ids'])} | "
        f"{_code_list(coverage['missing'])} | "
        f"{_code_list(coverage['unknown_replacements'])} | "
        f"{_code_list(coverage['duplicate_replacements'])} |"
    )


def _code_list(values: Iterable[str]) -> str:
    items = list(values)
    if not items:
        return "None"
    return ", ".join(f"`{item}`" for item in items)


def _runtime_candidate_has_selected_asset(candidate: dict[str, Any]) -> bool:
    source = candidate.get("source") if isinstance(candidate.get("source"), dict) else {}
    return all(
        str(source.get(field) or "").strip() not in {"", "TO_SELECT", "REQUIRED_BEFORE_RELEASE"}
        for field in ("repo", "tag", "asset")
    )


def _runtime_candidate_skip_reason(candidate: dict[str, Any]) -> str:
    if candidate.get("lifecycle_status") == "needs_runtime_distribution_decision":
        return "runtime distribution decision needed"
    return "release asset not selected"


def _apply_github_release_runtime_candidate(runtime: dict[str, Any], candidate: dict[str, Any]) -> None:
    source = candidate.get("source") if isinstance(candidate.get("source"), dict) else {}
    asset = str(source.get("asset") or "")
    tag = str(source.get("tag") or "")
    archive_member = str(source.get("archive_member") or "REQUIRED_BEFORE_RELEASE")
    asset_sha256 = str(source.get("asset_sha256") or "REQUIRED_BEFORE_RELEASE")
    asset_size_bytes = source.get("asset_size_bytes")
    runtime.update(
        {
            "runtime": candidate.get("runtime") or runtime.get("runtime"),
            "version": tag or "REQUIRED_BEFORE_RELEASE",
            "platform": candidate.get("platform") or runtime.get("platform"),
            "arch": candidate.get("arch") or runtime.get("arch"),
            "binary_name": candidate.get("binary_name") or runtime.get("binary_name"),
            "license_label": candidate.get("license_label") or runtime.get("license_label"),
            "license_url": candidate.get("license_url") or "REQUIRED_BEFORE_RELEASE",
            "source": {
                "type": "url",
                "url": _github_release_asset_url(source),
                "archive_format": _archive_format_for_asset(asset),
                "archive_member": archive_member,
            },
            "files": [
                {
                    "filename": asset,
                    "sha256": asset_sha256,
                    "size_bytes": asset_size_bytes if isinstance(asset_size_bytes, int) else None,
                    "executable": True,
                }
            ],
            "approval": {"status": "pending"},
            "candidate": {
                "shortlist_id": candidate.get("id"),
                "lifecycle_status": candidate.get("lifecycle_status"),
                "evidence_urls": _as_list(candidate.get("evidence_urls")),
                "rationale": candidate.get("rationale"),
            },
        }
    )
    if isinstance(candidate.get("smoke_test"), dict):
        runtime["smoke_test"] = copy.deepcopy(candidate["smoke_test"])


def _github_release_asset_url(source: dict[str, Any]) -> str:
    explicit_url = str(source.get("url") or "")
    if explicit_url:
        return explicit_url
    repo = str(source.get("repo") or "")
    tag = str(source.get("tag") or "")
    asset = str(source.get("asset") or "")
    return f"https://github.com/{repo}/releases/download/{tag}/{asset}"


def _archive_format_for_asset(asset: str) -> str:
    lowered = asset.lower()
    if lowered.endswith(".zip"):
        return "zip"
    if lowered.endswith(".tar.gz"):
        return "tar.gz"
    if lowered.endswith(".tgz"):
        return "tgz"
    if lowered.endswith(".tar"):
        return "tar"
    return "REQUIRED_BEFORE_RELEASE"


def _production_model_targets(model_registry: dict[str, Any]) -> list[str]:
    targets: list[str] = []
    for pack in _as_list(model_registry.get("model_packs")):
        if not isinstance(pack, dict) or pack.get("release_channel") != "production":
            continue
        targets.extend(str(model_id) for model_id in _as_list(pack.get("required_model_ids")))
        targets.extend(str(model_id) for model_id in _as_list(pack.get("optional_model_ids")))
    return _dedupe(targets)


def _production_runtime_targets(runtime_registry: dict[str, Any]) -> list[str]:
    return [
        str(runtime.get("id"))
        for runtime in _as_list(runtime_registry.get("runtimes"))
        if isinstance(runtime, dict) and runtime.get("release_channel") == "production" and runtime.get("id")
    ]


def _coverage(
    *,
    target_ids: list[str],
    candidates: list[Any],
    replacement_key: str,
) -> dict[str, Any]:
    replacement_counts: dict[str, int] = {}
    errors: list[str] = []
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        candidate_id = _candidate_id(candidate)
        replacements = _as_list(candidate.get(replacement_key))
        if not replacements:
            errors.append(f"{candidate_id or '<missing-candidate>'}.{replacement_key} is empty.")
            continue
        for replacement in replacements:
            replacement_id = str(replacement)
            replacement_counts[replacement_id] = replacement_counts.get(replacement_id, 0) + 1
    target_set = set(target_ids)
    covered = sorted(target_set & set(replacement_counts))
    missing = sorted(target_set - set(replacement_counts))
    unknown = sorted(set(replacement_counts) - target_set)
    duplicates = sorted(item_id for item_id, count in replacement_counts.items() if count > 1)
    errors.extend(f"Missing shortlist candidate for `{item_id}`." for item_id in missing)
    errors.extend(f"Shortlist replaces unknown target `{item_id}`." for item_id in unknown)
    errors.extend(f"Shortlist target `{item_id}` is replaced by multiple candidates." for item_id in duplicates)
    return {
        "target_ids": target_ids,
        "covered": covered,
        "missing": missing,
        "unknown_replacements": unknown,
        "duplicate_replacements": duplicates,
        "errors": errors,
    }


def _candidate_shape_errors(shortlist: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if shortlist.get("schema_version") != 1:
        errors.append("candidate_shortlist.schema_version must be 1.")
    for section in ("model_candidates", "runtime_candidates"):
        for index, candidate in enumerate(_as_list(shortlist.get(section))):
            if not isinstance(candidate, dict):
                errors.append(f"{section}[{index}] must be an object.")
                continue
            candidate_id = _candidate_id(candidate)
            if not candidate_id:
                errors.append(f"{section}[{index}].id is required.")
            source = candidate.get("source")
            if not isinstance(source, dict) or not source.get("type"):
                errors.append(f"{candidate_id or section + '[' + str(index) + ']'}.source.type is required.")
            if not candidate.get("lifecycle_status"):
                errors.append(f"{candidate_id or section + '[' + str(index) + ']'}.lifecycle_status is required.")
            if not _as_list(candidate.get("evidence_urls")):
                errors.append(f"{candidate_id or section + '[' + str(index) + ']'}.evidence_urls is required.")
    return errors


def _apply_huggingface_candidate(model: dict[str, Any], candidate: dict[str, Any]) -> None:
    source = candidate.get("source") if isinstance(candidate.get("source"), dict) else {}
    filenames = _candidate_filenames(source)
    model["family"] = str(candidate.get("id") or model.get("family") or "")
    model["kind"] = str(candidate.get("kind") or model.get("kind") or "")
    model["runtime"] = str(candidate.get("runtime") or model.get("runtime") or "")
    model["capabilities"] = [str(capability) for capability in _as_list(candidate.get("capabilities"))]
    if candidate.get("license_label"):
        model["license_label"] = str(candidate["license_label"])
    model["license_url"] = str(candidate.get("license_url") or "REQUIRED_BEFORE_RELEASE")
    model["download_state"] = "not_installed"
    model["installed"] = False
    model["source"] = {
        "type": "huggingface",
        "repo_id": str(source.get("repo_id") or ""),
        "revision": "REQUIRED_BEFORE_RELEASE",
        "allow_patterns": _allow_patterns_for_filenames(filenames),
    }
    model["files"] = [
        {
            "filename": filename,
            "sha256": "REQUIRED_BEFORE_RELEASE",
            "size_bytes": None,
        }
        for filename in filenames
    ]
    model["approval"] = {"status": "pending"}
    model["candidate"] = {
        "shortlist_id": str(candidate.get("id") or ""),
        "lifecycle_status": str(candidate.get("lifecycle_status") or ""),
        "evidence_urls": [str(url) for url in _as_list(candidate.get("evidence_urls"))],
        "rationale": str(candidate.get("rationale") or ""),
    }


def _candidate_filenames(source: dict[str, Any]) -> list[str]:
    filenames: list[str] = []
    primary = str(source.get("filename") or "").strip()
    if primary:
        filenames.append(primary)
    for sidecar in _as_list(source.get("sidecar_filenames")):
        value = str(sidecar or "").strip()
        if value and value not in filenames:
            filenames.append(value)
    return filenames


def _allow_patterns_for_filenames(filenames: list[str]) -> list[str]:
    patterns: list[str] = []
    for filename in filenames:
        pattern = _allow_pattern_for_filename(filename)
        if pattern not in patterns:
            patterns.append(pattern)
    return patterns or ["*"]


def _allow_pattern_for_filename(filename: str) -> str:
    if not filename:
        return "*"
    if "/" in filename:
        return filename
    if "." in filename:
        return f"*{Path(filename).suffix}"
    return filename


def _candidate_warnings(shortlist: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    for section in ("model_candidates", "runtime_candidates"):
        for candidate in _as_list(shortlist.get(section)):
            if not isinstance(candidate, dict) or not _candidate_id(candidate):
                continue
            status = str(candidate.get("lifecycle_status") or "")
            if status not in {
                "needs_hydration",
            "needs_source_confirmation",
            "needs_archive_member_review",
            "needs_release_asset_selection",
            "needs_release_evidence",
            "needs_runtime_distribution_decision",
        }:
                warnings.append(f"{candidate['id']} has an unrecognized lifecycle status `{status}`.")
            if candidate.get("license_label") in {None, "", "TO_REVIEW"}:
                warnings.append(f"{candidate['id']} still needs license review.")
    return warnings


def _runtime_distribution_decision(candidate: dict[str, Any]) -> dict[str, Any]:
    source = candidate.get("source") if isinstance(candidate.get("source"), dict) else {}
    return {
        "id": _candidate_id(candidate),
        "runtime": str(candidate.get("runtime") or ""),
        "platform": str(candidate.get("platform") or ""),
        "arch": str(candidate.get("arch") or ""),
        "repo": str(source.get("repo") or ""),
        "tag": str(source.get("tag") or ""),
        "latest_release_checked_at": str(source.get("latest_release_checked_at") or ""),
        "latest_release_assets_seen": [str(asset) for asset in _as_list(source.get("latest_release_assets_seen"))],
        "rejected_assets": [asset for asset in _as_list(source.get("rejected_assets")) if isinstance(asset, dict)],
        "recommended_distribution_path": str(source.get("recommended_distribution_path") or ""),
        "rationale": str(candidate.get("rationale") or ""),
    }


def _lifecycle_counts(candidates: list[Any]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        status = str(candidate.get("lifecycle_status") or "missing")
        counts[status] = counts.get(status, 0) + 1
    return counts


def _next_actions(
    *,
    errors: list[str],
    warnings: list[str],
    hydration_ready: list[str],
    source_confirmation_needed: list[str],
    release_evidence_needed: list[str],
    runtime_distribution_decision_needed: list[str],
    runtime_distribution_decisions: list[dict[str, Any]],
) -> list[str]:
    if errors:
        return ["Fix candidate shortlist coverage and schema errors before metadata hydration."]
    actions: list[str] = []
    if hydration_ready:
        actions.append("Run Hugging Face metadata hydration for hydration-ready model candidates.")
    if source_confirmation_needed:
        actions.append("Confirm source, license, and release asset choices for candidates that still need review.")
    if release_evidence_needed:
        actions.append(
            "Prepare release evidence by running source probe, byte verification, smoke verification, and approval evidence overlay "
            "for selected candidates."
        )
    if runtime_distribution_decision_needed:
        package_from_source_ids = [
            decision["id"]
            for decision in runtime_distribution_decisions
            if decision.get("recommended_distribution_path") == "package-approved-macos-arm64-cli-from-source"
        ]
        if package_from_source_ids:
            actions.append(
                "Package approved macOS arm64 CLI runtimes from tagged source for candidates without upstream CLI assets: "
                f"{', '.join(package_from_source_ids)}."
            )
        else:
            actions.append("Decide the production runtime distribution path for runtime candidates without an approved CLI asset.")
    if warnings:
        actions.append("Resolve shortlist warnings before generating candidate registry manifests.")
    actions.append("Generate candidate model/runtime registries, then run source probe and byte verification.")
    return _dedupe(actions)


def _candidate_id(candidate: dict[str, Any]) -> str:
    return str(candidate.get("id") or "")


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
