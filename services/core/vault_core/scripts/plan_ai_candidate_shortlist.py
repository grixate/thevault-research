from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from vault_core.ai.models.candidate_shortlist import (
    build_candidate_shortlist_report,
    format_candidate_shortlist_markdown,
    format_candidate_shortlist_text,
    load_candidate_shortlist,
)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        shortlist = load_candidate_shortlist(args.shortlist) if args.shortlist else None
        report = build_candidate_shortlist_report(shortlist)
        output = _format_report(report, args.format)
        if args.output:
            output_path = args.output.expanduser()
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(f"{output}\n", encoding="utf-8")
            print(f"Wrote {output_path}")
        else:
            print(output)
        return 0 if report["summary"]["error_count"] == 0 else 1
    except Exception as exc:
        print(f"AI candidate shortlist planning failed: {exc}", file=sys.stderr)
        return 2


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check the production local-AI candidate shortlist before manifest hydration."
    )
    parser.add_argument(
        "--shortlist",
        type=Path,
        help="Candidate shortlist JSON path. Defaults to the bundled candidate_shortlist.json.",
    )
    parser.add_argument("--format", choices=["text", "json", "markdown"], default="text", help="Output format.")
    parser.add_argument("--output", type=Path, help="Write the shortlist report to a file instead of stdout.")
    return parser.parse_args(argv)


def _format_report(report: dict, output_format: str) -> str:
    if output_format == "json":
        return json.dumps(report, indent=2)
    if output_format == "markdown":
        return format_candidate_shortlist_markdown(report)
    return format_candidate_shortlist_text(report)


if __name__ == "__main__":
    raise SystemExit(main())
