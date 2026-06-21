from __future__ import annotations

import re
import sqlite3
from calendar import monthrange
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
    where.append("t.parent_todo_id IS NULL")
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


def create_todo_list(db: VaultDatabase, payload: dict[str, Any]) -> dict[str, Any]:
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(422, "Todo list name is required")
    ts = now_iso()
    with db.connect() as conn:
        existing = conn.execute(
            "SELECT id, status FROM todo_lists WHERE workspace_id=? AND lower(name)=lower(?)",
            (db.workspace_id, name),
        ).fetchone()
        if existing:
            if existing["status"] != "active":
                conn.execute(
                    "UPDATE todo_lists SET status='active', archived_at=NULL, updated_at=? WHERE id=? AND workspace_id=?",
                    (ts, existing["id"], db.workspace_id),
                )
            return get_todo_list_by_id(conn, db.workspace_id, str(existing["id"]))
        list_id = new_id("tdl")
        sort_index = int(
            conn.execute(
                "SELECT COALESCE(MAX(sort_index), 0) + 1 FROM todo_lists WHERE workspace_id=?",
                (db.workspace_id,),
            ).fetchone()[0]
        )
        conn.execute(
            """
            INSERT INTO todo_lists (id, workspace_id, name, color, icon, sort_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                list_id,
                db.workspace_id,
                name,
                payload.get("color"),
                payload.get("icon"),
                sort_index,
                ts,
                ts,
            ),
        )
        db.event(conn, "todo_list.created", "todo_list", list_id, {"name": name}, "user")
        return get_todo_list_by_id(conn, db.workspace_id, list_id)


def update_todo_list(db: VaultDatabase, list_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    ts = now_iso()
    assignments: list[str] = []
    values: list[Any] = []
    if "name" in payload:
        name = str(payload.get("name") or "").strip()
        if not name:
            raise HTTPException(422, "Todo list name is required")
        assignments.append("name=?")
        values.append(name)
    for key in ("color", "icon"):
        if key in payload:
            assignments.append(f"{key}=?")
            values.append(payload.get(key))
    if "status" in payload:
        status = str(payload.get("status") or "")
        if status not in {"active", "archived"}:
            raise HTTPException(422, "Unsupported todo list status")
        assignments.append("status=?")
        values.append(status)
        assignments.append("archived_at=?")
        values.append(ts if status == "archived" else None)
    if not assignments:
        raise HTTPException(422, "No todo list fields to update")
    assignments.append("updated_at=?")
    values.append(ts)
    values.extend([list_id, db.workspace_id])
    with db.connect() as conn:
        existing = conn.execute("SELECT id FROM todo_lists WHERE id=? AND workspace_id=?", (list_id, db.workspace_id)).fetchone()
        if not existing:
            raise HTTPException(404, "Todo list not found")
        if "name" in payload:
            duplicate = conn.execute(
                "SELECT id FROM todo_lists WHERE workspace_id=? AND lower(name)=lower(?) AND id!=?",
                (db.workspace_id, str(payload.get("name") or "").strip(), list_id),
            ).fetchone()
            if duplicate:
                raise HTTPException(409, "Todo list name already exists")
        conn.execute(f"UPDATE todo_lists SET {', '.join(assignments)} WHERE id=? AND workspace_id=?", tuple(values))
        db.event(conn, "todo_list.updated", "todo_list", list_id, {"fields": list(payload.keys())}, "user")
        return get_todo_list_by_id(conn, db.workspace_id, list_id)


def create_todo(db: VaultDatabase, payload: dict[str, Any]) -> dict[str, Any]:
    ts = now_iso()
    with db.connect() as conn:
        return create_todo_with_conn(conn, db, payload, ts)


def create_todo_with_conn(conn: sqlite3.Connection, db: VaultDatabase, payload: dict[str, Any], ts: str | None = None) -> dict[str, Any]:
    ts = ts or now_iso()
    parsed = parse_todo_text(str(payload.get("text") or payload.get("title") or ""))
    title = str(payload.get("title") or parsed["title"]).strip()
    if not title:
        raise HTTPException(422, "Todo title is required")
    priority = normalize_priority(payload["priority"] if payload.get("priority") is not None else parsed.get("priority"))
    labels = normalize_string_list([*parsed.get("labels", []), *payload.get("labels", [])])
    list_name = str(payload.get("list_name") or parsed.get("list_name") or "").strip()
    due_date = payload.get("due_date") or parsed.get("due_date")
    recurrence_rule = payload.get("recurrence_rule") or parsed.get("recurrence_rule")
    context_links = payload.get("context_links") if isinstance(payload.get("context_links"), list) else []
    parent_todo_id = str(payload.get("parent_todo_id") or "").strip() or None
    todo_id = new_id("todo")
    if parent_todo_id:
        ensure_todo_exists(conn, db.workspace_id, parent_todo_id)
    list_id = ensure_todo_list(conn, db.workspace_id, list_name, ts) if list_name else None
    conn.execute(
        """
        INSERT INTO todos
          (id, workspace_id, list_id, parent_todo_id, title, description, status, priority, due_date,
           recurrence_rule, source_kind, source_ref_json, provenance_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            todo_id,
            db.workspace_id,
            list_id,
            parent_todo_id,
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
    db.event(conn, "todo.created", "todo", todo_id, {"title": title, "due_date": due_date, "parent_todo_id": parent_todo_id}, "user")
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
    label_values = payload.get("labels") if isinstance(payload.get("labels"), list) else None
    list_id_value: str | None | object = _UNSET
    if "list_id" in payload:
        raw_list_id = payload.get("list_id")
        list_id_value = str(raw_list_id).strip() if raw_list_id else None
    if "list_name" in payload:
        list_name = str(payload.get("list_name") or "").strip()
        list_id_value = list_name
    if not assignments:
        if label_values is None and list_id_value is _UNSET:
            raise HTTPException(422, "No todo fields to update")
    assignments.append("updated_at=?")
    values.append(ts)
    values.extend([todo_id, db.workspace_id])
    with db.connect() as conn:
        existing = conn.execute("SELECT id FROM todos WHERE id=? AND workspace_id=?", (todo_id, db.workspace_id)).fetchone()
        if not existing:
            raise HTTPException(404, "Todo not found")
        if list_id_value is not _UNSET:
            resolved_list_id = resolve_todo_list_id(conn, db.workspace_id, list_id_value, ts)
            assignments.insert(-1, "list_id=?")
            values.insert(-3, resolved_list_id)
        conn.execute(f"UPDATE todos SET {', '.join(assignments)} WHERE id=? AND workspace_id=?", tuple(values))
        if label_values is not None:
            replace_todo_labels(conn, db.workspace_id, todo_id, label_values, ts)
        db.event(conn, "todo.updated", "todo", todo_id, {"fields": list(payload.keys())}, "user")
        return get_todo_by_id(conn, db.workspace_id, todo_id)


def complete_todo(db: VaultDatabase, todo_id: str) -> dict[str, Any]:
    ts = now_iso()
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM todos WHERE id=? AND workspace_id=?", (todo_id, db.workspace_id)).fetchone()
        if not row:
            raise HTTPException(404, "Todo not found")
        if row["status"] == "completed":
            return get_todo_by_id(conn, db.workspace_id, todo_id)
        recurrence_rule = str(row["recurrence_rule"] or "").strip()
        next_due_date = next_recurrence_due_date(recurrence_rule, row["due_date"])
        if next_due_date:
            conn.execute(
                """
                UPDATE todos
                SET status='open', due_date=?, completed_at=NULL, updated_at=?
                WHERE id=? AND workspace_id=?
                """,
                (next_due_date, ts, todo_id, db.workspace_id),
            )
            db.event(
                conn,
                "todo.recurrence_completed",
                "todo",
                todo_id,
                {
                    "completed_at": ts,
                    "previous_due_date": row["due_date"],
                    "next_due_date": next_due_date,
                    "recurrence_rule": recurrence_rule,
                },
                "user",
            )
            return get_todo_by_id(conn, db.workspace_id, todo_id)
    return update_todo(db, todo_id, {"status": "completed"})


def update_todo_context_link(db: VaultDatabase, todo_id: str, link_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    allowed = {
        "relation": "relation",
        "exact_quote": "exact_quote",
        "locator": "locator",
    }
    assignments: list[str] = []
    values: list[Any] = []
    for key, column in allowed.items():
        if key not in payload:
            continue
        value = str(payload[key] or "").strip() if key == "relation" else payload[key]
        if key == "relation" and not value:
            value = "related"
        assignments.append(f"{column}=?")
        values.append(value)
    if "metadata" in payload:
        metadata = payload.get("metadata")
        if metadata is not None and not isinstance(metadata, dict):
            raise HTTPException(422, "Todo context metadata must be an object")
        assignments.append("metadata_json=?")
        values.append(dumps(metadata or {}))
    if not assignments:
        raise HTTPException(422, "No todo context fields to update")
    values.extend([link_id, todo_id, db.workspace_id])
    with db.connect() as conn:
        ensure_todo_context_link(conn, db.workspace_id, todo_id, link_id)
        conn.execute(
            f"""
            UPDATE todo_context_links
            SET {', '.join(assignments)}
            WHERE id=? AND todo_id=? AND workspace_id=?
            """,
            tuple(values),
        )
        conn.execute("UPDATE todos SET updated_at=? WHERE id=? AND workspace_id=?", (now_iso(), todo_id, db.workspace_id))
        db.event(conn, "todo_context.updated", "todo", todo_id, {"link_id": link_id, "fields": list(payload.keys())}, "user")
        return get_todo_by_id(conn, db.workspace_id, todo_id)


def delete_todo_context_link(db: VaultDatabase, todo_id: str, link_id: str) -> dict[str, Any]:
    with db.connect() as conn:
        ensure_todo_context_link(conn, db.workspace_id, todo_id, link_id)
        conn.execute("DELETE FROM todo_context_links WHERE id=? AND todo_id=? AND workspace_id=?", (link_id, todo_id, db.workspace_id))
        conn.execute("UPDATE todos SET updated_at=? WHERE id=? AND workspace_id=?", (now_iso(), todo_id, db.workspace_id))
        db.event(conn, "todo_context.deleted", "todo", todo_id, {"link_id": link_id}, "user")
        return get_todo_by_id(conn, db.workspace_id, todo_id)


def ensure_todo_context_link(conn: sqlite3.Connection, workspace_id: str, todo_id: str, link_id: str) -> sqlite3.Row:
    row = conn.execute(
        "SELECT id FROM todo_context_links WHERE id=? AND todo_id=? AND workspace_id=?",
        (link_id, todo_id, workspace_id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Todo context link not found")
    return row


def ensure_todo_exists(conn: sqlite3.Connection, workspace_id: str, todo_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT id FROM todos WHERE id=? AND workspace_id=?", (todo_id, workspace_id)).fetchone()
    if not row:
        raise HTTPException(404, "Todo not found")
    return row


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


def get_todo_list_by_id(conn: sqlite3.Connection, workspace_id: str, list_id: str) -> dict[str, Any]:
    row = conn.execute(
        """
        SELECT l.*,
               COUNT(t.id) AS open_count
        FROM todo_lists l
        LEFT JOIN todos t ON t.list_id=l.id AND t.status='open'
        WHERE l.id=? AND l.workspace_id=?
        GROUP BY l.id
        """,
        (list_id, workspace_id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Todo list not found")
    return dict(row)


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
    subtask_rows = conn.execute(
        """
        SELECT t.*, l.name AS list_name
        FROM todos t
        LEFT JOIN todo_lists l ON l.id=t.list_id
        WHERE t.workspace_id=? AND t.parent_todo_id=?
        ORDER BY t.status='completed', t.sort_index, t.created_at, t.id
        """,
        (row["workspace_id"], todo["id"]),
    ).fetchall()
    todo["labels"] = [row["name"] for row in label_rows]
    todo["context_links"] = [inflate_context_link(row) for row in context_rows]
    todo["subtasks"] = [inflate_todo(conn, subtask) for subtask in subtask_rows]
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


def next_recurrence_due_date(rule: str | None, due_date: str | None, *, today: date | None = None) -> str | None:
    rule_text = normalize_recurrence_rule(rule)
    if not rule_text:
        return None
    current_day = today or datetime.now(UTC).date()
    anchor = parse_due_date(due_date) or current_day
    candidate = advance_recurrence_due_date(rule_text, anchor)
    if not candidate:
        return None
    for _ in range(400):
        if candidate > current_day:
            return candidate.isoformat()
        candidate = advance_recurrence_due_date(rule_text, candidate)
        if not candidate:
            return None
    return candidate.isoformat()


def advance_recurrence_due_date(rule_text: str, anchor: date) -> date | None:
    match = re.fullmatch(r"every\s+(\d+)\s+days?", rule_text)
    if match:
        return anchor + timedelta(days=max(1, int(match.group(1))))
    match = re.fullmatch(r"every\s+(\d+)\s+weeks?", rule_text)
    if match:
        return anchor + timedelta(weeks=max(1, int(match.group(1))))
    if rule_text in {"daily", "every day", "every daily"}:
        return anchor + timedelta(days=1)
    if rule_text in {"weekly", "every week", "every weekly"}:
        return anchor + timedelta(weeks=1)
    if rule_text in {"weekday", "weekdays", "every weekday", "every weekdays"}:
        next_day = anchor + timedelta(days=1)
        while next_day.weekday() >= 5:
            next_day += timedelta(days=1)
        return next_day
    match = re.fullmatch(r"every\s+(" + "|".join(WEEKDAYS) + r")", rule_text)
    if match:
        return next_weekday(anchor, WEEKDAYS[match.group(1)])
    if rule_text in {"monthly", "every month", "every monthly"}:
        return add_month(anchor)
    return None


def normalize_recurrence_rule(rule: str | None) -> str:
    return re.sub(r"\s+", " ", str(rule or "").strip().lower().strip("."))


def parse_due_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


def add_month(value: date) -> date:
    month = value.month + 1
    year = value.year
    if month == 13:
        month = 1
        year += 1
    return date(year, month, min(value.day, monthrange(year, month)[1]))


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


_UNSET = object()


def resolve_todo_list_id(conn: sqlite3.Connection, workspace_id: str, value: Any, ts: str) -> str | None:
    if value is None:
        return None
    text = str(value or "").strip()
    if not text:
        return None
    existing = conn.execute("SELECT id FROM todo_lists WHERE id=? AND workspace_id=? AND status='active'", (text, workspace_id)).fetchone()
    if existing:
        return str(existing["id"])
    return ensure_todo_list(conn, workspace_id, text, ts)


def replace_todo_labels(conn: sqlite3.Connection, workspace_id: str, todo_id: str, labels: list[Any], ts: str) -> None:
    normalized = normalize_string_list(labels)
    conn.execute("DELETE FROM todo_label_links WHERE todo_id=?", (todo_id,))
    for label_name in normalized:
        label_id = ensure_todo_label(conn, workspace_id, label_name, ts)
        conn.execute(
            "INSERT OR IGNORE INTO todo_label_links (todo_id, label_id, created_at) VALUES (?, ?, ?)",
            (todo_id, label_id, ts),
        )


def ensure_todo_list(conn: sqlite3.Connection, workspace_id: str, name: str, ts: str) -> str:
    existing = conn.execute("SELECT id FROM todo_lists WHERE workspace_id=? AND lower(name)=lower(?)", (workspace_id, name)).fetchone()
    if existing:
        conn.execute(
            "UPDATE todo_lists SET status='active', archived_at=NULL, updated_at=? WHERE id=? AND workspace_id=? AND status!='active'",
            (ts, existing["id"], workspace_id),
        )
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
