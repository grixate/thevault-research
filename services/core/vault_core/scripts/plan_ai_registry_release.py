from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from vault_core.ai.models.release_plan import (
    build_ai_registry_release_plan,
    build_registry_pin_preview,
    format_release_plan_markdown,
    format_release_plan_text,
    load_registry_json,
    registry_file_sha256,
)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        model_registry = load_registry_json(args.model_registry) if args.model_registry else None
        runtime_registry = load_registry_json(args.runtime_registry) if args.runtime_registry else None
        plan = build_ai_registry_release_plan(model_registry, runtime_registry)
        if args.model_registry or args.runtime_registry:
            plan["pin_preview"] = build_registry_pin_preview(
                model_registry=model_registry if args.model_registry else None,
                runtime_registry=runtime_registry if args.runtime_registry else None,
                model_registry_sha256=registry_file_sha256(args.model_registry) if args.model_registry else None,
                runtime_registry_sha256=registry_file_sha256(args.runtime_registry) if args.runtime_registry else None,
            )
        output = _format_plan(plan, args.format)
        if args.output:
            output_path = args.output.expanduser()
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(f"{output}\n", encoding="utf-8")
            print(f"Wrote {output_path}")
        else:
            print(output)
        return 0 if plan["summary"]["ready_to_pin"] else 1
    except Exception as exc:
        print(f"AI registry release planning failed: {exc}", file=sys.stderr)
        return 2


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate candidate local AI model/runtime registries before pinning them for release."
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
    parser.add_argument("--output", type=Path, help="Write the release plan to a file instead of stdout.")
    return parser.parse_args(argv)


def _format_plan(plan: dict, output_format: str) -> str:
    if output_format == "json":
        return json.dumps(plan, indent=2)
    if output_format == "markdown":
        return format_release_plan_markdown(plan)
    return format_release_plan_text(plan)


if __name__ == "__main__":
    raise SystemExit(main())
