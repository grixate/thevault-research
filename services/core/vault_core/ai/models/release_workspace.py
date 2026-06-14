from __future__ import annotations

import json
from typing import Any

from vault_core.db.session import VaultDatabase, dumps, loads, now_iso

WORKSPACE_ID = "current"
MAX_RELEASE_WORKSPACE_BYTES = 8 * 1024 * 1024


def empty_release_workspace() -> dict[str, Any]:
    return {
        "schema_version": 1,
        "has_workspace": False,
        "updated_at": None,
        "candidate_payload": None,
        "candidate_release_plan": None,
        "candidate_metadata_hydration": None,
        "candidate_artifact_probe": None,
        "candidate_artifact_verification": None,
        "candidate_evidence": None,
        "candidate_status": None,
        "error": None,
    }


def read_release_workspace(db: VaultDatabase) -> dict[str, Any]:
    with db.connect() as conn:
        row = conn.execute(
            """
            SELECT state_json, updated_at
            FROM ai_registry_release_workspaces
            WHERE workspace_id=? AND id=?
            """,
            (db.workspace_id, WORKSPACE_ID),
        ).fetchone()
    if not row:
        return empty_release_workspace()
    try:
        state = loads(row["state_json"], {}) or {}
    except json.JSONDecodeError:
        workspace = empty_release_workspace()
        workspace["updated_at"] = row["updated_at"]
        workspace["error"] = "Saved release workspace state is not valid JSON."
        return workspace
    workspace = empty_release_workspace()
    workspace.update(state)
    workspace["schema_version"] = 1
    workspace["has_workspace"] = True
    workspace["updated_at"] = row["updated_at"]
    workspace["error"] = None
    return workspace


def save_release_workspace(db: VaultDatabase, payload: dict[str, Any]) -> dict[str, Any]:
    state = {key: value for key, value in payload.items() if value is not None}
    state["schema_version"] = 1
    state.pop("has_workspace", None)
    state.pop("updated_at", None)
    state.pop("error", None)
    state_json = dumps(state)
    size = len(state_json.encode("utf-8"))
    if size > MAX_RELEASE_WORKSPACE_BYTES:
        raise ValueError(f"Release workspace is too large ({size} bytes, max {MAX_RELEASE_WORKSPACE_BYTES}).")
    ts = now_iso()
    with db.connect() as conn:
        conn.execute(
            """
            INSERT INTO ai_registry_release_workspaces (workspace_id, id, state_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(workspace_id, id) DO UPDATE SET
              state_json=excluded.state_json,
              updated_at=excluded.updated_at
            """,
            (db.workspace_id, WORKSPACE_ID, state_json, ts, ts),
        )
        db.event(
            conn,
            action="ai_registry_release_workspace_saved",
            target_type="ai_registry_release_workspace",
            target_id=WORKSPACE_ID,
            payload={
                "size_bytes": size,
                "has_candidate": bool(state.get("candidate_release_plan")),
                "has_evidence": bool(state.get("candidate_evidence")),
            },
        )
    return read_release_workspace(db)


def clear_release_workspace(db: VaultDatabase) -> dict[str, Any]:
    with db.connect() as conn:
        conn.execute(
            """
            DELETE FROM ai_registry_release_workspaces
            WHERE workspace_id=? AND id=?
            """,
            (db.workspace_id, WORKSPACE_ID),
        )
        db.event(
            conn,
            action="ai_registry_release_workspace_cleared",
            target_type="ai_registry_release_workspace",
            target_id=WORKSPACE_ID,
        )
    return empty_release_workspace()
