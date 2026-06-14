from __future__ import annotations

import argparse
import json
import sys
from dataclasses import replace
from pathlib import Path

from vault_core.ai.readiness import ai_production_readiness_report, format_production_readiness_report
from vault_core.ai.routing import ensure_ai_defaults
from vault_core.app import ensure_storage
from vault_core.api.schemas import AIProductionReadinessReport
from vault_core.config import Settings, load_settings
from vault_core.db.session import VaultDatabase


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    settings = _settings_for_args(args)
    report = _load_report(settings)
    output = _format_report(report, output_format=args.format, allow_demo=args.allow_demo)

    if args.output:
        output_path = args.output.expanduser()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(f"{output}\n", encoding="utf-8")
        print(f"Wrote {output_path}")
    else:
        print(output)

    if report.production_ready:
        return 0
    if args.allow_demo and report.demo_available:
        return 0
    return 1


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check whether local AI model packs, runtimes, privacy, and routes are production-ready."
    )
    parser.add_argument(
        "--allow-demo",
        action="store_true",
        help="Return success when the demo fixture path is available. Strict production gates should omit this.",
    )
    parser.add_argument(
        "--format",
        choices=["text", "json", "markdown"],
        default="text",
        help="Output format.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Write the readiness report to a file instead of stdout.",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        help="Override VAULT_DATA_DIR for the readiness check.",
    )
    return parser.parse_args(argv)


def _settings_for_args(args: argparse.Namespace) -> Settings:
    settings = load_settings()
    if args.data_dir:
        settings = replace(settings, data_dir=args.data_dir.expanduser())
    return settings


def _load_report(settings: Settings) -> AIProductionReadinessReport:
    db = VaultDatabase(settings.db_path, settings.workspace_name)
    db.init()
    ensure_storage(settings)
    ensure_ai_defaults(db)
    return ai_production_readiness_report(db, settings)


def _format_report(report: AIProductionReadinessReport, *, output_format: str, allow_demo: bool) -> str:
    if output_format == "json":
        return json.dumps(report.model_dump(mode="json"), indent=2)
    return format_production_readiness_report(report, output_format=output_format, allow_demo=allow_demo)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as exc:
        print(f"Local AI readiness check failed unexpectedly: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc
