from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from vault_core.ai.models.approval_template import (
    build_ai_approval_template,
    build_ai_evidence_overlay_template,
    format_approval_template_markdown,
)
from vault_core.ai.models.release_plan import load_registry_json
from vault_core.db.session import now_iso


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        model_registry = load_registry_json(args.model_registry) if args.model_registry else None
        runtime_registry = load_registry_json(args.runtime_registry) if args.runtime_registry else None
        report = build_ai_approval_template(model_registry, runtime_registry)
        evidence = build_ai_evidence_overlay_template(
            report,
            model_registry_label=str(args.model_registry) if args.model_registry else None,
            runtime_registry_label=str(args.runtime_registry) if args.runtime_registry else None,
        )
        payload = {
            "generated_at": now_iso(),
            "filename": _filename(args),
            "mime_type": "text/markdown",
            "markdown": format_approval_template_markdown(
                report,
                model_registry_label=str(args.model_registry) if args.model_registry else None,
                runtime_registry_label=str(args.runtime_registry) if args.runtime_registry else None,
            ),
            "report": report,
            "evidence_filename": _evidence_filename(args),
            "evidence_mime_type": "application/json",
            "evidence_json": json.dumps(evidence, indent=2),
            "evidence": evidence,
            "model_registry_label": str(args.model_registry) if args.model_registry else None,
            "runtime_registry_label": str(args.runtime_registry) if args.runtime_registry else None,
        }
        if args.evidence_output:
            _write_output(args.evidence_output, payload["evidence_json"])
        output = _format_payload(payload, args.format)
        if args.output:
            _write_output(args.output, output)
        else:
            print(output)
        return 0 if not args.check or report["status"] == "ready" else 1
    except Exception as exc:
        print(f"AI approval template export failed: {exc}", file=sys.stderr)
        return 2


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export a local AI manifest approval template for bundled or candidate registries."
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
    parser.add_argument(
        "--format",
        choices=["markdown", "json", "evidence-json"],
        default="markdown",
        help="Output format.",
    )
    parser.add_argument("--output", type=Path, help="Write the approval template to a file instead of stdout.")
    parser.add_argument("--evidence-output", type=Path, help="Also write the fillable evidence overlay JSON template.")
    parser.add_argument("--check", action="store_true", help="Exit non-zero when any approval fields remain pending.")
    return parser.parse_args(argv)


def _filename(args: argparse.Namespace) -> str:
    if args.model_registry or args.runtime_registry:
        return "candidate-local-ai-approval-template.md"
    return "local-ai-approval-template.md"


def _evidence_filename(args: argparse.Namespace) -> str:
    if args.model_registry or args.runtime_registry:
        return "candidate-local-ai-evidence-template.json"
    return "local-ai-evidence-template.json"


def _format_payload(payload: dict, output_format: str) -> str:
    if output_format == "json":
        return json.dumps(payload, indent=2)
    if output_format == "evidence-json":
        return str(payload["evidence_json"])
    return str(payload["markdown"])


def _write_output(path: Path, contents: str) -> None:
    output_path = path.expanduser()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(f"{contents}\n", encoding="utf-8")
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    raise SystemExit(main())
