from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from vault_core.ai.models.evidence_merge import merge_ai_registry_evidence_files


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        merged = merge_ai_registry_evidence_files(args.evidence)
        output = json.dumps(merged, indent=2)
        if args.output:
            output_path = args.output.expanduser()
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(f"{output}\n", encoding="utf-8")
            print(f"Wrote {output_path}")
        else:
            print(output)
        return 0
    except Exception as exc:
        print(f"AI registry evidence merge failed: {exc}", file=sys.stderr)
        return 2


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Merge local AI registry evidence JSON files, rejecting conflicting artifact metadata."
    )
    parser.add_argument(
        "evidence",
        nargs="+",
        type=Path,
        help="Evidence JSON file to merge. Pass multiple files in application order.",
    )
    parser.add_argument("--output", type=Path, help="Write merged evidence JSON to this path.")
    return parser.parse_args(argv)


if __name__ == "__main__":
    raise SystemExit(main())
