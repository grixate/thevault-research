from __future__ import annotations

import argparse
import json
import sys
from dataclasses import replace
from pathlib import Path
from typing import Any

from vault_core.ai.readiness import ai_production_readiness_report
from vault_core.ai.routing import ensure_ai_defaults
from vault_core.ai.setup_runner import run_ai_setup
from vault_core.api.schemas import AISetupRunRequest
from vault_core.app import ensure_storage
from vault_core.config import Settings, load_settings
from vault_core.db.session import VaultDatabase


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    settings = _settings_for_args(args)
    db = VaultDatabase(settings.db_path, settings.workspace_name)
    db.init()
    ensure_storage(settings)
    ensure_ai_defaults(db)

    req = AISetupRunRequest(
        mode=args.mode,
        pack_id=args.pack_id,
        install_runtimes=not args.no_install_runtimes,
        download_models=not args.no_download_models,
        activate_routes=not args.no_activate_routes,
        include_optional_models=args.include_optional_models,
        dry_run=not args.execute,
        timeout_seconds=args.timeout_seconds,
    )
    setup = run_ai_setup(db, settings, req)
    readiness = ai_production_readiness_report(db, settings)
    report = {
        "status": setup.status,
        "executed": bool(args.execute),
        "setup": setup.model_dump(mode="json"),
        "readiness": readiness.model_dump(mode="json"),
    }
    output = _format_report(report, args.format)
    if args.output:
        output_path = args.output.expanduser()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(f"{output}\n", encoding="utf-8")
        print(f"Wrote {output_path}")
    else:
        print(output)

    if args.strict_ready and not readiness.production_ready:
        return 1
    return 1 if setup.status in {"blocked", "failed"} else 0


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Plan or run the local AI setup path that installs approved runtimes/models and activates routes."
    )
    parser.add_argument("--execute", action="store_true", help="Run setup for real. Omit this to perform a dry-run only.")
    parser.add_argument("--mode", choices=["recommended", "demo"], default="recommended", help="Setup mode to run.")
    parser.add_argument("--pack-id", help="Specific model pack id. Defaults to the setup runner recommendation.")
    parser.add_argument("--include-optional-models", action="store_true", help="Include optional model add-ons.")
    parser.add_argument("--no-install-runtimes", action="store_true", help="Skip runtime installation.")
    parser.add_argument("--no-download-models", action="store_true", help="Skip model downloads.")
    parser.add_argument("--no-activate-routes", action="store_true", help="Skip capability route activation.")
    parser.add_argument("--timeout-seconds", type=float, default=120, help="Wait time for each model download before reporting queued progress.")
    parser.add_argument("--strict-ready", action="store_true", help="Return failure unless strict production readiness is ready after the run.")
    parser.add_argument("--format", choices=["text", "json"], default="text", help="Output format.")
    parser.add_argument("--output", type=Path, help="Write the report to a file instead of stdout.")
    parser.add_argument("--data-dir", type=Path, help="Override VAULT_DATA_DIR for this setup run.")
    return parser.parse_args(argv)


def _settings_for_args(args: argparse.Namespace) -> Settings:
    settings = load_settings()
    if args.data_dir:
        settings = replace(settings, data_dir=args.data_dir.expanduser())
    return settings


def _format_report(report: dict[str, Any], output_format: str) -> str:
    if output_format == "json":
        return json.dumps(report, indent=2)
    setup = report["setup"]
    readiness = report["readiness"]
    action = "run" if report["executed"] else "check"
    lines = [
        f"Local AI setup {action}: {setup['status']}",
        f"Pack: {setup['pack_id']} ({setup['release_channel']})",
        f"Planned downloads: {setup.get('planned_download_count', 0)} / {_format_bytes(setup.get('planned_download_bytes', 0))}",
        f"Routes: {len(setup.get('selected_capabilities') or [])}",
        "",
        "Steps:",
    ]
    for step in setup.get("steps", []):
        detail = step.get("detail")
        lines.append(f"- [{step.get('status')}] {step.get('title')}" + (f" - {detail}" if detail else ""))
    summary = readiness.get("summary", {})
    lines.extend(
        [
            "",
            f"Readiness: {readiness.get('status')} / production ready: {_yes_no(readiness.get('production_ready'))}",
            f"Blocked checks: {summary.get('blocked_count', 0)}",
        ]
    )
    return "\n".join(lines)


def _format_bytes(value: int | None) -> str:
    if not value:
        return "0 B"
    if value < 1024:
        return f"{value} B"
    if value < 1024 * 1024:
        return f"{value / 1024:.1f} KB"
    if value < 1024 * 1024 * 1024:
        return f"{value / (1024 * 1024):.1f} MB"
    return f"{value / (1024 * 1024 * 1024):.1f} GB"


def _yes_no(value: Any) -> str:
    return "yes" if value else "no"


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as exc:
        print(f"Local AI setup run failed unexpectedly: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc
