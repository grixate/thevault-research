# The Vault Research Lab

## Knowledge Capsules Development Spec for Codex

**Document version:** 0.1  
**Date:** 2026-06-14  
**Applies to:** The Vault Research Lab Electron/Python architecture  
**Status:** Addendum to `the_vault_research_lab_codex_spec_v0_2.md`  
**Primary goal:** Implement transferable, versioned, evidence-backed knowledge capsules as first-class objects in The Vault.

---

## 0. Codex Operating Instructions

Use this document as an implementation addendum to the existing The Vault Research Lab spec.

Do not rebuild the existing architecture. Integrate capsules into the current model:

- Electron + React + TypeScript UI.
- Local Python FastAPI Core.
- SQLite in WAL mode.
- Existing objects: sources, source blocks, notes, kg nodes, claims, evidence links, kg edges, review items, tool registry, learning items, lab jobs, event log.
- Local AI model providers and validator-first structured extraction.
- Review-first autonomy.

Implement capsules in vertical slices. Every milestone must keep the app runnable.

The most important rule:

> Capsules must reference the global knowledge graph. They must not create isolated mini-vaults.

A capsule is a portable projection of the graph, not a separate database of truth.

---

## 1. Product Thesis

Knowledge Capsules are portable, versioned, reviewable subgraphs of sources, notes, claims, evidence, tools, and learning materials around a topic, project, skill, question, or research domain.

They let the user package knowledge into reusable modules such as:

- `Acoustic Science Foundations`
- `Ancient Civilisations: Bronze Age Collapse`
- `Electricity Basics for Home Repair`
- `Local AI Extraction Stack`
- `Yumeiho Exercise Sequencing`
- `EV 12V Battery Architecture`

A capsule should answer:

1. What is this knowledge area about?
2. What are the key concepts and claims?
3. What evidence supports them?
4. What is uncertain, speculative, contradicted, or outdated?
5. What sources, notes, and tools belong here?
6. What can the user learn from it?
7. Can it be exported, shared, forked, imported, or turned into a course?

Capsules make The Vault more than a knowledge graph. They make it a system for creating transferable knowledge modules.

---

## 2. Definition

### 2.1 Capsule

A capsule is a named, portable, versioned selection of global Vault objects plus capsule-specific metadata.

A capsule can include:

- sources,
- source blocks,
- notes,
- generated notes,
- kg nodes,
- claims,
- evidence links,
- kg edges,
- learning items,
- tools,
- tool outputs,
- open questions,
- contradictions,
- review state,
- capsule-specific summaries,
- capsule-specific ordering and curation.

### 2.2 Capsule is not a folder

A folder contains files.

A capsule contains a curated subgraph with provenance, trust status, learning projection, and export rules.

### 2.3 Capsule is not the canonical truth store

Canonical objects remain in the global workspace graph.

Capsules reference canonical objects by ID:

```text
global sources
   ↑
global notes
   ↑
global claims + concepts + relations + evidence
   ↑
capsule references selected objects
```

During export, a capsule materializes its referenced objects into a portable package.

During import, a capsule enters quarantine and creates merge candidates. It must not silently merge into the canonical graph.

---

## 3. Core Principles

### 3.1 One global graph, many capsule views

A concept such as `resonance` must not be duplicated separately inside `Acoustics`, `Electricity`, and `Ancient Architecture` unless the user explicitly creates distinct concepts.

Correct:

```text
Global concept: Resonance
Capsule context: Resonance in acoustics
Capsule context: Resonance in circuits
Capsule context: Resonance in archaeoacoustics
```

Incorrect:

```text
Acoustics/resonance
Electricity/resonance
AncientArchitecture/resonance
```

### 3.2 Capsules are portable, but provenance survives

Exported capsules must preserve:

- object IDs,
- source references,
- evidence links,
- exact quotes where allowed,
- trust metadata,
- review state,
- version history,
- checksums.

### 3.3 Import is quarantine-first

External capsules may contain inaccurate claims, private data, malicious prompts, or unsafe tools.

Imported capsules must be opened in quarantine by default.

### 3.4 Tools are disabled on import

A capsule may include Python tools. Imported tools must be disabled until explicitly reviewed and enabled.

### 3.5 Export must be privacy-aware

Capsules may contain sensitive notes, client information, copyrighted PDFs, transcripts, or accidentally pasted secrets.

Every export must support sanitization and preview.

### 3.6 Capsule health is a first-class signal

A capsule should expose its knowledge quality:

- approved claims,
- unreviewed claims,
- unsupported claims,
- contradicted claims,
- stale claims,
- missing evidence,
- private items,
- disabled tools,
- unresolved questions.

### 3.7 Capsules are teachable

A capsule should be able to produce:

- a glossary,
- a learning path,
- flashcards,
- drills,
- quizzes,
- a course outline,
- an explain-back session.

All learning output must link back to underlying claims, concepts, notes, and sources.

---

## 4. Non-goals for the First Capsule Alpha

Do not build these in the first capsule alpha:

- public capsule marketplace,
- cloud sharing,
- multiplayer capsule collaboration,
- automatic remote dependency resolution,
- automatic execution of imported tools,
- automatic trust of imported claims,
- full Git implementation,
- CRDT-based capsule sync,
- complex visual graph layout engine,
- community ranking/reputation,
- blockchain/signature ceremony,
- automatic publishing to web.

The alpha goal is local creation, curation, versioning, export, import quarantine, and basic learning/tool integration.

---

## 5. Required User Stories

### 5.1 Create a capsule manually

As a user, I can create a capsule named `Acoustic Science Foundations`, add a description, tags, domains, language, and initial purpose.

### 5.2 Add current note to capsule

As a user writing a note, I can click `Add to capsule` and attach the note to one or more capsules.

### 5.3 Add extracted claims to capsule

As a user reviewing extracted claims, I can approve them and add them to a capsule.

### 5.4 Add source with evidence policy

As a user, I can add a source to a capsule and choose whether exports should include the full file, extracted text, metadata only, or reference only.

### 5.5 Generate a capsule overview note

As a user, I can generate a capsule overview note from approved claims and sources. The generated note enters the editor as `generated_pending_review`.

### 5.6 Generate a learning path

As a user, I can generate a learning path from a capsule using approved or reviewed claims only.

### 5.7 View capsule health

As a user, I can see whether a capsule has unsupported claims, contradictions, private items, unreviewed generated notes, or missing evidence.

### 5.8 Snapshot capsule version

As a user, I can create a versioned snapshot such as `Acoustic Science Foundations v0.2.0`.

### 5.9 Diff capsule versions

As a user, I can compare capsule versions and see added, removed, and changed objects.

### 5.10 Export capsule

As a user, I can export a capsule as `.vaultcapsule` using one of several export modes.

### 5.11 Import capsule in quarantine

As a user, I can open an external `.vaultcapsule`, inspect its manifest, validate checksums, see trust warnings, and keep it in sandbox mode.

### 5.12 Merge imported capsule selectively

As a user, I can create review items for imported claims, concepts, notes, sources, and tools. Nothing merges silently.

### 5.13 Fork capsule

As a user, I can fork `Electricity Basics` into `Electricity for Home Repair` while preserving provenance and dependency references.

### 5.14 Attach tools to capsule

As a user, I can attach an existing Tool Studio tool to a capsule, such as a frequency calculator for acoustics.

### 5.15 Ask within capsule context

As a user, I can ask a contextual question inside a capsule. The answer should use capsule items first and cite source/evidence objects when possible.

---

## 6. Information Architecture

Add a top-level navigation item:

```text
Capsules
```

Recommended global navigation:

```text
Dashboard
Sources
Notes
Graph
Review
Capsules
Learning
Tool Studio
Night Lab
Settings
```

Capsule detail tabs:

```text
Overview
Knowledge
Sources
Notes
Claims
Questions
Contradictions
Learning
Tools
Versions
Export
Activity
```

Do not overload the first view. The capsule overview should be calm, readable, and decision-oriented.

---

## 7. Capsule UX Requirements

### 7.1 Capsules index page

Path:

```text
/capsules
```

Content:

- search input,
- filters: domain, tag, language, health, updated date,
- capsule cards,
- create capsule button.

Capsule card should show:

- name,
- description,
- tags/domains,
- last updated,
- item counts,
- health score,
- status chips:
  - `healthy`,
  - `needs review`,
  - `contradictions`,
  - `private items`,
  - `export ready`,
  - `draft`.

Example card:

```text
Acoustic Science Foundations
Foundational concepts, claims, notes, and tools for acoustics.

42 claims · 17 concepts · 8 sources · 3 notes · 1 tool
Health: 78%
Warnings: 6 unsupported claims, 2 unresolved questions
```

### 7.2 Capsule creation modal

Fields:

- name,
- description,
- purpose,
- domains,
- tags,
- language,
- capsule type,
- epistemic strictness,
- default source export policy.

Capsule types:

```text
domain
project
research_question
course
toolkit
archive
publication_pack
personal_learning
```

Epistemic strictness:

```text
strict_evidence
balanced
exploratory
creative_speculative
```

Default source export policy:

```text
reference_only
metadata_and_quotes
extracted_text_only
full_sources_private
```

### 7.3 Capsule overview

Path:

```text
/capsules/:capsuleId
```

Sections:

1. Header:
   - name,
   - description,
   - type,
   - version,
   - health,
   - actions: `Add`, `Generate`, `Snapshot`, `Export`.

2. Purpose block:
   - why this capsule exists,
   - what questions it answers,
   - intended audience/use.

3. Knowledge health:
   - approved claims,
   - unsupported claims,
   - contradictions,
   - stale claims,
   - private items,
   - tools disabled,
   - unreviewed generated notes.

4. Core concepts:
   - top concepts with relation counts.

5. Key claims:
   - high-value claims sorted by evidence strength.

6. Open questions:
   - unresolved research questions.

7. Recent activity:
   - additions,
   - review decisions,
   - snapshots,
   - imports,
   - exports.

### 7.4 Knowledge tab

Show a structured graph table rather than a decorative galaxy.

Views:

- concept map,
- claim table,
- evidence table,
- relation table,
- unsupported items,
- speculative items.

Required columns for claim table:

```text
Claim
Status
Confidence
Evidence strength
Source count
Contradictions
Last checked
Capsule role
Actions
```

### 7.5 Sources tab

Show sources included in the capsule.

Columns:

```text
Title
Type
Trust level
Export policy
Included blocks
Claims supported
Private flag
Actions
```

Actions:

- open source,
- change export policy,
- add related claims,
- remove from capsule,
- mark private,
- view evidence.

### 7.6 Notes tab

Show notes included in capsule.

Note types:

- user-written,
- generated draft,
- generated approved,
- summary,
- lesson,
- research memo,
- source annotation.

Required actions:

- open in editor,
- generate note from capsule,
- add note to capsule,
- remove note from capsule,
- mark as overview note,
- convert to source if needed,
- extract claims from note.

### 7.7 Questions tab

Show open questions, hypotheses, and research gaps.

Question statuses:

```text
open
investigating
answered
blocked
needs_source
converted_to_project
archived
```

### 7.8 Contradictions tab

Show contradictions between claims or sources.

Each contradiction card should show:

- conflicting claims,
- evidence for each side,
- source trust levels,
- last checked date,
- recommended action:
  - create review item,
  - mark one claim deprecated,
  - split claim by context,
  - keep contradiction unresolved.

### 7.9 Learning tab

Show capsule-generated learning materials:

- glossary,
- course outline,
- lessons,
- flashcards,
- quizzes,
- explain-back prompts,
- practical exercises.

Learning generation must support source policies:

```text
approved_claims_only
reviewed_claims_only
include_unreviewed_with_warnings
exploratory_mode
```

Default: `reviewed_claims_only`.

### 7.10 Tools tab

Show tools attached to capsule.

Columns:

```text
Tool
Version
Status
Permissions
Last run
Capsule role
Actions
```

Imported tools must display:

```text
Disabled until reviewed
```

### 7.11 Versions tab

Show snapshots, diffs, forks, dependencies.

Version actions:

- create snapshot,
- compare with previous,
- export this version,
- restore item selection from version,
- fork from version.

### 7.12 Export tab

Export modes:

```text
Private full export
Sanitized export
Reference-only export
Learning export
Tool export
Public capsule export
```

Before export, show a preview:

- number of sources included,
- number of private notes included,
- copyrighted files detected,
- secrets detected,
- tools included,
- disabled tools,
- unsupported claims,
- exact quotes included,
- total size,
- checksum status.

The export button must be disabled if critical privacy warnings are unresolved, unless user explicitly chooses `Private full export`.

---

## 8. Backend Concepts

### 8.1 Capsule item target types

A capsule may reference these target types:

```text
source
source_block
note
note_version
kg_node
claim
evidence_link
kg_edge
review_item
learning_item
tool
tool_run
lab_job_output
external_reference
```

Alpha can start with:

```text
source
note
kg_node
claim
evidence_link
kg_edge
learning_item
tool
```

### 8.2 Capsule item roles

Each included item can have a role:

```text
core
supporting
context
primary_source
secondary_source
evidence
open_question
contradiction
learning
reference
tool
private
export_excluded
generated
```

### 8.3 Capsule statuses

```text
draft
active
needs_review
export_ready
archived
imported_quarantine
imported_sandbox
```

### 8.4 Capsule health statuses

```text
healthy
needs_review
weak_evidence
contradictions_found
stale
privacy_risk
unsafe_tools
export_blocked
```

### 8.5 Epistemic labels

Important for domains like ancient civilisations, alternative history, speculative science, and creative research.

Supported labels:

```text
established
well_supported
plausible
speculative
controversial
weakly_supported
unsupported
contradicted
mythological
personal_interpretation
fictional_or_creative
```

Do not force all capsule content into a false binary of true/false.

---

## 9. Database Schema Additions

Implement with SQLModel or SQLAlchemy and Alembic migrations.

Naming can be adapted, but semantics must remain.

### 9.1 capsules

```sql
CREATE TABLE capsules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  purpose TEXT,
  capsule_type TEXT NOT NULL DEFAULT 'domain',
  status TEXT NOT NULL DEFAULT 'draft',
  version TEXT NOT NULL DEFAULT '0.1.0',
  language TEXT,
  domains_json TEXT NOT NULL DEFAULT '[]',
  tags_json TEXT NOT NULL DEFAULT '[]',
  epistemic_strictness TEXT NOT NULL DEFAULT 'balanced',
  default_source_policy TEXT NOT NULL DEFAULT 'reference_only',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);
```

Indexes:

```sql
CREATE INDEX idx_capsules_workspace ON capsules(workspace_id);
CREATE INDEX idx_capsules_workspace_status ON capsules(workspace_id, status);
CREATE UNIQUE INDEX idx_capsules_workspace_slug ON capsules(workspace_id, slug);
```

### 9.2 capsule_items

References global objects.

```sql
CREATE TABLE capsule_items (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'supporting',
  include_mode TEXT NOT NULL DEFAULT 'reference',
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  export_policy TEXT,
  private_flag INTEGER NOT NULL DEFAULT 0,
  added_by TEXT NOT NULL DEFAULT 'user',
  added_by_job_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  removed_at TEXT,
  FOREIGN KEY(capsule_id) REFERENCES capsules(id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(added_by_job_id) REFERENCES lab_jobs(id)
);
```

Indexes:

```sql
CREATE INDEX idx_capsule_items_capsule ON capsule_items(capsule_id);
CREATE INDEX idx_capsule_items_target ON capsule_items(target_type, target_id);
CREATE INDEX idx_capsule_items_capsule_target ON capsule_items(capsule_id, target_type, target_id);
CREATE INDEX idx_capsule_items_status ON capsule_items(capsule_id, status);
```

Uniqueness rule:

```sql
CREATE UNIQUE INDEX idx_capsule_items_unique_active
ON capsule_items(capsule_id, target_type, target_id)
WHERE status = 'active';
```

If the database layer does not support partial indexes cleanly through the ORM, enforce this in service logic.

### 9.3 capsule_versions

Stores snapshots of capsule membership and manifest state.

```sql
CREATE TABLE capsule_versions (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  version TEXT NOT NULL,
  title TEXT,
  changelog TEXT,
  parent_version_id TEXT,
  manifest_json TEXT NOT NULL,
  item_snapshot_json TEXT NOT NULL,
  health_snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  FOREIGN KEY(capsule_id) REFERENCES capsules(id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(parent_version_id) REFERENCES capsule_versions(id)
);
```

Indexes:

```sql
CREATE INDEX idx_capsule_versions_capsule ON capsule_versions(capsule_id);
CREATE UNIQUE INDEX idx_capsule_versions_unique ON capsule_versions(capsule_id, version);
```

### 9.4 capsule_dependencies

Supports forks, prerequisite capsules, and reference dependencies.

```sql
CREATE TABLE capsule_dependencies (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  dependency_type TEXT NOT NULL,
  target_capsule_id TEXT,
  external_capsule_ref TEXT,
  version_constraint TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(capsule_id) REFERENCES capsules(id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(target_capsule_id) REFERENCES capsules(id)
);
```

Dependency types:

```text
requires
extends
forked_from
references
supersedes
related_to
```

### 9.5 capsule_health_snapshots

```sql
CREATE TABLE capsule_health_snapshots (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  health_score REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  approved_claim_count INTEGER NOT NULL DEFAULT 0,
  unreviewed_claim_count INTEGER NOT NULL DEFAULT 0,
  unsupported_claim_count INTEGER NOT NULL DEFAULT 0,
  contradicted_claim_count INTEGER NOT NULL DEFAULT 0,
  stale_claim_count INTEGER NOT NULL DEFAULT 0,
  private_item_count INTEGER NOT NULL DEFAULT 0,
  disabled_tool_count INTEGER NOT NULL DEFAULT 0,
  source_count INTEGER NOT NULL DEFAULT 0,
  note_count INTEGER NOT NULL DEFAULT 0,
  tool_count INTEGER NOT NULL DEFAULT 0,
  warning_json TEXT NOT NULL DEFAULT '[]',
  created_by_job_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(capsule_id) REFERENCES capsules(id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(created_by_job_id) REFERENCES lab_jobs(id)
);
```

Indexes:

```sql
CREATE INDEX idx_capsule_health_capsule_created ON capsule_health_snapshots(capsule_id, created_at);
```

### 9.6 capsule_exports

```sql
CREATE TABLE capsule_exports (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  capsule_version_id TEXT,
  export_mode TEXT NOT NULL,
  status TEXT NOT NULL,
  file_path TEXT,
  file_size_bytes INTEGER,
  sha256 TEXT,
  manifest_json TEXT NOT NULL DEFAULT '{}',
  privacy_report_json TEXT NOT NULL DEFAULT '{}',
  validation_report_json TEXT NOT NULL DEFAULT '{}',
  warnings_json TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  created_by TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY(capsule_id) REFERENCES capsules(id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(capsule_version_id) REFERENCES capsule_versions(id)
);
```

### 9.7 capsule_imports

```sql
CREATE TABLE capsule_imports (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  source_file_path TEXT NOT NULL,
  quarantine_path TEXT,
  status TEXT NOT NULL,
  manifest_json TEXT NOT NULL DEFAULT '{}',
  validation_report_json TEXT NOT NULL DEFAULT '{}',
  merge_plan_json TEXT NOT NULL DEFAULT '{}',
  warnings_json TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  created_at TEXT NOT NULL,
  validated_at TEXT,
  decided_at TEXT,
  decision TEXT,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);
```

Statuses:

```text
uploaded
validating
validation_failed
quarantined
sandbox_opened
merge_plan_created
merge_candidates_created
applied
rejected
failed
```

### 9.8 capsule_changelog

```sql
CREATE TABLE capsule_changelog (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  summary TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY(capsule_id) REFERENCES capsules(id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);
```

Actions:

```text
created
updated
item_added
item_removed
item_role_changed
health_checked
snapshot_created
export_started
export_finished
imported
forked
learning_generated
tool_attached
tool_detached
note_generated
```

---

## 10. Backend Services

Add a `capsules` module in the Python Core.

Recommended structure:

```text
vault_core/
  capsules/
    __init__.py
    models.py
    schemas.py
    service.py
    routes.py
    manifest.py
    export_service.py
    import_service.py
    health.py
    diff.py
    merge.py
    privacy.py
    filesystem.py
    tests/
```

### 10.1 CapsuleService

Responsibilities:

- create capsule,
- update capsule,
- archive capsule,
- list capsules,
- get capsule detail,
- add/remove items,
- auto-include supporting evidence,
- attach/detach tools,
- log changelog events,
- emit general event_log events.

### 10.2 CapsuleHealthService

Responsibilities:

- compute health score,
- count claims by status,
- count contradictions,
- detect unsupported claims,
- detect stale claims,
- detect private export blockers,
- detect imported disabled tools,
- write capsule_health_snapshots.

### 10.3 CapsuleVersionService

Responsibilities:

- create snapshots,
- build item snapshot,
- build manifest snapshot,
- diff versions,
- restore membership from version, if requested,
- preserve changelog.

### 10.4 CapsuleExportService

Responsibilities:

- create export preview,
- run privacy scan,
- materialize capsule package,
- calculate checksums,
- write manifest,
- zip into `.vaultcapsule`,
- store export record.

### 10.5 CapsuleImportService

Responsibilities:

- receive/import package,
- check extension and size,
- safely unzip to quarantine,
- prevent path traversal,
- validate manifest,
- validate checksums,
- inspect tools without running them,
- build validation report,
- build merge plan,
- create review items for merge candidates.

### 10.6 CapsuleDiffService

Responsibilities:

- compare two capsule versions,
- compare local capsule with imported capsule,
- compare fork with parent,
- return added/removed/changed item lists.

### 10.7 CapsuleLearningService

Responsibilities:

- collect capsule concepts/claims/sources,
- generate learning path,
- generate glossary,
- generate flashcards,
- generate quizzes,
- write learning_items,
- link learning items back to capsule.

### 10.8 CapsuleGeneratedNoteService

Responsibilities:

- generate capsule overview note,
- generate research memo,
- generate literature map,
- generate contradiction summary,
- generate study guide,
- mark output as `generated_pending_review`,
- add generated note to capsule with role `generated` or `overview`.

---

## 11. API Specification

Use FastAPI and generate TypeScript client types from OpenAPI.

All routes require the local desktop auth token already defined in the main spec.

### 11.1 List capsules

```http
GET /capsules?query=&status=&domain=&tag=&limit=50&offset=0
```

Response:

```json
{
  "items": [
    {
      "id": "cap_...",
      "name": "Acoustic Science Foundations",
      "slug": "acoustic-science-foundations",
      "description": "Foundational knowledge for studying acoustics.",
      "capsule_type": "domain",
      "status": "active",
      "version": "0.1.0",
      "domains": ["acoustics", "physics"],
      "tags": ["science", "sound"],
      "health": {
        "score": 0.78,
        "status": "needs_review",
        "warnings": ["6 unsupported claims", "2 open contradictions"]
      },
      "counts": {
        "sources": 8,
        "notes": 3,
        "claims": 42,
        "concepts": 17,
        "tools": 1
      },
      "updated_at": "2026-06-14T12:00:00Z"
    }
  ],
  "total": 1
}
```

### 11.2 Create capsule

```http
POST /capsules
```

Request:

```json
{
  "name": "Acoustic Science Foundations",
  "description": "Foundational concepts, claims, sources, and tools for acoustics.",
  "purpose": "Create a reusable learning and research module for acoustics.",
  "capsule_type": "domain",
  "language": "en",
  "domains": ["acoustics", "physics"],
  "tags": ["sound", "science", "learning"],
  "epistemic_strictness": "balanced",
  "default_source_policy": "reference_only"
}
```

Response:

```json
{
  "id": "cap_...",
  "name": "Acoustic Science Foundations",
  "status": "draft",
  "version": "0.1.0"
}
```

### 11.3 Get capsule detail

```http
GET /capsules/{capsule_id}
```

Response must include:

- capsule metadata,
- latest health snapshot,
- counts by item type,
- recent changelog,
- core concepts,
- key claims,
- open questions.

### 11.4 Update capsule

```http
PUT /capsules/{capsule_id}
```

Fields:

```json
{
  "name": "Acoustic Science Foundations",
  "description": "Updated description",
  "purpose": "Updated purpose",
  "status": "active",
  "domains": ["acoustics"],
  "tags": ["sound"],
  "epistemic_strictness": "strict_evidence",
  "default_source_policy": "metadata_and_quotes"
}
```

### 11.5 Archive capsule

```http
POST /capsules/{capsule_id}/archive
```

Do not delete capsule data in alpha. Mark archived.

### 11.6 Add items

```http
POST /capsules/{capsule_id}/items
```

Request:

```json
{
  "items": [
    {
      "target_type": "note",
      "target_id": "note_...",
      "role": "core",
      "include_mode": "reference"
    },
    {
      "target_type": "claim",
      "target_id": "clm_...",
      "role": "core",
      "include_mode": "reference",
      "auto_include_evidence": true
    }
  ]
}
```

Response:

```json
{
  "added": 2,
  "skipped_duplicates": 0,
  "auto_included": [
    {
      "target_type": "evidence_link",
      "target_id": "ev_..."
    },
    {
      "target_type": "source_block",
      "target_id": "blk_..."
    }
  ]
}
```

### 11.7 List capsule items

```http
GET /capsules/{capsule_id}/items?target_type=&role=&status=&limit=100&offset=0
```

### 11.8 Remove item

```http
DELETE /capsules/{capsule_id}/items/{capsule_item_id}
```

Soft remove. Set status to `removed` and `removed_at`.

### 11.9 Auto-build capsule candidates

```http
POST /capsules/candidates
```

Purpose: ask local AI to propose a capsule structure from existing workspace objects.

Request:

```json
{
  "topic": "electricity basics for home repair",
  "source_ids": ["src_..."],
  "note_ids": ["note_..."],
  "claim_ids": [],
  "mode": "balanced",
  "max_items": 100
}
```

Response:

```json
{
  "candidate_id": "cand_...",
  "title": "Electricity Basics for Home Repair",
  "description": "A beginner-friendly capsule for understanding household electricity safely.",
  "proposed_items": [
    {
      "target_type": "claim",
      "target_id": "clm_...",
      "role": "core",
      "reason": "Explains voltage/current relationship."
    }
  ],
  "warnings": ["14 proposed claims are not user-approved yet"]
}
```

Candidates must be reviewable. Do not create capsule automatically unless the user confirms.

### 11.10 Compute health

```http
POST /capsules/{capsule_id}/health/run
```

Response:

```json
{
  "health_snapshot_id": "caph_...",
  "score": 0.81,
  "status": "needs_review",
  "counts": {
    "approved_claims": 122,
    "unreviewed_claims": 38,
    "unsupported_claims": 11,
    "contradicted_claims": 4,
    "stale_claims": 2,
    "private_items": 3,
    "disabled_tools": 1
  },
  "warnings": [
    {
      "level": "warning",
      "code": "unsupported_claims",
      "message": "11 claims have no evidence links."
    }
  ]
}
```

### 11.11 Snapshot capsule

```http
POST /capsules/{capsule_id}/versions
```

Request:

```json
{
  "version": "0.2.0",
  "title": "First reviewed acoustics capsule",
  "changelog": "Added resonance concepts, cleaned source policies, generated first learning path."
}
```

Response:

```json
{
  "version_id": "capver_...",
  "version": "0.2.0",
  "item_count": 184,
  "created_at": "2026-06-14T12:00:00Z"
}
```

### 11.12 List versions

```http
GET /capsules/{capsule_id}/versions
```

### 11.13 Diff versions

```http
GET /capsules/{capsule_id}/versions/{version_id}/diff?against={other_version_id}
```

Response:

```json
{
  "from_version": "0.1.0",
  "to_version": "0.2.0",
  "added": [
    {"target_type": "claim", "target_id": "clm_...", "title": "..."}
  ],
  "removed": [],
  "changed": [
    {
      "target_type": "claim",
      "target_id": "clm_...",
      "field_changes": [
        {"field": "status", "from": "extracted", "to": "approved"}
      ]
    }
  ]
}
```

### 11.14 Fork capsule

```http
POST /capsules/{capsule_id}/fork
```

Request:

```json
{
  "name": "Electricity for Home Repair",
  "description": "A practical fork of Electricity Basics focused on household repair learning.",
  "copy_items": true,
  "dependency_type": "forked_from"
}
```

Response:

```json
{
  "new_capsule_id": "cap_...",
  "dependency_id": "capdep_..."
}
```

### 11.15 Export preview

```http
POST /capsules/{capsule_id}/export/preview
```

Request:

```json
{
  "export_mode": "sanitized",
  "version_id": "capver_...",
  "include_tools": true,
  "include_learning": true,
  "include_review_state": true
}
```

Response:

```json
{
  "can_export": false,
  "estimated_size_bytes": 2450000,
  "privacy_report": {
    "private_notes": 2,
    "possible_secrets": 1,
    "copyrighted_source_files": 3,
    "full_source_files_included": 0
  },
  "warnings": [
    {
      "level": "error",
      "code": "possible_secret",
      "message": "Possible API key found in note 'Local AI setup'."
    }
  ],
  "included_counts": {
    "sources": 8,
    "notes": 6,
    "claims": 122,
    "tools": 1,
    "learning_items": 24
  }
}
```

### 11.16 Export capsule

```http
POST /capsules/{capsule_id}/export
```

Response:

```json
{
  "export_id": "capexp_...",
  "status": "running"
}
```

Poll:

```http
GET /capsules/exports/{export_id}
```

Completed response:

```json
{
  "export_id": "capexp_...",
  "status": "finished",
  "file_path": "/path/to/Acoustic Science Foundations.vaultcapsule",
  "sha256": "...",
  "file_size_bytes": 2450000
}
```

### 11.17 Import capsule

```http
POST /capsules/imports
```

Request may be multipart file upload or local file path selected through Electron main process.

Response:

```json
{
  "import_id": "capimp_...",
  "status": "uploaded"
}
```

### 11.18 Validate import

```http
POST /capsules/imports/{import_id}/validate
```

Response:

```json
{
  "status": "quarantined",
  "manifest": {
    "name": "Acoustic Science Foundations",
    "version": "0.2.0",
    "schema_version": "0.1.0"
  },
  "validation_report": {
    "checksums_valid": true,
    "schema_valid": true,
    "path_traversal_detected": false,
    "tool_files_present": true,
    "tools_disabled": true
  },
  "warnings": [
    {
      "level": "warning",
      "code": "imported_tools_disabled",
      "message": "1 Python tool was found and disabled."
    }
  ]
}
```

### 11.19 Create import merge plan

```http
POST /capsules/imports/{import_id}/merge-plan
```

Response:

```json
{
  "merge_plan": {
    "new_sources": 3,
    "candidate_duplicate_sources": 2,
    "new_claims": 42,
    "candidate_duplicate_claims": 8,
    "new_concepts": 17,
    "candidate_duplicate_concepts": 5,
    "tools_to_review": 1,
    "review_items_to_create": 73
  },
  "actions": [
    {
      "action": "create_review_item",
      "target_type": "claim",
      "title": "Imported claim: Resonance occurs when...",
      "reason": "Imported claims require review before canonical merge."
    }
  ]
}
```

### 11.20 Apply import merge plan

```http
POST /capsules/imports/{import_id}/apply
```

Request:

```json
{
  "mode": "create_review_items",
  "selected_actions": ["action_..."]
}
```

No direct canonical merge in alpha. `create_review_items` only.

### 11.21 Generate capsule note

```http
POST /capsules/{capsule_id}/notes/generate
```

Request:

```json
{
  "mode": "overview",
  "title": "Acoustic Science Foundations Overview",
  "source_policy": "reviewed_claims_only",
  "include_open_questions": true,
  "include_contradictions": true,
  "citation_policy": "require_evidence_for_factual_claims"
}
```

Response:

```json
{
  "note_id": "note_...",
  "status": "generated_pending_review",
  "capsule_item_id": "capitem_...",
  "warnings": ["3 open questions included"]
}
```

### 11.22 Generate learning items

```http
POST /capsules/{capsule_id}/learning/generate
```

Request:

```json
{
  "mode": "course_outline",
  "source_policy": "reviewed_claims_only",
  "difficulty": "beginner",
  "duration": "7_days",
  "include_flashcards": true,
  "include_quiz": true
}
```

### 11.23 Attach tool

```http
POST /capsules/{capsule_id}/tools/attach
```

Request:

```json
{
  "tool_id": "tool_...",
  "role": "tool",
  "reason": "Useful for calculating wavelength and frequency."
}
```

---

## 12. Capsule File Format

### 12.1 Extension

Use:

```text
.vaultcapsule
```

Implementation:

- zipped directory,
- deterministic file layout where possible,
- UTF-8 text,
- JSON/JSONL/Markdown/plain files,
- manifest at root,
- SHA-256 manifest.

### 12.2 Directory layout

```text
acoustic-science-foundations.vaultcapsule/
  capsule.json
  manifest-sha256.txt
  README.md

  sources/
    files/
      source_001.pdf
      source_002.md
    extracted_text/
      source_001.txt
    metadata.jsonl

  notes/
    note_001.md
    note_001.json
    generated_overview.md

  objects/
    kg_nodes.jsonl
    concepts.jsonl
    claims.jsonl
    definitions.jsonl
    hypotheses.jsonl
    questions.jsonl

  relations/
    kg_edges.jsonl

  evidence/
    evidence_links.jsonl
    source_blocks.jsonl
    citations.jsonl

  learning/
    learning_items.jsonl
    glossary.md
    course.json
    flashcards.jsonl
    quiz.jsonl

  tools/
    tool_registry.jsonl
    tool_001/
      tool.json
      src/
        main.py
      tests/
        test_main.py
      README.md

  review/
    review_items.jsonl
    unresolved_contradictions.jsonl
    approval_log.jsonl
    rejected_objects.jsonl

  history/
    changelog.jsonl
    versions.jsonl
    fork_info.json

  export/
    export_report.json
    privacy_report.json
    validation_report.json
```

The `.vaultcapsule` file is a zip archive of this directory.

### 12.3 Required root files

Required:

```text
capsule.json
manifest-sha256.txt
README.md
```

Optional:

```text
sources/
notes/
objects/
relations/
evidence/
learning/
tools/
review/
history/
export/
```

### 12.4 capsule.json schema

Initial schema:

```json
{
  "schema_version": "0.1.0",
  "vault_app_min_version": "0.1.0",
  "capsule_id": "cap_...",
  "source_workspace_id": "ws_...",
  "name": "Acoustic Science Foundations",
  "slug": "acoustic-science-foundations",
  "description": "Foundational concepts, claims, sources, and tools for acoustics.",
  "purpose": "Reusable learning and research module.",
  "version": "0.2.0",
  "created_at": "2026-06-14T12:00:00Z",
  "updated_at": "2026-06-14T12:00:00Z",
  "exported_at": "2026-06-14T12:30:00Z",
  "author": {
    "name": "local_user",
    "id": "user_local"
  },
  "languages": ["en"],
  "domains": ["acoustics", "physics"],
  "tags": ["sound", "science", "learning"],
  "capsule_type": "domain",
  "epistemic_strictness": "balanced",
  "license": {
    "content": "private",
    "metadata": "private"
  },
  "source_policy": {
    "mode": "metadata_and_quotes",
    "includes_full_source_files": false,
    "includes_extracted_text": false,
    "includes_short_quotes": true,
    "includes_external_references": true
  },
  "trust_profile": {
    "approved_claims": 122,
    "unreviewed_claims": 38,
    "unsupported_claims": 11,
    "contradicted_claims": 4,
    "stale_claims": 2,
    "private_items": 0,
    "disabled_tools": 1,
    "health_score": 0.81
  },
  "counts": {
    "sources": 8,
    "notes": 6,
    "kg_nodes": 64,
    "claims": 122,
    "evidence_links": 180,
    "kg_edges": 230,
    "learning_items": 24,
    "tools": 1
  },
  "dependencies": [
    {
      "type": "requires",
      "capsule_id": "cap_basic_physics",
      "name": "Basic Physics",
      "version_constraint": ">=0.1.0"
    }
  ],
  "tools": [
    {
      "tool_id": "tool_frequency_calculator",
      "name": "Frequency Calculator",
      "version": "0.1.0",
      "language": "python",
      "status": "exported_disabled",
      "permissions": ["read_capsule", "write_derived_outputs"],
      "requires_network": false
    }
  ],
  "checksums": {
    "algorithm": "sha256",
    "manifest_file": "manifest-sha256.txt"
  }
}
```

### 12.5 manifest-sha256.txt

Format:

```text
<sha256>  capsule.json
<sha256>  README.md
<sha256>  objects/claims.jsonl
<sha256>  evidence/evidence_links.jsonl
...
```

On import, validate all paths and checksums before showing imported contents.

### 12.6 README.md

Generate a human-readable capsule summary:

```markdown
# Acoustic Science Foundations

Purpose: ...

## Contents
- 8 sources
- 122 claims
- 17 concepts
- 24 learning items
- 1 tool

## Health
- 81% health score
- 11 unsupported claims
- 4 contradictions

## Export policy
This capsule includes source metadata and short quotes only. Full source files are not included.
```

---

## 13. Export Modes

### 13.1 Private full export

Intended for personal backup or transfer between own machines.

Includes:

- source files,
- extracted text,
- notes,
- graph objects,
- evidence,
- learning items,
- tools,
- review state,
- history.

Warnings:

- may include private data,
- may include copyrighted files,
- may include sensitive notes.

Requires explicit confirmation.

### 13.2 Sanitized export

Intended for sharing with another person privately.

Includes:

- notes not marked private,
- approved claims,
- source metadata,
- short quotes where allowed,
- learning items,
- disabled tools if selected.

Excludes:

- private notes,
- full source files unless explicitly approved,
- secrets,
- API keys,
- personal transcripts,
- client data.

### 13.3 Reference-only export

Intended for bibliography-like exchange.

Includes:

- source metadata,
- object graph,
- claims,
- relations,
- evidence references,
- no full source files,
- no extracted full text.

### 13.4 Learning export

Intended for turning a capsule into a course.

Includes:

- overview notes,
- lessons,
- glossary,
- flashcards,
- quizzes,
- approved claims and source references.

### 13.5 Tool export

Intended for sharing a tool-enabled mini-lab.

Includes:

- selected tools,
- tool manifests,
- tests,
- minimal sample fixtures,
- no private data.

Imported tools remain disabled.

### 13.6 Public capsule export

Strictest mode.

Includes only:

- explicitly public notes,
- approved claims,
- source metadata,
- license-compatible content,
- sanitized learning items,
- no private data,
- no full copyrighted sources,
- tools disabled and marked as untrusted until reviewed.

---

## 14. Privacy and Safety Requirements

### 14.1 Privacy scan before export

Implement a basic privacy scanner.

Alpha scanner should detect:

- API-key-like strings,
- private flag on notes/sources/items,
- emails,
- phone numbers,
- tokens beginning with common prefixes,
- `.env` files,
- secret-looking variables,
- client/patient data flags,
- imported transcripts marked private.

Do not overpromise perfect detection. Show warnings.

### 14.2 Copyright/source policy

For each source in a capsule, support export policy:

```text
exclude
reference_only
metadata_and_quotes
extracted_text_only
full_file
```

Default should be `reference_only` unless user chooses otherwise.

### 14.3 Imported capsule quarantine

On import:

- never execute tools,
- never load code dynamically,
- never merge claims directly,
- never overwrite existing objects,
- never trust imported status blindly,
- validate paths,
- validate checksums,
- enforce max file count and max unpacked size,
- reject symlinks in archive,
- reject absolute paths,
- reject `../` path traversal,
- store in quarantine directory.

### 14.4 Imported prompt-injection content

Imported notes or sources may contain instructions like `ignore previous instructions`.

Treat all imported content as data, never as system instructions.

Any AI operation over imported content must use the same prompt-injection-safe source handling defined in the main spec:

- source text is quoted as untrusted material,
- model instructions are outside the source block,
- model output is validated,
- generated merge proposals require review.

### 14.5 Tool safety

Imported tools must enter `disabled_imported` status.

Before enabling an imported tool:

- show manifest,
- show requested permissions,
- show files,
- run static checks where possible,
- require user confirmation,
- run tests in sandbox,
- log all runs.

No imported tool may access canonical DB directly.

---

## 15. Capsule Health Algorithm

Implement simple scoring first. Do not make this magical.

### 15.1 Inputs

Counts:

```text
approved_claims
unreviewed_claims
unsupported_claims
contradicted_claims
stale_claims
private_items
disabled_tools
sources
notes
tools
```

Signals:

- average evidence strength,
- number of claims with at least one evidence link,
- number of open contradictions,
- number of pending review items related to capsule,
- number of generated notes pending review,
- number of sources with unknown trust level.

### 15.2 Initial formula

Use transparent, explainable scoring:

```text
base = 100
minus 20 if no sources and has claims
minus 1 for each unsupported claim, capped at 25
minus 3 for each contradicted claim, capped at 30
minus 1 for each stale claim, capped at 10
minus 0.5 for each unreviewed claim, capped at 15
minus 5 if any imported disabled tools exist
minus 10 if privacy risks block export
plus 5 if all key claims have evidence
plus 5 if at least one overview note exists
```

Clamp to 0-100.

Return both numeric score and warnings.

Do not hide the reasons. Health is a diagnostic, not a moral judgment from the silicon monastery.

### 15.3 Status mapping

```text
score >= 85 and no critical warnings -> healthy
score >= 65 -> needs_review
score < 65 -> weak_evidence
any contradictions -> contradictions_found
any export blockers -> privacy_risk or export_blocked
any disabled imported tools -> unsafe_tools
```

---

## 16. Capsule Versioning and Diffs

### 16.1 Version format

Use semver-like strings:

```text
0.1.0
0.2.0
1.0.0
```

Do not implement full semver validation beyond simple pattern in alpha.

### 16.2 What a version snapshot stores

A snapshot must store:

- capsule metadata,
- item membership list,
- item roles,
- include/export policies,
- health snapshot,
- counts,
- dependencies,
- timestamp,
- changelog.

It does not duplicate full source files in the DB.

### 16.3 Diff categories

Diff must show:

```text
added_items
removed_items
changed_roles
changed_export_policies
changed_private_flags
changed_claim_status
changed_evidence_strength
changed_health
changed_dependencies
```

### 16.4 Restore behavior

Alpha restore should only restore capsule membership and item metadata. It must not revert global claims, notes, or sources.

Add a warning:

```text
Restoring this capsule version changes which objects are included in the capsule. It does not revert global notes, claims, sources, or tools.
```

---

## 17. Import and Merge Design

### 17.1 Import modes

```text
View only
Sandbox
Merge candidates
```

Alpha default:

```text
Sandbox
```

### 17.2 Quarantine model

When imported, create a temporary imported capsule record with status:

```text
imported_quarantine
```

Do not add imported items to global graph.

Represent imported objects as parsed package data until user creates merge candidates.

### 17.3 Merge candidates

Merge plan should classify imported objects:

```text
new
possible_duplicate
conflicts_with_existing
unsafe
unsupported
already_exists
```

### 17.4 Duplicate detection

Alpha duplicate detection:

Sources:

- match content hash,
- match title + uri,
- match extracted text hash if available.

Notes:

- match content hash,
- match title similarity later.

Claims:

- exact normalized text match,
- later embedding similarity.

Concepts:

- exact normalized title match,
- aliases from payload JSON.

Tools:

- tool slug + version,
- file checksums.

### 17.5 Merge actions

In alpha, applying merge plan creates review items only.

Review item payload examples:

```json
{
  "import_id": "capimp_...",
  "imported_target_type": "claim",
  "imported_object": {
    "normalized_text": "Resonance occurs when...",
    "confidence": 0.82,
    "status": "supported"
  },
  "candidate_matches": [
    {
      "target_type": "claim",
      "target_id": "clm_existing_...",
      "similarity": 0.94
    }
  ],
  "recommended_action": "merge_or_skip"
}
```

User review decisions later:

```text
import_as_new
merge_with_existing
ignore
mark_unsafe
create_new_capsule_only
```

---

## 18. AI Integration

Capsules must use the existing Local AI subsystem. Do not add a separate model runner.

### 18.1 AI jobs

Add lab job types:

```text
capsule_candidate_builder
capsule_overview_note_generation
capsule_health_analysis
capsule_learning_generation
capsule_contradiction_summary
capsule_import_merge_analysis
capsule_privacy_scan
```

### 18.2 Structured outputs

All AI jobs must return strict JSON validated by Pydantic.

For local llama.cpp structured paths, use GBNF or provider-specific structured output where available. Treat model output as untrusted until validated.

### 18.3 Capsule candidate builder output schema

```json
{
  "title": "string",
  "description": "string",
  "purpose": "string",
  "capsule_type": "domain|project|research_question|course|toolkit|archive|publication_pack|personal_learning",
  "domains": ["string"],
  "tags": ["string"],
  "proposed_items": [
    {
      "target_type": "source|note|kg_node|claim|evidence_link|kg_edge|learning_item|tool",
      "target_id": "string",
      "role": "core|supporting|context|primary_source|secondary_source|evidence|open_question|contradiction|learning|reference|tool|private|export_excluded|generated",
      "reason": "string"
    }
  ],
  "warnings": ["string"],
  "open_questions": ["string"]
}
```

### 18.4 Capsule generated note constraints

Generated capsule notes must:

- be stored in `notes`,
- use origin `generated`,
- use status `generated_pending_review`,
- include source refs in metadata,
- link to the capsule via `capsule_items`,
- not silently approve their own claims,
- create review items if new factual claims are detected.

### 18.5 Learning generation constraints

Learning items must link to claims/concepts/sources.

Default source policy:

```text
reviewed_claims_only
```

If user chooses exploratory mode, clearly mark generated material as exploratory.

---

## 19. Notes Integration

Notes are first-class capsule content.

### 19.1 Editor actions

Add editor actions:

```text
Add note to capsule
Remove note from capsule
Show capsules containing this note
Generate capsule note from selection
Extract claims into capsule context
```

### 19.2 Note metadata

Existing `notes.metadata_json` can include:

```json
{
  "capsule_refs": [
    {
      "capsule_id": "cap_...",
      "role": "core"
    }
  ],
  "generated_from_capsule_id": "cap_...",
  "source_policy": "reviewed_claims_only"
}
```

Do not rely only on this metadata. The source of truth is `capsule_items`.

### 19.3 Generated notes inside capsules

Generation modes:

```text
overview
research_memo
study_guide
contradiction_summary
source_map
open_questions_report
course_lesson
publication_draft
```

Output status:

```text
generated_pending_review
```

After user approves, allow status:

```text
approved_generated
```

### 19.4 Claim extraction from capsule notes

When extracting claims from a note already inside a capsule, the extraction review screen should offer:

```text
Add approved extracted claims to same capsule
Auto-include evidence links
Auto-link claim to source note
```

---

## 20. Tool Studio Integration

Capsules can attach tools, but tools remain globally registered in Tool Studio.

### 20.1 Tool attachment

A capsule item with `target_type = tool` references `tool_registry.id`.

### 20.2 Tool roles

```text
analysis_tool
calculator
visualizer
validator
extractor
teaching_tool
export_helper
privacy_checker
```

Store role in `capsule_items.metadata_json`.

### 20.3 Tool context

When running a tool from a capsule, pass capsule-scoped input:

```json
{
  "capsule_id": "cap_...",
  "input": {},
  "allowed_targets": {
    "sources": ["src_..."],
    "notes": ["note_..."],
    "claims": ["clm_..."]
  }
}
```

Tools must not receive unrestricted workspace access unless explicitly granted.

### 20.4 Tool outputs

Tool outputs should be:

- stored as `tool_runs`,
- optionally attached to capsule as `tool_run` item,
- never written to canonical graph without review.

---

## 21. Night Lab Integration

Add capsule-aware Night Lab jobs.

### 21.1 Night Lab capsule tasks

```text
Refresh capsule health
Find unsupported claims inside capsules
Find contradictions inside capsules
Find stale claims inside capsules
Suggest missing sources
Suggest capsule overview updates
Suggest learning items
Suggest tools useful for capsule
Find duplicated capsules or overlapping capsules
```

### 21.2 Output

Night Lab must create:

- review items,
- capsule health snapshots,
- suggested notes,
- suggested learning items,
- suggested tools.

It must not silently:

- merge capsules,
- remove items,
- approve claims,
- export capsules,
- import external capsules,
- enable tools.

---

## 22. Review Queue Integration

Review item types to add:

```text
capsule_item_addition
capsule_item_removal
capsule_generated_note
capsule_learning_item
capsule_import_claim
capsule_import_concept
capsule_import_tool
capsule_merge_candidate
capsule_contradiction_resolution
capsule_export_privacy_warning
```

Review item payload should always include:

```json
{
  "capsule_id": "cap_...",
  "target_type": "claim",
  "target_id": "clm_...",
  "proposed_action": "add_to_capsule",
  "reason": "...",
  "evidence_refs": []
}
```

Review actions:

```text
approve
reject
edit
defer
open_source
open_capsule
mark_private
create_follow_up_question
```

---

## 23. Search and Retrieval

Capsules should affect retrieval in two ways:

### 23.1 Search within capsule

Search endpoint should support `capsule_id` filter.

Examples:

```http
GET /search?q=resonance&capsule_id=cap_...
GET /claims?capsule_id=cap_...&status=supported
GET /notes?capsule_id=cap_...
```

### 23.2 Contextual chat within capsule

When user asks inside capsule context, retrieval priority:

1. capsule notes,
2. capsule claims,
3. capsule evidence/source blocks,
4. capsule sources,
5. global graph only if user enables `include_related_global_context`.

Default should keep answers capsule-scoped.

---

## 24. Frontend Implementation Plan

Recommended structure:

```text
apps/desktop/src/
  features/capsules/
    api.ts
    types.ts
    routes.tsx
    CapsuleIndexPage.tsx
    CapsuleCreateDialog.tsx
    CapsuleDetailPage.tsx
    CapsuleOverviewTab.tsx
    CapsuleKnowledgeTab.tsx
    CapsuleSourcesTab.tsx
    CapsuleNotesTab.tsx
    CapsuleQuestionsTab.tsx
    CapsuleContradictionsTab.tsx
    CapsuleLearningTab.tsx
    CapsuleToolsTab.tsx
    CapsuleVersionsTab.tsx
    CapsuleExportTab.tsx
    CapsuleImportPage.tsx
    CapsuleDiffView.tsx
    CapsuleHealthCard.tsx
    AddToCapsuleDialog.tsx
    ExportPreviewDialog.tsx
```

### 24.1 Shared components

Reuse existing design system:

- cards,
- badges,
- tabs,
- tables,
- command menu,
- dialogs,
- toasts,
- side inspector,
- split layout.

### 24.2 Command menu actions

Add commands:

```text
Create capsule
Add current note to capsule
Open capsule
Generate capsule overview
Snapshot capsule
Export capsule
Import capsule
Fork capsule
Run capsule health check
```

### 24.3 Empty states

Capsule index empty state:

```text
No capsules yet.
Create a portable knowledge module from notes, sources, claims, and tools.
```

Capsule detail empty state:

```text
This capsule is still empty.
Add notes, sources, claims, or generate a candidate capsule from a topic.
```

### 24.4 Visual style

Keep UI modern and airy:

- soft rounded cards,
- restrained borders,
- generous spacing,
- no dense graph spaghetti,
- no modal labyrinth,
- health warnings visible but not alarming,
- capsule cards should feel like knowledge modules, not folders.

---

## 25. Pydantic Schema Sketch

Use this as a starting point. Adapt names to existing code conventions.

```python
from pydantic import BaseModel, Field
from typing import Any, Literal

CapsuleType = Literal[
    "domain",
    "project",
    "research_question",
    "course",
    "toolkit",
    "archive",
    "publication_pack",
    "personal_learning",
]

CapsuleStatus = Literal[
    "draft",
    "active",
    "needs_review",
    "export_ready",
    "archived",
    "imported_quarantine",
    "imported_sandbox",
]

CapsuleTargetType = Literal[
    "source",
    "source_block",
    "note",
    "note_version",
    "kg_node",
    "claim",
    "evidence_link",
    "kg_edge",
    "review_item",
    "learning_item",
    "tool",
    "tool_run",
    "lab_job_output",
    "external_reference",
]

CapsuleRole = Literal[
    "core",
    "supporting",
    "context",
    "primary_source",
    "secondary_source",
    "evidence",
    "open_question",
    "contradiction",
    "learning",
    "reference",
    "tool",
    "private",
    "export_excluded",
    "generated",
]

class CapsuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    purpose: str | None = None
    capsule_type: CapsuleType = "domain"
    language: str | None = None
    domains: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    epistemic_strictness: str = "balanced"
    default_source_policy: str = "reference_only"

class CapsuleUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    purpose: str | None = None
    status: CapsuleStatus | None = None
    domains: list[str] | None = None
    tags: list[str] | None = None
    epistemic_strictness: str | None = None
    default_source_policy: str | None = None

class CapsuleItemAdd(BaseModel):
    target_type: CapsuleTargetType
    target_id: str
    role: CapsuleRole = "supporting"
    include_mode: str = "reference"
    export_policy: str | None = None
    private_flag: bool = False
    auto_include_evidence: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)

class CapsuleAddItemsRequest(BaseModel):
    items: list[CapsuleItemAdd]

class CapsuleHealth(BaseModel):
    score: float
    status: str
    approved_claims: int = 0
    unreviewed_claims: int = 0
    unsupported_claims: int = 0
    contradicted_claims: int = 0
    stale_claims: int = 0
    private_items: int = 0
    disabled_tools: int = 0
    warnings: list[dict[str, Any]] = Field(default_factory=list)

class CapsuleSnapshotRequest(BaseModel):
    version: str
    title: str | None = None
    changelog: str | None = None

class CapsuleExportPreviewRequest(BaseModel):
    export_mode: Literal[
        "private_full",
        "sanitized",
        "reference_only",
        "learning",
        "tool",
        "public",
    ]
    version_id: str | None = None
    include_tools: bool = True
    include_learning: bool = True
    include_review_state: bool = True

class CapsuleGenerateNoteRequest(BaseModel):
    mode: Literal[
        "overview",
        "research_memo",
        "study_guide",
        "contradiction_summary",
        "source_map",
        "open_questions_report",
        "course_lesson",
        "publication_draft",
    ]
    title: str
    source_policy: str = "reviewed_claims_only"
    include_open_questions: bool = True
    include_contradictions: bool = True
    citation_policy: str = "require_evidence_for_factual_claims"
```

---

## 26. Event Log Requirements

Every capsule mutation must write to both:

1. `capsule_changelog`, scoped to capsule.
2. `event_log`, global workspace audit trail.

Required event examples:

```json
{
  "actor": "user",
  "action": "capsule.item_added",
  "target_type": "claim",
  "target_id": "clm_...",
  "payload_json": {
    "capsule_id": "cap_...",
    "role": "core"
  }
}
```

AI actions must include job ID.

---

## 27. Filesystem Paths

Use a workspace data directory similar to existing core spec.

Recommended:

```text
vault_data/
  capsules/
    exports/
      capexp_.../
        capsule.vaultcapsule
        export_report.json
    imports/
      capimp_.../
        original.vaultcapsule
        quarantine/
        validation_report.json
    temp/
```

Rules:

- never unpack imports outside the quarantine folder,
- never use archive-provided paths directly,
- normalize and validate all paths,
- reject symlinks,
- enforce max size.

---

## 28. Limits and Defaults

Alpha defaults:

```text
Max capsule export size: 500 MB
Max import archive size: 500 MB
Max unpacked import size: 1 GB
Max file count per import: 10,000
Max single JSONL file size: 200 MB
Max tool files per capsule: 100
Max generated overview note length: 4,000 words
Max learning items generated per run: 100
```

Make these configurable in settings later.

---

## 29. Error Handling

Common errors:

```text
CAPSULE_NOT_FOUND
CAPSULE_ARCHIVED
CAPSULE_ITEM_DUPLICATE
CAPSULE_ITEM_TARGET_NOT_FOUND
CAPSULE_EXPORT_PRIVACY_BLOCKED
CAPSULE_EXPORT_FAILED
CAPSULE_IMPORT_INVALID_EXTENSION
CAPSULE_IMPORT_TOO_LARGE
CAPSULE_IMPORT_PATH_TRAVERSAL
CAPSULE_IMPORT_CHECKSUM_FAILED
CAPSULE_IMPORT_SCHEMA_UNSUPPORTED
CAPSULE_TOOL_IMPORT_DISABLED
CAPSULE_VERSION_EXISTS
CAPSULE_VERSION_NOT_FOUND
```

Return structured errors:

```json
{
  "error": {
    "code": "CAPSULE_ITEM_DUPLICATE",
    "message": "This claim is already included in the capsule.",
    "details": {
      "capsule_id": "cap_...",
      "target_type": "claim",
      "target_id": "clm_..."
    }
  }
}
```

---

## 30. Testing Requirements

### 30.1 Backend unit tests

Required tests:

- create capsule,
- update capsule,
- archive capsule,
- add item,
- duplicate item blocked,
- remove item soft delete,
- auto-include evidence for claim,
- health score calculation,
- snapshot creation,
- version diff,
- export preview,
- sanitized export excludes private items,
- reference-only export excludes source files,
- import validates checksum,
- import rejects path traversal,
- import rejects symlinks,
- import disables tools,
- merge plan creates review items only,
- fork creates dependency.

### 30.2 Frontend tests

Required Playwright tests:

1. Create capsule from index page.
2. Add a note to capsule from editor.
3. Open capsule detail and verify note appears.
4. Run health check and see health card update.
5. Generate capsule overview note and see it pending review.
6. Create snapshot and see version listed.
7. Export preview blocks private warning.
8. Import capsule opens quarantine screen.

### 30.3 Golden fixture

Create a tiny fixture capsule for tests:

```text
fixtures/capsules/acoustics_minimal/
  capsule.json
  README.md
  objects/claims.jsonl
  evidence/evidence_links.jsonl
  sources/metadata.jsonl
  manifest-sha256.txt
```

Use it for import validation tests.

### 30.4 Security tests

Create malicious archive fixtures:

- path traversal file: `../../evil.py`,
- absolute path file: `/tmp/evil.py`,
- symlink entry,
- checksum mismatch,
- oversized file count,
- tool with suspicious permission request.

All must be rejected or quarantined safely.

---

## 31. Implementation Milestones

### Milestone C0: Schema and API skeleton

Deliver:

- Alembic migration for capsule tables.
- SQLModel/SQLAlchemy models.
- Pydantic schemas.
- FastAPI router mounted at `/capsules`.
- CRUD endpoints.
- Tests for create/list/get/update/archive.

Acceptance:

- app starts,
- migration runs,
- capsules can be created and listed,
- no frontend required yet.

### Milestone C1: Capsule UI basics

Deliver:

- Capsules navigation item.
- Capsules index page.
- Create capsule dialog.
- Capsule detail page with Overview tab.
- React Query integration.

Acceptance:

- user can create capsule in UI,
- capsule appears in list,
- detail page loads.

### Milestone C2: Add/remove items

Deliver:

- Add item API.
- Remove item API.
- List items API.
- Add-to-capsule dialog usable from notes.
- Capsule Notes and Sources tabs.

Acceptance:

- user can add current note to capsule,
- user can remove note from capsule,
- item membership is persisted.

### Milestone C3: Claims, evidence, and health

Deliver:

- Support adding claims and evidence links.
- Auto-include evidence for claims.
- Capsule Health service.
- Health card in UI.
- Health run endpoint.

Acceptance:

- adding a claim also adds evidence links when requested,
- health card shows counts and warnings.

### Milestone C4: Generated capsule notes

Deliver:

- Capsule generated note endpoint.
- Prompt/structured call through existing Local AI provider.
- Generated note saved to `notes` with pending review status.
- Generated note linked to capsule.
- UI button: `Generate overview note`.

Acceptance:

- generated note appears in Notes tab,
- note opens in editor,
- status is pending review,
- source policy is stored.

### Milestone C5: Learning tab

Deliver:

- Generate learning items from capsule.
- Learning tab UI.
- Link learning items back to capsule.

Acceptance:

- user can generate a 7-day learning outline from a capsule,
- learning items include source refs.

### Milestone C6: Version snapshots and diffs

Deliver:

- Snapshot endpoint.
- Versions tab.
- Version diff endpoint.
- Diff UI.

Acceptance:

- user can create snapshot,
- user can compare snapshots,
- added/removed/changed items display correctly.

### Milestone C7: Export preview and `.vaultcapsule` export

Deliver:

- Export preview endpoint.
- Privacy scan.
- Export package writer.
- Checksum manifest.
- Export tab UI.

Acceptance:

- user can preview export,
- private items trigger warnings,
- reference-only export excludes full source files,
- `.vaultcapsule` file is created.

### Milestone C8: Import quarantine

Deliver:

- Import endpoint.
- Safe unzip.
- Manifest validation.
- Checksum validation.
- Quarantine storage.
- Import UI.

Acceptance:

- valid capsule imports into quarantine,
- malicious path traversal fixture is rejected,
- imported tools are disabled.

### Milestone C9: Merge plans

Deliver:

- Merge plan service.
- Duplicate detection alpha.
- Create review items from merge plan.
- Merge plan UI.

Acceptance:

- imported claims become review candidates,
- no imported claim becomes canonical automatically.

### Milestone C10: Forks and dependencies

Deliver:

- Fork endpoint.
- Dependency table integration.
- UI action: Fork capsule.
- Versions tab shows fork parent.

Acceptance:

- forking creates new capsule with same selected items,
- dependency relation is created.

### Milestone C11: Tool attachment

Deliver:

- Attach/detach tools.
- Tools tab.
- Imported tool disabled status visible.
- Capsule-scoped tool run input.

Acceptance:

- user can attach existing tool to capsule,
- tool run receives capsule context,
- output does not mutate canonical graph.

### Milestone C12: Hardening and polish

Deliver:

- E2E tests.
- Error handling.
- Empty states.
- Export/import logs.
- Settings for size limits.
- UI polish.

Acceptance:

- capsule flow works end to end:
  - create,
  - add notes/sources/claims,
  - generate overview,
  - health check,
  - snapshot,
  - export,
  - import quarantine,
  - merge candidates.

---

## 32. Acceptance Criteria for Capsule Alpha

The capsule alpha is complete when a user can:

1. Create `Acoustic Science Foundations` capsule.
2. Add a user-written note to it.
3. Add an imported source to it.
4. Add reviewed claims and evidence links to it.
5. Generate an overview note from reviewed claims.
6. Generate a beginner learning outline.
7. View capsule health and warnings.
8. Create version `0.1.0` snapshot.
9. Export a reference-only `.vaultcapsule`.
10. Import the same capsule into quarantine.
11. See merge candidates instead of automatic canonical writes.
12. Fork the capsule into a new project capsule.

---

## 33. Recommended First Codex Task

Start here:

```text
Implement Knowledge Capsules Milestone C0 and C1.

Scope:
- Add capsule database tables via migration.
- Add backend models, schemas, service, and routes for capsule CRUD.
- Add `/capsules` API endpoints: list, create, get, update, archive.
- Add frontend Capsules navigation item.
- Add Capsules index page.
- Add capsule creation dialog.
- Add capsule detail Overview page with empty health/count placeholders.
- Add basic backend and frontend tests.

Do not implement export/import, AI, health scoring, versioning, or tools yet.
Keep the app runnable after this change.
```

---

## 34. Future Extensions After Alpha

Do not build these until the alpha is stable:

- capsule publishing system,
- public/private capsule registry,
- signed capsules,
- capsule dependency resolver,
- remote collaboration,
- capsule marketplace,
- capsule-to-static-site export,
- capsule-to-course export,
- capsule-to-MCP resource export,
- capsule semantic version conflict resolution,
- cross-workspace capsule sync,
- cloud backup.

---

## 35. Product North Star

Knowledge Capsules should make this possible:

```text
I can gather knowledge about acoustic science, ancient civilisations, electricity, or any other domain, then package the useful part into a trustworthy, portable, teachable, tool-enabled module that can evolve without becoming a silo.
```

The Vault remains the living research lab.

Capsules are the portable organs of knowledge.

They can be written from, learned from, forked, shared, imported, inspected, and improved. But they must always remain grounded in sources, claims, evidence, and review.

