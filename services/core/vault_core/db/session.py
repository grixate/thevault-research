from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterator

from vault_core.db.schema import SCHEMA_SQL


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def dumps(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def loads(value: str | None, fallback: Any = None) -> Any:
    if not value:
        return fallback
    return json.loads(value)


class VaultDatabase:
    def __init__(self, db_path: Path, workspace_name: str) -> None:
        self.db_path = db_path
        self.workspace_name = workspace_name
        self.workspace_id = "wrk_default"

    def init(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            conn.executescript(SCHEMA_SQL)
            _ensure_schema_migrations(conn)
            ts = now_iso()
            conn.execute(
                """
                INSERT INTO workspaces (id, name, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at
                """,
                (self.workspace_id, self.workspace_name, ts, ts),
            )

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def event(
        self,
        conn: sqlite3.Connection,
        action: str,
        target_type: str,
        target_id: str | None = None,
        payload: dict[str, Any] | None = None,
        actor: str = "core",
    ) -> None:
        conn.execute(
            """
            INSERT INTO event_log (id, workspace_id, actor, action, target_type, target_id, payload_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id("evt"),
                self.workspace_id,
                actor,
                action,
                target_type,
                target_id,
                dumps(payload or {}),
                now_iso(),
            ),
        )


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return dict(row)


def rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


def _ensure_schema_migrations(conn: sqlite3.Connection) -> None:
    _ensure_columns(
        conn,
        "ai_installed_models",
        {
            "license_label": "TEXT",
            "license_url": "TEXT",
            "license_path": "TEXT",
        },
    )
    _ensure_columns(
        conn,
        "ai_runtime_installs",
        {
            "install_log_json": "TEXT NOT NULL DEFAULT '[]'",
        },
    )
    _ensure_columns(
        conn,
        "todos",
        {
            "parent_todo_id": "TEXT",
        },
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_todos_parent ON todos(parent_todo_id)")
    _backfill_installed_model_license_columns(conn)


def _ensure_columns(conn: sqlite3.Connection, table: str, columns: dict[str, str]) -> None:
    existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    for column, definition in columns.items():
        if column not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def _backfill_installed_model_license_columns(conn: sqlite3.Connection) -> None:
    rows = conn.execute(
        """
        SELECT id, manifest_json, license_label, license_url, license_path
        FROM ai_installed_models
        """
    ).fetchall()
    fields = ("license_label", "license_url", "license_path")
    for row in rows:
        try:
            manifest = loads(row["manifest_json"], {}) or {}
        except json.JSONDecodeError:
            continue
        updates = {field: manifest.get(field) for field in fields if not row[field] and manifest.get(field)}
        if not updates:
            continue
        assignments = ", ".join(f"{field}=?" for field in updates)
        conn.execute(
            f"UPDATE ai_installed_models SET {assignments} WHERE id=?",
            [*updates.values(), row["id"]],
        )
