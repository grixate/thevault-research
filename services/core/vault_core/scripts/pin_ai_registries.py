from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from vault_core.ai.models import registry as model_registry_module
from vault_core.ai.models import runtime_installer as runtime_registry_module
from vault_core.ai.models.release_plan import (
    build_ai_registry_release_plan,
    build_registry_pin_preview,
    load_registry_json,
    registry_file_sha256,
)
from vault_core.ai.models.validation import current_registry_policy, write_registry_policy


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        if args.model_registry or args.runtime_registry:
            result = _candidate_pin_result(
                model_registry_path=args.model_registry,
                runtime_registry_path=args.runtime_registry,
                dry_run=args.check,
            )
            output = _format_candidate_pin_result(result, args.format)
            _write_or_print(output, args.output)
            return 0 if result["ready_to_pin"] else 1
        policy = current_registry_policy() if args.check else write_registry_policy()
    except Exception as exc:
        print(f"AI registry pinning failed: {exc}", file=sys.stderr)
        return 2
    output = _format_policy(policy, args.format, check=args.check)
    _write_or_print(output, args.output)
    return 0


def _candidate_pin_result(
    *,
    model_registry_path: Path | None,
    runtime_registry_path: Path | None,
    dry_run: bool,
) -> dict:
    model_registry = load_registry_json(model_registry_path) if model_registry_path else None
    runtime_registry = load_registry_json(runtime_registry_path) if runtime_registry_path else None
    plan = build_ai_registry_release_plan(model_registry, runtime_registry)
    plan["pin_preview"] = build_registry_pin_preview(
        model_registry=model_registry,
        runtime_registry=runtime_registry,
        model_registry_sha256=registry_file_sha256(model_registry_path) if model_registry_path else None,
        runtime_registry_sha256=registry_file_sha256(runtime_registry_path) if runtime_registry_path else None,
    )
    ready_to_pin = bool(plan["summary"]["ready_to_pin"])
    writes = _candidate_writes(model_registry_path=model_registry_path, runtime_registry_path=runtime_registry_path)
    if ready_to_pin and not dry_run:
        _copy_candidate_registries(writes)
        policy = write_registry_policy()
    else:
        policy = current_registry_policy()
    return {
        "status": "ready_to_pin" if ready_to_pin else "blocked",
        "ready_to_pin": ready_to_pin,
        "dry_run": dry_run,
        "wrote_policy": ready_to_pin and not dry_run,
        "writes": writes,
        "policy": policy,
        "plan": plan,
    }


def _candidate_writes(*, model_registry_path: Path | None, runtime_registry_path: Path | None) -> list[dict[str, str]]:
    writes = []
    if model_registry_path:
        writes.append(
            {
                "registry": "model_registry",
                "source": str(model_registry_path.expanduser()),
                "target": str(model_registry_module.REGISTRY_PATH),
                "sha256": registry_file_sha256(model_registry_path),
            }
        )
    if runtime_registry_path:
        writes.append(
            {
                "registry": "runtime_registry",
                "source": str(runtime_registry_path.expanduser()),
                "target": str(runtime_registry_module.REGISTRY_PATH),
                "sha256": registry_file_sha256(runtime_registry_path),
            }
        )
    return writes


def _copy_candidate_registries(writes: list[dict[str, str]]) -> None:
    for write in writes:
        source = Path(write["source"]).expanduser().resolve()
        target = Path(write["target"]).expanduser().resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        if source == target:
            continue
        shutil.copyfile(source, target)


def _format_candidate_pin_result(result: dict, output_format: str) -> str:
    if output_format == "json":
        return json.dumps(result, indent=2)
    if output_format == "markdown":
        return _format_candidate_pin_markdown(result)

    action = "Candidate AI registry pin check" if result["dry_run"] else "Candidate AI registry pin"
    lines = [f"{action}: {result['status']}"]
    if result["plan"]["pin_preview"]:
        lines.append("Pin preview:")
        for registry in result["plan"]["pin_preview"]["registries"]:
            lines.append(
                f"- {registry['registry']}: {registry['candidate_sha256']} "
                f"({registry['total_added']} added / {registry['total_changed']} changed / {registry['total_removed']} removed)"
            )
    if result["writes"]:
        lines.append("Registry files:")
        for write in result["writes"]:
            prefix = "Would write" if result["dry_run"] or not result["ready_to_pin"] else "Wrote"
            lines.append(f"- {prefix} {write['registry']}: {write['source']} -> {write['target']} ({write['sha256']})")
    if result["ready_to_pin"]:
        policy_action = "Would write registry_policy.json" if result["dry_run"] else "Wrote registry_policy.json"
        lines.append(policy_action)
        for registry_id, info in result["policy"]["registries"].items():
            lines.append(f"- {registry_id}: {info['sha256']} ({info['path']})")
    elif result["plan"]["next_actions"]:
        lines.append("Next actions:")
        for action in result["plan"]["next_actions"]:
            lines.append(f"- {action}")
    return "\n".join(lines)


def _format_candidate_pin_markdown(result: dict) -> str:
    summary = result["plan"]["summary"]
    lines = [
        "# Candidate AI Registry Acceptance",
        "",
        f"- Status: **{result['status']}**",
        f"- Ready to pin: **{'yes' if result['ready_to_pin'] else 'no'}**",
        f"- Dry run: **{'yes' if result['dry_run'] else 'no'}**",
        f"- Policy written: **{'yes' if result['wrote_policy'] else 'no'}**",
        "",
        "## Gate Summary",
        "",
        "| Gate | Value |",
        "| --- | ---: |",
        f"| Validation errors | {summary['validation_error_count']} |",
        f"| Validation warnings | {summary['validation_warning_count']} |",
        f"| Blocked artifact checks | {summary['blocked_count']} |",
        f"| Production packs ready | {summary['ready_production_pack_count']}/{summary['production_pack_count']} |",
        f"| Production models ready | {summary['ready_production_model_count']}/{summary['production_model_count']} |",
        f"| Production runtimes ready | {summary['ready_production_runtime_count']}/{summary['production_runtime_count']} |",
        "",
    ]
    pin_preview = result["plan"].get("pin_preview")
    if pin_preview:
        lines.extend(
            [
                "## Pin Preview",
                "",
                "| Registry | Candidate SHA-256 | Added | Changed | Removed |",
                "| --- | --- | ---: | ---: | ---: |",
            ]
        )
        for registry in pin_preview["registries"]:
            lines.append(
                f"| `{registry['registry']}` | `{registry['candidate_sha256']}` | "
                f"{registry['total_added']} | {registry['total_changed']} | {registry['total_removed']} |"
            )
        lines.append("")
    lines.extend(["## Registry Writes", ""])
    if result["writes"]:
        lines.extend(
            [
                "| Registry | Source | Target | SHA-256 |",
                "| --- | --- | --- | --- |",
            ]
        )
        for write in result["writes"]:
            lines.append(f"| `{write['registry']}` | `{write['source']}` | `{write['target']}` | `{write['sha256']}` |")
        lines.append("")
    else:
        lines.extend(["- No candidate registry files were provided.", ""])
    lines.extend(["## Policy", ""])
    for registry_id, info in result["policy"]["registries"].items():
        lines.append(f"- `{registry_id}`: `{info['sha256']}` (`{info['path']}`)")
    lines.extend(["", "## Next Actions", ""])
    if result["plan"]["next_actions"]:
        lines.extend(f"- [ ] {action}" for action in result["plan"]["next_actions"])
    elif result["ready_to_pin"] and result["dry_run"]:
        lines.append("- [x] Candidate manifests passed the dry-run gate; run the pin command without `--check` after review.")
    else:
        lines.append("- [x] Candidate manifests are pinned.")
    return "\n".join(lines).rstrip()


def _format_policy(policy: dict, output_format: str, *, check: bool) -> str:
    if output_format == "json":
        return json.dumps(policy, indent=2)
    if output_format == "markdown":
        title = "Current AI Registry Policy" if check else "Pinned AI Registries"
        lines = [f"# {title}", "", f"- Mode: `{policy['pin_mode']}`", "", "## Registries", ""]
        for registry_id, info in policy["registries"].items():
            lines.append(f"- `{registry_id}`: `{info['sha256']}` (`{info['path']}`)")
        return "\n".join(lines)
    action = "Current AI registry policy" if check else "Pinned AI registries"
    lines = [action]
    for registry_id, info in policy["registries"].items():
        lines.append(f"- {registry_id}: {info['sha256']} ({info['path']})")
    return "\n".join(lines)


def _write_or_print(output: str, output_path: Path | None) -> None:
    if output_path:
        target = output_path.expanduser()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(f"{output}\n", encoding="utf-8")
        print(f"Wrote {target}")
        return
    print(output)


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Write the app-pinned local AI registry policy for approved manifest edits."
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Print the current manifest digests without writing registry_policy.json.",
    )
    parser.add_argument(
        "--model-registry",
        type=Path,
        help="Approved candidate model_registry.json to copy into the bundled registry before pinning.",
    )
    parser.add_argument(
        "--runtime-registry",
        type=Path,
        help="Approved candidate runtime_registry.json to copy into the bundled registry before pinning.",
    )
    parser.add_argument("--format", choices=["text", "json", "markdown"], default="text", help="Output format.")
    parser.add_argument("--output", type=Path, help="Write the pin check or policy output to a file instead of stdout.")
    return parser.parse_args(argv)


if __name__ == "__main__":
    raise SystemExit(main())
