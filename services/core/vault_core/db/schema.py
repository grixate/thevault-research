SCHEMA_SQL = """
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  uri TEXT,
  content_hash TEXT,
  raw_path TEXT,
  extracted_text_path TEXT,
  trust_level TEXT NOT NULL DEFAULT 'unknown',
  language TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS source_blocks (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  block_index INTEGER NOT NULL,
  locator TEXT,
  heading_path TEXT,
  text TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  token_count INTEGER,
  language TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(source_id, block_index),
  FOREIGN KEY(source_id) REFERENCES sources(id)
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  source_id TEXT,
  title TEXT NOT NULL,
  content_json TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  origin TEXT NOT NULL,
  status TEXT NOT NULL,
  parent_note_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(source_id) REFERENCES sources(id)
);

CREATE TABLE IF NOT EXISTS note_versions (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(note_id) REFERENCES notes(id)
);

CREATE TABLE IF NOT EXISTS kg_nodes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  title TEXT NOT NULL,
  canonical_text TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  confidence REAL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  language TEXT,
  domain TEXT,
  time_scope TEXT,
  status TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  evidence_strength REAL NOT NULL DEFAULT 0,
  source_trust_score REAL NOT NULL DEFAULT 0,
  last_checked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(node_id) REFERENCES kg_nodes(id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS evidence_links (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  source_block_id TEXT NOT NULL,
  support_type TEXT NOT NULL,
  exact_quote TEXT NOT NULL,
  char_start INTEGER,
  char_end INTEGER,
  strength REAL NOT NULL DEFAULT 0,
  evaluator TEXT NOT NULL,
  created_by_job_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(claim_id) REFERENCES claims(id),
  FOREIGN KEY(source_block_id) REFERENCES source_blocks(id)
);

CREATE TABLE IF NOT EXISTS kg_edges (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  edge_type TEXT NOT NULL,
  strength REAL,
  status TEXT NOT NULL DEFAULT 'proposed',
  provenance_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(from_node_id) REFERENCES kg_nodes(id),
  FOREIGN KEY(to_node_id) REFERENCES kg_nodes(id)
);

CREATE TABLE IF NOT EXISTS review_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by_job_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  decided_at TEXT,
  decision_note TEXT,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  vector_blob BLOB NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS ai_capability_bindings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT,
  local_only INTEGER NOT NULL DEFAULT 1,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, capability),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS ai_model_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  prompt_id TEXT,
  input_hash TEXT NOT NULL,
  output_hash TEXT,
  status TEXT NOT NULL,
  error TEXT,
  duration_ms INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  validation_status TEXT,
  local_only INTEGER NOT NULL DEFAULT 1,
  sent_off_device INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS ai_installed_models (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  kind TEXT NOT NULL,
  runtime TEXT NOT NULL,
  format TEXT NOT NULL,
  file_path TEXT,
  license_label TEXT,
  license_url TEXT,
  license_path TEXT,
  manifest_json TEXT NOT NULL DEFAULT '{}',
  installed_at TEXT NOT NULL,
  verified_at TEXT,
  sha256 TEXT,
  size_bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'installed',
  UNIQUE(workspace_id, model_id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS ai_model_downloads (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  state TEXT NOT NULL,
  source_json TEXT NOT NULL DEFAULT '{}',
  target_path TEXT,
  bytes_total INTEGER,
  bytes_downloaded INTEGER NOT NULL DEFAULT 0,
  sha256_expected TEXT,
  sha256_actual TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS ai_runtime_installs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  runtime_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  runtime TEXT NOT NULL,
  version TEXT,
  binary_path TEXT NOT NULL,
  manifest_json TEXT NOT NULL DEFAULT '{}',
  installed_at TEXT NOT NULL,
  verified_at TEXT,
  sha256 TEXT,
  size_bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'installed',
  install_log_json TEXT NOT NULL DEFAULT '[]',
  UNIQUE(workspace_id, runtime_id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS ai_registry_release_workspaces (
  workspace_id TEXT NOT NULL,
  id TEXT NOT NULL,
  state_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(workspace_id, id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS audio_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  original_filename TEXT,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  duration_ms INTEGER,
  sha256 TEXT NOT NULL,
  source_id TEXT,
  privacy_level TEXT NOT NULL DEFAULT 'private',
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(source_id) REFERENCES sources(id)
);

CREATE TABLE IF NOT EXISTS transcript_segments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  audio_asset_id TEXT NOT NULL,
  source_block_id TEXT,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  text TEXT NOT NULL,
  confidence REAL,
  speaker_label TEXT,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(audio_asset_id) REFERENCES audio_assets(id),
  FOREIGN KEY(source_block_id) REFERENCES source_blocks(id)
);

CREATE TABLE IF NOT EXISTS speech_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  text_preview TEXT,
  audio_path TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  voice_id TEXT,
  language TEXT,
  duration_ms INTEGER,
  sent_off_device INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS source_blocks_fts USING fts5(
  text,
  title,
  source_id UNINDEXED,
  source_block_id UNINDEXED
);

CREATE TABLE IF NOT EXISTS lab_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT NOT NULL DEFAULT '{}',
  error TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS tool_registry (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  install_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS tool_runs (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT,
  stdout TEXT,
  stderr TEXT,
  error TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY(tool_id) REFERENCES tool_registry(id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS learning_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body_json TEXT NOT NULL,
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS capsules (
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
  UNIQUE(workspace_id, slug),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS capsule_items (
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

CREATE TABLE IF NOT EXISTS capsule_versions (
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
  UNIQUE(capsule_id, version),
  FOREIGN KEY(capsule_id) REFERENCES capsules(id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(parent_version_id) REFERENCES capsule_versions(id)
);

CREATE TABLE IF NOT EXISTS capsule_dependencies (
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

CREATE TABLE IF NOT EXISTS capsule_health_snapshots (
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

CREATE TABLE IF NOT EXISTS capsule_exports (
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

CREATE TABLE IF NOT EXISTS capsule_imports (
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

CREATE TABLE IF NOT EXISTS capsule_changelog (
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

CREATE TABLE IF NOT EXISTS todo_lists (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  UNIQUE(workspace_id, name),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  list_id TEXT,
  parent_todo_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  priority INTEGER NOT NULL DEFAULT 4,
  due_date TEXT,
  due_time TEXT,
  deadline_date TEXT,
  recurrence_rule TEXT,
  scheduled_for TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  source_kind TEXT NOT NULL DEFAULT 'user',
  source_ref_json TEXT NOT NULL DEFAULT '{}',
  provenance_json TEXT NOT NULL DEFAULT '{}',
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(list_id) REFERENCES todo_lists(id),
  FOREIGN KEY(parent_todo_id) REFERENCES todos(id)
);

CREATE TABLE IF NOT EXISTS todo_labels (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, name),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS todo_label_links (
  todo_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(todo_id, label_id),
  FOREIGN KEY(todo_id) REFERENCES todos(id),
  FOREIGN KEY(label_id) REFERENCES todo_labels(id)
);

CREATE TABLE IF NOT EXISTS todo_context_links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  todo_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_title TEXT,
  relation TEXT NOT NULL DEFAULT 'related',
  exact_quote TEXT,
  locator TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(todo_id) REFERENCES todos(id)
);

CREATE TABLE IF NOT EXISTS event_log (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE INDEX IF NOT EXISTS idx_sources_workspace ON sources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_blocks_source ON source_blocks(source_id);
CREATE INDEX IF NOT EXISTS idx_claims_workspace_status ON claims(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_review_workspace_status ON review_items(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_edges_from ON kg_edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON kg_edges(to_node_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_target ON embeddings(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_space ON embeddings(workspace_id, target_type, provider, model, dimensions);
CREATE INDEX IF NOT EXISTS idx_ai_bindings_workspace ON ai_capability_bindings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_runs_workspace_created ON ai_model_runs(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_runs_capability_status ON ai_model_runs(capability, status);
CREATE INDEX IF NOT EXISTS idx_ai_installed_workspace ON ai_installed_models(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_downloads_workspace_state ON ai_model_downloads(workspace_id, state);
CREATE INDEX IF NOT EXISTS idx_ai_runtime_installs_workspace ON ai_runtime_installs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_release_workspaces_workspace ON ai_registry_release_workspaces(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audio_assets_workspace_created ON audio_assets(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transcript_segments_audio ON transcript_segments(audio_asset_id);
CREATE INDEX IF NOT EXISTS idx_speech_assets_workspace_hash ON speech_assets(workspace_id, text_hash);
CREATE INDEX IF NOT EXISTS idx_jobs_workspace_status ON lab_jobs(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_capsules_workspace ON capsules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_capsules_workspace_status ON capsules(workspace_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_capsules_workspace_slug ON capsules(workspace_id, slug);
CREATE INDEX IF NOT EXISTS idx_capsule_items_capsule ON capsule_items(capsule_id);
CREATE INDEX IF NOT EXISTS idx_capsule_items_target ON capsule_items(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_capsule_items_capsule_target ON capsule_items(capsule_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_capsule_items_status ON capsule_items(capsule_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_capsule_items_unique_active ON capsule_items(capsule_id, target_type, target_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_capsule_versions_capsule ON capsule_versions(capsule_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_capsule_versions_unique ON capsule_versions(capsule_id, version);
CREATE INDEX IF NOT EXISTS idx_capsule_health_capsule_created ON capsule_health_snapshots(capsule_id, created_at);
CREATE INDEX IF NOT EXISTS idx_todos_workspace_status_due ON todos(workspace_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_todos_workspace_list ON todos(workspace_id, list_id, status);
CREATE INDEX IF NOT EXISTS idx_todo_context_links_target ON todo_context_links(workspace_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_event_log_workspace_created ON event_log(workspace_id, created_at);
"""
