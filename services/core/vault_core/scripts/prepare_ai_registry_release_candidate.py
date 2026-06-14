from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from vault_core.ai.models.approval_overlay import apply_ai_registry_evidence_overlay
from vault_core.ai.models.artifact_probe import (
    DEFAULT_TIMEOUT_SECONDS,
    build_ai_registry_artifact_probe,
    format_artifact_probe_markdown,
)
from vault_core.ai.models.artifact_verification import (
    DEFAULT_MAX_BYTES as DEFAULT_VERIFY_MAX_BYTES,
    DEFAULT_TIMEOUT_SECONDS as DEFAULT_VERIFY_TIMEOUT_SECONDS,
    build_ai_registry_artifact_verification,
    format_artifact_verification_markdown,
)
from vault_core.ai.models.release_plan import load_registry_json
from vault_core.scripts.pin_ai_registries import _candidate_pin_result, _format_candidate_pin_result


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        packet = build_release_candidate_packet(
            model_registry_path=args.model_registry,
            runtime_registry_path=args.runtime_registry,
            evidence_path=args.evidence,
            output_dir=args.output_dir,
            probe_sources=args.probe_sources,
            probe_timeout_seconds=args.probe_timeout,
            verify_bytes=args.verify_bytes,
            verify_timeout_seconds=args.verify_timeout,
            verify_max_bytes=args.verify_max_bytes,
        )
        output = json.dumps(packet, indent=2) if args.format == "json" else _format_summary(packet)
        print(output)
        return 0 if packet["ready_to_pin"] else 1
    except Exception as exc:
        print(f"AI registry release candidate packet failed: {exc}", file=sys.stderr)
        return 2


def build_release_candidate_packet(
    *,
    model_registry_path: Path,
    runtime_registry_path: Path,
    evidence_path: Path,
    output_dir: Path,
    probe_sources: bool = False,
    probe_timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    verify_bytes: bool = False,
    verify_timeout_seconds: float = DEFAULT_VERIFY_TIMEOUT_SECONDS,
    verify_max_bytes: int = DEFAULT_VERIFY_MAX_BYTES,
) -> dict[str, Any]:
    output_path = output_dir.expanduser()
    output_path.mkdir(parents=True, exist_ok=True)
    model_registry = load_registry_json(model_registry_path)
    runtime_registry = load_registry_json(runtime_registry_path)
    evidence = load_registry_json(evidence_path)
    overlay = apply_ai_registry_evidence_overlay(
        evidence=evidence,
        model_registry=model_registry,
        runtime_registry=runtime_registry,
        model_registry_label=str(model_registry_path),
        runtime_registry_label=str(runtime_registry_path),
        evidence_label=str(evidence_path),
    )
    return build_release_candidate_packet_from_overlay(
        overlay=overlay,
        output_dir=output_dir,
        probe_sources=probe_sources,
        probe_timeout_seconds=probe_timeout_seconds,
        verify_bytes=verify_bytes,
        verify_timeout_seconds=verify_timeout_seconds,
        verify_max_bytes=verify_max_bytes,
    )


def build_release_candidate_packet_from_overlay(
    *,
    overlay: dict[str, Any],
    output_dir: Path,
    probe_sources: bool = False,
    probe_timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    verify_bytes: bool = False,
    verify_timeout_seconds: float = DEFAULT_VERIFY_TIMEOUT_SECONDS,
    verify_max_bytes: int = DEFAULT_VERIFY_MAX_BYTES,
) -> dict[str, Any]:
    output_path = output_dir.expanduser()
    output_path.mkdir(parents=True, exist_ok=True)
    artifacts: list[dict[str, Any]] = []
    _write_artifact(
        output_path,
        artifacts,
        filename=overlay["filename"],
        contents=overlay["bundle_json"],
        artifact_type="evidence_bundle",
    )
    patched_model_path = _write_artifact(
        output_path,
        artifacts,
        filename=overlay["model_registry_filename"],
        contents=overlay["model_registry_json"],
        artifact_type="patched_model_registry",
        trailing_newline=False,
    )
    patched_runtime_path = _write_artifact(
        output_path,
        artifacts,
        filename=overlay["runtime_registry_filename"],
        contents=overlay["runtime_registry_json"],
        artifact_type="patched_runtime_registry",
        trailing_newline=False,
    )
    _write_artifact(
        output_path,
        artifacts,
        filename=overlay["release_plan_filename"],
        contents=overlay["release_plan_markdown"],
        artifact_type="applied_release_plan",
    )
    _write_artifact(
        output_path,
        artifacts,
        filename=overlay["approval_template_filename"],
        contents=overlay["approval_template_markdown"],
        artifact_type="applied_approval_checklist",
    )
    _write_artifact(
        output_path,
        artifacts,
        filename=overlay["pin_handoff_filename"],
        contents=overlay["pin_handoff_markdown"],
        artifact_type="pin_handoff",
    )
    artifact_probe = None
    if probe_sources:
        artifact_probe = build_ai_registry_artifact_probe(
            overlay["model_registry"],
            overlay["runtime_registry"],
            timeout_seconds=probe_timeout_seconds,
        )
        _write_artifact(
            output_path,
            artifacts,
            filename=str(overlay["pin_handoff"]["artifact_probe_filename"]),
            contents=format_artifact_probe_markdown(
                artifact_probe,
                model_registry_label=overlay["model_registry_filename"],
                runtime_registry_label=overlay["runtime_registry_filename"],
            ),
            artifact_type="artifact_probe",
        )

    artifact_verification = None
    if verify_bytes:
        artifact_verification = build_ai_registry_artifact_verification(
            overlay["model_registry"],
            overlay["runtime_registry"],
            timeout_seconds=verify_timeout_seconds,
            max_bytes=verify_max_bytes,
        )
        _write_artifact(
            output_path,
            artifacts,
            filename=str(overlay["pin_handoff"]["artifact_verification_filename"]),
            contents=format_artifact_verification_markdown(
                artifact_verification,
                model_registry_label=overlay["model_registry_filename"],
                runtime_registry_label=overlay["runtime_registry_filename"],
            ),
            artifact_type="artifact_verification",
        )
        _write_artifact(
            output_path,
            artifacts,
            filename=str(overlay["pin_handoff"]["artifact_verification_evidence_filename"]),
            contents=json.dumps(artifact_verification["evidence"], indent=2),
            artifact_type="artifact_verification_evidence",
        )

    acceptance = _candidate_pin_result(
        model_registry_path=patched_model_path,
        runtime_registry_path=patched_runtime_path,
        dry_run=True,
    )
    acceptance_filename = str(
        overlay["pin_handoff"].get("acceptance_report_filename") or "candidate-ai-registry-acceptance.applied.md"
    )
    _write_artifact(
        output_path,
        artifacts,
        filename=acceptance_filename,
        contents=_format_candidate_pin_result(acceptance, "markdown"),
        artifact_type="acceptance_report",
    )
    blocking_findings = _blocking_findings(artifact_probe, artifact_verification)
    packet_index = _format_packet_index(
        overlay=overlay,
        acceptance=acceptance,
        artifact_probe=artifact_probe,
        artifact_verification=artifact_verification,
        artifacts=artifacts,
        blocking_findings=blocking_findings,
    )
    _write_artifact(
        output_path,
        artifacts,
        filename="candidate-ai-registry-release-packet.md",
        contents=packet_index,
        artifact_type="packet_index",
    )

    ready_to_pin = bool(
        overlay["status"] == "applied"
        and overlay["release_plan"]["summary"]["ready_to_pin"]
        and acceptance["ready_to_pin"]
        and (artifact_probe is None or artifact_probe["status"] == "pass")
        and (artifact_verification is None or artifact_verification["status"] == "pass")
    )
    next_actions = _combined_next_actions(
        overlay["release_plan"].get("next_actions", []),
        artifact_probe.get("next_actions", []) if artifact_probe else [],
        artifact_verification.get("next_actions", []) if artifact_verification else [],
    )
    summary = {
        "status": "ready_to_pin" if ready_to_pin else "blocked",
        "ready_to_pin": ready_to_pin,
        "output_dir": str(output_path),
        "generated_at": overlay["generated_at"],
        "applied_count": overlay["applied_count"],
        "patched_model_registry_sha256": overlay["patched_model_registry_sha256"],
        "patched_runtime_registry_sha256": overlay["patched_runtime_registry_sha256"],
        "release_plan": overlay["release_plan"]["summary"],
        "acceptance": {
            "status": acceptance["status"],
            "ready_to_pin": acceptance["ready_to_pin"],
            "dry_run": acceptance["dry_run"],
        },
        "artifact_probe": {
            "status": artifact_probe["status"] if artifact_probe else "not_run",
            "summary": artifact_probe["summary"] if artifact_probe else None,
        },
        "artifact_verification": {
            "status": artifact_verification["status"] if artifact_verification else "not_run",
            "summary": artifact_verification["summary"] if artifact_verification else None,
            "evidence": artifact_verification["evidence"] if artifact_verification else None,
        },
        "blocking_findings": blocking_findings,
        "artifacts": artifacts,
        "next_actions": next_actions,
        "errors": overlay["errors"],
        "warnings": overlay["warnings"],
    }
    _write_summary_artifact(
        output_path,
        artifacts,
        summary,
        filename="candidate-ai-registry-release-packet.json",
        artifact_type="packet_summary",
    )
    return summary


def _write_artifact(
    output_dir: Path,
    artifacts: list[dict[str, Any]],
    *,
    filename: str,
    contents: str,
    artifact_type: str,
    trailing_newline: bool = True,
) -> Path:
    path = output_dir / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    suffix = "\n" if trailing_newline else ""
    path.write_text(f"{contents}{suffix}", encoding="utf-8")
    artifacts.append(
        {
            "type": artifact_type,
            "filename": filename,
            "path": str(path),
            "bytes": path.stat().st_size,
        }
    )
    return path


def _write_summary_artifact(
    output_dir: Path,
    artifacts: list[dict[str, Any]],
    summary: dict[str, Any],
    *,
    filename: str,
    artifact_type: str,
) -> Path:
    path = output_dir / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    artifact = {
        "type": artifact_type,
        "filename": filename,
        "path": str(path),
        "bytes": 0,
    }
    artifacts.append(artifact)
    summary["artifacts"] = artifacts

    # The summary lists itself, so iterate until the recorded byte count is stable.
    for _ in range(4):
        path.write_text(f"{json.dumps(summary, indent=2)}\n", encoding="utf-8")
        byte_count = path.stat().st_size
        if artifact["bytes"] == byte_count:
            break
        artifact["bytes"] = byte_count
    return path


def _format_packet_index(
    *,
    overlay: dict[str, Any],
    acceptance: dict[str, Any],
    artifact_probe: dict[str, Any] | None,
    artifact_verification: dict[str, Any] | None,
    artifacts: list[dict[str, Any]],
    blocking_findings: list[dict[str, Any]],
) -> str:
    probe_status = artifact_probe["status"] if artifact_probe else "not_run"
    verification_status = artifact_verification["status"] if artifact_verification else "not_run"
    packet_ready = bool(
        overlay["release_plan"]["summary"]["ready_to_pin"]
        and acceptance["ready_to_pin"]
        and (artifact_probe is None or artifact_probe["status"] == "pass")
        and (artifact_verification is None or artifact_verification["status"] == "pass")
    )
    lines = [
        "# Candidate AI Registry Release Packet",
        "",
        f"- Status: **{'ready_to_pin' if packet_ready else 'blocked'}**",
        f"- Source probe: **{probe_status}**",
        f"- Byte verification: **{verification_status}**",
        f"- Applied evidence fields: **{overlay['applied_count']}**",
        f"- Patched model registry SHA-256: `{overlay['patched_model_registry_sha256']}`",
        f"- Patched runtime registry SHA-256: `{overlay['patched_runtime_registry_sha256']}`",
        "",
        "## Artifacts",
        "",
    ]
    lines.extend(f"- `{artifact['filename']}` - {artifact['type']}" for artifact in artifacts)
    if blocking_findings:
        lines.extend(["", "## Blocking Details", ""])
        for finding in blocking_findings:
            lines.append(
                f"- `{finding['source']}` `{finding['check_id']}` "
                f"**{finding['status']}** - {finding['detail']}"
            )
            if finding.get("action"):
                lines.append(f"  - Action: {finding['action']}")
    lines.extend(
        [
            "",
            "## Commands",
            "",
            "```sh",
            overlay["pin_handoff"]["commands"]["artifact_probe"],
            overlay["pin_handoff"]["commands"]["artifact_verification"],
            overlay["pin_handoff"]["commands"]["acceptance_report"],
            overlay["pin_handoff"]["commands"]["pin_check"],
            overlay["pin_handoff"]["commands"]["pin"],
            overlay["pin_handoff"]["commands"]["readiness"],
            "```",
            "",
            "## Next Actions",
            "",
        ]
    )
    next_actions = _combined_next_actions(
        overlay["release_plan"].get("next_actions", []),
        artifact_probe.get("next_actions", []) if artifact_probe else [],
        artifact_verification.get("next_actions", []) if artifact_verification else [],
    )
    if next_actions:
        lines.extend(f"- [ ] {action}" for action in next_actions)
    else:
        lines.append("- [x] Packet artifacts are ready for release review and guarded pinning.")
    return "\n".join(lines).rstrip()


def _blocking_findings(
    artifact_probe: dict[str, Any] | None,
    artifact_verification: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    if artifact_probe:
        for artifact in artifact_probe.get("artifacts", []):
            for check in artifact.get("checks", []):
                _append_nonpassing_finding(findings, "source_probe", artifact, check)
    if artifact_verification:
        for artifact in artifact_verification.get("artifacts", []):
            for file_info in artifact.get("files", []):
                for check in file_info.get("checks", []):
                    _append_nonpassing_finding(findings, "byte_verification", artifact, check)
    return findings


def _append_nonpassing_finding(
    findings: list[dict[str, Any]],
    source: str,
    artifact: dict[str, Any],
    check: dict[str, Any],
) -> None:
    status = str(check.get("status") or "")
    if status == "pass":
        return
    findings.append(
        {
            "source": source,
            "artifact_id": artifact.get("id"),
            "artifact_type": artifact.get("type"),
            "check_id": check.get("id"),
            "status": status,
            "label": check.get("label"),
            "detail": check.get("detail"),
            "action": check.get("action"),
        }
    )


def _format_summary(packet: dict[str, Any]) -> str:
    lines = [
        f"AI registry release candidate packet: {packet['status']}",
        f"Output directory: {packet['output_dir']}",
        f"Applied fields: {packet['applied_count']}",
        f"Patched model registry SHA-256: {packet['patched_model_registry_sha256']}",
        f"Patched runtime registry SHA-256: {packet['patched_runtime_registry_sha256']}",
        f"Source probe: {packet['artifact_probe']['status']}",
        f"Byte verification: {packet['artifact_verification']['status']}",
        f"Artifacts: {len(packet['artifacts'])}",
    ]
    if packet["errors"]:
        lines.extend(["", "Errors:", *[f"- {error}" for error in packet["errors"]]])
    if packet["warnings"]:
        lines.extend(["", "Warnings:", *[f"- {warning}" for warning in packet["warnings"]]])
    if packet["next_actions"]:
        lines.extend(["", "Next actions:", *[f"- {action}" for action in packet["next_actions"]]])
    return "\n".join(lines)


def _combined_next_actions(*action_groups: list[Any]) -> list[str]:
    actions: list[str] = []
    for group in action_groups:
        for action in group:
            text = str(action)
            if text and text not in actions:
                actions.append(text)
    return actions


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a complete local AI registry release candidate packet from candidate manifests and evidence."
    )
    parser.add_argument("--model-registry", type=Path, required=True, help="Candidate model_registry.json path.")
    parser.add_argument("--runtime-registry", type=Path, required=True, help="Candidate runtime_registry.json path.")
    parser.add_argument("--evidence", type=Path, required=True, help="Filled evidence overlay JSON path.")
    parser.add_argument("--output-dir", type=Path, required=True, help="Directory where release packet artifacts are written.")
    parser.add_argument(
        "--probe-sources",
        action="store_true",
        help="Probe patched candidate artifact and license URLs and include the Markdown report in the packet.",
    )
    parser.add_argument(
        "--probe-timeout",
        type=float,
        default=DEFAULT_TIMEOUT_SECONDS,
        help="HTTP timeout in seconds per source or license URL when --probe-sources is used.",
    )
    parser.add_argument(
        "--verify-bytes",
        action="store_true",
        help="Download and hash patched candidate model/runtime artifacts and include the byte-verification report.",
    )
    parser.add_argument(
        "--verify-timeout",
        type=float,
        default=DEFAULT_VERIFY_TIMEOUT_SECONDS,
        help="HTTP timeout in seconds per artifact download when --verify-bytes is used.",
    )
    parser.add_argument(
        "--verify-max-bytes",
        type=int,
        default=DEFAULT_VERIFY_MAX_BYTES,
        help="Maximum bytes to stream per artifact when --verify-bytes is used.",
    )
    parser.add_argument("--format", choices=["summary", "json"], default="summary", help="Output format.")
    return parser.parse_args(argv)


if __name__ == "__main__":
    raise SystemExit(main())
