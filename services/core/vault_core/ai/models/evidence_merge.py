from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

from vault_core.db.session import now_iso


def merge_ai_registry_evidence_files(paths: list[Path]) -> dict[str, Any]:
    if not paths:
        raise ValueError("At least one evidence file is required.")
    merged: dict[str, Any] = {
        "schema_version": 1,
        "generated_at": now_iso(),
        "merged_from": [str(path) for path in paths],
        "models": {},
        "runtimes": {},
    }
    for path in paths:
        evidence = json.loads(path.expanduser().read_text(encoding="utf-8"))
        merge_ai_registry_evidence(merged, evidence, label=str(path))
    return merged


def merge_ai_registry_evidence(target: dict[str, Any], incoming: dict[str, Any], *, label: str = "<evidence>") -> None:
    for section in ("models", "runtimes"):
        target_section = target.setdefault(section, {})
        incoming_section = incoming.get(section) or {}
        if not isinstance(incoming_section, dict):
            raise ValueError(f"{label}.{section} must be an object.")
        for artifact_id, patch in incoming_section.items():
            if not isinstance(patch, dict):
                raise ValueError(f"{label}.{section}.{artifact_id} must be an object.")
            existing = target_section.get(artifact_id)
            if existing is None:
                target_section[artifact_id] = copy.deepcopy(patch)
                continue
            _merge_patch(existing, patch, f"{section}.{artifact_id}")


def _merge_patch(existing: dict[str, Any], incoming: dict[str, Any], path: str) -> None:
    incoming_files = incoming.get("files")
    if isinstance(incoming_files, list):
        existing["files"] = _merge_files(existing.get("files"), incoming_files, f"{path}.files")
    for key, value in incoming.items():
        if key == "files":
            continue
        if key not in existing:
            existing[key] = copy.deepcopy(value)
            continue
        _merge_value(existing, key, value, f"{path}.{key}")


def _merge_files(existing_files: Any, incoming_files: list[Any], path: str) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    if isinstance(existing_files, list):
        for index, file_info in enumerate(existing_files):
            if not isinstance(file_info, dict):
                raise ValueError(f"{path}[{index}] must be an object.")
            merged.append(copy.deepcopy(file_info))
    by_filename = {
        str(file_info.get("filename") or ""): file_info
        for file_info in merged
        if file_info.get("filename")
    }
    for index, incoming_file in enumerate(incoming_files):
        if not isinstance(incoming_file, dict):
            raise ValueError(f"{path}[{index}] must be an object.")
        filename = str(incoming_file.get("filename") or "")
        if filename and filename in by_filename:
            target_file = by_filename[filename]
        elif index < len(merged) and not filename:
            target_file = merged[index]
        else:
            copied = copy.deepcopy(incoming_file)
            merged.append(copied)
            if filename:
                by_filename[filename] = copied
            continue
        for key, value in incoming_file.items():
            if key not in target_file:
                target_file[key] = copy.deepcopy(value)
                continue
            _merge_value(target_file, key, value, f"{path}[{filename or index}].{key}")
    return merged


def _merge_value(target: dict[str, Any], key: str, incoming_value: Any, path: str) -> None:
    existing_value = target.get(key)
    if existing_value == incoming_value:
        return
    if isinstance(existing_value, dict) and isinstance(incoming_value, dict):
        _merge_patch(existing_value, incoming_value, path)
        return
    raise ValueError(f"Conflicting evidence for {path}: {existing_value!r} != {incoming_value!r}.")
