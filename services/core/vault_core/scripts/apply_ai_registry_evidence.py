from __future__ import annotations

import argparse
import sys
from pathlib import Path

from vault_core.ai.models.approval_overlay import apply_ai_registry_evidence_overlay
from vault_core.ai.models.release_plan import load_registry_json


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        model_registry = load_registry_json(args.model_registry) if args.model_registry else None
        runtime_registry = load_registry_json(args.runtime_registry) if args.runtime_registry else None
        evidence = load_registry_json(args.evidence)
        overlay = apply_ai_registry_evidence_overlay(
            evidence=evidence,
            model_registry=model_registry,
            runtime_registry=runtime_registry,
            model_registry_label=str(args.model_registry) if args.model_registry else None,
            runtime_registry_label=str(args.runtime_registry) if args.runtime_registry else None,
            evidence_label=str(args.evidence),
        )
        if args.model_output:
            _write_output(args.model_output, overlay["model_registry_json"], trailing_newline=False)
        if args.runtime_output:
            _write_output(args.runtime_output, overlay["runtime_registry_json"], trailing_newline=False)
        if args.release_plan_output:
            _write_output(args.release_plan_output, overlay["release_plan_markdown"])
        if args.approval_template_output:
            _write_output(args.approval_template_output, overlay["approval_template_markdown"])
        if args.pin_handoff_output:
            _write_output(args.pin_handoff_output, overlay["pin_handoff_markdown"])
        output = overlay["bundle_json"] if args.format == "json" else _summary(overlay)
        if args.output:
            _write_output(args.output, output)
        else:
            print(output)
        if args.check:
            return 0 if overlay["status"] == "applied" and overlay["release_plan"]["summary"]["ready_to_pin"] else 1
        return 0 if overlay["status"] == "applied" else 1
    except Exception as exc:
        print(f"AI registry evidence overlay failed: {exc}", file=sys.stderr)
        return 2


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Apply a local AI approval evidence JSON overlay to candidate model/runtime registries."
    )
    parser.add_argument("--evidence", type=Path, required=True, help="Evidence overlay JSON path.")
    parser.add_argument(
        "--model-registry",
        type=Path,
        help="Candidate model_registry.json path. Defaults to the bundled registry.",
    )
    parser.add_argument(
        "--runtime-registry",
        type=Path,
        help="Candidate runtime_registry.json path. Defaults to the bundled registry.",
    )
    parser.add_argument("--format", choices=["summary", "json"], default="summary", help="Output format.")
    parser.add_argument("--output", type=Path, help="Write the evidence bundle to a file instead of stdout.")
    parser.add_argument("--model-output", type=Path, help="Write the patched model registry JSON to this path.")
    parser.add_argument("--runtime-output", type=Path, help="Write the patched runtime registry JSON to this path.")
    parser.add_argument("--release-plan-output", type=Path, help="Write the applied release-plan Markdown to this path.")
    parser.add_argument("--approval-template-output", type=Path, help="Write the applied approval-template Markdown to this path.")
    parser.add_argument("--pin-handoff-output", type=Path, help="Write the final pin handoff Markdown to this path.")
    parser.add_argument("--check", action="store_true", help="Exit zero only when the patched registries are ready to pin.")
    return parser.parse_args(argv)


def _summary(overlay: dict) -> str:
    release_summary = overlay["release_plan"]["summary"]
    validation_summary = overlay["validation"]["summary"]
    lines = [
        f"AI registry evidence overlay: {overlay['status']}",
        f"Applied fields: {overlay['applied_count']}",
        (
            "Structural validation: "
            f"{overlay['validation']['status']} "
            f"({validation_summary['error_count']} errors, {validation_summary['warning_count']} warnings)"
        ),
        (
            "Pin readiness: "
            f"{release_summary['ready_production_pack_count']}/{release_summary['production_pack_count']} packs, "
            f"{release_summary['ready_production_model_count']}/{release_summary['production_model_count']} models, "
            f"{release_summary['ready_production_runtime_count']}/{release_summary['production_runtime_count']} runtimes"
        ),
        f"Patched model registry SHA-256: {overlay['patched_model_registry_sha256']}",
        f"Patched runtime registry SHA-256: {overlay['patched_runtime_registry_sha256']}",
        f"Pin handoff: {overlay['pin_handoff_filename']}",
    ]
    if overlay["errors"]:
        lines.extend(["", "Errors:", *[f"- {error}" for error in overlay["errors"]]])
    if overlay["warnings"]:
        lines.extend(["", "Warnings:", *[f"- {warning}" for warning in overlay["warnings"]]])
    return "\n".join(lines)


def _write_output(path: Path, contents: str, *, trailing_newline: bool = True) -> None:
    output_path = path.expanduser()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    suffix = "\n" if trailing_newline else ""
    output_path.write_text(f"{contents}{suffix}", encoding="utf-8")
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    raise SystemExit(main())
