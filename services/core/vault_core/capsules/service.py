from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import zipfile
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from vault_core.db.session import VaultDatabase, dumps, loads, new_id, now_iso, rows_to_dicts

APPROVED_CLAIM_STATUSES = {"supported", "user_confirmed", "verified"}
UNREVIEWED_CLAIM_STATUSES = {"proposed", "needs_review", "weakly_supported"}
CAPSULE_EXPORT_MODES = {"reference_only", "sanitized", "private_full", "learning", "tool", "public"}
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


def preview_capsule_export(db: VaultDatabase, capsule_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    export_mode = normalize_export_mode((payload or {}).get("export_mode"))
    with db.connect() as conn:
        package = build_capsule_export_payload(conn, db.workspace_id, capsule_id, export_mode)
        return {
            "capsule_id": capsule_id,
            "export_mode": export_mode,
            "status": "blocked" if package["privacy_report"]["blockers"] else "ready",
            "filename": capsule_export_filename(package["capsule"]),
            "manifest": package["manifest"],
            "privacy_report": package["privacy_report"],
            "validation_report": package["validation_report"],
        }


def export_capsule_package(db: VaultDatabase, capsule_id: str, output_dir: Path, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    export_mode = normalize_export_mode((payload or {}).get("export_mode"))
    ts = now_iso()
    export_id = new_id("capexp")
    output_dir.mkdir(parents=True, exist_ok=True)
    with db.connect() as conn:
        package = build_capsule_export_payload(conn, db.workspace_id, capsule_id, export_mode)
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

        output_path = output_dir / capsule_export_filename(package["capsule"], export_id)
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
            payload={"export_id": export_id, "file_size_bytes": size_bytes, "sha256": archive_sha},
        )
        db.event(conn, "capsule.export_created", "capsule", capsule_id, {"export_id": export_id, "export_mode": export_mode}, "user")
        return {
            "export_id": export_id,
            "capsule_id": capsule_id,
            "export_mode": export_mode,
            "status": "completed",
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


def preview_from_package(capsule_id: str, export_mode: str, package: dict[str, Any]) -> dict[str, Any]:
    return {
        "capsule_id": capsule_id,
        "export_mode": export_mode,
        "status": "blocked" if package["privacy_report"]["blockers"] else "ready",
        "filename": capsule_export_filename(package["capsule"]),
        "manifest": package["manifest"],
        "privacy_report": package["privacy_report"],
        "validation_report": package["validation_report"],
    }


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


def build_capsule_export_payload(conn: sqlite3.Connection, workspace_id: str, capsule_id: str, export_mode: str) -> dict[str, Any]:
    capsule = inflate_capsule(ensure_capsule(conn, workspace_id, capsule_id))
    items = list_capsule_items_for_conn(conn, workspace_id, capsule_id, limit=10000)
    records = collect_capsule_export_records(conn, workspace_id, capsule_id, items, export_mode)
    health = summarize_health(compute_health_payload(conn, workspace_id, capsule_id))
    privacy_report = capsule_export_privacy_report(conn, capsule_id, export_mode, items, records, health)
    object_counts = {key: len(value) for key, value in records.items()}
    manifest = {
        "schema_version": 1,
        "package_type": "the_vault_knowledge_capsule",
        "workspace_id": workspace_id,
        "capsule": capsule,
        "export_mode": export_mode,
        "created_at": now_iso(),
        "counts": capsule_counts(conn, capsule_id),
        "object_counts": object_counts,
        "formats": {
            "manifest": "JSON",
            "items": "JSON",
            "notes": "Markdown + JSONL metadata",
            "sources": "JSON",
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
        "object_counts": object_counts,
        "warnings": privacy_report["warnings"],
        "blockers": privacy_report["blockers"],
    }
    return {
        "capsule": capsule,
        "items": items,
        "records": records,
        "health": health,
        "manifest": manifest,
        "privacy_report": privacy_report,
        "validation_report": validation_report,
    }


def collect_capsule_export_records(
    conn: sqlite3.Connection,
    workspace_id: str,
    capsule_id: str,
    items: list[dict[str, Any]],
    export_mode: str,
) -> dict[str, list[dict[str, Any]]]:
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

    return {
        "items": items,
        "sources": [sanitize_source_for_export(row, export_mode) for row in source_rows],
        "source_blocks": [sanitize_source_block_for_export(row, export_mode) for row in source_block_rows],
        "notes": [export_note_row(row, export_mode) for row in note_rows],
        "kg_nodes": [export_json_fields(row, {"metadata_json": "metadata"}) for row in kg_node_rows],
        "claims": [export_json_fields(row, {"metadata_json": "metadata"}) for row in claim_rows],
        "evidence_links": [sanitize_evidence_link_for_export(row, export_mode) for row in evidence_rows],
        "graph_edges": [export_json_fields(row, {"metadata_json": "metadata"}) for row in kg_edge_rows],
        "learning_items": [export_json_fields(row, {"body_json": "body"}) for row in learning_rows],
        "tools": [sanitize_tool_for_export(row) for row in tool_rows],
    }


def capsule_export_privacy_report(
    conn: sqlite3.Connection,
    capsule_id: str,
    export_mode: str,
    items: list[dict[str, Any]],
    records: dict[str, list[dict[str, Any]]],
    health: dict[str, Any],
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
    return {
        "status": "blocked" if blockers else "ready",
        "export_mode": export_mode,
        "private_item_count": len(private_items),
        "full_source_private_count": len(full_source_items),
        "disabled_tool_count": len(disabled_tools),
        "unsupported_claim_count": len(unsupported_claims),
        "exact_quote_count": exact_quote_count,
        "estimated_record_count": sum(len(value) for value in records.values()),
        "health_status": health.get("status"),
        "checksum_status": "ready",
        "warnings": warnings,
        "blockers": blockers,
    }


def write_capsule_export_zip(output_path: Path, package: dict[str, Any]) -> dict[str, str]:
    files: dict[str, bytes] = {
        "data/capsule.json": stable_json_bytes(package["capsule"]),
        "data/items.json": stable_json_bytes(package["items"]),
        "data/sources.json": stable_json_bytes(package["records"]["sources"]),
        "data/health.json": stable_json_bytes(package["health"]),
        "privacy_report.json": stable_json_bytes(package["privacy_report"]),
        "validation_report.json": stable_json_bytes(package["validation_report"]),
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
    checksums = {path: hashlib.sha256(content).hexdigest() for path, content in files.items()}
    manifest = {**package["manifest"], "checksums": checksums}
    manifest_bytes = stable_json_bytes(manifest)
    files["manifest.json"] = manifest_bytes
    files["manifest-sha256.txt"] = f"{hashlib.sha256(manifest_bytes).hexdigest()}  manifest.json\n".encode("utf-8")
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path, content in sorted(files.items()):
            archive.writestr(path, content)
    return checksums


def capsule_export_filename(capsule: dict[str, Any], export_id: str | None = None) -> str:
    suffix = f"-{export_id.removeprefix('capexp_')}" if export_id else ""
    return f"{capsule_safe_filename(capsule.get('slug') or capsule.get('name') or 'capsule')}{suffix}.vaultcapsule"


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


def sanitize_source_for_export(row: dict[str, Any], export_mode: str) -> dict[str, Any]:
    record = export_json_fields(row, {"metadata_json": "metadata"})
    if export_mode != "private_full":
        record["raw_path"] = None
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
