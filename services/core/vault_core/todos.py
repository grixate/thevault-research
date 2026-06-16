from __future__ import annotations

import re
import sqlite3
from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import HTTPException

from vault_core.db.session import VaultDatabase, dumps, loads, new_id, now_iso, rows_to_dicts

TODO_TARGET_TYPES = {
    "note",
    "source",
    "source_block",
    "claim",
    "kg_node",
    "review_item",
    "capsule",
    "learning_item",
    "tool",
    "lab_job",
    "assistant_answer",
}

WEEKDAYS = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def list_todos(db: VaultDatabase, *, view: str = "inbox", list_id: str | None = None, limit: int = 100, offset: int = 0) -> dict[str, Any]:
    today = date.today().isoformat()
    view = normalize_todo_view(view)
    where = ["t.workspace_id=?"]
    params: list[Any] = [db.workspace_id]
    if view == "inbox":
        where.append("t.status='open'")
        if not list_id:
            where.append("t.list_id IS NULL")
    elif view == "today":
        where.extend(["t.status='open'", "t.due_date IS NOT NULL", "t.due_date<=?"])
        params.append(today)
    elif view == "upcoming":
        where.extend(["t.status='open'", "t.due_date IS NOT NULL", "t.due_date>?"])
        params.append(today)
    elif view == "completed":
        where.append("t.status='completed'")
    else:
        where.append("t.status!='archived'")
    if list_id:
        where.append("t.list_id=?")
        params.append(list_id)
    order = "t.completed_at DESC, t.updated_at DESC" if view == "completed" else "COALESCE(t.due_date, '9999-12-31'), t.priority, t.sort_index, t.created_at DESC"
    sql = f"""
        SELECT t.*, l.name AS list_name
        FROM todos t
        LEFT JOIN todo_lists l ON l.id=t.list_id
        WHERE {' AND '.join(where)}
        ORDER BY {order}
        LIMIT ? OFFSET ?
    """
    params.extend([limit, offset])
    with db.connect() as conn:
        rows = conn.execute(sql, tuple(params)).fetchall()
        total = int(conn.execute(f"SELECT COUNT(*) FROM todos t WHERE {' AND '.join(where)}", tuple(params[:-2])).fetchone()[0])
        items = [inflate_todo(conn, row) for row in rows]
        return {"items": items, "total": total, "view": view}


def list_todo_lists(db: VaultDatabase) -> list[dict[str, Any]]:
    with db.connect() as conn:
        rows = conn.execute(
            """
            SELECT l.*,
                   COUNT(t.id) AS open_count
            FROM todo_lists l
            LEFT JOIN todos t ON t.list_id=l.id AND t.status='open'
            WHERE l.workspace_id=? AND l.status='active'
            GROUP BY l.id
            ORDER BY l.sort_index, lower(l.name)
            """,
            (db.workspace_id,),
        ).fetchall()
        return rows_to_dicts(rows)


def create_todo(db: VaultDatabase, payload: dict[str, Any]) -> dict[str, Any]:
    parsed = parse_todo_text(str(payload.get("text") or payload.get("title") or ""))
    title = str(payload.get("title") or parsed["title"]).strip()
    if not title:
        raise HTTPException(422, "Todo title is required")
    ts = now_iso()
    priority = normalize_priority(payload["priority"] if payload.get("priority") is not None else parsed.get("priority"))
    labels = normalize_string_list([*parsed.get("labels", []), *payload.get("labels", [])])
    list_name = str(payload.get("list_name") or parsed.get("list_name") or "").strip()
    due_date = payload.get("due_date") or parsed.get("due_date")
    recurrence_rule = payload.get("recurrence_rule") or parsed.get("recurrence_rule")
    context_links = payload.get("context_links") if isinstance(payload.get("context_links"), list) else []
    todo_id = new_id("todo")
    with db.connect() as conn:
        list_id = ensure_todo_list(conn, db.workspace_id, list_name, ts) if list_name else None
        conn.execute(
            """
            INSERT INTO todos
              (id, workspace_id, list_id, title, description, status, priority, due_date,
               recurrence_rule, source_kind, source_ref_json, provenance_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                todo_id,
                db.workspace_id,
                list_id,
                title,
                str(payload.get("description") or ""),
                priority,
                due_date,
                recurrence_rule,
                str(payload.get("source_kind") or "user"),
                dumps(payload.get("source_ref") or {}),
                dumps(payload.get("provenance") or {}),
                ts,
                ts,
            ),
        )
        for label_name in labels:
            label_id = ensure_todo_label(conn, db.workspace_id, label_name, ts)
            conn.execute(
                "INSERT OR IGNORE INTO todo_label_links (todo_id, label_id, created_at) VALUES (?, ?, ?)",
                (todo_id, label_id, ts),
            )
        for link in context_links:
            create_context_link(conn, db.workspace_id, todo_id, link, ts)
        db.event(conn, "todo.created", "todo", todo_id, {"title": title, "due_date": due_date}, "user")
        return get_todo_by_id(conn, db.workspace_id, todo_id)


def update_todo(db: VaultDatabase, todo_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    ts = now_iso()
    allowed = {
        "title": "title",
        "description": "description",
        "priority": "priority",
        "due_date": "due_date",
        "due_time": "due_time",
        "deadline_date": "deadline_date",
        "recurrence_rule": "recurrence_rule",
        "scheduled_for": "scheduled_for",
    }
    assignments: list[str] = []
    values: list[Any] = []
    for key, column in allowed.items():
        if key not in payload:
            continue
        value = normalize_priority(payload[key]) if key == "priority" else payload[key]
        if key == "title":
            value = str(value or "").strip()
            if not value:
                raise HTTPException(422, "Todo title is required")
        assignments.append(f"{column}=?")
        values.append(value)
    if "status" in payload:
        status = str(payload["status"])
        if status not in {"open", "completed", "cancelled", "archived"}:
            raise HTTPException(422, "Unsupported todo status")
        assignments.append("status=?")
        values.append(status)
        if status == "completed":
            assignments.append("completed_at=?")
            values.append(ts)
        if status == "cancelled":
            assignments.append("cancelled_at=?")
            values.append(ts)
    if not assignments:
        raise HTTPException(422, "No todo fields to update")
    assignments.append("updated_at=?")
    values.append(ts)
    values.extend([todo_id, db.workspace_id])
    with db.connect() as conn:
        existing = conn.execute("SELECT id FROM todos WHERE id=? AND workspace_id=?", (todo_id, db.workspace_id)).fetchone()
        if not existing:
            raise HTTPException(404, "Todo not found")
        conn.execute(f"UPDATE todos SET {', '.join(assignments)} WHERE id=? AND workspace_id=?", tuple(values))
        db.event(conn, "todo.updated", "todo", todo_id, {"fields": list(payload.keys())}, "user")
        return get_todo_by_id(conn, db.workspace_id, todo_id)


def complete_todo(db: VaultDatabase, todo_id: str) -> dict[str, Any]:
    return update_todo(db, todo_id, {"status": "completed"})


def get_todo_by_id(conn: sqlite3.Connection, workspace_id: str, todo_id: str) -> dict[str, Any]:
    row = conn.execute(
        """
        SELECT t.*, l.name AS list_name
        FROM todos t
        LEFT JOIN todo_lists l ON l.id=t.list_id
        WHERE t.id=? AND t.workspace_id=?
        """,
        (todo_id, workspace_id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Todo not found")
    return inflate_todo(conn, row)


def inflate_todo(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    todo = dict(row)
    todo["source_ref"] = loads(todo.pop("source_ref_json"), {})
    todo["provenance"] = loads(todo.pop("provenance_json"), {})
    label_rows = conn.execute(
        """
        SELECT label.name
        FROM todo_labels label
        JOIN todo_label_links link ON link.label_id=label.id
        WHERE link.todo_id=?
        ORDER BY lower(label.name)
        """,
        (todo["id"],),
    ).fetchall()
    context_rows = conn.execute(
        "SELECT * FROM todo_context_links WHERE todo_id=? ORDER BY created_at, id",
        (todo["id"],),
    ).fetchall()
    todo["labels"] = [row["name"] for row in label_rows]
    todo["context_links"] = [inflate_context_link(row) for row in context_rows]
    return todo


def inflate_context_link(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["metadata"] = loads(item.pop("metadata_json"), {})
    return item


def parse_todo_text(text: str, *, today: date | None = None) -> dict[str, Any]:
    today = today or datetime.now(UTC).date()
    tokens = text.strip().split()
    kept: list[str] = []
    labels: list[str] = []
    list_name: str | None = None
    priority: int | None = None
    due_date: str | None = None
    recurrence_rule: str | None = None
    index = 0
    while index < len(tokens):
        token = tokens[index]
        lower = token.lower().strip(",.")
        cleaned = token.strip(",.")
        if lower.startswith("@") and len(lower) > 1:
            labels.append(clean_token(cleaned[1:]))
        elif lower.startswith("#") and len(lower) > 1:
            list_parts = [clean_token(cleaned[1:])]
            lookahead = index + 1
            while lookahead < len(tokens) and not token_is_control(tokens[lookahead]):
                list_parts.append(tokens[lookahead].strip(",."))
                lookahead += 1
            list_name = " ".join(part for part in list_parts if part).strip()
            index = lookahead - 1
        elif re.fullmatch(r"p[1-4]", lower):
            priority = int(lower[1])
        elif lower == "today":
            due_date = today.isoformat()
        elif lower == "tomorrow":
            due_date = (today + timedelta(days=1)).isoformat()
        elif lower == "next" and index + 1 < len(tokens) and tokens[index + 1].lower().strip(",.") == "week":
            due_date = next_weekday(today, 0).isoformat()
            index += 1
        elif lower in WEEKDAYS:
            due_date = next_weekday(today, WEEKDAYS[lower]).isoformat()
        elif lower == "every" and index + 1 < len(tokens):
            recurrence_rule = " ".join(tokens[index:]).strip()
            break
        else:
            kept.append(token)
        index += 1
    return {
        "title": " ".join(kept).strip(),
        "labels": labels,
        "list_name": list_name,
        "priority": priority,
        "due_date": due_date,
        "recurrence_rule": recurrence_rule,
    }


def token_is_control(token: str) -> bool:
    lower = token.lower().strip(",.")
    return lower.startswith("@") or lower.startswith("#") or re.fullmatch(r"p[1-4]", lower) is not None or lower in {"today", "tomorrow", "next", "every", *WEEKDAYS}


def clean_token(value: str) -> str:
    return value.strip().strip(",.").replace("_", " ")


def next_weekday(today: date, weekday: int) -> date:
    days = (weekday - today.weekday()) % 7
    if days == 0:
        days = 7
    return today + timedelta(days=days)


def normalize_todo_view(view: str) -> str:
    return view if view in {"inbox", "today", "upcoming", "completed", "all"} else "inbox"


def normalize_priority(value: Any) -> int:
    try:
        priority = int(value or 4)
    except (TypeError, ValueError):
        priority = 4
    return max(1, min(4, priority))


def normalize_string_list(values: list[Any]) -> list[str]:
    result: list[str] = []
    for value in values:
        text = clean_token(str(value or ""))
        if text and text not in result:
            result.append(text)
    return result


def ensure_todo_list(conn: sqlite3.Connection, workspace_id: str, name: str, ts: str) -> str:
    existing = conn.execute("SELECT id FROM todo_lists WHERE workspace_id=? AND lower(name)=lower(?)", (workspace_id, name)).fetchone()
    if existing:
        return str(existing["id"])
    list_id = new_id("tdl")
    conn.execute(
        "INSERT INTO todo_lists (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (list_id, workspace_id, name, ts, ts),
    )
    return list_id


def ensure_todo_label(conn: sqlite3.Connection, workspace_id: str, name: str, ts: str) -> str:
    existing = conn.execute("SELECT id FROM todo_labels WHERE workspace_id=? AND lower(name)=lower(?)", (workspace_id, name)).fetchone()
    if existing:
        return str(existing["id"])
    label_id = new_id("tdlbl")
    conn.execute(
        "INSERT INTO todo_labels (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (label_id, workspace_id, name, ts, ts),
    )
    return label_id


def create_context_link(conn: sqlite3.Connection, workspace_id: str, todo_id: str, link: dict[str, Any], ts: str) -> None:
    target_type = str(link.get("target_type") or "")
    target_id = str(link.get("target_id") or "")
    if target_type not in TODO_TARGET_TYPES or not target_id:
        raise HTTPException(422, "Unsupported todo context link")
    conn.execute(
        """
        INSERT INTO todo_context_links
          (id, workspace_id, todo_id, target_type, target_id, target_title, relation,
           exact_quote, locator, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_id("tdctx"),
            workspace_id,
            todo_id,
            target_type,
            target_id,
            link.get("target_title"),
            str(link.get("relation") or "related"),
            link.get("exact_quote"),
            link.get("locator"),
            dumps(link.get("metadata") or {}),
            ts,
        ),
    )
