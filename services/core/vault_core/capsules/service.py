from __future__ import annotations

import re
import sqlite3
from typing import Any

from fastapi import HTTPException

from vault_core.db.session import VaultDatabase, dumps, loads, new_id, now_iso, rows_to_dicts

APPROVED_CLAIM_STATUSES = {"supported", "user_confirmed", "verified"}
UNREVIEWED_CLAIM_STATUSES = {"proposed", "needs_review", "weakly_supported"}
SUPPORTED_TARGET_TYPES = {
    "source",
    "source_block",
    "note",
    "kg_node",
    "claim",
    "evidence_link",
    "kg_edge",
    "learning_item",
    "tool",
}
TARGET_TABLES = {
    "source": ("sources", "id", "title", "workspace_id"),
    "source_block": ("source_blocks", "id", "text", None),
    "note": ("notes", "id", "title", "workspace_id"),
    "kg_node": ("kg_nodes", "id", "title", "workspace_id"),
    "claim": ("claims", "id", "normalized_text", "workspace_id"),
    "evidence_link": ("evidence_links", "id", "exact_quote", None),
    "kg_edge": ("kg_edges", "id", "edge_type", "workspace_id"),
    "learning_item": ("learning_items", "id", "title", "workspace_id"),
    "tool": ("tool_registry", "id", "name", "workspace_id"),
}


def list_capsules(
    db: VaultDatabase,
    query: str | None = None,
    status: str | None = None,
    domain: str | None = None,
    tag: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    clauses = ["workspace_id=?"]
    args: list[Any] = [db.workspace_id]
    if status:
        clauses.append("status=?")
        args.append(status)
    else:
        clauses.append("status!='archived'")
    if query:
        clauses.append("(LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(purpose) LIKE ?)")
        needle = f"%{query.lower()}%"
        args.extend([needle, needle, needle])
    where = " AND ".join(clauses)
    with db.connect() as conn:
        rows = conn.execute(
            f"SELECT * FROM capsules WHERE {where} ORDER BY updated_at DESC LIMIT ? OFFSET ?",
            (*args, limit, offset),
        ).fetchall()
        total = int(conn.execute(f"SELECT COUNT(*) FROM capsules WHERE {where}", args).fetchone()[0])
        capsules = []
        for row in rows:
            capsule = inflate_capsule(row)
            if domain and domain not in capsule["domains"]:
                continue
            if tag and tag not in capsule["tags"]:
                continue
            capsule["counts"] = capsule_counts(conn, capsule["id"])
            capsule["health"] = latest_health(conn, capsule["id"]) or summarize_health(compute_health_payload(conn, db.workspace_id, capsule["id"]))
            capsules.append(capsule)
    return {"items": capsules, "total": total}


def create_capsule(db: VaultDatabase, payload: dict[str, Any]) -> dict[str, Any]:
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(422, "Capsule name is required")
    ts = now_iso()
    capsule_id = new_id("cap")
    slug = unique_capsule_slug(db, name)
    domains = clean_string_list(payload.get("domains"))
    tags = clean_string_list(payload.get("tags"))
    with db.connect() as conn:
        conn.execute(
            """
            INSERT INTO capsules
              (id, workspace_id, name, slug, description, purpose, capsule_type, status, version,
               language, domains_json, tags_json, epistemic_strictness, default_source_policy,
               metadata_json, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                capsule_id,
                db.workspace_id,
                name,
                slug,
                nullable_text(payload.get("description")),
                nullable_text(payload.get("purpose")),
                str(payload.get("capsule_type") or "domain"),
                "draft",
                "0.1.0",
                nullable_text(payload.get("language")),
                dumps(domains),
                dumps(tags),
                str(payload.get("epistemic_strictness") or "balanced"),
                str(payload.get("default_source_policy") or "reference_only"),
                dumps(payload.get("metadata") or {}),
                "user",
                ts,
                ts,
            ),
        )
        insert_changelog(conn, db, capsule_id, "created", summary=f"Created {name}")
        db.event(conn, "capsule.created", "capsule", capsule_id, {"name": name}, "user")
        row = conn.execute("SELECT * FROM capsules WHERE id=?", (capsule_id,)).fetchone()
        capsule = inflate_capsule(row)
        capsule["counts"] = empty_counts()
        capsule["health"] = summarize_health(empty_health())
        return capsule


def get_capsule_detail(db: VaultDatabase, capsule_id: str) -> dict[str, Any]:
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM capsules WHERE id=? AND workspace_id=?", (capsule_id, db.workspace_id)).fetchone()
        if not row:
            raise HTTPException(404, "Capsule not found")
        capsule = inflate_capsule(row)
        health_payload = latest_health(conn, capsule_id)
        if health_payload is None:
            health_payload = summarize_health(compute_health_payload(conn, db.workspace_id, capsule_id))
        capsule["counts"] = capsule_counts(conn, capsule_id)
        capsule["health"] = health_payload
        capsule["items"] = list_capsule_items_for_conn(conn, db.workspace_id, capsule_id, limit=30)
        capsule["versions"] = rows_to_dicts(
            conn.execute(
                "SELECT id, version, title, changelog, created_at FROM capsule_versions WHERE capsule_id=? ORDER BY created_at DESC",
                (capsule_id,),
            ).fetchall()
        )
        capsule["activity"] = [
            inflate_json(row, "payload_json")
            for row in rows_to_dicts(
                conn.execute(
                    "SELECT * FROM capsule_changelog WHERE capsule_id=? ORDER BY created_at DESC LIMIT 20",
                    (capsule_id,),
                ).fetchall()
            )
        ]
        capsule["key_claims"] = capsule_key_claims(conn, capsule_id)
        capsule["core_concepts"] = capsule_core_concepts(conn, capsule_id)
        return capsule


def update_capsule(db: VaultDatabase, capsule_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    allowed = {
        "name",
        "description",
        "purpose",
        "status",
        "language",
        "capsule_type",
        "domains",
        "tags",
        "epistemic_strictness",
        "default_source_policy",
    }
    updates = {key: value for key, value in payload.items() if key in allowed}
    if not updates:
        return get_capsule_detail(db, capsule_id)
    ts = now_iso()
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM capsules WHERE id=? AND workspace_id=?", (capsule_id, db.workspace_id)).fetchone()
        if not row:
            raise HTTPException(404, "Capsule not found")
        assignments = ["updated_at=?"]
        args: list[Any] = [ts]
        if "name" in updates:
            name = str(updates["name"] or "").strip()
            if not name:
                raise HTTPException(422, "Capsule name is required")
            assignments.extend(["name=?", "slug=?"])
            args.extend([name, unique_capsule_slug(db, name, ignore_capsule_id=capsule_id)])
        for key in ("description", "purpose", "status", "language", "capsule_type", "epistemic_strictness", "default_source_policy"):
            if key in updates:
                assignments.append(f"{key}=?")
                args.append(nullable_text(updates[key]) if key in {"description", "purpose", "language"} else str(updates[key]))
        if "domains" in updates:
            assignments.append("domains_json=?")
            args.append(dumps(clean_string_list(updates["domains"])))
        if "tags" in updates:
            assignments.append("tags_json=?")
            args.append(dumps(clean_string_list(updates["tags"])))
        args.append(capsule_id)
        conn.execute(f"UPDATE capsules SET {', '.join(assignments)} WHERE id=?", args)
        insert_changelog(conn, db, capsule_id, "updated", summary="Updated capsule metadata", payload=updates)
        db.event(conn, "capsule.updated", "capsule", capsule_id, {"fields": sorted(updates)}, "user")
    return get_capsule_detail(db, capsule_id)


def archive_capsule(db: VaultDatabase, capsule_id: str) -> dict[str, Any]:
    ts = now_iso()
    with db.connect() as conn:
        row = conn.execute("SELECT id FROM capsules WHERE id=? AND workspace_id=?", (capsule_id, db.workspace_id)).fetchone()
        if not row:
            raise HTTPException(404, "Capsule not found")
        conn.execute("UPDATE capsules SET status='archived', archived_at=?, updated_at=? WHERE id=?", (ts, ts, capsule_id))
        insert_changelog(conn, db, capsule_id, "updated", summary="Archived capsule")
        db.event(conn, "capsule.archived", "capsule", capsule_id, {}, "user")
    return get_capsule_detail(db, capsule_id)


def add_capsule_items(db: VaultDatabase, capsule_id: str, items: list[dict[str, Any]]) -> dict[str, Any]:
    if not items:
        raise HTTPException(422, "At least one capsule item is required")
    ts = now_iso()
    added = 0
    skipped = 0
    auto_included: list[dict[str, str]] = []
    with db.connect() as conn:
        ensure_capsule(conn, db.workspace_id, capsule_id)
        max_sort = int(conn.execute("SELECT COALESCE(MAX(sort_order), 0) FROM capsule_items WHERE capsule_id=?", (capsule_id,)).fetchone()[0])
        for item in items:
            target_type = str(item.get("target_type") or "")
            target_id = str(item.get("target_id") or "")
            validate_target(conn, db.workspace_id, target_type, target_id)
            result = insert_capsule_item(conn, db, capsule_id, item, sort_order=max_sort + added + 1, ts=ts)
            if result == "added":
                added += 1
            else:
                skipped += 1
            if target_type == "claim" and item.get("auto_include_evidence"):
                for included in auto_include_claim_evidence(conn, db, capsule_id, target_id, ts):
                    auto_included.append(included)
        if added or auto_included:
            conn.execute("UPDATE capsules SET updated_at=? WHERE id=?", (ts, capsule_id))
            insert_changelog(
                conn,
                db,
                capsule_id,
                "item_added",
                summary=f"Added {added} item{'' if added == 1 else 's'}",
                payload={"added": added, "auto_included": auto_included},
            )
            db.event(conn, "capsule.items_added", "capsule", capsule_id, {"added": added, "auto_included": auto_included}, "user")
    return {"added": added, "skipped_duplicates": skipped, "auto_included": auto_included}


def list_capsule_items(
    db: VaultDatabase,
    capsule_id: str,
    target_type: str | None = None,
    role: str | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict[str, Any]:
    with db.connect() as conn:
        ensure_capsule(conn, db.workspace_id, capsule_id)
        items = list_capsule_items_for_conn(conn, db.workspace_id, capsule_id, target_type, role, status, limit, offset)
        total = count_capsule_items(conn, capsule_id, target_type, role, status)
    return {"items": items, "total": total}


def remove_capsule_item(db: VaultDatabase, capsule_id: str, item_id: str) -> dict[str, Any]:
    ts = now_iso()
    with db.connect() as conn:
        ensure_capsule(conn, db.workspace_id, capsule_id)
        row = conn.execute(
            "SELECT * FROM capsule_items WHERE id=? AND capsule_id=? AND status='active'",
            (item_id, capsule_id),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Capsule item not found")
        conn.execute(
            "UPDATE capsule_items SET status='removed', removed_at=?, updated_at=? WHERE id=?",
            (ts, ts, item_id),
        )
        conn.execute("UPDATE capsules SET updated_at=? WHERE id=?", (ts, capsule_id))
        insert_changelog(
            conn,
            db,
            capsule_id,
            "item_removed",
            target_type=row["target_type"],
            target_id=row["target_id"],
            summary="Removed capsule item",
        )
        db.event(conn, "capsule.item_removed", "capsule", capsule_id, {"item_id": item_id}, "user")
    return {"item_id": item_id, "status": "removed"}


def run_capsule_health(db: VaultDatabase, capsule_id: str) -> dict[str, Any]:
    ts = now_iso()
    with db.connect() as conn:
        ensure_capsule(conn, db.workspace_id, capsule_id)
        health = compute_health_payload(conn, db.workspace_id, capsule_id)
        snapshot_id = new_id("caph")
        counts = health["counts"]
        conn.execute(
            """
            INSERT INTO capsule_health_snapshots
              (id, capsule_id, workspace_id, health_score, status, approved_claim_count,
               unreviewed_claim_count, unsupported_claim_count, contradicted_claim_count,
               stale_claim_count, private_item_count, disabled_tool_count, source_count,
               note_count, tool_count, warning_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                snapshot_id,
                capsule_id,
                db.workspace_id,
                health["score"],
                health["status"],
                counts["approved_claims"],
                counts["unreviewed_claims"],
                counts["unsupported_claims"],
                counts["contradicted_claims"],
                counts["stale_claims"],
                counts["private_items"],
                counts["disabled_tools"],
                counts["sources"],
                counts["notes"],
                counts["tools"],
                dumps(health["warnings"]),
                ts,
            ),
        )
        insert_changelog(conn, db, capsule_id, "health_checked", summary=f"Health {round(health['score'] * 100)}%")
        db.event(conn, "capsule.health_checked", "capsule", capsule_id, {"score": health["score"], "status": health["status"]}, "core")
    return {"health_snapshot_id": snapshot_id, **health}


def create_capsule_snapshot(db: VaultDatabase, capsule_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    version = str(payload.get("version") or "").strip()
    if not version:
        raise HTTPException(422, "Version is required")
    ts = now_iso()
    with db.connect() as conn:
        capsule_row = ensure_capsule(conn, db.workspace_id, capsule_id)
        item_rows = rows_to_dicts(
            conn.execute(
                "SELECT * FROM capsule_items WHERE capsule_id=? AND status='active' ORDER BY sort_order, created_at, id",
                (capsule_id,),
            ).fetchall()
        )
        item_snapshot = [inflate_json(row, "metadata_json") for row in item_rows]
        health = compute_health_payload(conn, db.workspace_id, capsule_id)
        manifest = {
            "schema_version": 1,
            "capsule": inflate_capsule(capsule_row),
            "counts": capsule_counts(conn, capsule_id),
            "created_at": ts,
        }
        version_id = new_id("capver")
        try:
            conn.execute(
                """
                INSERT INTO capsule_versions
                  (id, capsule_id, workspace_id, version, title, changelog, manifest_json,
                   item_snapshot_json, health_snapshot_json, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    version_id,
                    capsule_id,
                    db.workspace_id,
                    version,
                    nullable_text(payload.get("title")),
                    nullable_text(payload.get("changelog")),
                    dumps(manifest),
                    dumps(item_snapshot),
                    dumps(health),
                    "user",
                    ts,
                ),
            )
        except sqlite3.IntegrityError as exc:
            raise HTTPException(409, "Capsule version already exists") from exc
        conn.execute("UPDATE capsules SET version=?, updated_at=? WHERE id=?", (version, ts, capsule_id))
        insert_changelog(
            conn,
            db,
            capsule_id,
            "snapshot_created",
            summary=f"Snapshot {version}",
            payload={"version_id": version_id, "version": version},
        )
        db.event(conn, "capsule.snapshot_created", "capsule", capsule_id, {"version_id": version_id, "version": version}, "user")
        return {"version_id": version_id, "version": version, "item_count": len(item_snapshot), "created_at": ts}


def list_capsule_versions(db: VaultDatabase, capsule_id: str) -> list[dict[str, Any]]:
    with db.connect() as conn:
        ensure_capsule(conn, db.workspace_id, capsule_id)
        rows = conn.execute(
            "SELECT id, version, title, changelog, created_at FROM capsule_versions WHERE capsule_id=? ORDER BY created_at DESC",
            (capsule_id,),
        ).fetchall()
        return rows_to_dicts(rows)


def unique_capsule_slug(db: VaultDatabase, name: str, ignore_capsule_id: str | None = None) -> str:
    base = slugify(name)
    with db.connect() as conn:
        slug = base
        index = 2
        while True:
            if ignore_capsule_id:
                row = conn.execute(
                    "SELECT id FROM capsules WHERE workspace_id=? AND slug=? AND id!=?",
                    (db.workspace_id, slug, ignore_capsule_id),
                ).fetchone()
            else:
                row = conn.execute(
                    "SELECT id FROM capsules WHERE workspace_id=? AND slug=?",
                    (db.workspace_id, slug),
                ).fetchone()
            if not row:
                return slug
            slug = f"{base}-{index}"
            index += 1


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "capsule"


def nullable_text(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def clean_string_list(value: Any) -> list[str]:
    if isinstance(value, str):
        raw = re.split(r"[,;\n]+", value)
    elif isinstance(value, list):
        raw = value
    else:
        raw = []
    cleaned = []
    for item in raw:
        text = str(item or "").strip()
        if text and text not in cleaned:
            cleaned.append(text)
    return cleaned


def inflate_capsule(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    capsule = dict(row)
    capsule["domains"] = loads(capsule.pop("domains_json", "[]"), [])
    capsule["tags"] = loads(capsule.pop("tags_json", "[]"), [])
    capsule["metadata"] = loads(capsule.pop("metadata_json", "{}"), {})
    return capsule


def inflate_json(row: dict[str, Any], key: str) -> dict[str, Any]:
    if key in row:
        row[key.replace("_json", "")] = loads(row.pop(key), {})
    return row


def ensure_capsule(conn: sqlite3.Connection, workspace_id: str, capsule_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM capsules WHERE id=? AND workspace_id=?", (capsule_id, workspace_id)).fetchone()
    if not row:
        raise HTTPException(404, "Capsule not found")
    return row


def validate_target(conn: sqlite3.Connection, workspace_id: str, target_type: str, target_id: str) -> None:
    if target_type not in SUPPORTED_TARGET_TYPES:
        raise HTTPException(422, f"Unsupported capsule target type: {target_type}")
    if not target_id:
        raise HTTPException(422, "Capsule target id is required")
    table, id_column, _label_column, workspace_column = TARGET_TABLES[target_type]
    if workspace_column:
        row = conn.execute(
            f"SELECT {id_column} FROM {table} WHERE {id_column}=? AND {workspace_column}=?",
            (target_id, workspace_id),
        ).fetchone()
    elif target_type == "source_block":
        row = conn.execute(
            """
            SELECT source_blocks.id
            FROM source_blocks
            JOIN sources ON sources.id=source_blocks.source_id
            WHERE source_blocks.id=? AND sources.workspace_id=?
            """,
            (target_id, workspace_id),
        ).fetchone()
    elif target_type == "evidence_link":
        row = conn.execute(
            """
            SELECT evidence_links.id
            FROM evidence_links
            JOIN claims ON claims.id=evidence_links.claim_id
            WHERE evidence_links.id=? AND claims.workspace_id=?
            """,
            (target_id, workspace_id),
        ).fetchone()
    else:
        row = conn.execute(f"SELECT {id_column} FROM {table} WHERE {id_column}=?", (target_id,)).fetchone()
    if not row:
        raise HTTPException(404, f"{target_type} target not found")


def insert_capsule_item(
    conn: sqlite3.Connection,
    db: VaultDatabase,
    capsule_id: str,
    item: dict[str, Any],
    sort_order: int,
    ts: str,
) -> str:
    existing = conn.execute(
        """
        SELECT id FROM capsule_items
        WHERE capsule_id=? AND target_type=? AND target_id=? AND status='active'
        """,
        (capsule_id, item["target_type"], item["target_id"]),
    ).fetchone()
    if existing:
        return "duplicate"
    try:
        conn.execute(
            """
            INSERT INTO capsule_items
              (id, capsule_id, workspace_id, target_type, target_id, role, include_mode,
               status, sort_order, export_policy, private_flag, added_by, added_by_job_id,
               metadata_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id("capitem"),
                capsule_id,
                db.workspace_id,
                str(item["target_type"]),
                str(item["target_id"]),
                str(item.get("role") or "supporting"),
                str(item.get("include_mode") or "reference"),
                "active",
                sort_order,
                nullable_text(item.get("export_policy")),
                1 if item.get("private_flag") else 0,
                str(item.get("added_by") or "user"),
                nullable_text(item.get("added_by_job_id")),
                dumps(item.get("metadata") or {}),
                ts,
                ts,
            ),
        )
    except sqlite3.IntegrityError:
        return "duplicate"
    return "added"


def auto_include_claim_evidence(
    conn: sqlite3.Connection,
    db: VaultDatabase,
    capsule_id: str,
    claim_id: str,
    ts: str,
) -> list[dict[str, str]]:
    included: list[dict[str, str]] = []
    rows = conn.execute(
        """
        SELECT evidence_links.id AS evidence_link_id, evidence_links.source_block_id
        FROM evidence_links
        WHERE evidence_links.claim_id=?
        """,
        (claim_id,),
    ).fetchall()
    for row in rows:
        for target_type, target_id in (
            ("evidence_link", row["evidence_link_id"]),
            ("source_block", row["source_block_id"]),
        ):
            result = insert_capsule_item(
                conn,
                db,
                capsule_id,
                {
                    "target_type": target_type,
                    "target_id": target_id,
                    "role": "evidence",
                    "include_mode": "reference",
                    "added_by": "core",
                    "metadata": {"auto_included_for_claim_id": claim_id},
                },
                sort_order=0,
                ts=ts,
            )
            if result == "added":
                included.append({"target_type": target_type, "target_id": target_id})
    return included


def list_capsule_items_for_conn(
    conn: sqlite3.Connection,
    workspace_id: str,
    capsule_id: str,
    target_type: str | None = None,
    role: str | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    clauses = ["capsule_id=?"]
    args: list[Any] = [capsule_id]
    if target_type:
        clauses.append("target_type=?")
        args.append(target_type)
    if role:
        clauses.append("role=?")
        args.append(role)
    if status:
        clauses.append("status=?")
        args.append(status)
    else:
        clauses.append("status='active'")
    rows = conn.execute(
        f"""
        SELECT * FROM capsule_items
        WHERE {' AND '.join(clauses)}
        ORDER BY sort_order, created_at, id
        LIMIT ? OFFSET ?
        """,
        (*args, limit, offset),
    ).fetchall()
    items = []
    for row in rows:
        item = inflate_json(dict(row), "metadata_json")
        item["target"] = target_summary(conn, workspace_id, item["target_type"], item["target_id"])
        items.append(item)
    return items


def count_capsule_items(
    conn: sqlite3.Connection,
    capsule_id: str,
    target_type: str | None = None,
    role: str | None = None,
    status: str | None = None,
) -> int:
    clauses = ["capsule_id=?"]
    args: list[Any] = [capsule_id]
    if target_type:
        clauses.append("target_type=?")
        args.append(target_type)
    if role:
        clauses.append("role=?")
        args.append(role)
    clauses.append("status=?" if status else "status='active'")
    if status:
        args.append(status)
    return int(conn.execute(f"SELECT COUNT(*) FROM capsule_items WHERE {' AND '.join(clauses)}", args).fetchone()[0])


def target_summary(conn: sqlite3.Connection, workspace_id: str, target_type: str, target_id: str) -> dict[str, Any]:
    try:
        validate_target(conn, workspace_id, target_type, target_id)
    except HTTPException:
        return {"id": target_id, "type": target_type, "title": "Missing target", "missing": True}
    if target_type == "source_block":
        row = conn.execute(
            """
            SELECT source_blocks.id, source_blocks.text, sources.title AS source_title
            FROM source_blocks
            JOIN sources ON sources.id=source_blocks.source_id
            WHERE source_blocks.id=?
            """,
            (target_id,),
        ).fetchone()
        title = f"{row['source_title']} block" if row else "Source block"
    elif target_type == "evidence_link":
        row = conn.execute("SELECT exact_quote FROM evidence_links WHERE id=?", (target_id,)).fetchone()
        title = compact_text(row["exact_quote"], 90) if row else "Evidence link"
    else:
        table, id_column, label_column, _workspace_column = TARGET_TABLES[target_type]
        row = conn.execute(f"SELECT {label_column} AS label FROM {table} WHERE {id_column}=?", (target_id,)).fetchone()
        title = compact_text(row["label"], 90) if row else target_id
    return {"id": target_id, "type": target_type, "title": title}


def compact_text(value: str, limit: int) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    return f"{text[: limit - 1].rstrip()}..."


def capsule_counts(conn: sqlite3.Connection, capsule_id: str) -> dict[str, int]:
    counts = empty_counts()
    rows = conn.execute(
        """
        SELECT target_type, COUNT(*) AS count
        FROM capsule_items
        WHERE capsule_id=? AND status='active'
        GROUP BY target_type
        """,
        (capsule_id,),
    ).fetchall()
    for row in rows:
        target_type = row["target_type"]
        count = int(row["count"])
        if target_type == "source":
            counts["sources"] += count
        elif target_type == "note":
            counts["notes"] += count
        elif target_type == "claim":
            counts["claims"] += count
        elif target_type == "kg_node":
            counts["concepts"] += count
        elif target_type == "tool":
            counts["tools"] += count
    return counts


def empty_counts() -> dict[str, int]:
    return {"sources": 0, "notes": 0, "claims": 0, "concepts": 0, "tools": 0}


def latest_health(conn: sqlite3.Connection, capsule_id: str) -> dict[str, Any] | None:
    row = conn.execute(
        """
        SELECT * FROM capsule_health_snapshots
        WHERE capsule_id=?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (capsule_id,),
    ).fetchone()
    if not row:
        return None
    warnings = loads(row["warning_json"], [])
    return {
        "score": float(row["health_score"]),
        "status": row["status"],
        "warnings": [warning["message"] if isinstance(warning, dict) else str(warning) for warning in warnings],
        "counts": {
            "approved_claims": int(row["approved_claim_count"]),
            "unreviewed_claims": int(row["unreviewed_claim_count"]),
            "unsupported_claims": int(row["unsupported_claim_count"]),
            "contradicted_claims": int(row["contradicted_claim_count"]),
            "stale_claims": int(row["stale_claim_count"]),
            "private_items": int(row["private_item_count"]),
            "disabled_tools": int(row["disabled_tool_count"]),
            "sources": int(row["source_count"]),
            "notes": int(row["note_count"]),
            "tools": int(row["tool_count"]),
        },
    }


def empty_health() -> dict[str, Any]:
    return {
        "score": 0,
        "status": "needs_review",
        "counts": {
            "approved_claims": 0,
            "unreviewed_claims": 0,
            "unsupported_claims": 0,
            "contradicted_claims": 0,
            "stale_claims": 0,
            "private_items": 0,
            "disabled_tools": 0,
            "sources": 0,
            "notes": 0,
            "tools": 0,
        },
        "warnings": [{"level": "info", "code": "empty_capsule", "message": "No capsule items yet."}],
    }


def compute_health_payload(conn: sqlite3.Connection, workspace_id: str, capsule_id: str) -> dict[str, Any]:
    counts = empty_health()["counts"]
    item_counts = capsule_counts(conn, capsule_id)
    counts["sources"] = item_counts["sources"]
    counts["notes"] = item_counts["notes"]
    counts["tools"] = item_counts["tools"]
    claim_rows = conn.execute(
        """
        SELECT claims.id, claims.status
        FROM capsule_items
        JOIN claims ON claims.id=capsule_items.target_id
        WHERE capsule_items.capsule_id=? AND capsule_items.target_type='claim' AND capsule_items.status='active'
        """,
        (capsule_id,),
    ).fetchall()
    for row in claim_rows:
        status = str(row["status"])
        if status in APPROVED_CLAIM_STATUSES:
            counts["approved_claims"] += 1
        if status in UNREVIEWED_CLAIM_STATUSES:
            counts["unreviewed_claims"] += 1
        if status == "contradicted":
            counts["contradicted_claims"] += 1
        evidence_count = int(conn.execute("SELECT COUNT(*) FROM evidence_links WHERE claim_id=?", (row["id"],)).fetchone()[0])
        if evidence_count == 0:
            counts["unsupported_claims"] += 1
    counts["private_items"] = int(
        conn.execute(
            "SELECT COUNT(*) FROM capsule_items WHERE capsule_id=? AND status='active' AND private_flag=1",
            (capsule_id,),
        ).fetchone()[0]
    )
    counts["disabled_tools"] = int(
        conn.execute(
            """
            SELECT COUNT(*)
            FROM capsule_items
            JOIN tool_registry ON tool_registry.id=capsule_items.target_id
            WHERE capsule_items.capsule_id=? AND capsule_items.target_type='tool'
              AND capsule_items.status='active' AND tool_registry.status!='installed'
            """,
            (capsule_id,),
        ).fetchone()[0]
    )
    warnings = health_warnings(counts)
    score = health_score(counts, len(claim_rows))
    status = health_status(counts, warnings)
    return {"score": score, "status": status, "counts": counts, "warnings": warnings}


def health_warnings(counts: dict[str, int]) -> list[dict[str, str]]:
    warnings: list[dict[str, str]] = []
    if counts["unsupported_claims"]:
        warnings.append({"level": "warning", "code": "unsupported_claims", "message": f"{counts['unsupported_claims']} claims have no evidence."})
    if counts["unreviewed_claims"]:
        warnings.append({"level": "warning", "code": "unreviewed_claims", "message": f"{counts['unreviewed_claims']} claims still need review."})
    if counts["contradicted_claims"]:
        warnings.append({"level": "critical", "code": "contradictions", "message": f"{counts['contradicted_claims']} claims are contradicted."})
    if counts["private_items"]:
        warnings.append({"level": "warning", "code": "private_items", "message": f"{counts['private_items']} private items affect export."})
    if counts["disabled_tools"]:
        warnings.append({"level": "critical", "code": "unsafe_tools", "message": f"{counts['disabled_tools']} tools are disabled."})
    if not any(counts[key] for key in ("sources", "notes", "approved_claims", "unreviewed_claims")):
        warnings.append({"level": "info", "code": "empty_capsule", "message": "No capsule items yet."})
    return warnings


def health_score(counts: dict[str, int], claim_count: int) -> float:
    if not any(counts[key] for key in ("sources", "notes", "tools")) and claim_count == 0:
        return 0
    penalty = (
        counts["unsupported_claims"] * 0.12
        + counts["unreviewed_claims"] * 0.08
        + counts["contradicted_claims"] * 0.2
        + counts["private_items"] * 0.08
        + counts["disabled_tools"] * 0.2
    )
    return max(0.0, min(1.0, 1.0 - penalty))


def health_status(counts: dict[str, int], warnings: list[dict[str, str]]) -> str:
    if counts["disabled_tools"]:
        return "unsafe_tools"
    if counts["private_items"]:
        return "privacy_risk"
    if counts["contradicted_claims"]:
        return "contradictions_found"
    if counts["unsupported_claims"]:
        return "weak_evidence"
    if counts["unreviewed_claims"] or any(warning["code"] == "empty_capsule" for warning in warnings):
        return "needs_review"
    return "healthy"


def summarize_health(health: dict[str, Any]) -> dict[str, Any]:
    return {
        "score": health["score"],
        "status": health["status"],
        "warnings": [warning["message"] if isinstance(warning, dict) else str(warning) for warning in health["warnings"]],
        "counts": health["counts"],
    }


def capsule_key_claims(conn: sqlite3.Connection, capsule_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT claims.*, kg_nodes.title
        FROM capsule_items
        JOIN claims ON claims.id=capsule_items.target_id
        JOIN kg_nodes ON kg_nodes.id=claims.node_id
        WHERE capsule_items.capsule_id=? AND capsule_items.target_type='claim' AND capsule_items.status='active'
        ORDER BY claims.evidence_strength DESC, claims.updated_at DESC
        LIMIT 8
        """,
        (capsule_id,),
    ).fetchall()
    return rows_to_dicts(rows)


def capsule_core_concepts(conn: sqlite3.Connection, capsule_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT kg_nodes.id, kg_nodes.title, kg_nodes.node_type, kg_nodes.status
        FROM capsule_items
        JOIN kg_nodes ON kg_nodes.id=capsule_items.target_id
        WHERE capsule_items.capsule_id=? AND capsule_items.target_type='kg_node' AND capsule_items.status='active'
        ORDER BY capsule_items.sort_order, kg_nodes.title
        LIMIT 12
        """,
        (capsule_id,),
    ).fetchall()
    return rows_to_dicts(rows)


def insert_changelog(
    conn: sqlite3.Connection,
    db: VaultDatabase,
    capsule_id: str,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    summary: str | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    conn.execute(
        """
        INSERT INTO capsule_changelog
          (id, capsule_id, workspace_id, actor, action, target_type, target_id, summary, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_id("caplog"),
            capsule_id,
            db.workspace_id,
            "user",
            action,
            target_type,
            target_id,
            summary,
            dumps(payload or {}),
            now_iso(),
        ),
    )
