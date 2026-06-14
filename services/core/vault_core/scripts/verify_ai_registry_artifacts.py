from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from vault_core.ai.models.artifact_verification import (
    DEFAULT_MAX_BYTES,
    DEFAULT_TIMEOUT_SECONDS,
    build_ai_registry_artifact_verification,
    format_artifact_verification_markdown,
    format_artifact_verification_text,
)
from vault_core.ai.models.release_plan import load_registry_json


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        model_registry = load_registry_json(args.model_registry) if args.model_registry else None
        runtime_registry = load_registry_json(args.runtime_registry) if args.runtime_registry else None
        report = build_ai_registry_artifact_verification(
            model_registry,
            runtime_registry,
            timeout_seconds=args.timeout,
            max_bytes=args.max_bytes,
            artifact_ids=args.artifact_id,
        )
        output = _format_report(
            report,
            args.format,
            model_registry_label=str(args.model_registry) if args.model_registry else None,
            runtime_registry_label=str(args.runtime_registry) if args.runtime_registry else None,
        )
        if args.evidence_output:
            _write_output(args.evidence_output, json.dumps(report["evidence"], indent=2))
        if args.output:
            _write_output(args.output, output)
        else:
            print(output)
        return 0 if report["status"] != "blocked" else 1
    except Exception as exc:
        print(f"AI registry artifact byte verification failed: {exc}", file=sys.stderr)
        return 2


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download candidate local AI model/runtime artifacts, compute byte evidence, and avoid installation."
    )
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
    parser.add_argument("--format", choices=["text", "json", "markdown"], default="text", help="Output format.")
    parser.add_argument("--output", type=Path, help="Write the verification report to a file instead of stdout.")
    parser.add_argument("--evidence-output", type=Path, help="Write fillable evidence overlay JSON to this path.")
    parser.add_argument(
        "--timeout",
        type=float,
        default=DEFAULT_TIMEOUT_SECONDS,
        help="HTTP timeout in seconds per artifact download.",
    )
    parser.add_argument(
        "--max-bytes",
        type=int,
        default=DEFAULT_MAX_BYTES,
        help="Maximum bytes to stream for each artifact before blocking verification.",
    )
    parser.add_argument(
        "--artifact-id",
        action="append",
        default=[],
        help="Verify only a specific production model/runtime id. May be passed more than once.",
    )
    return parser.parse_args(argv)


def _format_report(
    report: dict,
    output_format: str,
    *,
    model_registry_label: str | None,
    runtime_registry_label: str | None,
) -> str:
    if output_format == "json":
        return json.dumps(report, indent=2)
    if output_format == "markdown":
        return format_artifact_verification_markdown(
            report,
            model_registry_label=model_registry_label,
            runtime_registry_label=runtime_registry_label,
        )
    return format_artifact_verification_text(report)


def _write_output(path: Path, contents: str) -> None:
    output_path = path.expanduser()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(f"{contents}\n", encoding="utf-8")
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    raise SystemExit(main())
