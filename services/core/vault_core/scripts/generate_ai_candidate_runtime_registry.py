from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from vault_core.ai.models.candidate_shortlist import (
    format_candidate_runtime_registry_summary,
    load_candidate_shortlist,
    write_candidate_runtime_registry_from_shortlist,
)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        shortlist = load_candidate_shortlist(args.shortlist) if args.shortlist else None
        result = write_candidate_runtime_registry_from_shortlist(
            args.output,
            shortlist,
            selected_assets_only=not args.include_unselected,
        )
        if args.format == "json":
            print(json.dumps(_report_without_registry(result), indent=2))
        else:
            print(format_candidate_runtime_registry_summary(result))
        if result["errors"]:
            return 1
        print(f"Wrote {args.output.expanduser()}")
        return 0
    except Exception as exc:
        print(f"AI candidate runtime registry generation failed: {exc}", file=sys.stderr)
        return 2


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a candidate runtime_registry.json from the production local-AI shortlist."
    )
    parser.add_argument("--output", type=Path, required=True, help="Write the candidate runtime registry JSON here.")
    parser.add_argument(
        "--shortlist",
        type=Path,
        help="Candidate shortlist JSON path. Defaults to the bundled candidate_shortlist.json.",
    )
    parser.add_argument(
        "--include-unselected",
        action="store_true",
        help="Also patch runtime candidates whose release asset is still marked TO_SELECT.",
    )
    parser.add_argument("--format", choices=["summary", "json"], default="summary", help="Output format.")
    return parser.parse_args(argv)


def _report_without_registry(result: dict) -> dict:
    return {key: value for key, value in result.items() if key != "registry"}


if __name__ == "__main__":
    raise SystemExit(main())
