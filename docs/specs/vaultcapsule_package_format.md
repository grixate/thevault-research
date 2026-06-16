# Vault Capsule Package Format

Status: v1 alpha contract

This document defines the `.vaultcapsule` archive contract used by Knowledge Capsules. A capsule package is a zip archive that moves a curated projection of the canonical Vault graph without turning the capsule into a separate mini-vault.

## Core Rules

- The archive extension is `.vaultcapsule`.
- The archive MIME type is `application/vnd.thevault.capsule+zip`.
- Import must quarantine and validate packages before any canonical object is created or linked.
- Import must reject absolute paths, parent traversal paths, symlinks, excessive file counts, and excessive unpacked size.
- Archive paths are internal package paths only. Exported records must not expose local absolute paths.
- `manifest-sha256.txt` must contain the SHA-256 digest of `manifest.json`.
- `manifest.json.checksums` must include every package file except `manifest-sha256.txt`.

## Required Files

```text
manifest.json
manifest-sha256.txt
data/capsule.json
data/items.json
data/sources.json
data/source_blobs.jsonl
data/source_blocks.jsonl
data/notes.jsonl
data/claims.jsonl
data/evidence_links.jsonl
data/kg_nodes.jsonl
data/graph_edges.jsonl
data/learning_items.jsonl
data/tools.jsonl
data/health.json
privacy_report.json
validation_report.json
```

`data/source_blobs.jsonl` is required even when empty. Non-private export modes should write an empty file.

## Optional Files

```text
notes/{safe-title}-{note_id}.md
sources/raw/{source_id}-{safe-filename}
sources/extracted_text/{source_id}-{safe-filename}
```

Note markdown files mirror exported note records for readable review.

Source blob files are allowed only for `private_full` export. Other modes must not include raw or extracted source files.

## Manifest

`manifest.json` must include:

```json
{
  "schema_version": 1,
  "package_type": "the_vault_knowledge_capsule",
  "workspace_id": "wrk_...",
  "capsule": {},
  "export_mode": "reference_only",
  "export_scope": { "type": "live" },
  "created_at": "2026-06-16T00:00:00Z",
  "counts": {},
  "object_counts": {},
  "formats": {},
  "privacy": {},
  "checksums": {},
  "archive_sha256": "optional-on-export-result"
}
```

For saved-version export, `export_scope` must be:

```json
{
  "type": "version",
  "version_id": "capver_...",
  "version": "0.2.0",
  "title": "Snapshot title",
  "created_at": "2026-06-16T00:00:00Z"
}
```

Version export freezes capsule membership from the saved snapshot. Canonical object records are resolved at export time from the current Vault database.

## Export Modes

`reference_only`
: Strips source block text and exact evidence quotes. Excludes source blobs.

`sanitized`
: Includes reviewed source block text and evidence quotes. Excludes source blobs.

`public`
: Strips note markdown, source block text, and exact evidence quotes. Excludes source blobs.

`learning`
: Includes learning-oriented records. Excludes source blobs unless later explicitly promoted to a private mode.

`tool`
: Includes tool registry metadata. Imported tools must remain disabled until reviewed.

`private_full`
: May include private items and full source blobs. Source blobs must use internal package paths and must be listed in `data/source_blobs.jsonl`.

## Source Records

Exported source records must set:

```json
{
  "raw_path": null,
  "extracted_text_path": null,
  "blob_refs": []
}
```

For `private_full`, `blob_refs` may contain internal blob references:

```json
{
  "kind": "raw",
  "package_path": "sources/raw/src_abc-private-source.md",
  "sha256": "...",
  "size_bytes": 1234
}
```

`data/source_blobs.jsonl` must contain one row per blob with `source_id`, `kind`, `filename`, `package_path`, `sha256`, and `size_bytes`.

## Privacy And Validation Reports

`privacy_report.json` must include export mode, privacy status, warning/blocker arrays, and counts used by the UI preview.

`validation_report.json` must include checksum readiness, item count, object counts, export scope, warnings, and blockers.

Non-private modes must block export when capsule items are marked private or when an item requests `full_sources_private`.

## Import Contract

Import must:

- copy the original `.vaultcapsule` into quarantine,
- validate required files and checksums,
- write quarantined `manifest.json`, `validation_report.json`, and `merge_plan.json`,
- create a `capsule_imports` audit row,
- avoid canonical writes until Review approval,
- create or link notes, sources, claims, concepts, and tools only through Review merge actions,
- keep imported tools disabled until explicitly reviewed and enabled.

## Compatibility

Consumers must ignore unknown manifest keys and unknown record fields.

Producers must keep required files present, even when their corresponding record lists are empty.
