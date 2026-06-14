from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from vault_core.ai.models.artifact_probe import (
    DEFAULT_TIMEOUT_SECONDS,
    build_ai_registry_artifact_probe,
    format_artifact_probe_markdown,
    format_artifact_probe_text,
)
from vault_core.ai.models.release_plan import load_registry_json


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        model_registry = load_registry_json(args.model_registry) if args.model_registry else None
        runtime_registry = load_registry_json(args.runtime_registry) if args.runtime_registry else None
        report = build_ai_registry_artifact_probe(
            model_registry,
            runtime_registry,
            timeout_seconds=args.timeout,
        )
        output = _format_report(
            report,
            args.format,
            model_registry_label=str(args.model_registry) if args.model_registry else None,
            runtime_registry_label=str(args.runtime_registry) if args.runtime_registry else None,
        )
        if args.output:
            output_path = args.output.expanduser()
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(f"{output}\n", encoding="utf-8")
            print(f"Wrote {output_path}")
        else:
            print(output)
        return 0 if report["status"] == "pass" else 1
    except Exception as exc:
        print(f"AI registry artifact probe failed: {exc}", file=sys.stderr)
        return 2


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Probe candidate local AI model/runtime source and license URLs without downloading full artifacts."
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
    parser.add_argument("--output", type=Path, help="Write the probe report to a file instead of stdout.")
    parser.add_argument(
        "--timeout",
        type=float,
        default=DEFAULT_TIMEOUT_SECONDS,
        help="HTTP timeout in seconds per source or license URL.",
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
        return format_artifact_probe_markdown(
            report,
            model_registry_label=model_registry_label,
            runtime_registry_label=runtime_registry_label,
        )
    return format_artifact_probe_text(report)


if __name__ == "__main__":
    raise SystemExit(main())
