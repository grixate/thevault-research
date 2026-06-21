export type Health = {
  ok: boolean;
  version: string;
  db_ready: boolean;
  workspace_id: string;
};

export type Stats = {
  sources: number;
  source_blocks: number;
  notes: number;
  claims: number;
  claims_without_evidence: number;
  contradicted_claims: number;
  pending_review_items: number;
  generated_notes_pending_review: number;
  installed_tools: number;
  capsules: number;
  open_todos?: number;
  due_todos?: number;
  failed_jobs: number;
  learning_items: number;
};

export type LabJob = {
  id: string;
  job_type: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | string;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
};

export type Note = {
  id: string;
  title: string;
  content?: Record<string, unknown>;
  content_markdown: string;
  origin: string;
  status: string;
  version: number;
  source_id: string;
  updated_at: string;
};

export type NoteVersion = {
  id: string;
  note_id: string;
  version: number;
  content?: Record<string, unknown>;
  content_markdown: string;
  created_by: string;
  created_at: string;
};

export type Source = {
  id: string;
  type: string;
  title: string;
  content_hash?: string;
  raw_path?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SourceBlock = {
  id: string;
  source_id: string;
  block_index: number;
  locator?: string;
  heading_path?: string;
  text: string;
};

export type SourcePipelineStage = {
  id: "imported" | "chunked" | "indexed" | "review" | "knowledge";
  label: string;
  status: "done" | "ready" | "pending" | "blocked";
  detail: string;
  action_label?: string | null;
  action_route?: string | null;
};

export type SourcePipeline = {
  source_id: string;
  source_title: string;
  source_type: string;
  source_status: string;
  block_count: number;
  embedded_block_count: number;
  pending_review_items: number;
  needs_edit_review_items: number;
  approved_review_items: number;
  rejected_review_items: number;
  quarantined_items: number;
  approved_claims: number;
  evidence_links: number;
  latest_extraction_job?: {
    id: string;
    status: string;
    created_at: string;
    finished_at?: string | null;
    created_review_items: number;
    quarantined_items: number;
    error?: string | null;
  } | null;
  stages: SourcePipelineStage[];
};

export type ReviewItem = {
  id: string;
  item_type: string;
  title: string;
  summary?: string;
  payload?: Record<string, any>;
  status: string;
  created_by_job_id?: string | null;
  created_at: string;
};

export type Claim = {
  id: string;
  node_id: string;
  title: string;
  normalized_text: string;
  status: string;
  confidence: number;
  evidence_strength: number;
};

export type KnowledgeNode = {
  id: string;
  node_type: string;
  title: string;
  canonical_text?: string | null;
  status: string;
  confidence?: number | null;
  payload?: Record<string, any>;
  updated_at: string;
};

export type Tool = {
  id: string;
  name: string;
  slug: string;
  version: string;
  status: string;
  manifest?: Record<string, any>;
};

export type LearningItem = {
  id: string;
  type: string;
  title: string;
  body?: Record<string, any>;
  status: string;
};

export type TodoContextLink = {
  id: string;
  todo_id: string;
  target_type: string;
  target_id: string;
  target_title?: string | null;
  relation: string;
  exact_quote?: string | null;
  locator?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
};

export type TodoItem = {
  id: string;
  parent_todo_id?: string | null;
  title: string;
  description: string;
  status: string;
  priority: number;
  due_date?: string | null;
  due_time?: string | null;
  recurrence_rule?: string | null;
  list_id?: string | null;
  list_name?: string | null;
  labels: string[];
  context_links: TodoContextLink[];
  source_kind: string;
  source_ref?: Record<string, any>;
  provenance?: Record<string, any>;
  subtasks?: TodoItem[];
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
};

export type TodoList = {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  status: string;
  open_count: number;
};

export type TodoListResponse = {
  items: TodoItem[];
  total: number;
  view: string;
};

export type CapsuleHealth = {
  score: number;
  status: string;
  warnings: string[];
  counts?: Record<string, number>;
};

export type CapsuleCounts = {
  sources: number;
  notes: number;
  claims: number;
  concepts: number;
  tools: number;
};

export type CapsuleTargetSummary = {
  id: string;
  type: string;
  title: string;
  missing?: boolean;
};

export type CapsuleItem = {
  id: string;
  capsule_id: string;
  target_type: string;
  target_id: string;
  role: string;
  include_mode: string;
  status: string;
  export_policy?: string | null;
  private_flag: number | boolean;
  created_at: string;
  target?: CapsuleTargetSummary;
};

export type CapsuleDependency = {
  id: string;
  capsule_id: string;
  dependency_type: string;
  target_capsule_id?: string | null;
  target_capsule_name?: string | null;
  target_capsule_slug?: string | null;
  target_capsule_version?: string | null;
  version_constraint?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
};

export type Capsule = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  purpose?: string | null;
  capsule_type: string;
  status: string;
  version: string;
  language?: string | null;
  domains: string[];
  tags: string[];
  epistemic_strictness: string;
  default_source_policy: string;
  updated_at: string;
  counts: CapsuleCounts;
  health: CapsuleHealth;
  items?: CapsuleItem[];
  versions?: Array<{ id: string; version: string; title?: string | null; changelog?: string | null; created_at: string }>;
  dependencies?: CapsuleDependency[];
  activity?: Array<Record<string, any>>;
  key_claims?: Claim[];
  core_concepts?: Array<Record<string, any>>;
};

export type CapsuleListResponse = {
  items: Capsule[];
  total: number;
};

export type CapsuleExportReport = {
  status: "ready" | "blocked" | string;
  export_mode: string;
  private_item_count: number;
  full_source_private_count: number;
  disabled_tool_count: number;
  unsupported_claim_count: number;
  exact_quote_count: number;
  estimated_record_count: number;
  checksum_status: string;
  warnings: Array<{ code: string; count?: number; message: string }>;
  blockers: Array<{ code: string; count?: number; message: string }>;
};

export type CapsuleExportPreview = {
  capsule_id: string;
  export_mode: string;
  status: "ready" | "blocked" | string;
  filename: string;
  export_scope?: Record<string, any>;
  manifest: Record<string, any>;
  privacy_report: CapsuleExportReport;
  validation_report: Record<string, any>;
};

export type CapsuleExportResult = CapsuleExportPreview & {
  export_id: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  created_at: string;
};

export type CapsuleExportHistoryItem = {
  id: string;
  capsule_id: string;
  export_mode: string;
  status: string;
  file_path?: string | null;
  file_size_bytes?: number | null;
  size_bytes?: number;
  sha256?: string | null;
  filename?: string;
  error?: string | null;
  manifest: Record<string, any>;
  privacy_report: Record<string, any>;
  validation_report: Record<string, any>;
  warnings: Array<{ code?: string; message?: string } | string>;
  created_at: string;
  finished_at?: string | null;
};

export type CapsuleExportListResponse = {
  items: CapsuleExportHistoryItem[];
  total: number;
};

export type CapsuleVersionDiff = {
  capsule_id: string;
  from: { id: string; version: string; title?: string | null; changelog?: string | null; created_at: string };
  to: { id: string; version: string; title?: string | null; changelog?: string | null; created_at: string };
  counts: { added: number; removed: number; changed: number };
  added: CapsuleVersionDiffItem[];
  removed: CapsuleVersionDiffItem[];
  changed: Array<{ key: string; before: CapsuleVersionDiffItem; after: CapsuleVersionDiffItem; changes: Record<string, { from: unknown; to: unknown }> }>;
};

export type CapsuleVersionDiffItem = {
  target_type?: string;
  target_id?: string;
  role?: string;
  include_mode?: string;
  status?: string;
  export_policy?: string | null;
  private_flag?: number | boolean;
};

export type CapsuleImportResult = {
  import_id: string;
  status: "quarantined" | "invalid" | string;
  source_file_path: string;
  quarantine_path: string;
  manifest: Record<string, any>;
  validation_report: Record<string, any>;
  merge_plan: Record<string, any>;
  warnings: Array<{ code?: string; message?: string } | string>;
  created_at: string;
};

export type CapsuleImportListResponse = {
  items: CapsuleImportResult[];
  total: number;
};

export type CapsuleImportReviewItemsResult = {
  import_id: string;
  status: "review_ready" | string;
  created_review_items: number;
  skipped_duplicates: number;
  review_item_ids: string[];
  merge_plan: Record<string, any>;
};

export type CapsuleOverviewNoteResult = {
  capsule_id: string;
  note_id: string;
  status: "generated_pending_review" | string;
  warnings: string[];
  citations: Record<string, any>[];
  ai_run_id: string;
  output_hash: string;
  provider: string;
  model_id: string;
  sent_off_device: boolean;
  attached: {
    added: number;
    skipped_duplicates: number;
    auto_included: Record<string, string>[];
  };
};

export type CapsuleLearningGenerateResult = {
  capsule_id: string;
  review_item_id: string;
  items: Record<string, any>[];
  cards: Record<string, any>[];
  status: "pending_review" | string;
  source_policy: string;
  warnings: string[];
};

export type AIProviderInfo = {
  id: string;
  display_name: string;
  kind: "llm" | "embedding" | "reranker" | "stt" | "tts";
  locality: "local" | "cloud" | "external_local";
  enabled: boolean;
  configured: boolean;
  privacy_label: string;
};

export type AIReadinessCheck = {
  id: string;
  label: string;
  status: "pass" | "pending" | "blocked" | "warn";
  detail: string;
  action?: string | null;
};

export type AIReadinessSummary = {
  total_checks: number;
  pass_count: number;
  warn_count: number;
  pending_count: number;
  blocked_count: number;
  production_pack_count: number;
  ready_production_pack_count: number;
  production_runtime_count: number;
  ready_production_runtime_count: number;
};

export type AIReadinessReportSection = {
  id: string;
  title: string;
  status: "ready" | "warn" | "pending" | "blocked";
  summary: string;
  blocked_count: number;
  checks: AIReadinessCheck[];
};

export type AIReadinessApprovalItem = {
  id: string;
  category: "model_pack" | "runtime" | "privacy" | "capability_route";
  title: string;
  blocker_count: number;
  next_action: string;
  check_ids: string[];
  sample_details: string[];
};

export type AIProductionReadinessReport = {
  generated_at: string;
  status: "ready" | "warn" | "blocked";
  production_ready: boolean;
  demo_available: boolean;
  recommended_profile: "tiny" | "standard" | "strong";
  recommended_pack_id?: string | null;
  summary: AIReadinessSummary;
  sections: AIReadinessReportSection[];
  next_actions: string[];
  approval_items: AIReadinessApprovalItem[];
};

export type AIProductionReadinessExport = {
  generated_at: string;
  filename: string;
  mime_type: "text/markdown";
  markdown: string;
  report: AIProductionReadinessReport;
};

export type AIApprovalTemplateExport = {
  generated_at: string;
  filename: string;
  mime_type: "text/markdown";
  markdown: string;
  report: {
    generated_at: string;
    status: "ready" | "pending";
    artifact_count: number;
    pending_field_count: number;
    artifacts: Array<{
      type: "model" | "runtime";
      id: string;
      display_name: string;
      field_count: number;
      pending_field_count: number;
    }>;
    next_actions: string[];
  };
  evidence_filename: string;
  evidence_mime_type: "application/json";
  evidence_json: string;
  evidence: Record<string, unknown>;
  model_registry_label?: string | null;
  runtime_registry_label?: string | null;
};

export type AIApprovalTemplateEvaluateInput = {
  model_registry?: Record<string, unknown> | null;
  runtime_registry?: Record<string, unknown> | null;
  model_registry_label?: string | null;
  runtime_registry_label?: string | null;
};

export type AIRegistryValidationReport = {
  status: "pass" | "fail";
  summary: {
    model_count: number;
    model_pack_count: number;
    runtime_count: number;
    error_count: number;
    warning_count: number;
  };
  policy: {
    status: "pass" | "fail" | "missing" | "skipped";
    path: string;
    actual?: Record<string, unknown> | null;
    expected?: Record<string, unknown> | null;
  };
  errors: string[];
  warnings: string[];
};

export type AIRegistryReleasePlanSummary = {
  status: "ready_to_pin" | "blocked";
  ready_to_pin: boolean;
  total_checks: number;
  blocked_count: number;
  artifact_warning_count: number;
  warning_count: number;
  validation_error_count: number;
  validation_warning_count: number;
  production_pack_count: number;
  ready_production_pack_count: number;
  production_model_count: number;
  ready_production_model_count: number;
  production_runtime_count: number;
  ready_production_runtime_count: number;
};

export type AIRegistryReleasePlanArtifact = {
  type: "model_pack" | "model" | "runtime";
  id: string;
  display_name: string;
  status: "ready" | "warn" | "blocked";
  blocked_count: number;
  warning_count: number;
  readiness_checks: AIReadinessCheck[];
  runtime_name?: string | null;
};

export type AIRegistryPromotionStage = {
  id:
    | "manifest-evidence"
    | "metadata-hydration"
    | "source-probe"
    | "byte-verification"
    | "evidence-overlay"
    | "pin-handoff"
    | "final-pin"
    | "readiness-gate";
  title: string;
  status: "done" | "active" | "blocked" | "pending";
  detail: string;
  action: string;
};

export type AIRegistryPinPreviewChangeSet = {
  artifact_type: "model" | "model_pack" | "runtime";
  added: string[];
  changed: string[];
  removed: string[];
  unchanged: string[];
};

export type AIRegistryPinPreviewRegistry = {
  registry: "model_registry" | "runtime_registry";
  path: string;
  current_sha256: string;
  candidate_sha256: string;
  changed: boolean;
  total_added: number;
  total_changed: number;
  total_removed: number;
  changes: AIRegistryPinPreviewChangeSet[];
};

export type AIRegistryPinPreview = {
  registries: AIRegistryPinPreviewRegistry[];
  total_added: number;
  total_changed: number;
  total_removed: number;
};

export type AIRegistryReleasePlanReport = {
  status: "ready_to_pin" | "blocked";
  summary: AIRegistryReleasePlanSummary;
  validation: AIRegistryValidationReport;
  artifacts: AIRegistryReleasePlanArtifact[];
  promotion_stages: AIRegistryPromotionStage[];
  next_actions: string[];
  pin_preview?: AIRegistryPinPreview | null;
};

export type AIRegistryReleasePlanEvaluateInput = {
  model_registry?: Record<string, unknown> | null;
  runtime_registry?: Record<string, unknown> | null;
  model_registry_label?: string | null;
  runtime_registry_label?: string | null;
  model_registry_sha256?: string | null;
  runtime_registry_sha256?: string | null;
};

export type AIRegistryReleasePlanExport = {
  generated_at: string;
  filename: string;
  mime_type: "text/markdown";
  markdown: string;
  plan: AIRegistryReleasePlanReport;
  model_registry_label?: string | null;
  runtime_registry_label?: string | null;
};

export type AIRegistryMetadataHydrationInput = {
  model_registry: Record<string, unknown>;
  runtime_registry?: Record<string, unknown> | null;
  model_registry_label?: string | null;
  runtime_registry_label?: string | null;
  model_ids?: string[];
  revision?: string;
  refresh?: boolean;
  timeout_seconds?: number;
};

export type AIRegistryMetadataHydrationExport = {
  generated_at: string;
  status: "hydrated" | "blocked";
  filename: string;
  mime_type: "application/json";
  model_registry: Record<string, unknown>;
  model_registry_json: string;
  model_registry_sha256: string;
  summary: {
    model_count: number;
    updated_field_count: number;
    warning_count: number;
    error_count: number;
    skipped_count: number;
  };
  updates: Array<{ model_id: string; field: string; old_value?: unknown; new_value?: unknown }>;
  warnings: string[];
  errors: string[];
  skipped: Array<Record<string, string>>;
  release_plan?: AIRegistryReleasePlanReport | null;
  release_plan_markdown?: string | null;
  model_registry_label?: string | null;
  runtime_registry_label?: string | null;
};

export type AIRegistryArtifactProbeSummary = {
  status: "pass" | "warn" | "blocked";
  artifact_count: number;
  check_count: number;
  pass_count: number;
  warn_count: number;
  pending_count: number;
  blocked_count: number;
  validation_error_count: number;
  validation_warning_count: number;
};

export type AIRegistryArtifactProbeArtifact = {
  type: "model" | "runtime";
  id: string;
  display_name: string;
  source_type?: string | null;
  status: "pass" | "warn" | "blocked";
  checks: AIReadinessCheck[];
  runtime_name?: string | null;
};

export type AIRegistryArtifactProbeReport = {
  generated_at: string;
  status: "pass" | "warn" | "blocked";
  summary: AIRegistryArtifactProbeSummary;
  validation: AIRegistryValidationReport;
  artifacts: AIRegistryArtifactProbeArtifact[];
  next_actions: string[];
};

export type AIRegistryArtifactProbeExport = {
  generated_at: string;
  filename: string;
  mime_type: "text/markdown";
  markdown: string;
  report: AIRegistryArtifactProbeReport;
  model_registry_label?: string | null;
  runtime_registry_label?: string | null;
};

export type AIRegistryArtifactVerificationSummary = {
  status: "pass" | "warn" | "blocked";
  artifact_count: number;
  file_count: number;
  verified_file_count: number;
  check_count: number;
  pass_count: number;
  warn_count: number;
  pending_count: number;
  blocked_count: number;
  validation_error_count: number;
  validation_warning_count: number;
  evidence_model_count: number;
  evidence_runtime_count: number;
  max_bytes: number;
};

export type AIRegistryArtifactVerificationFile = {
  filename: string;
  status: "pass" | "warn" | "blocked";
  size_bytes?: number | null;
  sha256?: string | null;
  checks: AIReadinessCheck[];
};

export type AIRegistryArtifactVerificationArtifact = {
  type: "model" | "runtime";
  id: string;
  display_name: string;
  source_type?: string | null;
  status: "pass" | "warn" | "blocked";
  files: AIRegistryArtifactVerificationFile[];
};

export type AIRegistryArtifactVerificationReport = {
  generated_at: string;
  status: "pass" | "warn" | "blocked";
  summary: AIRegistryArtifactVerificationSummary;
  validation: AIRegistryValidationReport;
  artifacts: AIRegistryArtifactVerificationArtifact[];
  evidence: Record<string, unknown>;
  next_actions: string[];
};

export type AIRegistryArtifactVerificationExport = {
  generated_at: string;
  filename: string;
  mime_type: "text/markdown";
  markdown: string;
  evidence_filename: string;
  evidence_mime_type: "application/json";
  evidence_json: string;
  report: AIRegistryArtifactVerificationReport;
  model_registry_label?: string | null;
  runtime_registry_label?: string | null;
};

export type AIRegistryEvidenceOverlayInput = {
  model_registry?: Record<string, unknown> | null;
  runtime_registry?: Record<string, unknown> | null;
  evidence: Record<string, unknown>;
  model_registry_label?: string | null;
  runtime_registry_label?: string | null;
  evidence_label?: string | null;
};

export type AIRegistryEvidenceOverlayExport = {
  generated_at: string;
  status: "applied" | "invalid";
  filename: string;
  mime_type: "application/json";
  bundle_json: string;
  applied_count: number;
  applied_fields: Array<{ type: "model" | "runtime"; id: string; path: string }>;
  errors: string[];
  warnings: string[];
  model_registry: Record<string, unknown>;
  runtime_registry: Record<string, unknown>;
  model_registry_filename: string;
  runtime_registry_filename: string;
  model_registry_json: string;
  runtime_registry_json: string;
  patched_model_registry_sha256: string;
  patched_runtime_registry_sha256: string;
  release_plan_filename: string;
  release_plan_mime_type: "text/markdown";
  approval_template_filename: string;
  approval_template_mime_type: "text/markdown";
  pin_handoff_filename: string;
  pin_handoff_mime_type: "text/markdown";
  validation: AIRegistryValidationReport;
  release_plan: AIRegistryReleasePlanReport;
  approval_template: AIApprovalTemplateExport["report"];
  pin_handoff: Record<string, unknown>;
  release_plan_markdown: string;
  approval_template_markdown: string;
  pin_handoff_markdown: string;
  model_registry_label?: string | null;
  runtime_registry_label?: string | null;
  evidence_label?: string | null;
};

export type AIRegistryReleasePacketArtifact = {
  type: string;
  filename: string;
  path: string;
  bytes: number;
};

export type AIRegistryReleasePacketPrepareInput = {
  candidate_evidence?: AIRegistryEvidenceOverlayExport | null;
  probe_sources?: boolean;
  probe_timeout_seconds?: number;
  verify_bytes?: boolean;
  verify_timeout_seconds?: number;
  verify_max_bytes?: number;
  packet_name?: string | null;
};

export type AIRegistryReleasePacket = {
  status: "ready_to_pin" | "blocked";
  ready_to_pin: boolean;
  output_dir: string;
  generated_at: string;
  applied_count: number;
  patched_model_registry_sha256: string;
  patched_runtime_registry_sha256: string;
  release_plan: Record<string, unknown>;
  acceptance: Record<string, unknown>;
  artifact_probe: Record<string, unknown>;
  artifact_verification: Record<string, unknown>;
  artifacts: AIRegistryReleasePacketArtifact[];
  next_actions: string[];
  errors: string[];
  warnings: string[];
};

export type AIRegistryReleaseWorkspaceSaveInput = {
  candidate_payload?: AIRegistryReleasePlanEvaluateInput | null;
  candidate_release_plan?: AIRegistryReleasePlanExport | null;
  candidate_metadata_hydration?: AIRegistryMetadataHydrationExport | null;
  candidate_artifact_probe?: AIRegistryArtifactProbeExport | null;
  candidate_artifact_verification?: AIRegistryArtifactVerificationExport | null;
  candidate_evidence?: AIRegistryEvidenceOverlayExport | null;
  candidate_release_packet?: AIRegistryReleasePacket | null;
  candidate_status?: string | null;
};

export type AIRegistryReleaseWorkspace = AIRegistryReleaseWorkspaceSaveInput & {
  schema_version: number;
  has_workspace: boolean;
  updated_at?: string | null;
  error?: string | null;
};

export type SelectedRegistryFile = {
  filePath: string;
  filename: string;
  contents: string;
};

export type AIModelInfo = {
  id: string;
  display_name: string;
  kind: "llm" | "embedding" | "reranker" | "stt" | "tts";
  installed: boolean;
  download_state: string;
  capabilities: string[];
  downloadable: boolean;
  size_bytes?: number | null;
  disk_path?: string | null;
  license_label?: string | null;
  license_url?: string | null;
  license_path?: string | null;
  recommended_profile: string;
  runtime?: string | null;
  format?: string | null;
  source_type?: string | null;
  trust_level?: string | null;
  runtime_tested: boolean;
  readiness_checks: AIReadinessCheck[];
};

export type AIModelPackInfo = {
  id: string;
  display_name: string;
  profile: "tiny" | "standard" | "strong";
  release_channel: "demo" | "production";
  release_status: "demo_ready" | "ready" | "blocked" | "installed";
  description: string;
  privacy_label: string;
  model_ids: string[];
  required_model_ids: string[];
  optional_model_ids: string[];
  capabilities: string[];
  disk_bytes?: number | null;
  installed_model_ids: string[];
  missing_model_ids: string[];
  downloadable_model_ids: string[];
  blocked_reasons: string[];
  installable: boolean;
  installed: boolean;
  readiness_checks: AIReadinessCheck[];
};

export type AISetupStepInfo = {
  id: "privacy" | "hardware" | "runtime" | "production_pack" | "demo_fallback" | "capability_routes";
  title: string;
  status: "done" | "ready" | "blocked" | "optional";
  summary: string;
  detail?: string | null;
  action_label?: string | null;
  action_route?: string | null;
  action_payload: Record<string, unknown>;
};

export type AISetupStatus = {
  mode: "local_only";
  overall_status: "ready" | "demo_ready" | "blocked" | "not_started";
  recommended_profile: "tiny" | "standard" | "strong";
  recommended_pack_id?: string | null;
  demo_pack_id?: string | null;
  privacy_label: string;
  next_action: string;
  can_use_demo: boolean;
  blocked_reasons: string[];
  steps: AISetupStepInfo[];
};

export type AISetupRunStep = {
  id: string;
  title: string;
  status: "done" | "queued" | "skipped" | "blocked" | "failed";
  detail?: string | null;
  runtime_id?: string | null;
  model_id?: string | null;
  capability?: string | null;
};

export type AISetupRunResult = {
  mode: "demo" | "recommended";
  pack_id: string;
  release_channel: "demo" | "production";
  status: "ready" | "demo_ready" | "partial" | "blocked" | "failed";
  selected_capabilities: string[];
  downloads: Array<Record<string, unknown>>;
  steps: AISetupRunStep[];
  setup: AISetupStatus;
};

export type AISetupRunInput = {
  mode: "demo" | "recommended";
  pack_id?: string;
  include_optional_models?: boolean;
};

export type AIRuntimeInfo = {
  id: string;
  display_name: string;
  runtime: "llama_cpp" | "whisper_cpp" | "piper";
  release_channel: "demo" | "production";
  version?: string | null;
  platform: string;
  arch: string;
  compatible: boolean;
  host_platform?: string | null;
  host_arch?: string | null;
  compatibility_error?: string | null;
  binary_name: string;
  installed: boolean;
  install_state: "not_installed" | "installed" | "failed";
  installable: boolean;
  source_type?: string | null;
  binary_path?: string | null;
  size_bytes?: number | null;
  sha256?: string | null;
  sha256_actual?: string | null;
  integrity_status: "unknown" | "verified" | "missing" | "mismatch" | "failed";
  integrity_error?: string | null;
  license_label?: string | null;
  license_url?: string | null;
  license_path?: string | null;
  blocked_reasons: string[];
  readiness_checks: AIReadinessCheck[];
  install_log: Array<{
    created_at?: string;
    action?: string;
    status?: string;
    detail?: string;
    [key: string]: unknown;
  }>;
};

export type RuntimeBinaryStatus = {
  configured: boolean;
  path?: string | null;
  source: "env" | "app_data" | "path" | "missing";
  version?: string | null;
  error?: string | null;
  managed_runtime_id?: string | null;
  integrity_status: "unknown" | "verified" | "missing" | "mismatch" | "failed";
  sha256_expected?: string | null;
  sha256_actual?: string | null;
};

export type RuntimeInstalledModel = {
  model_id: string;
  display_name: string;
  kind: string;
  runtime: string;
  format: string;
  file_path?: string | null;
  verified_at?: string | null;
  status: string;
  size_bytes?: number | null;
  fixture_only: boolean;
};

export type RuntimeHealth = {
  llama_cpp: {
    runtime: "llama_cpp";
    state: "ready" | "degraded" | "not_configured" | "no_installed_model";
    runtime_dir: string;
    cli: RuntimeBinaryStatus;
    server: RuntimeBinaryStatus;
    server_process?: {
      state: "running" | "stopped" | "exited" | string;
      pid?: number | null;
      exit_code?: number | null;
      model_id?: string | null;
      endpoint?: string | null;
      mode?: string | null;
      started_at?: string | null;
      log_path?: string | null;
      recent_logs?: string;
    };
    installed_models: RuntimeInstalledModel[];
    warnings: string[];
    next_actions: string[];
  };
  voice: Record<string, unknown>;
};

export type CapabilityBinding = {
  capability: string;
  provider_id: string;
  model_id?: string | null;
  local_only: boolean;
  settings: Record<string, unknown>;
};

export type HardwareProfile = {
  os: "macos" | "windows" | "linux";
  arch: "arm64" | "x64" | "unknown";
  cpu_brand?: string | null;
  physical_ram_gb?: number | null;
  available_ram_gb?: number | null;
  apple_silicon: boolean;
  metal_available: boolean;
  cuda_available: boolean;
  rocm_available: boolean;
  vulkan_available: boolean;
  recommended_profile: "tiny" | "standard" | "strong";
  warnings: string[];
};

export type AIModelRun = {
  id: string;
  created_at: string;
  completed_at?: string;
  provider: string;
  model_id: string;
  capability: string;
  status: string;
  validation_status?: string;
  local_only: number;
  sent_off_device: number;
};

export type AIModelDownload = {
  id: string;
  model_id: string;
  state: string;
  bytes_total?: number | null;
  bytes_downloaded: number;
  sha256_expected?: string | null;
  sha256_actual?: string | null;
  error?: string | null;
  target_path?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
};

export type AIModelTestResult = {
  model_id: string;
  runtime?: string;
  status: string;
  message: string;
  run_id?: string;
  exit_code?: number | null;
};

export type AIModelImportResult = {
  model_id: string;
  display_name: string;
  status: string;
  runtime: string;
  format: string;
  file_path: string;
  sha256: string;
  size_bytes: number;
};

export type VaultApi = {
  request: <T = unknown>(route: string, payload?: unknown) => Promise<T>;
  selectFiles: () => Promise<string[]>;
  selectAudioFiles?: () => Promise<string[]>;
  selectModelFiles?: () => Promise<string[]>;
  selectRegistryFiles?: () => Promise<SelectedRegistryFile[]>;
  saveAudioRecording?: (input: { data: ArrayBuffer; mimeType?: string }) => Promise<{ filePath: string; mimeType: string; sizeBytes: number }>;
  saveTextFile?: (input: { filename: string; contents: string; mimeType?: string }) => Promise<{ saved: boolean; filePath?: string | null; mimeType?: string; sizeBytes?: number }>;
  onQuickNote?: (callback: () => void) => () => void;
  onQuickTask?: (callback: () => void) => () => void;
  onAddSource?: (callback: () => void) => () => void;
  onFocusSearch?: (callback: () => void) => () => void;
};

declare global {
  interface Window {
    vault?: VaultApi;
  }
}
