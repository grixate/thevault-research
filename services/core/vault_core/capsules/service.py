from __future__ import annotations

import hashlib
import json
import re
import shutil
import sqlite3
import zipfile
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from vault_core.db.session import VaultDatabase, dumps, loads, new_id, now_iso, rows_to_dicts

APPROVED_CLAIM_STATUSES = {"supported", "user_confirmed", "verified"}
UNREVIEWED_CLAIM_STATUSES = {"proposed", "needs_review", "weakly_supported"}
CAPSULE_EXPORT_MODES = {"reference_only", "sanitized", "private_full", "learning", "tool", "public"}
CAPSULE_IMPORT_REQUIRED_FILES = {"manifest.json", "manifest-sha256.txt"}
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
SECRET_SCAN_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("api_key_assignment", re.compile(r"(?i)\b(?:api[_-]?key|secret|token|password|client_secret|access[_-]?key|private[_-]?key)\b\s*[:=]\s*[\"']?[A-Za-z0-9_./+=:-]{8,}")),
    ("openai_key", re.compile(r"\bsk-[A-Za-z0-9][A-Za-z0-9_-]{18,}\b")),
    ("github_token", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b")),
    ("huggingface_token", re.compile(r"\bhf_[A-Za-z0-9]{20,}\b")),
    ("aws_access_key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
)
EMAIL_SCAN_PATTERN = re.compile(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b")
PHONE_SCAN_PATTERN = re.compile(r"(?<![\w-])(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})(?![\w-])")
PRIVATE_CONTEXT_PATTERN = re.compile(r"(?i)\b(?:client|patient|case|medical|diagnosis|confidential)\s*(?:id|name|record|data|note)?\s*[:#]")
COPYRIGHT_CONTEXT_PATTERN = re.compile(r"(?i)\b(?:all rights reserved|copyright|proprietary|licensed content|license restricted|no redistribution|do not redistribute)\b")
LICENSE_METADATA_KEYS = {"license", "license_label", "license_url", "license_path", "rights", "usage_rights", "copyright_status"}
MAX_CAPSULE_SCAN_TEXT_CHARS = 20000
MAX_CAPSULE_SCAN_FINDINGS = 25


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
        capsule["dependencies"] = capsule_dependencies(conn, db.workspace_id, capsule_id)
        return capsule


def fork_capsule(db: VaultDatabase, capsule_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    ts = now_iso()
    with db.connect() as conn:
        parent_row = ensure_capsule(conn, db.workspace_id, capsule_id)
        parent = inflate_capsule(parent_row)
        name = str(payload.get("name") or f"{parent['name']} Fork").strip()
        if not name:
            raise HTTPException(422, "Fork name is required")
        fork_id = new_id("cap")
        fork_slug = unique_capsule_slug_in_conn(conn, db.workspace_id, name)
        purpose = nullable_text(payload.get("purpose")) or parent.get("purpose")
        capsule_type = str(payload.get("capsule_type") or parent.get("capsule_type") or "project")
        conn.execute(
            """
            INSERT INTO capsules
              (id, workspace_id, name, slug, description, purpose, capsule_type, status, version,
               language, domains_json, tags_json, epistemic_strictness, default_source_policy,
               metadata_json, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', '0.1.0', ?, ?, ?, ?, ?, ?, 'user', ?, ?)
            """,
            (
                fork_id,
                db.workspace_id,
                name,
                fork_slug,
                parent.get("description"),
                purpose,
                capsule_type,
                parent.get("language"),
                dumps(parent.get("domains") or []),
                dumps(parent.get("tags") or []),
                parent.get("epistemic_strictness") or "balanced",
                parent.get("default_source_policy") or "reference_only",
                dumps({"forked_from_capsule_id": capsule_id, "forked_from_version": parent.get("version")}),
                ts,
                ts,
            ),
        )
        parent_items = rows_to_dicts(
            conn.execute(
                """
                SELECT *
                FROM capsule_items
                WHERE capsule_id=? AND status='active'
                ORDER BY sort_order, created_at, id
                """,
                (capsule_id,),
            ).fetchall()
        )
        copied = 0
        for index, item in enumerate(parent_items, start=1):
            inflated = inflate_json(item, "metadata_json")
            result = insert_capsule_item(
                conn,
                db,
                fork_id,
                {
                    "target_type": inflated["target_type"],
                    "target_id": inflated["target_id"],
                    "role": inflated.get("role"),
                    "include_mode": inflated.get("include_mode"),
                    "export_policy": inflated.get("export_policy"),
                    "private_flag": bool(inflated.get("private_flag")),
                    "added_by": "fork",
                    "metadata": {**(inflated.get("metadata") or {}), "forked_from_capsule_item_id": inflated["id"]},
                },
                sort_order=index,
                ts=ts,
            )
            if result == "added":
                copied += 1
        dependency_id = new_id("capdep")
        conn.execute(
            """
            INSERT INTO capsule_dependencies
              (id, capsule_id, workspace_id, dependency_type, target_capsule_id, external_capsule_ref,
               version_constraint, status, metadata_json, created_at, updated_at)
            VALUES (?, ?, ?, 'forked_from', ?, NULL, ?, 'active', ?, ?, ?)
            """,
            (
                dependency_id,
                fork_id,
                db.workspace_id,
                capsule_id,
                parent.get("version"),
                dumps({"parent_name": parent["name"], "parent_slug": parent["slug"]}),
                ts,
                ts,
            ),
        )
        insert_changelog(conn, db, fork_id, "created", summary=f"Forked from {parent['name']}", payload={"parent_capsule_id": capsule_id, "copied_items": copied})
        insert_changelog(conn, db, capsule_id, "fork_created", target_type="capsule", target_id=fork_id, summary=f"Forked to {name}", payload={"fork_capsule_id": fork_id})
        db.event(conn, "capsule.forked", "capsule", fork_id, {"parent_capsule_id": capsule_id, "copied_items": copied}, "user")
    result = get_capsule_detail(db, fork_id)
    result["fork"] = {"parent_capsule_id": capsule_id, "copied_items": copied, "dependency_id": dependency_id}
    return result


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


def diff_capsule_versions(db: VaultDatabase, capsule_id: str, from_version_id: str, to_version_id: str) -> dict[str, Any]:
    with db.connect() as conn:
        ensure_capsule(conn, db.workspace_id, capsule_id)
        from_row = capsule_version_row(conn, db.workspace_id, capsule_id, from_version_id)
        to_row = capsule_version_row(conn, db.workspace_id, capsule_id, to_version_id)
        from_items = version_item_map(loads(from_row["item_snapshot_json"], []))
        to_items = version_item_map(loads(to_row["item_snapshot_json"], []))
        added_keys = sorted(set(to_items) - set(from_items))
        removed_keys = sorted(set(from_items) - set(to_items))
        shared_keys = sorted(set(from_items) & set(to_items))
        changed = []
        for key in shared_keys:
            changes = version_item_changes(from_items[key], to_items[key])
            if changes:
                changed.append({"key": key, "before": version_item_summary(from_items[key]), "after": version_item_summary(to_items[key]), "changes": changes})
        return {
            "capsule_id": capsule_id,
            "from": version_summary(from_row),
            "to": version_summary(to_row),
            "counts": {"added": len(added_keys), "removed": len(removed_keys), "changed": len(changed)},
            "added": [version_item_summary(to_items[key]) for key in added_keys],
            "removed": [version_item_summary(from_items[key]) for key in removed_keys],
            "changed": changed,
        }


def capsule_version_row(conn: sqlite3.Connection, workspace_id: str, capsule_id: str, version_id: str) -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT *
        FROM capsule_versions
        WHERE workspace_id=? AND capsule_id=? AND id=?
        """,
        (workspace_id, capsule_id, version_id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Capsule version not found")
    return row


def version_summary(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "version": row["version"],
        "title": row["title"],
        "changelog": row["changelog"],
        "created_at": row["created_at"],
    }


def version_item_map(items: Any) -> dict[str, dict[str, Any]]:
    if not isinstance(items, list):
        return {}
    mapped: dict[str, dict[str, Any]] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        target_type = str(item.get("target_type") or "")
        target_id = str(item.get("target_id") or "")
        if target_type and target_id:
            mapped[f"{target_type}:{target_id}"] = item
    return mapped


def version_item_summary(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "target_type": item.get("target_type"),
        "target_id": item.get("target_id"),
        "role": item.get("role"),
        "include_mode": item.get("include_mode"),
        "status": item.get("status"),
        "export_policy": item.get("export_policy"),
        "private_flag": item.get("private_flag"),
    }


def version_item_changes(before: dict[str, Any], after: dict[str, Any]) -> dict[str, dict[str, Any]]:
    fields = ["role", "include_mode", "status", "export_policy", "private_flag", "metadata"]
    changes: dict[str, dict[str, Any]] = {}
    for field in fields:
        before_value = before.get(field)
        after_value = after.get(field)
        if before_value != after_value:
            changes[field] = {"from": before_value, "to": after_value}
    return changes


def capsule_dependencies(conn: sqlite3.Connection, workspace_id: str, capsule_id: str) -> list[dict[str, Any]]:
    rows = rows_to_dicts(
        conn.execute(
            """
            SELECT capsule_dependencies.*, capsules.name AS target_capsule_name, capsules.slug AS target_capsule_slug,
                   capsules.version AS target_capsule_version
            FROM capsule_dependencies
            LEFT JOIN capsules ON capsules.id=capsule_dependencies.target_capsule_id
            WHERE capsule_dependencies.workspace_id=? AND capsule_dependencies.capsule_id=?
              AND capsule_dependencies.status='active'
            ORDER BY capsule_dependencies.created_at DESC
            """,
            (workspace_id, capsule_id),
        ).fetchall()
    )
    return [inflate_json(row, "metadata_json") for row in rows]


def preview_capsule_export(db: VaultDatabase, capsule_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    export_mode = normalize_export_mode((payload or {}).get("export_mode"))
    version_id = nullable_text((payload or {}).get("version_id"))
    with db.connect() as conn:
        package = build_capsule_export_payload(conn, db.workspace_id, capsule_id, export_mode, version_id=version_id)
        return {
            "capsule_id": capsule_id,
            "export_mode": export_mode,
            "status": "blocked" if package["privacy_report"]["blockers"] else "ready",
            "filename": capsule_export_filename(package["capsule"], version=package["export_scope"].get("version")),
            "export_scope": package["export_scope"],
            "manifest": package["manifest"],
            "privacy_report": package["privacy_report"],
            "validation_report": package["validation_report"],
        }


def export_capsule_package(db: VaultDatabase, capsule_id: str, output_dir: Path, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    export_mode = normalize_export_mode((payload or {}).get("export_mode"))
    version_id = nullable_text((payload or {}).get("version_id"))
    ts = now_iso()
    export_id = new_id("capexp")
    output_dir.mkdir(parents=True, exist_ok=True)
    with db.connect() as conn:
        package = build_capsule_export_payload(conn, db.workspace_id, capsule_id, export_mode, version_id=version_id)
        privacy_report = package["privacy_report"]
        validation_report = package["validation_report"]
        if privacy_report["blockers"]:
            conn.execute(
                """
                INSERT INTO capsule_exports
                  (id, capsule_id, workspace_id, export_mode, status, manifest_json,
                   privacy_report_json, validation_report_json, warnings_json, error,
                   created_by, created_at, finished_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    export_id,
                    capsule_id,
                    db.workspace_id,
                    export_mode,
                    "blocked",
                    dumps(package["manifest"]),
                    dumps(privacy_report),
                    dumps(validation_report),
                    dumps(privacy_report["warnings"]),
                    "Export blocked by privacy policy.",
                    "user",
                    ts,
                    ts,
                ),
            )
            raise HTTPException(409, {"message": "Capsule export blocked by privacy policy.", "preview": preview_from_package(capsule_id, export_mode, package)})

        output_path = output_dir / capsule_export_filename(package["capsule"], export_id, version=package["export_scope"].get("version"))
        file_checksums = write_capsule_export_zip(output_path, package)
        archive_sha = sha256_file(output_path)
        manifest = {**package["manifest"], "checksums": file_checksums, "archive_sha256": archive_sha}
        size_bytes = output_path.stat().st_size
        conn.execute(
            """
            INSERT INTO capsule_exports
              (id, capsule_id, workspace_id, export_mode, status, file_path,
               file_size_bytes, sha256, manifest_json, privacy_report_json,
               validation_report_json, warnings_json, created_by, created_at, finished_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                export_id,
                capsule_id,
                db.workspace_id,
                export_mode,
                "completed",
                str(output_path),
                size_bytes,
                archive_sha,
                dumps(manifest),
                dumps(privacy_report),
                dumps(validation_report),
                dumps(privacy_report["warnings"]),
                "user",
                ts,
                ts,
            ),
        )
        insert_changelog(
            conn,
            db,
            capsule_id,
            "export_created",
            summary=f"Exported {export_mode.replace('_', ' ')} capsule",
            payload={"export_id": export_id, "file_size_bytes": size_bytes, "sha256": archive_sha, "export_scope": package["export_scope"]},
        )
        db.event(conn, "capsule.export_created", "capsule", capsule_id, {"export_id": export_id, "export_mode": export_mode, "export_scope": package["export_scope"]}, "user")
        return {
            "export_id": export_id,
            "capsule_id": capsule_id,
            "export_mode": export_mode,
            "status": "completed",
            "export_scope": package["export_scope"],
            "filename": output_path.name,
            "file_path": str(output_path),
            "mime_type": "application/vnd.thevault.capsule+zip",
            "size_bytes": size_bytes,
            "sha256": archive_sha,
            "manifest": manifest,
            "privacy_report": privacy_report,
            "validation_report": validation_report,
            "created_at": ts,
        }


def list_capsule_exports(db: VaultDatabase, capsule_id: str, limit: int = 20, offset: int = 0) -> dict[str, Any]:
    with db.connect() as conn:
        ensure_capsule(conn, db.workspace_id, capsule_id)
        rows = conn.execute(
            """
            SELECT *
            FROM capsule_exports
            WHERE workspace_id=? AND capsule_id=?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (db.workspace_id, capsule_id, limit, offset),
        ).fetchall()
        total = int(
            conn.execute(
                "SELECT COUNT(*) FROM capsule_exports WHERE workspace_id=? AND capsule_id=?",
                (db.workspace_id, capsule_id),
            ).fetchone()[0]
        )
        items = []
        for row in rows:
            record = dict(row)
            record["manifest"] = loads(record.pop("manifest_json"), {})
            record["privacy_report"] = loads(record.pop("privacy_report_json"), {})
            record["validation_report"] = loads(record.pop("validation_report_json"), {})
            record["warnings"] = loads(record.pop("warnings_json"), [])
            record["size_bytes"] = int(record.get("file_size_bytes") or 0)
            manifest = record["manifest"]
            scope = manifest.get("export_scope") if isinstance(manifest, dict) else {}
            version = scope.get("version") if isinstance(scope, dict) else None
            fallback_capsule = manifest.get("capsule", {"name": "capsule"}) if isinstance(manifest, dict) else {"name": "capsule"}
            record["filename"] = Path(str(record.get("file_path") or "")).name if record.get("file_path") else capsule_export_filename(fallback_capsule, version=version)
            items.append(record)
        return {"items": items, "total": total}


def import_capsule_quarantine(db: VaultDatabase, imports_dir: Path, payload: dict[str, Any]) -> dict[str, Any]:
    source_path = Path(str(payload.get("file_path") or "")).expanduser()
    if not source_path.exists() or not source_path.is_file():
        raise HTTPException(404, "Capsule package file not found")
    if source_path.suffix != ".vaultcapsule":
        raise HTTPException(422, "Capsule imports must use a .vaultcapsule package")
    max_file_count = int(payload.get("max_file_count") or 5000)
    max_unpacked_bytes = int(payload.get("max_unpacked_bytes") or 500 * 1024 * 1024)
    import_id = new_id("capimp")
    ts = now_iso()
    quarantine_dir = imports_dir / import_id
    quarantine_dir.mkdir(parents=True, exist_ok=True)
    original_path = quarantine_dir / "original.vaultcapsule"
    shutil.copyfile(source_path, original_path)
    validation = validate_capsule_import_package(original_path, max_file_count=max_file_count, max_unpacked_bytes=max_unpacked_bytes)
    manifest = validation.get("manifest") or {}
    merge_plan = build_capsule_import_merge_plan(manifest, validation)
    status = "quarantined" if validation["status"] == "valid" else "invalid"
    warnings = validation["warnings"] + merge_plan.get("warnings", [])
    write_import_quarantine_files(quarantine_dir, manifest, validation, merge_plan)
    with db.connect() as conn:
        conn.execute(
            """
            INSERT INTO capsule_imports
              (id, workspace_id, source_file_path, quarantine_path, status,
               manifest_json, validation_report_json, merge_plan_json,
               warnings_json, error, created_at, validated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                import_id,
                db.workspace_id,
                str(source_path),
                str(quarantine_dir),
                status,
                dumps(manifest),
                dumps(validation),
                dumps(merge_plan),
                dumps(warnings),
                None if status == "quarantined" else "; ".join(validation["errors"]),
                ts,
                ts,
            ),
        )
        db.event(conn, "capsule.import_quarantined", "capsule_import", import_id, {"status": status, "source_file_path": str(source_path)}, "user")
    return {
        "import_id": import_id,
        "status": status,
        "source_file_path": str(source_path),
        "quarantine_path": str(quarantine_dir),
        "manifest": manifest,
        "validation_report": validation,
        "merge_plan": merge_plan,
        "warnings": warnings,
        "created_at": ts,
    }


def get_capsule_import_detail(db: VaultDatabase, import_id: str) -> dict[str, Any]:
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM capsule_imports WHERE id=? AND workspace_id=?", (import_id, db.workspace_id)).fetchone()
        if not row:
            raise HTTPException(404, "Capsule import not found")
        record = dict(row)
        record["import_id"] = record["id"]
        record["manifest"] = loads(record.pop("manifest_json"), {})
        record["validation_report"] = loads(record.pop("validation_report_json"), {})
        record["merge_plan"] = loads(record.pop("merge_plan_json"), {})
        record["warnings"] = loads(record.pop("warnings_json"), [])
        return record


def list_capsule_imports(db: VaultDatabase, limit: int = 50, offset: int = 0) -> dict[str, Any]:
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT * FROM capsule_imports WHERE workspace_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (db.workspace_id, limit, offset),
        ).fetchall()
        total = int(conn.execute("SELECT COUNT(*) FROM capsule_imports WHERE workspace_id=?", (db.workspace_id,)).fetchone()[0])
        items = []
        for row in rows:
            record = dict(row)
            record["import_id"] = record["id"]
            record["manifest"] = loads(record.pop("manifest_json"), {})
            record["validation_report"] = loads(record.pop("validation_report_json"), {})
            record["merge_plan"] = loads(record.pop("merge_plan_json"), {})
            record["warnings"] = loads(record.pop("warnings_json"), [])
            items.append(record)
        return {"items": items, "total": total}


def capsule_overview_note_input(db: VaultDatabase, capsule_id: str) -> dict[str, Any]:
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM capsules WHERE id=? AND workspace_id=?", (capsule_id, db.workspace_id)).fetchone()
        if not row:
            raise HTTPException(404, "Capsule not found")
        capsule = inflate_capsule(row)
        source_ids = capsule_source_ids_for_overview(conn, db.workspace_id, capsule_id)
        claim_ids = capsule_approved_claim_ids_for_overview(conn, db.workspace_id, capsule_id)
        if not source_ids and not claim_ids:
            raise HTTPException(422, "Add capsule sources or approved claims before generating an overview note")
        purpose = capsule.get("purpose") or capsule.get("description") or "Summarize the reviewed capsule knowledge."
        prompt = (
            f"Create a capsule overview for {capsule['name']}.\n"
            f"Purpose: {purpose}\n"
            "Use only the supplied capsule evidence. Summarize what is known, key claims, evidence, uncertainties, and useful next questions."
        )
        return {
            "capsule": capsule,
            "title": f"{capsule['name']} overview",
            "prompt": prompt,
            "source_ids": source_ids,
            "claim_ids": claim_ids,
        }


def capsule_assistant_scope(db: VaultDatabase, capsule_id: str) -> dict[str, Any]:
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM capsules WHERE id=? AND workspace_id=?", (capsule_id, db.workspace_id)).fetchone()
        if not row:
            raise HTTPException(404, "Capsule not found")
        capsule = inflate_capsule(row)
        claim_ids = capsule_approved_claim_ids_for_overview(conn, db.workspace_id, capsule_id)
        source_rows = conn.execute(
            """
            SELECT DISTINCT sources.id
            FROM capsule_items
            JOIN sources ON sources.id=capsule_items.target_id
            WHERE capsule_items.workspace_id=? AND capsule_items.capsule_id=?
              AND capsule_items.target_type='source' AND capsule_items.status='active'
            UNION
            SELECT DISTINCT notes.source_id
            FROM capsule_items
            JOIN notes ON notes.id=capsule_items.target_id
            WHERE capsule_items.workspace_id=? AND capsule_items.capsule_id=?
              AND capsule_items.target_type='note' AND capsule_items.status='active'
              AND notes.source_id IS NOT NULL
            ORDER BY 1
            """,
            (db.workspace_id, capsule_id, db.workspace_id, capsule_id),
        ).fetchall()
        source_ids = [row["id"] for row in source_rows]
        source_block_rows = conn.execute(
            """
            SELECT DISTINCT source_blocks.id
            FROM capsule_items
            JOIN source_blocks ON source_blocks.id=capsule_items.target_id
            JOIN sources ON sources.id=source_blocks.source_id
            WHERE capsule_items.workspace_id=? AND capsule_items.capsule_id=?
              AND capsule_items.target_type='source_block' AND capsule_items.status='active'
              AND sources.workspace_id=?
            ORDER BY source_blocks.id
            """,
            (db.workspace_id, capsule_id, db.workspace_id),
        ).fetchall()
        source_block_ids = [row["id"] for row in source_block_rows]
        return {
            "capsule": capsule,
            "source_ids": source_ids,
            "source_block_ids": source_block_ids,
            "claim_ids": claim_ids,
            "item_count": count_capsule_items(conn, capsule_id, status="active"),
        }


def record_capsule_generated_note(db: VaultDatabase, capsule_id: str, note_id: str, payload: dict[str, Any]) -> None:
    ts = now_iso()
    with db.connect() as conn:
        ensure_capsule(conn, db.workspace_id, capsule_id)
        conn.execute("UPDATE capsules SET updated_at=? WHERE id=?", (ts, capsule_id))
        insert_changelog(
            conn,
            db,
            capsule_id,
            "note_generated",
            target_type="note",
            target_id=note_id,
            summary="Generated capsule overview note",
            payload=payload,
        )
        db.event(conn, "capsule.note_generated", "capsule", capsule_id, {"note_id": note_id, **payload}, "user")


def capsule_learning_deck_payload(db: VaultDatabase, capsule_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM capsules WHERE id=? AND workspace_id=?", (capsule_id, db.workspace_id)).fetchone()
        if not row:
            raise HTTPException(404, "Capsule not found")
        capsule = inflate_capsule(row)
        source_policy = str(payload.get("source_policy") or "reviewed_claims_only")
        deck_size = max(1, min(int(payload.get("deck_size") or 8), 24))
        claims = capsule_claim_rows_for_learning(conn, db.workspace_id, capsule_id, source_policy, deck_size)
        if not claims:
            raise HTTPException(422, "Add reviewed capsule claims before generating learning items")
        items = capsule_learning_items(capsule["name"], claims, payload)
        cards = [item["body"] for item in items if item["type"] == "flashcard"]
        warnings: list[str] = []
        if source_policy in {"include_unreviewed_with_warnings", "exploratory_mode"}:
            warnings.append("Some learning items may come from unreviewed capsule claims.")
        return {
            "capsule": capsule,
            "topic": capsule["name"],
            "items": items,
            "cards": cards,
            "claims": [dict(row) for row in claims],
            "source_policy": source_policy,
            "difficulty": str(payload.get("difficulty") or "beginner"),
            "duration": str(payload.get("duration") or "7_days"),
            "mode": str(payload.get("mode") or "course_outline"),
            "warnings": warnings,
        }


def attach_capsule_learning_items(conn: sqlite3.Connection, db: VaultDatabase, capsule_id: str, learning_item_ids: list[str], ts: str) -> dict[str, Any]:
    ensure_capsule(conn, db.workspace_id, capsule_id)
    max_sort = int(conn.execute("SELECT COALESCE(MAX(sort_order), 0) FROM capsule_items WHERE capsule_id=?", (capsule_id,)).fetchone()[0])
    added = 0
    skipped = 0
    for index, learning_item_id in enumerate(learning_item_ids, start=1):
        result = insert_capsule_item(
            conn,
            db,
            capsule_id,
            {
                "target_type": "learning_item",
                "target_id": learning_item_id,
                "role": "learning",
                "include_mode": "reference",
                "metadata": {"generated_from_capsule": True},
            },
            max_sort + index,
            ts,
        )
        if result == "added":
            added += 1
        else:
            skipped += 1
    if added:
        conn.execute("UPDATE capsules SET updated_at=? WHERE id=?", (ts, capsule_id))
        insert_changelog(
            conn,
            db,
            capsule_id,
            "learning_generated",
            summary=f"Added {added} learning item{'' if added == 1 else 's'}",
            payload={"learning_item_ids": learning_item_ids, "skipped_duplicates": skipped},
        )
        db.event(conn, "capsule.learning_generated", "capsule", capsule_id, {"learning_item_ids": learning_item_ids, "added": added}, "user")
    return {"added": added, "skipped_duplicates": skipped, "learning_item_ids": learning_item_ids}


def create_capsule_import_review_items(db: VaultDatabase, import_id: str) -> dict[str, Any]:
    ts = now_iso()
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM capsule_imports WHERE id=? AND workspace_id=?", (import_id, db.workspace_id)).fetchone()
        if not row:
            raise HTTPException(404, "Capsule import not found")
        if row["status"] not in {"quarantined", "review_ready", "partially_applied"}:
            raise HTTPException(409, "Only quarantined capsule imports can create review items")
        quarantine_path = Path(row["quarantine_path"] or "")
        package_path = quarantine_path / "original.vaultcapsule"
        if not package_path.exists():
            raise HTTPException(404, "Quarantined capsule package not found")
        manifest = loads(row["manifest_json"], {})
        records = capsule_import_records_for_review(package_path)
        existing = existing_import_review_targets(conn, db.workspace_id, import_id)
        created_ids: list[str] = []
        skipped = 0
        for proposal in capsule_import_review_proposals(import_id, manifest, records):
            proposal = add_capsule_import_merge_preview(conn, db.workspace_id, proposal)
            key = (proposal["item_type"], proposal["payload"]["import_target_type"], proposal["payload"]["import_target_id"])
            if key in existing:
                skipped += 1
                continue
            review_id = new_id("rev")
            conn.execute(
                """
                INSERT INTO review_items
                  (id, workspace_id, item_type, title, summary, payload_json, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
                """,
                (
                    review_id,
                    db.workspace_id,
                    proposal["item_type"],
                    proposal["title"],
                    proposal["summary"],
                    dumps(proposal["payload"]),
                    ts,
                    ts,
                ),
            )
            created_ids.append(review_id)
            existing.add(key)
        merge_plan = loads(row["merge_plan_json"], {})
        next_status = "partially_applied" if row["status"] == "partially_applied" else "review_ready"
        merge_plan["status"] = "partially_applied" if next_status == "partially_applied" else ("review_items_created" if created_ids or skipped else merge_plan.get("status", "ready_for_review"))
        merge_plan["review_item_ids"] = sorted(set([*merge_plan.get("review_item_ids", []), *created_ids]))
        merge_plan["created_review_item_count"] = len(merge_plan["review_item_ids"])
        conn.execute(
            """
            UPDATE capsule_imports
            SET status=?, merge_plan_json=?, warnings_json=?, validated_at=?
            WHERE id=?
            """,
            (next_status, dumps(merge_plan), row["warnings_json"], ts, import_id),
        )
        db.event(
            conn,
            "capsule.import_review_items_created",
            "capsule_import",
            import_id,
            {"created_review_items": len(created_ids), "skipped_duplicates": skipped},
            "user",
        )
        return {
            "import_id": import_id,
            "status": next_status,
            "created_review_items": len(created_ids),
            "skipped_duplicates": skipped,
            "review_item_ids": created_ids,
            "merge_plan": merge_plan,
        }


def approve_capsule_import_review_item(
    conn: sqlite3.Connection,
    db: VaultDatabase,
    payload: dict[str, Any],
    decision_note: str | None,
    ts: str,
) -> dict[str, Any]:
    if payload.get("type") != "capsule_import":
        raise HTTPException(422, "Review item is not a capsule import candidate")
    import_id = str(payload.get("capsule_import_id") or "")
    target_type = str(payload.get("import_target_type") or "")
    original_id = str(payload.get("import_target_id") or "")
    record = payload.get("record") if isinstance(payload.get("record"), dict) else {}
    if not import_id or not target_type or not original_id:
        raise HTTPException(422, "Capsule import review item is missing merge target metadata")
    imported = conn.execute("SELECT id FROM capsule_imports WHERE id=? AND workspace_id=?", (import_id, db.workspace_id)).fetchone()
    if not imported:
        raise HTTPException(404, "Capsule import not found")

    if target_type == "source":
        created = merge_imported_source(conn, db, import_id, original_id, record, ts)
    elif target_type == "note":
        created = merge_imported_note(conn, db, import_id, original_id, record, ts)
    elif target_type == "claim":
        created = merge_imported_claim(conn, db, import_id, original_id, record, ts)
    elif target_type == "kg_node":
        created = merge_imported_kg_node(conn, db, import_id, original_id, record, ts)
    elif target_type == "tool":
        created = merge_imported_tool(conn, db, import_id, original_id, record, ts)
    elif target_type in {"source_block", "evidence_link", "kg_edge", "capsule_membership"}:
        created = merge_imported_reference_decision(target_type, original_id, record)
    else:
        raise HTTPException(422, f"Unsupported capsule import target type: {target_type}")

    merge_record = {
        "import_target_type": target_type,
        "import_target_id": original_id,
        "canonical_target_type": created["target_type"],
        "canonical_target_id": created["target_id"],
        "action": created["merge_action"],
        "decision_note": decision_note,
        "decided_at": ts,
    }
    record_capsule_import_merge_decision(conn, db.workspace_id, import_id, merge_record, ts)
    return {"capsule_import_id": import_id, **created}


def merge_imported_source(conn: sqlite3.Connection, db: VaultDatabase, import_id: str, original_id: str, record: dict[str, Any], ts: str) -> dict[str, Any]:
    existing = local_row_by_original_id(conn, "sources", db.workspace_id, original_id)
    if existing:
        return {"target_type": "source", "target_id": existing["id"], "source_id": existing["id"], "merge_action": "linked_existing"}
    source_id = new_id("src")
    metadata = merge_import_metadata(record.get("metadata"), import_id, original_id, "source")
    conn.execute(
        """
        INSERT INTO sources
          (id, workspace_id, type, title, uri, content_hash, raw_path, extracted_text_path,
           trust_level, language, metadata_json, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, 'active', ?, ?)
        """,
        (
            source_id,
            db.workspace_id,
            str(record.get("type") or "capsule_import"),
            str(record.get("title") or "Imported source"),
            record.get("uri"),
            str(record.get("content_hash") or capsule_import_content_hash(record)),
            str(record.get("trust_level") or "unknown"),
            record.get("language"),
            dumps(metadata),
            ts,
            ts,
        ),
    )
    return {"target_type": "source", "target_id": source_id, "source_id": source_id, "merge_action": "created"}


def merge_imported_note(conn: sqlite3.Connection, db: VaultDatabase, import_id: str, original_id: str, record: dict[str, Any], ts: str) -> dict[str, Any]:
    existing = local_row_by_original_id(conn, "notes", db.workspace_id, original_id)
    if existing:
        return {"target_type": "note", "target_id": existing["id"], "note_id": existing["id"], "merge_action": "linked_existing"}
    note_id = new_id("note")
    source_id = new_id("src")
    title = str(record.get("title") or "Imported note")
    markdown = str(record.get("content_markdown") or title)
    content = record.get("content") if isinstance(record.get("content"), dict) else {}
    metadata = merge_import_metadata({"note_id": note_id}, import_id, original_id, "note")
    conn.execute(
        """
        INSERT INTO sources
          (id, workspace_id, type, title, content_hash, trust_level, metadata_json, status, created_at, updated_at)
        VALUES (?, ?, 'note', ?, ?, 'unknown', ?, 'active', ?, ?)
        """,
        (source_id, db.workspace_id, title, capsule_import_content_hash(markdown), dumps(metadata), ts, ts),
    )
    conn.execute(
        """
        INSERT INTO notes
          (id, workspace_id, source_id, title, content_json, content_markdown, origin, status,
           parent_note_id, version, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'capsule_import', 'active', ?, 1, 'user', ?, ?)
        """,
        (note_id, db.workspace_id, source_id, title, dumps(content), markdown, original_id, ts, ts),
    )
    conn.execute(
        """
        INSERT INTO note_versions (id, note_id, version, content_json, content_markdown, created_by, created_at)
        VALUES (?, ?, 1, ?, ?, 'user', ?)
        """,
        (new_id("ver"), note_id, dumps(content), markdown, ts),
    )
    insert_import_source_block(conn, source_id, title, markdown, ts)
    return {"target_type": "note", "target_id": note_id, "note_id": note_id, "source_id": source_id, "merge_action": "created"}


def merge_imported_claim(conn: sqlite3.Connection, db: VaultDatabase, import_id: str, original_id: str, record: dict[str, Any], ts: str) -> dict[str, Any]:
    existing = local_row_by_original_id(conn, "claims", db.workspace_id, original_id)
    if existing:
        return {"target_type": "claim", "target_id": existing["id"], "claim_id": existing["id"], "merge_action": "linked_existing"}
    body = str(record.get("normalized_text") or record.get("body") or record.get("title") or "Imported claim")
    original_node_id = str(record.get("node_id") or "")
    node_row = local_row_by_original_id(conn, "kg_nodes", db.workspace_id, original_node_id) if original_node_id else None
    if node_row:
        node_id = node_row["id"]
    else:
        node_id = new_id("node")
        conn.execute(
            """
            INSERT INTO kg_nodes
              (id, workspace_id, node_type, title, canonical_text, status, confidence, payload_json, created_at, updated_at)
            VALUES (?, ?, 'claim', ?, ?, 'active', ?, ?, ?, ?)
            """,
            (
                node_id,
                db.workspace_id,
                compact_text(body, 90),
                body,
                float(record.get("confidence") or 0),
                dumps(merge_import_metadata(record.get("metadata"), import_id, original_node_id or original_id, "claim_node")),
                ts,
                ts,
            ),
        )
    claim_id = new_id("clm")
    conn.execute(
        """
        INSERT INTO claims
          (id, node_id, workspace_id, normalized_text, language, domain, time_scope, status,
           confidence, evidence_strength, source_trust_score, last_checked_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'weakly_supported', ?, 0, 0, NULL, ?, ?)
        """,
        (
            claim_id,
            node_id,
            db.workspace_id,
            body,
            record.get("language"),
            record.get("domain"),
            record.get("time_scope"),
            float(record.get("confidence") or 0),
            ts,
            ts,
        ),
    )
    return {"target_type": "claim", "target_id": claim_id, "claim_id": claim_id, "node_id": node_id, "status": "weakly_supported", "merge_action": "created"}


def merge_imported_kg_node(conn: sqlite3.Connection, db: VaultDatabase, import_id: str, original_id: str, record: dict[str, Any], ts: str) -> dict[str, Any]:
    existing = local_row_by_original_id(conn, "kg_nodes", db.workspace_id, original_id)
    if existing:
        return {"target_type": "kg_node", "target_id": existing["id"], "node_id": existing["id"], "merge_action": "linked_existing"}
    node_id = new_id("node")
    title = str(record.get("title") or record.get("canonical_text") or "Imported concept")
    conn.execute(
        """
        INSERT INTO kg_nodes
          (id, workspace_id, node_type, title, canonical_text, status, confidence, payload_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
        """,
        (
            node_id,
            db.workspace_id,
            str(record.get("node_type") or "concept"),
            title,
            str(record.get("canonical_text") or title),
            float(record.get("confidence") or 0),
            dumps(merge_import_metadata(record.get("metadata"), import_id, original_id, "kg_node")),
            ts,
            ts,
        ),
    )
    return {"target_type": "kg_node", "target_id": node_id, "node_id": node_id, "merge_action": "created"}


def merge_imported_tool(conn: sqlite3.Connection, db: VaultDatabase, import_id: str, original_id: str, record: dict[str, Any], ts: str) -> dict[str, Any]:
    existing = local_row_by_original_id(conn, "tool_registry", db.workspace_id, original_id)
    if existing:
        return {"target_type": "tool", "target_id": existing["id"], "tool_id": existing["id"], "status": existing["status"], "merge_action": "linked_existing"}
    tool_id = new_id("tool")
    manifest = record.get("manifest") if isinstance(record.get("manifest"), dict) else {}
    name = str(record.get("name") or manifest.get("name") or "Imported tool")
    slug = slugify(str(record.get("slug") or name))
    manifest = {**manifest, "imported_from_capsule": True, "import_review_required": True}
    conn.execute(
        """
        INSERT INTO tool_registry
          (id, workspace_id, name, slug, version, status, manifest_json, install_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'disabled', ?, NULL, ?, ?)
        """,
        (
            tool_id,
            db.workspace_id,
            name,
            unique_import_slug(conn, db.workspace_id, slug),
            str(record.get("version") or manifest.get("version") or "0.1.0"),
            dumps(merge_import_metadata(manifest, import_id, original_id, "tool")),
            ts,
            ts,
        ),
    )
    return {"target_type": "tool", "target_id": tool_id, "tool_id": tool_id, "status": "disabled", "merge_action": "created_disabled"}


def merge_imported_reference_decision(target_type: str, original_id: str, record: dict[str, Any]) -> dict[str, Any]:
    return {
        "target_type": target_type,
        "target_id": original_id,
        "import_record": record,
        "merge_action": "recorded_for_followup",
    }


def local_row_by_original_id(conn: sqlite3.Connection, table: str, workspace_id: str, original_id: str) -> sqlite3.Row | None:
    if not original_id:
        return None
    return conn.execute(f"SELECT * FROM {table} WHERE id=? AND workspace_id=?", (original_id, workspace_id)).fetchone()


def merge_import_metadata(value: Any, import_id: str, original_id: str, target_type: str) -> dict[str, Any]:
    metadata = dict(value) if isinstance(value, dict) else {}
    metadata["capsule_import"] = {
        "import_id": import_id,
        "original_id": original_id,
        "target_type": target_type,
    }
    return metadata


def capsule_import_content_hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


def insert_import_source_block(conn: sqlite3.Connection, source_id: str, title: str, text: str, ts: str) -> str:
    block_text = text or title or "Imported note"
    block_id = new_id("blk")
    conn.execute(
        """
        INSERT INTO source_blocks
          (id, source_id, block_index, locator, heading_path, text, text_hash, token_count, created_at)
        VALUES (?, ?, 1, 'imported-note', NULL, ?, ?, ?, ?)
        """,
        (block_id, source_id, block_text, capsule_import_content_hash(block_text), estimate_import_tokens(block_text), ts),
    )
    conn.execute(
        "INSERT INTO source_blocks_fts (text, title, source_id, source_block_id) VALUES (?, ?, ?, ?)",
        (block_text, title, source_id, block_id),
    )
    return block_id


def estimate_import_tokens(text: str) -> int:
    return max(1, len(str(text or "").split()))


def unique_import_slug(conn: sqlite3.Connection, workspace_id: str, base_slug: str) -> str:
    slug = base_slug or "imported-tool"
    candidate = slug
    index = 2
    while conn.execute("SELECT id FROM tool_registry WHERE workspace_id=? AND slug=?", (workspace_id, candidate)).fetchone():
        candidate = f"{slug}-{index}"
        index += 1
    return candidate


def record_capsule_import_merge_decision(conn: sqlite3.Connection, workspace_id: str, import_id: str, decision: dict[str, Any], ts: str) -> None:
    row = conn.execute("SELECT merge_plan_json FROM capsule_imports WHERE id=? AND workspace_id=?", (import_id, workspace_id)).fetchone()
    if not row:
        return
    merge_plan = loads(row["merge_plan_json"], {})
    decisions = [item for item in merge_plan.get("merge_decisions", []) if isinstance(item, dict)]
    decisions.append(decision)
    merge_plan["merge_decisions"] = decisions
    merge_plan["merged_item_count"] = len(decisions)
    merge_plan["status"] = "partially_applied"
    conn.execute(
        """
        UPDATE capsule_imports
        SET status='partially_applied', merge_plan_json=?, decided_at=?, decision='partial_merge'
        WHERE id=? AND workspace_id=?
        """,
        (dumps(merge_plan), ts, import_id, workspace_id),
    )


def preview_from_package(capsule_id: str, export_mode: str, package: dict[str, Any]) -> dict[str, Any]:
    return {
        "capsule_id": capsule_id,
        "export_mode": export_mode,
        "status": "blocked" if package["privacy_report"]["blockers"] else "ready",
        "filename": capsule_export_filename(package["capsule"], version=package["export_scope"].get("version")),
        "export_scope": package["export_scope"],
        "manifest": package["manifest"],
        "privacy_report": package["privacy_report"],
        "validation_report": package["validation_report"],
    }


def validate_capsule_import_package(package_path: Path, max_file_count: int, max_unpacked_bytes: int) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[dict[str, Any]] = []
    manifest: dict[str, Any] = {}
    file_count = 0
    unpacked_bytes = 0
    checksum_results: list[dict[str, Any]] = []
    try:
        with zipfile.ZipFile(package_path) as archive:
            infos = archive.infolist()
            file_count = len([info for info in infos if not info.is_dir()])
            if file_count > max_file_count:
                errors.append(f"Package has {file_count} files, above the limit of {max_file_count}.")
            names = {info.filename for info in infos if not info.is_dir()}
            missing = sorted(CAPSULE_IMPORT_REQUIRED_FILES - names)
            if missing:
                errors.append(f"Package is missing required files: {', '.join(missing)}.")
            for info in infos:
                if info.is_dir():
                    continue
                unpacked_bytes += int(info.file_size)
                path_error = validate_capsule_archive_path(info)
                if path_error:
                    errors.append(path_error)
            if unpacked_bytes > max_unpacked_bytes:
                errors.append(f"Package expands to {unpacked_bytes} bytes, above the limit of {max_unpacked_bytes}.")
            if "manifest.json" in names:
                manifest_bytes = archive.read("manifest.json")
                try:
                    manifest = json.loads(manifest_bytes.decode("utf-8"))
                except json.JSONDecodeError as exc:
                    errors.append(f"manifest.json is invalid JSON: {exc}")
                if "manifest-sha256.txt" in names:
                    expected = archive.read("manifest-sha256.txt").decode("utf-8", errors="replace").split()[0].strip()
                    actual = hashlib.sha256(manifest_bytes).hexdigest()
                    if expected != actual:
                        errors.append("manifest-sha256.txt does not match manifest.json.")
                    checksum_results.append({"path": "manifest.json", "status": "pass" if expected == actual else "failed", "sha256": actual})
            checksums = manifest.get("checksums") if isinstance(manifest, dict) else {}
            if isinstance(checksums, dict):
                for path, expected_sha in checksums.items():
                    if not isinstance(path, str) or not isinstance(expected_sha, str):
                        errors.append("Manifest checksums must map paths to SHA-256 strings.")
                        continue
                    if path not in names:
                        errors.append(f"Manifest checksum references missing file: {path}.")
                        checksum_results.append({"path": path, "status": "missing"})
                        continue
                    actual_sha = hashlib.sha256(archive.read(path)).hexdigest()
                    status = "pass" if actual_sha == expected_sha else "failed"
                    if status == "failed":
                        errors.append(f"Checksum mismatch for {path}.")
                    checksum_results.append({"path": path, "status": status, "sha256": actual_sha})
            else:
                warnings.append({"code": "missing_file_checksums", "message": "Manifest does not include file checksums."})
    except zipfile.BadZipFile as exc:
        errors.append(f"Package is not a valid zip archive: {exc}")
    return {
        "status": "valid" if not errors else "invalid",
        "package_path": str(package_path),
        "file_count": file_count,
        "unpacked_bytes": unpacked_bytes,
        "manifest": manifest,
        "checksum_results": checksum_results,
        "warnings": warnings,
        "errors": errors,
    }


def validate_capsule_archive_path(info: zipfile.ZipInfo) -> str | None:
    name = info.filename
    if name.startswith("/") or name.startswith("\\"):
        return f"Archive path is absolute: {name}."
    path = Path(name)
    if any(part in {"..", ""} for part in path.parts):
        return f"Archive path is unsafe: {name}."
    if info.external_attr >> 16 & 0o170000 == 0o120000:
        return f"Archive entry is a symlink: {name}."
    return None


def build_capsule_import_merge_plan(manifest: dict[str, Any], validation: dict[str, Any]) -> dict[str, Any]:
    capsule = manifest.get("capsule") if isinstance(manifest, dict) else {}
    object_counts = manifest.get("object_counts") if isinstance(manifest, dict) else {}
    object_counts = object_counts if isinstance(object_counts, dict) else {}
    actions = []
    for key, label in (
        ("notes", "notes"),
        ("sources", "sources"),
        ("source_blocks", "source blocks"),
        ("claims", "claims"),
        ("kg_nodes", "concepts"),
        ("evidence_links", "evidence links"),
        ("graph_edges", "graph edges"),
        ("items", "capsule memberships"),
        ("learning_items", "learning items"),
        ("tools", "tools"),
    ):
        count = int(object_counts.get(key) or 0)
        if count:
            action = "review_imported_tools_disabled" if key == "tools" else "create_review_items"
            actions.append({"target_type": key, "count": count, "action": action})
    warnings = [{"code": "tools_disabled_until_reviewed", "message": "Imported tools stay disabled until reviewed."}] if int(object_counts.get("tools") or 0) else []
    return {
        "status": "ready_for_review" if validation["status"] == "valid" else "blocked",
        "capsule_name": capsule.get("name") if isinstance(capsule, dict) else None,
        "capsule_slug": capsule.get("slug") if isinstance(capsule, dict) else None,
        "object_counts": object_counts,
        "actions": actions,
        "canonical_mutation": "none",
        "tool_default_status": "disabled_imported",
        "warnings": warnings,
    }


def write_import_quarantine_files(quarantine_dir: Path, manifest: dict[str, Any], validation: dict[str, Any], merge_plan: dict[str, Any]) -> None:
    (quarantine_dir / "manifest.json").write_bytes(stable_json_bytes(manifest))
    (quarantine_dir / "validation_report.json").write_bytes(stable_json_bytes(validation))
    (quarantine_dir / "merge_plan.json").write_bytes(stable_json_bytes(merge_plan))


def capsule_import_records_for_review(package_path: Path) -> dict[str, list[dict[str, Any]]]:
    with zipfile.ZipFile(package_path) as archive:
        return {
            "items": read_zip_json(archive, "data/items.json", []),
            "claims": read_zip_jsonl(archive, "data/claims.jsonl"),
            "sources": read_zip_json(archive, "data/sources.json", []),
            "source_blocks": read_zip_jsonl(archive, "data/source_blocks.jsonl"),
            "notes": read_zip_jsonl(archive, "data/notes.jsonl"),
            "kg_nodes": read_zip_jsonl(archive, "data/kg_nodes.jsonl"),
            "evidence_links": read_zip_jsonl(archive, "data/evidence_links.jsonl"),
            "graph_edges": read_zip_jsonl(archive, "data/graph_edges.jsonl"),
            "tools": read_zip_jsonl(archive, "data/tools.jsonl"),
        }


def read_zip_json(archive: zipfile.ZipFile, path: str, fallback: Any) -> Any:
    if path not in archive.namelist():
        return fallback
    return json.loads(archive.read(path).decode("utf-8"))


def read_zip_jsonl(archive: zipfile.ZipFile, path: str) -> list[dict[str, Any]]:
    if path not in archive.namelist():
        return []
    text = archive.read(path).decode("utf-8")
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def existing_import_review_targets(conn: sqlite3.Connection, workspace_id: str, import_id: str) -> set[tuple[str, str, str]]:
    rows = conn.execute(
        """
        SELECT item_type, payload_json
        FROM review_items
        WHERE workspace_id=? AND item_type LIKE 'capsule_import_%'
        """,
        (workspace_id,),
    ).fetchall()
    existing: set[tuple[str, str, str]] = set()
    for row in rows:
        payload = loads(row["payload_json"], {})
        if payload.get("capsule_import_id") != import_id:
            continue
        existing.add((row["item_type"], str(payload.get("import_target_type") or ""), str(payload.get("import_target_id") or "")))
    return existing


def capsule_import_review_proposals(import_id: str, manifest: dict[str, Any], records: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    capsule = manifest.get("capsule") if isinstance(manifest, dict) else {}
    capsule_name = capsule.get("name") if isinstance(capsule, dict) else "Imported capsule"
    proposals: list[dict[str, Any]] = []
    for claim in records.get("claims", []):
        target_id = str(claim.get("id") or "")
        body = str(claim.get("normalized_text") or claim.get("title") or target_id)
        proposals.append(
            import_review_proposal(
                import_id,
                "capsule_import_claim",
                "claim",
                target_id,
                f"Imported claim: {compact_text(body, 72)}",
                f"{capsule_name}: claim requires review before merge.",
                body,
                claim,
            )
        )
    for note in records.get("notes", []):
        title = str(note.get("title") or note.get("id") or "Imported note")
        body = str(note.get("content_markdown") or "")
        proposals.append(
            import_review_proposal(import_id, "capsule_import_note", "note", str(note.get("id") or ""), f"Imported note: {title}", f"{capsule_name}: note requires review before merge.", body, note)
        )
    for source in records.get("sources", []):
        title = str(source.get("title") or source.get("id") or "Imported source")
        body = f"{source.get('type', 'source')} source"
        proposals.append(
            import_review_proposal(
                import_id,
                "capsule_import_source",
                "source",
                str(source.get("id") or ""),
                f"Imported source: {title}",
                f"{capsule_name}: source metadata requires review before merge.",
                body,
                source,
            )
        )
    for node in records.get("kg_nodes", []):
        title = str(node.get("title") or node.get("canonical_text") or node.get("id") or "Imported concept")
        body = str(node.get("canonical_text") or title)
        proposals.append(
            import_review_proposal(
                import_id,
                "capsule_import_concept",
                "kg_node",
                str(node.get("id") or ""),
                f"Imported concept: {title}",
                f"{capsule_name}: concept requires review before merge.",
                body,
                node,
            )
        )
    for tool in records.get("tools", []):
        title = str(tool.get("name") or tool.get("id") or "Imported tool")
        body = "Imported tools remain disabled until reviewed."
        record = {**tool, "status": "disabled_imported", "import_default_status": "disabled_imported"}
        proposals.append(
            import_review_proposal(
                import_id,
                "capsule_import_tool",
                "tool",
                str(tool.get("id") or ""),
                f"Imported tool: {title}",
                f"{capsule_name}: tool is disabled until reviewed.",
                body,
                record,
            )
        )
    for block in records.get("source_blocks", []):
        block_id = str(block.get("id") or "")
        body = str(block.get("text") or block.get("heading_path") or block_id)
        proposals.append(
            import_review_proposal(
                import_id,
                "capsule_import_source_block",
                "source_block",
                block_id,
                f"Imported source block: {compact_text(body, 72)}",
                f"{capsule_name}: source block requires review before merge.",
                body,
                block,
            )
        )
    for evidence in records.get("evidence_links", []):
        evidence_id = str(evidence.get("id") or "")
        body = str(evidence.get("exact_quote") or evidence.get("claim_id") or evidence_id)
        proposals.append(
            import_review_proposal(
                import_id,
                "capsule_import_evidence_link",
                "evidence_link",
                evidence_id,
                f"Imported evidence: {compact_text(body, 72)}",
                f"{capsule_name}: evidence link requires review before merge.",
                body,
                evidence,
            )
        )
    for edge in records.get("graph_edges", []):
        edge_id = str(edge.get("id") or "")
        edge_label = f"{edge.get('from_node_id', 'node')} {edge.get('edge_type', 'relates')} {edge.get('to_node_id', 'node')}"
        proposals.append(
            import_review_proposal(
                import_id,
                "capsule_import_graph_edge",
                "kg_edge",
                edge_id,
                f"Imported graph edge: {compact_text(edge_label, 72)}",
                f"{capsule_name}: graph edge requires review before merge.",
                edge_label,
                edge,
            )
        )
    for item in records.get("items", []):
        membership_id = str(item.get("id") or "")
        target_type = str(item.get("target_type") or "item")
        target_id = str(item.get("target_id") or "")
        body = f"{target_type} · {target_id} · {item.get('role', 'reference')}"
        proposals.append(
            import_review_proposal(
                import_id,
                "capsule_import_membership",
                "capsule_membership",
                membership_id or f"{target_type}:{target_id}",
                f"Imported capsule membership: {target_type.replace('_', ' ')}",
                f"{capsule_name}: capsule membership requires review before merge.",
                body,
                item,
            )
        )
    return [proposal for proposal in proposals if proposal["payload"]["import_target_id"]]


def import_review_proposal(
    import_id: str,
    item_type: str,
    target_type: str,
    target_id: str,
    title: str,
    summary: str,
    body: str,
    record: dict[str, Any],
) -> dict[str, Any]:
    return {
        "item_type": item_type,
        "title": title,
        "summary": summary,
        "payload": {
            "type": "capsule_import",
            "capsule_import_id": import_id,
            "import_target_type": target_type,
            "import_target_id": target_id,
            "body": compact_text(body, 1200),
            "record": record,
            "actions": ["Review imported data", "Create merge decision later"],
            "canonical_mutation": "none",
        },
    }


def add_capsule_import_merge_preview(conn: sqlite3.Connection, workspace_id: str, proposal: dict[str, Any]) -> dict[str, Any]:
    payload = proposal.get("payload") if isinstance(proposal.get("payload"), dict) else {}
    target_type = str(payload.get("import_target_type") or "")
    original_id = str(payload.get("import_target_id") or "")
    target_table = capsule_import_target_table(target_type)
    existing = local_row_by_original_id(conn, target_table, workspace_id, original_id) if target_table else None
    action = "linked_existing" if existing else capsule_import_create_action(target_type)
    summary = capsule_import_merge_preview_summary(target_type, action)
    comparison = capsule_import_merge_comparison(target_type, payload.get("record") if isinstance(payload.get("record"), dict) else {}, existing)
    enriched_payload = {
        **payload,
        "merge_preview": {
            "import_target_type": target_type,
            "import_target_id": original_id,
            "canonical_target_type": target_type,
            "canonical_target_id": existing["id"] if existing else None,
            "action": action,
            "summary": summary,
            "requires_review": True,
            "comparison": comparison,
            "conflict_count": sum(1 for item in comparison if item.get("changed")),
        },
        "merge_action_preview": action,
        "merge_summary": summary,
        "existing_target_id": existing["id"] if existing else None,
    }
    if target_type == "claim" and not existing:
        enriched_payload["suggested_status"] = "weakly_supported"
    if target_type == "tool" and not existing:
        enriched_payload["tool_import_status"] = "disabled_until_reviewed"
    return {**proposal, "payload": enriched_payload}


def capsule_import_merge_comparison(target_type: str, imported: dict[str, Any], existing: sqlite3.Row | None) -> list[dict[str, Any]]:
    if not existing:
        return []
    local = dict(existing)
    if target_type == "note":
        return compare_import_fields(
            [
                ("title", "Title", imported.get("title"), local.get("title")),
                ("content_markdown", "Body", compact_text(str(imported.get("content_markdown") or ""), 180), compact_text(str(local.get("content_markdown") or ""), 180)),
                ("status", "Status", imported.get("status"), local.get("status")),
            ]
        )
    if target_type == "source":
        return compare_import_fields(
            [
                ("title", "Title", imported.get("title"), local.get("title")),
                ("type", "Type", imported.get("type"), local.get("type")),
                ("content_hash", "Hash", imported.get("content_hash"), local.get("content_hash")),
                ("trust_level", "Trust", imported.get("trust_level"), local.get("trust_level")),
            ]
        )
    if target_type == "claim":
        return compare_import_fields(
            [
                ("normalized_text", "Claim", compact_text(str(imported.get("normalized_text") or ""), 180), compact_text(str(local.get("normalized_text") or ""), 180)),
                ("status", "Status", imported.get("status"), local.get("status")),
                ("confidence", "Confidence", imported.get("confidence"), local.get("confidence")),
                ("evidence_strength", "Evidence", imported.get("evidence_strength"), local.get("evidence_strength")),
            ]
        )
    if target_type == "kg_node":
        return compare_import_fields(
            [
                ("title", "Title", imported.get("title"), local.get("title")),
                ("canonical_text", "Text", compact_text(str(imported.get("canonical_text") or ""), 180), compact_text(str(local.get("canonical_text") or ""), 180)),
                ("node_type", "Type", imported.get("node_type"), local.get("node_type")),
                ("status", "Status", imported.get("status"), local.get("status")),
            ]
        )
    if target_type == "tool":
        manifest = loads(local.get("manifest_json"), {}) if "manifest_json" in local else {}
        imported_manifest = imported.get("manifest") if isinstance(imported.get("manifest"), dict) else {}
        return compare_import_fields(
            [
                ("name", "Name", imported.get("name") or imported_manifest.get("name"), local.get("name")),
                ("version", "Version", imported.get("version") or imported_manifest.get("version"), local.get("version")),
                ("status", "Status", imported.get("status"), local.get("status")),
                ("runtime", "Runtime", imported_manifest.get("runtime"), manifest.get("runtime")),
            ]
        )
    return []


def compare_import_fields(fields: list[tuple[str, str, Any, Any]]) -> list[dict[str, Any]]:
    comparison = []
    for key, label, imported_value, local_value in fields:
        imported_text = comparable_text(imported_value)
        local_text = comparable_text(local_value)
        comparison.append(
            {
                "field": key,
                "label": label,
                "imported": imported_text,
                "local": local_text,
                "changed": imported_text != local_text,
            }
        )
    return comparison


def comparable_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        return f"{value:.3f}".rstrip("0").rstrip(".")
    return str(value)


def capsule_import_target_table(target_type: str) -> str | None:
    tables = {
        "source": "sources",
        "note": "notes",
        "claim": "claims",
        "kg_node": "kg_nodes",
        "tool": "tool_registry",
    }
    return tables.get(target_type)


def capsule_import_create_action(target_type: str) -> str:
    if target_type in {"source_block", "evidence_link", "kg_edge", "capsule_membership"}:
        return "recorded_for_followup"
    if target_type == "tool":
        return "created_disabled"
    return "created"


def capsule_import_merge_preview_summary(target_type: str, action: str) -> str:
    label = target_type.replace("_", " ") or "item"
    if action == "linked_existing":
        return f"Approval links this import to the existing local {label}; no duplicate object is created."
    if action == "created_disabled":
        return "Approval creates a disabled local tool. It cannot run until explicitly enabled after review."
    if action == "recorded_for_followup":
        return "Approval records this imported relationship for a later selective merge step."
    if target_type == "claim":
        return "Approval creates a weakly supported local claim that still needs evidence review."
    return f"Approval creates a new local {label} from this quarantined import."


def normalize_export_mode(value: Any) -> str:
    text = str(value or "reference_only").strip().lower().replace(" ", "_").replace("-", "_")
    aliases = {
        "reference": "reference_only",
        "reference_only_export": "reference_only",
        "sanitized_export": "sanitized",
        "private_full_export": "private_full",
        "full_private": "private_full",
        "learning_export": "learning",
        "tool_export": "tool",
        "public_capsule_export": "public",
    }
    mode = aliases.get(text, text)
    if mode not in CAPSULE_EXPORT_MODES:
        raise HTTPException(422, f"Unsupported capsule export mode: {value}")
    return mode


def build_capsule_export_payload(conn: sqlite3.Connection, workspace_id: str, capsule_id: str, export_mode: str, version_id: str | None = None) -> dict[str, Any]:
    capsule = inflate_capsule(ensure_capsule(conn, workspace_id, capsule_id))
    counts = capsule_counts(conn, capsule_id)
    health = summarize_health(compute_health_payload(conn, workspace_id, capsule_id))
    export_scope: dict[str, Any] = {"type": "live"}
    if version_id:
        version_row = capsule_version_row(conn, workspace_id, capsule_id, version_id)
        version_manifest = loads(version_row["manifest_json"], {})
        snapshot_capsule = version_manifest.get("capsule") if isinstance(version_manifest, dict) else None
        if isinstance(snapshot_capsule, dict):
            capsule = snapshot_capsule
        items = hydrate_capsule_snapshot_items(conn, workspace_id, capsule_id, loads(version_row["item_snapshot_json"], []))
        counts = capsule_counts_from_items(items)
        snapshot_health = loads(version_row["health_snapshot_json"], {})
        if isinstance(snapshot_health, dict) and {"score", "status", "warnings", "counts"} <= set(snapshot_health):
            health = summarize_health(snapshot_health)
        export_scope = {
            "type": "version",
            "version_id": version_row["id"],
            "version": version_row["version"],
            "title": version_row["title"],
            "created_at": version_row["created_at"],
        }
    else:
        items = list_capsule_items_for_conn(conn, workspace_id, capsule_id, limit=10000)
    records, source_blob_files = collect_capsule_export_records(conn, workspace_id, capsule_id, items, export_mode)
    privacy_report = capsule_export_privacy_report(conn, capsule_id, export_mode, items, records, health, source_blob_files)
    object_counts = {key: len(value) for key, value in records.items()}
    manifest = {
        "schema_version": 1,
        "package_type": "the_vault_knowledge_capsule",
        "workspace_id": workspace_id,
        "capsule": capsule,
        "export_mode": export_mode,
        "export_scope": export_scope,
        "created_at": now_iso(),
        "counts": counts,
        "object_counts": object_counts,
        "formats": {
            "manifest": "JSON",
            "items": "JSON",
            "notes": "Markdown + JSONL metadata",
            "sources": "JSON",
            "source_blobs": "Private-full source files",
            "source_blocks": "JSONL",
            "claims": "JSONL",
            "evidence_links": "JSONL",
            "graph_edges": "JSONL",
            "learning_items": "JSONL",
            "tools": "JSONL",
        },
        "privacy": {
            "status": "blocked" if privacy_report["blockers"] else "ready",
            "warning_count": len(privacy_report["warnings"]),
            "blocker_count": len(privacy_report["blockers"]),
        },
    }
    validation_report = {
        "status": "blocked" if privacy_report["blockers"] else "ready",
        "checksums_ready": True,
        "item_count": len(items),
        "export_scope": export_scope,
        "object_counts": object_counts,
        "warnings": privacy_report["warnings"],
        "blockers": privacy_report["blockers"],
    }
    return {
        "capsule": capsule,
        "items": items,
        "records": records,
        "source_blob_files": source_blob_files,
        "health": health,
        "export_scope": export_scope,
        "manifest": manifest,
        "privacy_report": privacy_report,
        "validation_report": validation_report,
    }


def hydrate_capsule_snapshot_items(conn: sqlite3.Connection, workspace_id: str, capsule_id: str, snapshot_items: Any) -> list[dict[str, Any]]:
    if not isinstance(snapshot_items, list):
        return []
    items = []
    for raw in snapshot_items:
        if not isinstance(raw, dict):
            continue
        item = dict(raw)
        item.setdefault("capsule_id", capsule_id)
        item.setdefault("workspace_id", workspace_id)
        item.setdefault("status", "active")
        target_type = str(item.get("target_type") or "")
        target_id = str(item.get("target_id") or "")
        if not target_type or not target_id or item.get("status") != "active":
            continue
        item["target"] = target_summary(conn, workspace_id, target_type, target_id)
        items.append(item)
    return items


def capsule_counts_from_items(items: list[dict[str, Any]]) -> dict[str, int]:
    counts = empty_counts()
    for item in items:
        target_type = item.get("target_type")
        if target_type == "source":
            counts["sources"] += 1
        elif target_type == "note":
            counts["notes"] += 1
        elif target_type == "claim":
            counts["claims"] += 1
        elif target_type == "kg_node":
            counts["concepts"] += 1
        elif target_type == "tool":
            counts["tools"] += 1
    return counts


def collect_capsule_export_records(
    conn: sqlite3.Connection,
    workspace_id: str,
    capsule_id: str,
    items: list[dict[str, Any]],
    export_mode: str,
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, bytes]]:
    ids: dict[str, set[str]] = {target_type: set() for target_type in SUPPORTED_TARGET_TYPES}
    for item in items:
        ids.setdefault(item["target_type"], set()).add(item["target_id"])

    claim_ids = set(ids.get("claim", set()))
    claim_rows = rows_by_ids(conn, "claims", "id", claim_ids, workspace_id=workspace_id)
    ids.setdefault("kg_node", set()).update(str(row["node_id"]) for row in claim_rows if row.get("node_id"))

    evidence_ids = set(ids.get("evidence_link", set()))
    if claim_ids:
        evidence_rows = rows_to_dicts(
            conn.execute(
                f"SELECT * FROM evidence_links WHERE claim_id IN ({sql_placeholders(claim_ids)})",
                tuple(claim_ids),
            ).fetchall()
        )
        evidence_ids.update(row["id"] for row in evidence_rows)
    evidence_rows = rows_by_ids(conn, "evidence_links", "id", evidence_ids) if evidence_ids else []
    ids.setdefault("source_block", set()).update(str(row["source_block_id"]) for row in evidence_rows if row.get("source_block_id"))

    source_block_ids = set(ids.get("source_block", set()))
    source_block_rows = source_blocks_by_ids(conn, source_block_ids, workspace_id)
    ids.setdefault("source", set()).update(str(row["source_id"]) for row in source_block_rows if row.get("source_id"))

    source_rows = rows_by_ids(conn, "sources", "id", ids.get("source", set()), workspace_id=workspace_id)
    note_rows = rows_by_ids(conn, "notes", "id", ids.get("note", set()), workspace_id=workspace_id)
    kg_node_rows = rows_by_ids(conn, "kg_nodes", "id", ids.get("kg_node", set()), workspace_id=workspace_id)
    kg_edge_rows = capsule_edge_rows(conn, workspace_id, ids.get("kg_edge", set()), {row["id"] for row in kg_node_rows})
    learning_rows = rows_by_ids(conn, "learning_items", "id", ids.get("learning_item", set()), workspace_id=workspace_id)
    tool_rows = rows_by_ids(conn, "tool_registry", "id", ids.get("tool", set()), workspace_id=workspace_id)
    source_blobs, source_blob_files = source_blob_records_for_export(source_rows, export_mode)
    blob_refs_by_source: dict[str, list[dict[str, Any]]] = {}
    for blob in source_blobs:
        blob_refs_by_source.setdefault(str(blob["source_id"]), []).append({key: blob[key] for key in ("kind", "package_path", "sha256", "size_bytes")})

    return {
        "items": items,
        "sources": [sanitize_source_for_export(row, blob_refs_by_source.get(str(row["id"]), [])) for row in source_rows],
        "source_blobs": source_blobs,
        "source_blocks": [sanitize_source_block_for_export(row, export_mode) for row in source_block_rows],
        "notes": [export_note_row(row, export_mode) for row in note_rows],
        "kg_nodes": [export_json_fields(row, {"metadata_json": "metadata"}) for row in kg_node_rows],
        "claims": [export_json_fields(row, {"metadata_json": "metadata"}) for row in claim_rows],
        "evidence_links": [sanitize_evidence_link_for_export(row, export_mode) for row in evidence_rows],
        "graph_edges": [export_json_fields(row, {"metadata_json": "metadata"}) for row in kg_edge_rows],
        "learning_items": [export_json_fields(row, {"body_json": "body"}) for row in learning_rows],
        "tools": [sanitize_tool_for_export(row) for row in tool_rows],
    }, source_blob_files


def capsule_export_privacy_report(
    conn: sqlite3.Connection,
    capsule_id: str,
    export_mode: str,
    items: list[dict[str, Any]],
    records: dict[str, list[dict[str, Any]]],
    health: dict[str, Any],
    source_blob_files: dict[str, bytes] | None = None,
) -> dict[str, Any]:
    private_items = [item for item in items if bool(item.get("private_flag"))]
    full_source_items = [item for item in items if item.get("export_policy") == "full_sources_private"]
    disabled_tools = [
        tool
        for tool in records.get("tools", [])
        if tool.get("status") not in {None, "installed", "active", "enabled"}
    ]
    unsupported_claims = [claim for claim in records.get("claims", []) if claim.get("evidence_strength", 0) <= 0 or claim.get("status") in {"needs_review", "weakly_supported"}]
    exact_quote_count = sum(1 for link in records.get("evidence_links", []) if link.get("exact_quote")) + sum(1 for block in records.get("source_blocks", []) if block.get("text"))
    scan_report = capsule_export_safety_scan(records, export_mode, source_blob_files or {})
    secret_findings = scan_report["possible_secrets"]
    pii_findings = scan_report["pii_signals"]
    copyright_findings = scan_report["copyrighted_sources"]
    warnings: list[dict[str, Any]] = []
    blockers: list[dict[str, Any]] = []
    if private_items:
        target = {"code": "private_items", "count": len(private_items), "message": f"{len(private_items)} private capsule items are included."}
        (warnings if export_mode == "private_full" else blockers).append(target)
    if full_source_items and export_mode != "private_full":
        blockers.append({"code": "full_sources_private", "count": len(full_source_items), "message": "Full-source private export requires Private full export."})
    if disabled_tools:
        warnings.append({"code": "disabled_tools", "count": len(disabled_tools), "message": f"{len(disabled_tools)} tools are disabled or not installed."})
    if unsupported_claims:
        warnings.append({"code": "unsupported_claims", "count": len(unsupported_claims), "message": f"{len(unsupported_claims)} claims need stronger evidence."})
    if secret_findings:
        blockers.append({"code": "possible_secrets", "count": len(secret_findings), "message": f"{len(secret_findings)} secret-looking strings were detected before export."})
    if pii_findings:
        target = {"code": "personal_data_signals", "count": len(pii_findings), "message": f"{len(pii_findings)} email, phone, client, or patient signals were detected."}
        (warnings if export_mode == "private_full" else blockers).append(target)
    if copyright_findings:
        target = {"code": "copyrighted_sources", "count": len(copyright_findings), "message": f"{len(copyright_findings)} source copyright/license findings need review."}
        (blockers if export_mode == "public" else warnings).append(target)
    return {
        "status": "blocked" if blockers else "ready",
        "export_mode": export_mode,
        "private_item_count": len(private_items),
        "full_source_private_count": len(full_source_items),
        "disabled_tool_count": len(disabled_tools),
        "unsupported_claim_count": len(unsupported_claims),
        "possible_secret_count": len(secret_findings),
        "pii_signal_count": len(pii_findings),
        "copyrighted_source_count": len(copyright_findings),
        "exact_quote_count": exact_quote_count,
        "estimated_record_count": sum(len(value) for value in records.values()),
        "health_status": health.get("status"),
        "checksum_status": "ready",
        "scan_report": scan_report,
        "warnings": warnings,
        "blockers": blockers,
    }


def capsule_export_safety_scan(records: dict[str, list[dict[str, Any]]], export_mode: str, source_blob_files: dict[str, bytes]) -> dict[str, Any]:
    secret_findings: list[dict[str, Any]] = []
    pii_findings: list[dict[str, Any]] = []
    copyright_findings = capsule_export_copyright_findings(records, export_mode)
    for target_type, rows in records.items():
        if target_type == "source_blobs":
            continue
        for row in rows:
            if len(secret_findings) >= MAX_CAPSULE_SCAN_FINDINGS and len(pii_findings) >= MAX_CAPSULE_SCAN_FINDINGS:
                break
            target_id = str(row.get("id") or row.get("target_id") or row.get("source_id") or "")
            for field, text in capsule_scan_text_fields(target_type, row):
                if len(secret_findings) < MAX_CAPSULE_SCAN_FINDINGS:
                    secret_findings.extend(capsule_secret_findings(target_type, target_id, field, text, MAX_CAPSULE_SCAN_FINDINGS - len(secret_findings)))
                if len(pii_findings) < MAX_CAPSULE_SCAN_FINDINGS:
                    pii_findings.extend(capsule_pii_findings(target_type, target_id, field, text, MAX_CAPSULE_SCAN_FINDINGS - len(pii_findings)))
    for package_path, content in source_blob_files.items():
        if len(secret_findings) >= MAX_CAPSULE_SCAN_FINDINGS and len(pii_findings) >= MAX_CAPSULE_SCAN_FINDINGS:
            break
        text = content[:MAX_CAPSULE_SCAN_TEXT_CHARS].decode("utf-8", errors="ignore")
        target_id = package_path.rsplit("/", 1)[-1]
        if len(secret_findings) < MAX_CAPSULE_SCAN_FINDINGS:
            secret_findings.extend(capsule_secret_findings("source_blob", target_id, "content", text, MAX_CAPSULE_SCAN_FINDINGS - len(secret_findings)))
        if len(pii_findings) < MAX_CAPSULE_SCAN_FINDINGS:
            pii_findings.extend(capsule_pii_findings("source_blob", target_id, "content", text, MAX_CAPSULE_SCAN_FINDINGS - len(pii_findings)))
    return {
        "possible_secrets": secret_findings,
        "pii_signals": pii_findings,
        "copyrighted_sources": copyright_findings[:MAX_CAPSULE_SCAN_FINDINGS],
        "limits": {"max_text_chars_per_field": MAX_CAPSULE_SCAN_TEXT_CHARS, "max_findings_per_kind": MAX_CAPSULE_SCAN_FINDINGS},
    }


def capsule_scan_text_fields(target_type: str, row: dict[str, Any]) -> list[tuple[str, str]]:
    fields: list[tuple[str, str]] = []
    for key in ("title", "text", "content_markdown", "exact_quote", "normalized_text", "uri", "locator", "filename", "package_path", "type"):
        value = row.get(key)
        if isinstance(value, str) and value.strip():
            fields.append((key, value[:MAX_CAPSULE_SCAN_TEXT_CHARS]))
    for key in ("content", "metadata", "body", "manifest"):
        value = row.get(key)
        if value not in (None, "", {}, []):
            fields.append((key, json.dumps(value, ensure_ascii=False, sort_keys=True)[:MAX_CAPSULE_SCAN_TEXT_CHARS]))
    if target_type == "source" and capsule_path_looks_env(row.get("title")):
        fields.append(("title", str(row.get("title"))))
    return fields


def capsule_secret_findings(target_type: str, target_id: str, field: str, text: str, limit: int) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    if capsule_path_looks_env(text):
        findings.append(capsule_scan_finding("env_file_reference", target_type, target_id, field))
    for code, pattern in SECRET_SCAN_PATTERNS:
        if len(findings) >= limit:
            break
        if pattern.search(text):
            findings.append(capsule_scan_finding(code, target_type, target_id, field))
    return findings[:limit]


def capsule_pii_findings(target_type: str, target_id: str, field: str, text: str, limit: int) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for code, pattern in (("email", EMAIL_SCAN_PATTERN), ("phone", PHONE_SCAN_PATTERN), ("private_context", PRIVATE_CONTEXT_PATTERN)):
        if len(findings) >= limit:
            break
        if pattern.search(text):
            findings.append(capsule_scan_finding(code, target_type, target_id, field))
    return findings[:limit]


def capsule_scan_finding(code: str, target_type: str, target_id: str, field: str) -> dict[str, str]:
    return {"code": code, "target_type": target_type, "target_id": target_id, "field": field, "sample": "[redacted]"}


def capsule_export_copyright_findings(records: dict[str, list[dict[str, Any]]], export_mode: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for source in records.get("sources", []):
        source_id = str(source.get("id") or "")
        metadata = source.get("metadata") if isinstance(source.get("metadata"), dict) else {}
        blob_refs = source.get("blob_refs") if isinstance(source.get("blob_refs"), list) else []
        metadata_text = json.dumps(metadata, ensure_ascii=False, sort_keys=True)
        title_text = str(source.get("title") or "")
        if COPYRIGHT_CONTEXT_PATTERN.search(metadata_text) or COPYRIGHT_CONTEXT_PATTERN.search(title_text):
            findings.append({"code": "copyright_restricted_source", "target_type": "source", "target_id": source_id, "field": "metadata", "sample": "[redacted]"})
        if export_mode == "private_full" and blob_refs and not any(str(metadata.get(key) or "").strip() for key in LICENSE_METADATA_KEYS):
            findings.append({"code": "full_source_license_unreviewed", "target_type": "source", "target_id": source_id, "field": "metadata", "sample": "[redacted]"})
    return findings


def capsule_path_looks_env(value: Any) -> bool:
    text = str(value or "").lower()
    return bool(re.search(r"(^|[/\\])\.env(?:[.\w-]*)?$", text))


def write_capsule_export_zip(output_path: Path, package: dict[str, Any]) -> dict[str, str]:
    files: dict[str, bytes] = {
        "data/capsule.json": stable_json_bytes(package["capsule"]),
        "data/items.json": stable_json_bytes(package["items"]),
        "data/sources.json": stable_json_bytes(package["records"]["sources"]),
        "data/source_blobs.jsonl": jsonl_bytes(package["records"]["source_blobs"]),
        "data/health.json": stable_json_bytes(package["health"]),
        "privacy_report.json": stable_json_bytes(package["privacy_report"]),
        "validation_report.json": stable_json_bytes(package["validation_report"]),
        "data/notes.jsonl": jsonl_bytes(package["records"]["notes"]),
        "data/source_blocks.jsonl": jsonl_bytes(package["records"]["source_blocks"]),
        "data/claims.jsonl": jsonl_bytes(package["records"]["claims"]),
        "data/evidence_links.jsonl": jsonl_bytes(package["records"]["evidence_links"]),
        "data/kg_nodes.jsonl": jsonl_bytes(package["records"]["kg_nodes"]),
        "data/graph_edges.jsonl": jsonl_bytes(package["records"]["graph_edges"]),
        "data/learning_items.jsonl": jsonl_bytes(package["records"]["learning_items"]),
        "data/tools.jsonl": jsonl_bytes(package["records"]["tools"]),
    }
    for note in package["records"]["notes"]:
        files[f"notes/{capsule_safe_filename(note.get('title') or 'untitled')}-{note['id']}.md"] = capsule_note_markdown(note).encode("utf-8")
    files.update(package.get("source_blob_files") or {})
    checksums = {path: hashlib.sha256(content).hexdigest() for path, content in files.items()}
    manifest = {**package["manifest"], "checksums": checksums}
    manifest_bytes = stable_json_bytes(manifest)
    files["manifest.json"] = manifest_bytes
    files["manifest-sha256.txt"] = f"{hashlib.sha256(manifest_bytes).hexdigest()}  manifest.json\n".encode("utf-8")
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path, content in sorted(files.items()):
            archive.writestr(path, content)
    return checksums


def capsule_export_filename(capsule: dict[str, Any], export_id: str | None = None, version: str | None = None) -> str:
    version_suffix = f"-{capsule_safe_filename(version)}" if version else ""
    suffix = f"-{export_id.removeprefix('capexp_')}" if export_id else ""
    return f"{capsule_safe_filename(capsule.get('slug') or capsule.get('name') or 'capsule')}{version_suffix}{suffix}.vaultcapsule"


def capsule_safe_filename(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", str(value or "").strip().lower()).strip("-._")
    return (slug or "capsule")[:90]


def stable_json_bytes(data: Any) -> bytes:
    return json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True).encode("utf-8")


def jsonl_bytes(rows: list[dict[str, Any]]) -> bytes:
    return ("\n".join(json.dumps(row, ensure_ascii=False, sort_keys=True) for row in rows) + ("\n" if rows else "")).encode("utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sql_placeholders(values: set[str]) -> str:
    return ",".join("?" for _ in values) or "?"


def rows_by_ids(
    conn: sqlite3.Connection,
    table: str,
    id_column: str,
    ids: set[str] | None,
    workspace_id: str | None = None,
) -> list[dict[str, Any]]:
    ids = ids or set()
    if not ids:
        return []
    clauses = [f"{id_column} IN ({sql_placeholders(ids)})"]
    args: list[Any] = list(ids)
    if workspace_id:
        clauses.append("workspace_id=?")
        args.append(workspace_id)
    return rows_to_dicts(conn.execute(f"SELECT * FROM {table} WHERE {' AND '.join(clauses)}", args).fetchall())


def source_blocks_by_ids(conn: sqlite3.Connection, ids: set[str], workspace_id: str) -> list[dict[str, Any]]:
    if not ids:
        return []
    return rows_to_dicts(
        conn.execute(
            f"""
            SELECT source_blocks.*
            FROM source_blocks
            JOIN sources ON sources.id=source_blocks.source_id
            WHERE source_blocks.id IN ({sql_placeholders(ids)}) AND sources.workspace_id=?
            """,
            (*ids, workspace_id),
        ).fetchall()
    )


def capsule_source_ids_for_overview(conn: sqlite3.Connection, workspace_id: str, capsule_id: str) -> list[str]:
    rows = conn.execute(
        """
        SELECT DISTINCT sources.id
        FROM capsule_items
        JOIN sources ON sources.id=capsule_items.target_id
        WHERE capsule_items.workspace_id=? AND capsule_items.capsule_id=?
          AND capsule_items.target_type='source' AND capsule_items.status='active'
        UNION
        SELECT DISTINCT source_blocks.source_id
        FROM capsule_items
        JOIN source_blocks ON source_blocks.id=capsule_items.target_id
        JOIN sources ON sources.id=source_blocks.source_id
        WHERE capsule_items.workspace_id=? AND capsule_items.capsule_id=?
          AND capsule_items.target_type='source_block' AND capsule_items.status='active'
        UNION
        SELECT DISTINCT notes.source_id
        FROM capsule_items
        JOIN notes ON notes.id=capsule_items.target_id
        WHERE capsule_items.workspace_id=? AND capsule_items.capsule_id=?
          AND capsule_items.target_type='note' AND capsule_items.status='active'
          AND notes.source_id IS NOT NULL
        ORDER BY 1
        """,
        (workspace_id, capsule_id, workspace_id, capsule_id, workspace_id, capsule_id),
    ).fetchall()
    return [row["id"] for row in rows]


def capsule_approved_claim_ids_for_overview(conn: sqlite3.Connection, workspace_id: str, capsule_id: str) -> list[str]:
    rows = conn.execute(
        f"""
        SELECT DISTINCT claims.id
        FROM capsule_items
        JOIN claims ON claims.id=capsule_items.target_id
        WHERE capsule_items.workspace_id=? AND capsule_items.capsule_id=?
          AND capsule_items.target_type='claim' AND capsule_items.status='active'
          AND claims.status IN ({sql_placeholders(APPROVED_CLAIM_STATUSES)})
        ORDER BY claims.evidence_strength DESC, claims.updated_at DESC
        """,
        (workspace_id, capsule_id, *APPROVED_CLAIM_STATUSES),
    ).fetchall()
    return [row["id"] for row in rows]


def capsule_claim_rows_for_learning(conn: sqlite3.Connection, workspace_id: str, capsule_id: str, source_policy: str, limit: int) -> list[sqlite3.Row]:
    if source_policy in {"approved_claims_only", "reviewed_claims_only"}:
        statuses = sorted(APPROVED_CLAIM_STATUSES)
    elif source_policy == "include_unreviewed_with_warnings":
        statuses = sorted(APPROVED_CLAIM_STATUSES | UNREVIEWED_CLAIM_STATUSES)
    elif source_policy == "exploratory_mode":
        statuses = sorted(APPROVED_CLAIM_STATUSES | UNREVIEWED_CLAIM_STATUSES | {"contradicted", "deprecated", "rejected"})
    else:
        raise HTTPException(422, f"Unsupported capsule learning source policy: {source_policy}")
    rows = conn.execute(
        f"""
        SELECT claims.id, claims.normalized_text, claims.status, claims.evidence_strength, claims.confidence,
               capsule_items.role, capsule_items.sort_order
        FROM capsule_items
        JOIN claims ON claims.id=capsule_items.target_id
        WHERE capsule_items.workspace_id=? AND capsule_items.capsule_id=?
          AND capsule_items.target_type='claim' AND capsule_items.status='active'
          AND claims.status IN ({','.join('?' for _ in statuses)})
        ORDER BY
          CASE capsule_items.role
            WHEN 'core' THEN 0
            WHEN 'evidence' THEN 1
            WHEN 'supporting' THEN 2
            ELSE 3
          END,
          capsule_items.sort_order ASC,
          claims.evidence_strength DESC,
          claims.updated_at DESC
        LIMIT ?
        """,
        (workspace_id, capsule_id, *statuses, limit),
    ).fetchall()
    return list(rows)


def capsule_learning_items(capsule_name: str, claims: list[sqlite3.Row], payload: dict[str, Any]) -> list[dict[str, Any]]:
    difficulty = str(payload.get("difficulty") or "beginner")
    duration = str(payload.get("duration") or "7_days")
    source_policy = str(payload.get("source_policy") or "reviewed_claims_only")
    include_flashcards = bool(payload.get("include_flashcards", True))
    include_quiz = bool(payload.get("include_quiz", True))
    path = capsule_learning_path(claims, duration)
    source_refs = [{"claim_id": step["claim_id"], "status": step["status"], "sequence": step["sequence"], "phase": step["phase"]} for step in path]
    claim_texts = [step["summary"] for step in path]
    items: list[dict[str, Any]] = [
        {
            "type": "course_outline",
            "title": f"{capsule_name}: {duration.replace('_', ' ')} path",
            "body": {
                "prompt": f"Follow this {duration.replace('_', ' ')} path through {capsule_name}.",
                "answer": "Start with the core claims, then explain them from memory and check the evidence.",
                "sections": [
                    {
                        "title": step["title"],
                        "claim_id": step["claim_id"],
                        "summary": step["summary"],
                        "phase": step["phase"],
                        "review_after": step["review_after"],
                    }
                    for step in path
                ],
                "path": path,
                "difficulty": difficulty,
                "duration": duration,
                "source_policy": source_policy,
            },
            "source_refs": source_refs,
        },
        {
            "type": "course_lesson",
            "title": f"{capsule_name}: first lesson",
            "body": {
                "prompt": f"Read the first lesson for {capsule_name}.",
                "answer": "\n".join(f"{index}. {text}" for index, text in enumerate(claim_texts[:4], start=1)),
                "key_points": claim_texts[:4],
                "path": path[:4],
                "review_prompt": "Close the source, explain each point from memory, then reopen the evidence before rating yourself.",
                "difficulty": difficulty,
                "duration": duration,
                "source_policy": source_policy,
            },
            "source_refs": source_refs[:4],
        },
        {
            "type": "explain_back",
            "title": f"{capsule_name}: explain back",
            "body": {
                "prompt": f"Explain {capsule_name} back in your own words, using the claims below.",
                "answer": "A strong answer should cover: " + "; ".join(claim_texts[:5]),
                "checklist": [{"claim_id": step["claim_id"], "expected": step["summary"], "phase": step["phase"]} for step in path[:5]],
                "self_review": ["Name the core idea without reading.", "Cite the evidence that would change your mind.", "Mark any claim you could not explain as again."],
                "difficulty": difficulty,
                "duration": duration,
                "source_policy": source_policy,
            },
            "source_refs": source_refs[:5],
        },
    ]
    if include_quiz:
        items.append(
            {
                "type": "quiz",
                "title": f"{capsule_name}: checkpoint quiz",
                "body": {
                    "prompt": f"Answer this short quiz on {capsule_name}.",
                    "answer": "Score each answer against the cited capsule claim and review anything missed.",
                    "scoring": {"max_score": len(path[:5]) * 2, "passing_score": max(2, len(path[:5]) * 2 - 2), "points_per_question": 2},
                    "questions": [
                        {
                            "question": f"What is the key idea in point {index}?",
                            "answer": text,
                            "claim_id": step["claim_id"],
                            "sequence": step["sequence"],
                            "phase": step["phase"],
                            "points": 2,
                            "review_if_missed": step["review_after"],
                        }
                        for index, (step, text) in enumerate(zip(path[:5], claim_texts[:5], strict=False), start=1)
                    ],
                    "difficulty": difficulty,
                    "duration": duration,
                    "source_policy": source_policy,
                },
                "source_refs": source_refs[:5],
            }
        )
    if not include_flashcards:
        return items
    cards = []
    for step in path:
        text = step["summary"]
        cards.append(
            {
                "front": f"{capsule_name}: what should you remember about point {step['sequence']}?",
                "back": text,
                "source_refs": [{"claim_id": step["claim_id"], "status": step["status"], "sequence": step["sequence"], "phase": step["phase"]}],
                "schedule": capsule_learning_schedule(step["sequence"], len(path), duration),
                "capsule_learning": {
                    "difficulty": difficulty,
                    "duration": duration,
                    "source_policy": source_policy,
                    "sequence": step["sequence"],
                    "phase": step["phase"],
                    "evidence_strength": step["evidence_strength"],
                    "confidence": step["confidence"],
                },
            }
        )
    return items + [{"type": "flashcard", "title": card["front"], "body": card, "source_refs": card.get("source_refs", [])} for card in cards]


def capsule_learning_path(claims: list[sqlite3.Row], duration: str) -> list[dict[str, Any]]:
    phases = ("orient", "connect", "apply")
    path: list[dict[str, Any]] = []
    for index, row in enumerate(claims, start=1):
        phase = phases[min(len(phases) - 1, (index - 1) * len(phases) // max(1, len(claims)))]
        path.append(
            {
                "sequence": index,
                "title": f"{phase.title()} {index}",
                "claim_id": row["id"],
                "summary": str(row["normalized_text"]),
                "status": row["status"],
                "phase": phase,
                "review_after": capsule_learning_review_after(index, len(claims), duration),
                "evidence_strength": row["evidence_strength"],
                "confidence": row["confidence"],
            }
        )
    return path


def capsule_learning_review_after(index: int, total: int, duration: str) -> str:
    if duration in {"1_day", "single_session"}:
        return "end of session"
    if index == total:
        return "final checkpoint"
    return "next session" if index % 2 else "same session"


def capsule_learning_schedule(index: int, total: int, duration: str) -> dict[str, str]:
    if duration in {"1_day", "single_session"}:
        return {"again": "later today", "good": "tomorrow", "easy": "3 days"}
    if index == total:
        return {"again": "tomorrow", "good": "2 days", "easy": "5 days"}
    return {"again": "tomorrow", "good": "3 days", "easy": "7 days"}


def capsule_learning_cards(capsule_name: str, claims: list[sqlite3.Row], payload: dict[str, Any]) -> list[dict[str, Any]]:
    return [item["body"] for item in capsule_learning_items(capsule_name, claims, payload) if item["type"] == "flashcard"]


def capsule_edge_rows(conn: sqlite3.Connection, workspace_id: str, explicit_edge_ids: set[str], node_ids: set[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    if explicit_edge_ids:
        for row in rows_by_ids(conn, "kg_edges", "id", explicit_edge_ids, workspace_id=workspace_id):
            rows.append(row)
            seen.add(row["id"])
    if node_ids:
        related = rows_to_dicts(
            conn.execute(
                f"""
                SELECT * FROM kg_edges
                WHERE workspace_id=? AND (from_node_id IN ({sql_placeholders(node_ids)}) OR to_node_id IN ({sql_placeholders(node_ids)}))
                """,
                (workspace_id, *node_ids, *node_ids),
            ).fetchall()
        )
        for row in related:
            if row["id"] not in seen:
                rows.append(row)
                seen.add(row["id"])
    return rows


def export_json_fields(row: dict[str, Any], json_fields: dict[str, str]) -> dict[str, Any]:
    record = dict(row)
    for source_key, target_key in json_fields.items():
        raw = record.pop(source_key, None)
        record[target_key] = loads(raw, {} if raw != "[]" else [])
    return record


def source_blob_records_for_export(source_rows: list[dict[str, Any]], export_mode: str) -> tuple[list[dict[str, Any]], dict[str, bytes]]:
    if export_mode != "private_full":
        return [], {}
    records: list[dict[str, Any]] = []
    files: dict[str, bytes] = {}
    for row in source_rows:
        source_id = str(row.get("id") or "")
        for kind, field in (("raw", "raw_path"), ("extracted_text", "extracted_text_path")):
            source_path = Path(str(row.get(field) or ""))
            if not source_id or not row.get(field) or not source_path.exists() or not source_path.is_file():
                continue
            content = source_path.read_bytes()
            filename = capsule_safe_filename(source_path.name or f"{kind}.txt")
            package_path = f"sources/{kind}/{source_id}-{filename}"
            digest = hashlib.sha256(content).hexdigest()
            files[package_path] = content
            records.append(
                {
                    "source_id": source_id,
                    "kind": kind,
                    "filename": source_path.name,
                    "package_path": package_path,
                    "sha256": digest,
                    "size_bytes": len(content),
                }
            )
    return records, files


def sanitize_source_for_export(row: dict[str, Any], blob_refs: list[dict[str, Any]]) -> dict[str, Any]:
    record = export_json_fields(row, {"metadata_json": "metadata"})
    record["raw_path"] = None
    record["extracted_text_path"] = None
    record["blob_refs"] = blob_refs
    return record


def sanitize_source_block_for_export(row: dict[str, Any], export_mode: str) -> dict[str, Any]:
    record = dict(row)
    if export_mode in {"reference_only", "public"}:
        record["text"] = ""
    return record


def export_note_row(row: dict[str, Any], export_mode: str) -> dict[str, Any]:
    record = export_json_fields(row, {"content_json": "content"})
    if export_mode == "public":
        record["content_markdown"] = ""
    return record


def sanitize_evidence_link_for_export(row: dict[str, Any], export_mode: str) -> dict[str, Any]:
    record = export_json_fields(row, {"metadata_json": "metadata"})
    if export_mode in {"reference_only", "public"}:
        record["exact_quote"] = ""
    return record


def sanitize_tool_for_export(row: dict[str, Any]) -> dict[str, Any]:
    record = export_json_fields(row, {"manifest_json": "manifest"})
    record["import_default_status"] = "disabled_until_reviewed"
    return record


def capsule_note_markdown(note: dict[str, Any]) -> str:
    frontmatter = {
        "id": note["id"],
        "title": note["title"],
        "origin": note["origin"],
        "status": note["status"],
        "version": note["version"],
        "source_id": note.get("source_id"),
        "updated_at": note["updated_at"],
    }
    metadata = "\n".join(f"{key}: {json.dumps(value, ensure_ascii=False)}" for key, value in frontmatter.items())
    return f"---\n{metadata}\n---\n\n{note.get('content_markdown') or ''}"


def unique_capsule_slug(db: VaultDatabase, name: str, ignore_capsule_id: str | None = None) -> str:
    with db.connect() as conn:
        return unique_capsule_slug_in_conn(conn, db.workspace_id, name, ignore_capsule_id=ignore_capsule_id)


def unique_capsule_slug_in_conn(conn: sqlite3.Connection, workspace_id: str, name: str, ignore_capsule_id: str | None = None) -> str:
    base = slugify(name)
    slug = base
    index = 2
    while True:
        if ignore_capsule_id:
            row = conn.execute(
                "SELECT id FROM capsules WHERE workspace_id=? AND slug=? AND id!=?",
                (workspace_id, slug, ignore_capsule_id),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT id FROM capsules WHERE workspace_id=? AND slug=?",
                (workspace_id, slug),
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
