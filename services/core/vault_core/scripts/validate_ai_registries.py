from __future__ import annotations

import argparse
import json
import sys

from vault_core.ai.models.validation import validate_ai_registries


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    report = validate_ai_registries()
    if args.format == "json":
        print(json.dumps(report, indent=2))
    else:
        print(_format_text_report(report))

    if report["errors"]:
        return 1
    if args.strict_warnings and report["warnings"]:
        return 1
    return 0


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate AI model and runtime registry structure before release checks."
    )
    parser.add_argument("--format", choices=["text", "json"], default="text", help="Output format.")
    parser.add_argument(
        "--strict-warnings",
        action="store_true",
        help="Return non-zero when registry placeholders or other warnings remain.",
    )
    return parser.parse_args(argv)


def _format_text_report(report: dict) -> str:
    summary = report["summary"]
    lines = [
        f"AI registry validation: {report['status']}",
        (
            "Entries: "
            f"{summary['model_count']} models / "
            f"{summary['model_pack_count']} packs / "
            f"{summary['runtime_count']} runtimes"
        ),
        f"Errors: {summary['error_count']}",
        f"Warnings: {summary['warning_count']}",
    ]
    if report["errors"]:
        lines.extend(["", "Errors:"])
        lines.extend(f"- {error}" for error in report["errors"])
    if report["warnings"]:
        lines.extend(["", "Warnings:"])
        lines.extend(f"- {warning}" for warning in report["warnings"])
    return "\n".join(lines)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as exc:
        print(f"AI registry validation failed unexpectedly: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc
