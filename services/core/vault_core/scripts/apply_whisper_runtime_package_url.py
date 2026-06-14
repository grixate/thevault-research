from __future__ import annotations

import argparse
import copy
import json
import sys
import urllib.parse
from pathlib import Path
from typing import Any

from vault_core.ai.models.candidate_shortlist import (
    load_candidate_shortlist,
    write_candidate_runtime_registry_from_shortlist,
)

DEFAULT_CANDIDATE_ID = "whisper-cpp-macos-arm64"
PLACEHOLDER_MARKERS = {"", "REQUIRED_BEFORE_RELEASE", "REPLACE_WITH_APPROVED_WHISPER_CPP_PACKAGE_URL"}


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        result = apply_whisper_runtime_package_url(
            url=args.url,
            shortlist_path=args.shortlist,
            output_shortlist_path=args.output_shortlist,
            runtime_output_path=args.runtime_output,
            candidate_id=args.candidate_id,
        )
        if args.format == "json":
            print(json.dumps(result, indent=2))
        else:
            print(_format_summary(result))
        return 0
    except Exception as exc:
        print(f"Whisper runtime package URL application failed: {exc}", file=sys.stderr)
        return 2


def apply_whisper_runtime_package_url(
    *,
    url: str,
    shortlist_path: Path | None,
    output_shortlist_path: Path,
    runtime_output_path: Path | None,
    candidate_id: str = DEFAULT_CANDIDATE_ID,
) -> dict[str, Any]:
    normalized_url = _validate_package_url(url)
    shortlist = load_candidate_shortlist(shortlist_path) if shortlist_path else load_candidate_shortlist()
    updated_shortlist = copy.deepcopy(shortlist)
    candidate = _runtime_candidate(updated_shortlist, candidate_id)
    source = candidate.setdefault("source", {})
    if not isinstance(source, dict):
        raise ValueError(f"{candidate_id}.source must be an object.")
    previous_url = str(source.get("url") or "")
    source["url"] = normalized_url
    candidate["evidence_urls"] = _updated_evidence_urls(candidate.get("evidence_urls"), normalized_url)
    output_shortlist = output_shortlist_path.expanduser()
    output_shortlist.parent.mkdir(parents=True, exist_ok=True)
    output_shortlist.write_text(f"{json.dumps(updated_shortlist, indent=2)}\n", encoding="utf-8")

    runtime_summary: dict[str, Any] | None = None
    if runtime_output_path:
        runtime_result = write_candidate_runtime_registry_from_shortlist(
            runtime_output_path,
            updated_shortlist,
            selected_assets_only=True,
        )
        runtime_summary_source = runtime_result.get("summary") if isinstance(runtime_result.get("summary"), dict) else {}
        runtime_summary = {
            "applied_count": runtime_summary_source.get("applied_count", 0),
            "skipped_count": runtime_summary_source.get("skipped_count", 0),
            "errors": runtime_result.get("errors", []),
            "output": str(runtime_output_path.expanduser()),
        }

    return {
        "status": "applied",
        "candidate_id": candidate_id,
        "url": normalized_url,
        "previous_url": previous_url,
        "output_shortlist": str(output_shortlist),
        "runtime_output": str(runtime_output_path.expanduser()) if runtime_output_path else None,
        "runtime_generation": runtime_summary,
        "next_commands": _next_commands(output_shortlist, runtime_output_path),
    }


def _validate_package_url(url: str) -> str:
    value = str(url or "").strip()
    if value in PLACEHOLDER_MARKERS or value.startswith("REPLACE_WITH_"):
        raise ValueError("Package URL must be a concrete approved HTTP(S) URL.")
    parsed = urllib.parse.urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Package URL must use http:// or https:// with a hostname.")
    if parsed.username or parsed.password:
        raise ValueError("Package URL must not contain embedded credentials.")
    if not parsed.path.endswith(".tar.gz"):
        raise ValueError("Package URL must point at the approved .tar.gz whisper runtime package.")
    return value


def _runtime_candidate(shortlist: dict[str, Any], candidate_id: str) -> dict[str, Any]:
    for candidate in shortlist.get("runtime_candidates", []):
        if isinstance(candidate, dict) and candidate.get("id") == candidate_id:
            return candidate
    raise ValueError(f"Runtime candidate not found: {candidate_id}.")


def _updated_evidence_urls(existing: Any, package_url: str) -> list[str]:
    values = [str(value) for value in existing if value] if isinstance(existing, list) else []
    updated = [
        value
        for value in values
        if value != package_url and not value.startswith("file:///tmp/vault-whisper-package-script/")
    ]
    updated.append(package_url)
    return updated


def _next_commands(output_shortlist: Path, runtime_output_path: Path | None) -> list[str]:
    commands = [
        (
            "./scripts/plan_ai_candidate_shortlist.sh "
            f"--shortlist {output_shortlist} "
            "--format json"
        )
    ]
    if runtime_output_path:
        commands.extend(
            [
                (
                    "./scripts/probe_ai_registry_artifacts.sh "
                    "--model-registry /tmp/vault-candidate-model-registry.all-models-byte-patched.json "
                    f"--runtime-registry {runtime_output_path} "
                    "--format json --output /tmp/vault-whisper-published-source-probe.json"
                ),
                (
                    "./scripts/verify_ai_registry_artifacts.sh "
                    "--model-registry /tmp/vault-candidate-model-registry.all-models-byte-patched.json "
                    f"--runtime-registry {runtime_output_path} "
                    "--artifact-id whisper-cpp-managed-runtime "
                    "--max-bytes 2000000 "
                    "--format text "
                    "--output /tmp/vault-whisper-published-byte-verification.txt "
                    "--evidence-output /tmp/vault-whisper-published-byte-evidence.json"
                ),
            ]
        )
    return commands


def _format_summary(result: dict[str, Any]) -> str:
    lines = [
        "Whisper runtime package URL: applied",
        f"Candidate: {result['candidate_id']}",
        f"URL: {result['url']}",
        f"Previous URL: {result['previous_url']}",
        f"Updated shortlist: {result['output_shortlist']}",
    ]
    if result.get("runtime_output"):
        lines.append(f"Generated runtime registry: {result['runtime_output']}")
    runtime_generation = result.get("runtime_generation")
    if runtime_generation:
        lines.append(
            "Runtime generation: "
            f"{runtime_generation['applied_count']} applied / "
            f"{runtime_generation['skipped_count']} skipped / "
            f"{len(runtime_generation['errors'])} errors"
        )
    if result["next_commands"]:
        lines.extend(["", "Next commands:"])
        lines.extend(f"- {command}" for command in result["next_commands"])
    return "\n".join(lines)


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Apply an approved immutable whisper.cpp runtime package URL to a copied candidate shortlist."
    )
    parser.add_argument("--url", required=True, help="Approved immutable HTTP(S) URL for the packaged whisper.cpp tar.gz.")
    parser.add_argument("--shortlist", type=Path, help="Input candidate shortlist. Defaults to bundled shortlist.")
    parser.add_argument("--output-shortlist", type=Path, required=True, help="Write the updated candidate shortlist here.")
    parser.add_argument("--runtime-output", type=Path, help="Optionally generate a runtime registry from the updated shortlist.")
    parser.add_argument("--candidate-id", default=DEFAULT_CANDIDATE_ID, help="Runtime candidate ID to update.")
    parser.add_argument("--format", choices=["summary", "json"], default="summary", help="Output format.")
    return parser.parse_args(argv)


if __name__ == "__main__":
    raise SystemExit(main())
