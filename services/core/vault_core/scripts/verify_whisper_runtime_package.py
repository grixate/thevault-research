from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path
from typing import Any

from vault_core.ai.models.candidate_shortlist import load_candidate_shortlist

DEFAULT_CANDIDATE_ID = "whisper-cpp-macos-arm64"


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        report = verify_whisper_runtime_package(
            package_path=args.package,
            shortlist_path=args.shortlist,
            candidate_id=args.candidate_id,
            metadata_path=args.metadata,
        )
        output = json.dumps(report, indent=2) if args.format == "json" else _format_summary(report)
        if args.output:
            output_path = args.output.expanduser()
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(f"{output}\n", encoding="utf-8")
            print(f"Wrote {output_path}")
        else:
            print(output)
        return 0 if report["status"] == "pass" else 1
    except Exception as exc:
        print(f"Whisper runtime package verification failed: {exc}", file=sys.stderr)
        return 2


def verify_whisper_runtime_package(
    *,
    package_path: Path,
    shortlist_path: Path | None = None,
    candidate_id: str = DEFAULT_CANDIDATE_ID,
    metadata_path: Path | None = None,
) -> dict[str, Any]:
    package = package_path.expanduser()
    shortlist = load_candidate_shortlist(shortlist_path) if shortlist_path else load_candidate_shortlist()
    candidate = _runtime_candidate(shortlist, candidate_id)
    source = candidate.get("source") if isinstance(candidate.get("source"), dict) else {}
    smoke_test = candidate.get("smoke_test") if isinstance(candidate.get("smoke_test"), dict) else {}
    archive_member = str(source.get("archive_member") or "")
    expected_asset = str(source.get("asset") or "")
    expected_sha256 = str(source.get("asset_sha256") or "")
    expected_size = source.get("asset_size_bytes")

    checks: list[dict[str, Any]] = []
    checks.append(_check("package:path", package.exists() and package.is_file(), f"Package exists: {package}."))
    checks.append(_check("package:filename", package.name == expected_asset, f"Package filename is {package.name}; expected {expected_asset}."))
    actual_size = package.stat().st_size if package.exists() else None
    checks.append(_check("package:size", actual_size == expected_size, f"Package size is {actual_size}; expected {expected_size}."))
    actual_sha256 = _sha256(package) if package.exists() else None
    checks.append(_check("package:sha256", actual_sha256 == expected_sha256, f"Package SHA-256 is {actual_sha256}; expected {expected_sha256}."))

    binary_report: dict[str, Any] = {}
    if package.exists() and archive_member:
        binary_report = _verify_archive_member(package, archive_member, smoke_test)
        checks.extend(binary_report["checks"])
    else:
        checks.append(_check("archive:member", False, "Archive member is not available for verification."))

    metadata_report = _verify_metadata(metadata_path, package, expected_asset, expected_sha256, expected_size, archive_member)
    checks.extend(metadata_report["checks"])
    status = "pass" if all(check["status"] == "pass" for check in checks) else "blocked"
    return {
        "status": status,
        "candidate_id": candidate_id,
        "package": {
            "path": str(package),
            "filename": package.name,
            "sha256": actual_sha256,
            "size_bytes": actual_size,
            "expected_sha256": expected_sha256,
            "expected_size_bytes": expected_size,
        },
        "archive_member": archive_member,
        "binary": binary_report.get("binary"),
        "metadata": metadata_report.get("metadata"),
        "checks": checks,
        "next_actions": _next_actions(checks),
    }


def _verify_archive_member(package: Path, archive_member: str, smoke_test: dict[str, Any]) -> dict[str, Any]:
    checks: list[dict[str, Any]] = []
    binary: dict[str, Any] | None = None
    with tempfile.TemporaryDirectory(prefix="vault-whisper-package-verify-") as temp_dir:
        target_path = Path(temp_dir) / Path(archive_member).name
        try:
            with tarfile.open(package) as archive:
                info = archive.getmember(archive_member)
                checks.append(_check("archive:member", info.isfile(), f"Archive member found: {archive_member}."))
                source = archive.extractfile(info)
                if source is None:
                    checks.append(_check("archive:read", False, "Archive member could not be read."))
                    return {"checks": checks, "binary": binary}
                with source, target_path.open("wb") as target:
                    shutil.copyfileobj(source, target)
                mode = info.mode & 0o777
                target_path.chmod(mode or 0o755)
        except (KeyError, tarfile.TarError) as exc:
            checks.append(_check("archive:member", False, f"Archive member verification failed: {exc}."))
            return {"checks": checks, "binary": binary}

        executable = os.access(target_path, os.X_OK)
        binary_sha256 = _sha256(target_path)
        binary_size = target_path.stat().st_size
        smoke = _run_smoke(target_path, smoke_test)
        checks.append(_check("binary:executable", executable, "Extracted binary is executable."))
        checks.append(_check("binary:smoke", smoke["status"] == "pass", smoke["detail"]))
        binary = {
            "path": str(target_path),
            "sha256": binary_sha256,
            "size_bytes": binary_size,
            "executable": executable,
            "smoke": smoke,
        }
    return {"checks": checks, "binary": binary}


def _verify_metadata(
    metadata_path: Path | None,
    package: Path,
    expected_asset: str,
    expected_sha256: str,
    expected_size: Any,
    archive_member: str,
) -> dict[str, Any]:
    metadata_file = metadata_path.expanduser() if metadata_path else package.with_name(f"{package.name.removesuffix('.tar.gz')}.metadata.json")
    if not metadata_file.exists():
        return {"metadata": None, "checks": []}
    metadata = json.loads(metadata_file.read_text(encoding="utf-8"))
    checks = [
        _check("metadata:filename", metadata.get("package_filename") == expected_asset, "Metadata package filename matches candidate asset."),
        _check("metadata:sha256", metadata.get("sha256") == expected_sha256, "Metadata package SHA-256 matches candidate asset."),
        _check("metadata:size", metadata.get("size_bytes") == expected_size, "Metadata package size matches candidate asset."),
        _check("metadata:archive_member", metadata.get("archive_member") == archive_member, "Metadata archive member matches candidate source."),
    ]
    return {"metadata": metadata, "checks": checks}


def _run_smoke(path: Path, smoke_test: dict[str, Any]) -> dict[str, Any]:
    args = smoke_test.get("args")
    if not isinstance(args, list) or not all(isinstance(arg, str) for arg in args):
        args = ["--help"]
    allowed_exit_codes = smoke_test.get("allowed_exit_codes")
    if not isinstance(allowed_exit_codes, list) or not all(isinstance(code, int) for code in allowed_exit_codes):
        allowed_exit_codes = [0]
    timeout_seconds = smoke_test.get("timeout_seconds")
    if not isinstance(timeout_seconds, int | float) or timeout_seconds <= 0:
        timeout_seconds = 10
    command = [str(path), *args]
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=float(timeout_seconds), check=False)
    except Exception as exc:
        return {"status": "blocked", "command": command, "detail": f"Smoke command failed: {exc}."}
    stdout = (completed.stdout or "").strip()
    stderr = (completed.stderr or "").strip()
    output = stdout or stderr
    first_line = output.splitlines()[0] if output else ""
    if completed.returncode not in allowed_exit_codes:
        return {
            "status": "blocked",
            "command": command,
            "exit_code": completed.returncode,
            "detail": f"Smoke command exited with {completed.returncode}.",
        }
    if not first_line:
        return {"status": "blocked", "command": command, "exit_code": completed.returncode, "detail": "Smoke command returned no output."}
    return {
        "status": "pass",
        "command": command,
        "exit_code": completed.returncode,
        "first_line": first_line[:500],
        "detail": f"Smoke command passed: {first_line[:500]}.",
    }


def _runtime_candidate(shortlist: dict[str, Any], candidate_id: str) -> dict[str, Any]:
    for candidate in shortlist.get("runtime_candidates", []):
        if isinstance(candidate, dict) and candidate.get("id") == candidate_id:
            return candidate
    raise ValueError(f"Runtime candidate not found: {candidate_id}.")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _check(check_id: str, passed: bool, detail: str) -> dict[str, str]:
    return {"id": check_id, "status": "pass" if passed else "blocked", "detail": detail}


def _next_actions(checks: list[dict[str, str]]) -> list[str]:
    if all(check["status"] == "pass" for check in checks):
        return ["Publish this package to the approved immutable URL, then apply the URL helper and re-run source/byte probes."]
    return ["Rebuild or replace the package before publishing; at least one pre-publish check failed."]


def _format_summary(report: dict[str, Any]) -> str:
    lines = [
        f"Whisper runtime package verification: {report['status']}",
        f"Package: {report['package']['path']}",
        f"SHA-256: {report['package']['sha256']}",
        f"Size bytes: {report['package']['size_bytes']}",
        f"Archive member: {report['archive_member']}",
    ]
    binary = report.get("binary") or {}
    smoke = binary.get("smoke") or {}
    if smoke:
        lines.append(f"Smoke: {smoke['status']} ({smoke.get('first_line') or smoke.get('detail')})")
    lines.extend(["", "Checks:"])
    lines.extend(f"- {check['status']}: {check['id']} - {check['detail']}" for check in report["checks"])
    if report["next_actions"]:
        lines.extend(["", "Next actions:"])
        lines.extend(f"- {action}" for action in report["next_actions"])
    return "\n".join(lines)


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify the local whisper.cpp runtime package before publishing it to the approved URL."
    )
    parser.add_argument("--package", type=Path, required=True, help="Path to whisper.cpp macOS arm64 tar.gz package.")
    parser.add_argument("--shortlist", type=Path, help="Candidate shortlist JSON path. Defaults to bundled shortlist.")
    parser.add_argument("--candidate-id", default=DEFAULT_CANDIDATE_ID, help="Runtime candidate ID to verify.")
    parser.add_argument("--metadata", type=Path, help="Optional package metadata JSON path.")
    parser.add_argument("--output", type=Path, help="Write report to a file instead of stdout.")
    parser.add_argument("--format", choices=["summary", "json"], default="summary", help="Output format.")
    return parser.parse_args(argv)


if __name__ == "__main__":
    raise SystemExit(main())
