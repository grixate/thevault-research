from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from vault_core.ai.models.huggingface_metadata import (
    DEFAULT_HUGGINGFACE_API_BASE_URL,
    DEFAULT_TIMEOUT_SECONDS,
    format_huggingface_hydration_summary,
    hydrate_huggingface_model_registry_file,
)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        result = hydrate_huggingface_model_registry_file(
            args.model_registry,
            args.output,
            model_ids=set(args.model_id) if args.model_id else None,
            revision=args.revision,
            refresh=args.refresh,
            timeout_seconds=args.timeout,
            api_base_url=args.api_base_url,
        )
        if args.format == "json":
            print(json.dumps(_report_without_registry(result), indent=2))
        else:
            print(format_huggingface_hydration_summary(result))
        if result["errors"]:
            return 1
        print(f"Wrote {args.output.expanduser()}")
        return 0
    except Exception as exc:
        print(f"AI registry metadata hydration failed: {exc}", file=sys.stderr)
        return 2


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Hydrate candidate Hugging Face model registry entries with immutable revision, "
            "file size, LFS SHA-256, and license label metadata."
        )
    )
    parser.add_argument("--model-registry", type=Path, required=True, help="Candidate model_registry.json path.")
    parser.add_argument("--output", type=Path, required=True, help="Write the hydrated model registry JSON here.")
    parser.add_argument(
        "--model-id",
        action="append",
        help="Only hydrate this model id. May be supplied more than once.",
    )
    parser.add_argument(
        "--revision",
        default="main",
        help="Revision to resolve when the registry still has REQUIRED_BEFORE_RELEASE. Defaults to main.",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Refresh already-pinned Hugging Face revision, size, checksum, and license label values.",
    )
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT_SECONDS, help="HTTP timeout in seconds.")
    parser.add_argument("--format", choices=["summary", "json"], default="summary", help="Output format.")
    parser.add_argument(
        "--api-base-url",
        default=DEFAULT_HUGGINGFACE_API_BASE_URL,
        help=argparse.SUPPRESS,
    )
    return parser.parse_args(argv)


def _report_without_registry(result: dict) -> dict:
    return {key: value for key, value in result.items() if key != "registry"}


if __name__ == "__main__":
    raise SystemExit(main())
