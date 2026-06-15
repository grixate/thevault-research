from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    ok: bool
    version: str
    db_ready: bool
    workspace_id: str


class NoteCreate(BaseModel):
    title: str = Field(min_length=1)
    content_json: dict[str, Any] = Field(default_factory=dict)
    content_markdown: str = ""
    origin: str = "user_written"


class NoteUpdate(BaseModel):
    title: str | None = None
    content_json: dict[str, Any] | None = None
    content_markdown: str | None = None
    status: str | None = None


class GeneratedNoteRequest(BaseModel):
    mode: str = "research_memo"
    title: str
    prompt: str
    source_ids: list[str] = Field(default_factory=list)
    claim_ids: list[str] = Field(default_factory=list)
    citation_policy: str = "require_evidence_for_factual_claims"
    local_only: bool = True
    max_tokens: int = 1200


class GeneratedNoteReviewPrepareRequest(BaseModel):
    force: bool = False
    extract: list[str] = Field(default_factory=lambda: ["claims"])


class ImportTextRequest(BaseModel):
    title: str
    type: str = "text"
    text: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class ImportFileRequest(BaseModel):
    file_path: str
    title: str | None = None
    type: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SourcePipelineStage(BaseModel):
    id: Literal["imported", "chunked", "indexed", "review", "knowledge"]
    label: str
    status: Literal["done", "ready", "pending", "blocked"]
    detail: str
    action_label: str | None = None
    action_route: str | None = None


class SourcePipelineJob(BaseModel):
    id: str
    status: str
    created_at: str
    finished_at: str | None = None
    created_review_items: int = 0
    quarantined_items: int = 0
    error: str | None = None


class SourcePipelineResponse(BaseModel):
    source_id: str
    source_title: str
    source_type: str
    source_status: str
    block_count: int = 0
    embedded_block_count: int = 0
    pending_review_items: int = 0
    needs_edit_review_items: int = 0
    approved_review_items: int = 0
    rejected_review_items: int = 0
    quarantined_items: int = 0
    approved_claims: int = 0
    evidence_links: int = 0
    latest_extraction_job: SourcePipelineJob | None = None
    stages: list[SourcePipelineStage] = Field(default_factory=list)


class SearchRequest(BaseModel):
    query: str
    modes: list[str] = Field(default_factory=lambda: ["fts"])
    limit: int = 20
    filters: dict[str, Any] = Field(default_factory=dict)


class EmbeddingReindexRequest(BaseModel):
    source_ids: list[str] = Field(default_factory=list)
    auto_start: bool = True


class ExtractionRunRequest(BaseModel):
    target_type: Literal["source", "source_block", "note"]
    target_id: str
    extract: list[str] = Field(default_factory=lambda: ["claims", "concepts"])
    mode: str = "review_required"


class DecisionRequest(BaseModel):
    decision_note: str | None = None
    edits: dict[str, Any] = Field(default_factory=dict)


class BulkReviewRequest(BaseModel):
    action: Literal["approve", "reject"]
    item_ids: list[str] = Field(min_length=1)
    decision_note: str | None = None


class AssistantAskRequest(BaseModel):
    question: str
    scope: dict[str, Any] = Field(default_factory=dict)
    answer_style: str = "concise_research_memo"
    require_citations: bool = True


class NightLabRequest(BaseModel):
    mode: str = "manual"
    tasks: list[str] = Field(default_factory=list)
    autonomy_level: int = 2


class CapsuleCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    purpose: str | None = None
    capsule_type: str = "domain"
    language: str | None = None
    domains: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    epistemic_strictness: str = "balanced"
    default_source_policy: str = "reference_only"
    metadata: dict[str, Any] = Field(default_factory=dict)


class CapsuleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    purpose: str | None = None
    capsule_type: str | None = None
    status: str | None = None
    language: str | None = None
    domains: list[str] | None = None
    tags: list[str] | None = None
    epistemic_strictness: str | None = None
    default_source_policy: str | None = None


class CapsuleItemCreate(BaseModel):
    target_type: str
    target_id: str
    role: str = "supporting"
    include_mode: str = "reference"
    export_policy: str | None = None
    private_flag: bool = False
    auto_include_evidence: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


class CapsuleItemsAddRequest(BaseModel):
    items: list[CapsuleItemCreate] = Field(min_length=1)


class CapsuleSnapshotRequest(BaseModel):
    version: str = Field(min_length=1)
    title: str | None = None
    changelog: str | None = None


class CapsuleExportRequest(BaseModel):
    export_mode: str = "reference_only"


class CapsuleImportRequest(BaseModel):
    file_path: str = Field(min_length=1)
    max_file_count: int = Field(default=5000, ge=1, le=50000)
    max_unpacked_bytes: int = Field(default=500 * 1024 * 1024, ge=1, le=5 * 1024 * 1024 * 1024)


class ToolProposeRequest(BaseModel):
    name: str
    description: str
    permissions: dict[str, Any] = Field(default_factory=dict)


class ToolRunRequest(BaseModel):
    input: dict[str, Any] = Field(default_factory=dict)


class LearningDeckRequest(BaseModel):
    topic: str
    claim_ids: list[str] = Field(default_factory=list)
    deck_size: int = 8


class AIProviderInfo(BaseModel):
    id: str
    display_name: str
    kind: Literal["llm", "embedding", "reranker", "stt", "tts"]
    locality: Literal["local", "cloud", "external_local"]
    enabled: bool
    configured: bool
    privacy_label: str


class AIReadinessCheck(BaseModel):
    id: str
    label: str
    status: Literal["pass", "pending", "blocked", "warn"]
    detail: str
    action: str | None = None


class AIReadinessSummary(BaseModel):
    total_checks: int = 0
    pass_count: int = 0
    warn_count: int = 0
    pending_count: int = 0
    blocked_count: int = 0
    production_pack_count: int = 0
    ready_production_pack_count: int = 0
    production_runtime_count: int = 0
    ready_production_runtime_count: int = 0


class AIReadinessReportSection(BaseModel):
    id: str
    title: str
    status: Literal["ready", "warn", "pending", "blocked"]
    summary: str
    blocked_count: int = 0
    checks: list[AIReadinessCheck] = Field(default_factory=list)


class AIReadinessApprovalItem(BaseModel):
    id: str
    category: Literal["model_pack", "runtime", "privacy", "capability_route"]
    title: str
    blocker_count: int
    next_action: str
    check_ids: list[str] = Field(default_factory=list)
    sample_details: list[str] = Field(default_factory=list)


class AIProductionReadinessReport(BaseModel):
    generated_at: str
    status: Literal["ready", "warn", "blocked"]
    production_ready: bool
    demo_available: bool
    recommended_profile: Literal["tiny", "standard", "strong"]
    recommended_pack_id: str | None = None
    summary: AIReadinessSummary
    sections: list[AIReadinessReportSection]
    next_actions: list[str] = Field(default_factory=list)
    approval_items: list[AIReadinessApprovalItem] = Field(default_factory=list)


class AIProductionReadinessExportResponse(BaseModel):
    generated_at: str
    filename: str
    mime_type: Literal["text/markdown"] = "text/markdown"
    markdown: str
    report: AIProductionReadinessReport


class AIApprovalTemplateField(BaseModel):
    path: str
    label: str
    current_value: Any | None = None
    required_value: Any
    status: Literal["missing", "pending", "present"]
    guidance: str


class AIApprovalTemplateArtifact(BaseModel):
    type: Literal["model", "runtime"]
    id: str
    display_name: str
    field_count: int = 0
    pending_field_count: int = 0
    fields: list[AIApprovalTemplateField] = Field(default_factory=list)


class AIApprovalTemplateReport(BaseModel):
    generated_at: str
    status: Literal["ready", "pending"]
    artifact_count: int = 0
    pending_field_count: int = 0
    artifacts: list[AIApprovalTemplateArtifact] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)


class AIApprovalTemplateEvaluateRequest(BaseModel):
    model_registry: dict[str, Any] | None = None
    runtime_registry: dict[str, Any] | None = None
    model_registry_label: str | None = None
    runtime_registry_label: str | None = None


class AIApprovalTemplateExportResponse(BaseModel):
    generated_at: str
    filename: str
    mime_type: Literal["text/markdown"] = "text/markdown"
    markdown: str
    report: AIApprovalTemplateReport
    evidence_filename: str
    evidence_mime_type: Literal["application/json"] = "application/json"
    evidence_json: str
    evidence: dict[str, Any]
    model_registry_label: str | None = None
    runtime_registry_label: str | None = None


class AIRegistryValidationSummary(BaseModel):
    model_count: int = 0
    model_pack_count: int = 0
    runtime_count: int = 0
    error_count: int = 0
    warning_count: int = 0


class AIRegistryPolicyReport(BaseModel):
    status: Literal["pass", "fail", "missing", "skipped"]
    path: str
    actual: dict[str, Any] | None = None
    expected: dict[str, Any] | None = None


class AIRegistryValidationReport(BaseModel):
    status: Literal["pass", "fail"]
    summary: AIRegistryValidationSummary
    policy: AIRegistryPolicyReport
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class AIRegistryReleasePlanSummary(BaseModel):
    status: Literal["ready_to_pin", "blocked"]
    ready_to_pin: bool
    total_checks: int = 0
    blocked_count: int = 0
    artifact_warning_count: int = 0
    warning_count: int = 0
    validation_error_count: int = 0
    validation_warning_count: int = 0
    production_pack_count: int = 0
    ready_production_pack_count: int = 0
    production_model_count: int = 0
    ready_production_model_count: int = 0
    production_runtime_count: int = 0
    ready_production_runtime_count: int = 0


class AIRegistryReleasePlanArtifact(BaseModel):
    type: Literal["model_pack", "model", "runtime"]
    id: str
    display_name: str
    status: Literal["ready", "warn", "blocked"]
    blocked_count: int = 0
    warning_count: int = 0
    readiness_checks: list[AIReadinessCheck] = Field(default_factory=list)
    runtime_name: str | None = None


class AIRegistryPromotionStage(BaseModel):
    id: Literal[
        "manifest-evidence",
        "metadata-hydration",
        "source-probe",
        "byte-verification",
        "evidence-overlay",
        "pin-handoff",
        "final-pin",
        "readiness-gate",
    ]
    title: str
    status: Literal["done", "active", "blocked", "pending"]
    detail: str
    action: str


class AIRegistryPinPreviewChangeSet(BaseModel):
    artifact_type: Literal["model", "model_pack", "runtime"]
    added: list[str] = Field(default_factory=list)
    changed: list[str] = Field(default_factory=list)
    removed: list[str] = Field(default_factory=list)
    unchanged: list[str] = Field(default_factory=list)


class AIRegistryPinPreviewRegistry(BaseModel):
    registry: Literal["model_registry", "runtime_registry"]
    path: str
    current_sha256: str
    candidate_sha256: str
    changed: bool
    total_added: int = 0
    total_changed: int = 0
    total_removed: int = 0
    changes: list[AIRegistryPinPreviewChangeSet] = Field(default_factory=list)


class AIRegistryPinPreview(BaseModel):
    registries: list[AIRegistryPinPreviewRegistry] = Field(default_factory=list)
    total_added: int = 0
    total_changed: int = 0
    total_removed: int = 0


class AIRegistryReleasePlanReport(BaseModel):
    status: Literal["ready_to_pin", "blocked"]
    summary: AIRegistryReleasePlanSummary
    validation: AIRegistryValidationReport
    artifacts: list[AIRegistryReleasePlanArtifact] = Field(default_factory=list)
    promotion_stages: list[AIRegistryPromotionStage] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)
    pin_preview: AIRegistryPinPreview | None = None


class AIRegistryReleasePlanEvaluateRequest(BaseModel):
    model_registry: dict[str, Any] | None = None
    runtime_registry: dict[str, Any] | None = None
    model_registry_label: str | None = None
    runtime_registry_label: str | None = None
    model_registry_sha256: str | None = Field(default=None, pattern=r"^[a-fA-F0-9]{64}$")
    runtime_registry_sha256: str | None = Field(default=None, pattern=r"^[a-fA-F0-9]{64}$")


class AIRegistryReleasePlanExportResponse(BaseModel):
    generated_at: str
    filename: str
    mime_type: Literal["text/markdown"] = "text/markdown"
    markdown: str
    plan: AIRegistryReleasePlanReport
    model_registry_label: str | None = None
    runtime_registry_label: str | None = None


class AIRegistryMetadataHydrationRequest(BaseModel):
    model_registry: dict[str, Any]
    runtime_registry: dict[str, Any] | None = None
    model_registry_label: str | None = None
    runtime_registry_label: str | None = None
    model_ids: list[str] = Field(default_factory=list)
    revision: str = "main"
    refresh: bool = False
    timeout_seconds: float = Field(default=15, ge=1, le=120)
    api_base_url: str | None = None


class AIRegistryMetadataHydrationSummary(BaseModel):
    model_count: int = 0
    updated_field_count: int = 0
    warning_count: int = 0
    error_count: int = 0
    skipped_count: int = 0


class AIRegistryMetadataHydrationUpdate(BaseModel):
    model_id: str
    field: str
    old_value: Any | None = None
    new_value: Any | None = None


class AIRegistryMetadataHydrationResponse(BaseModel):
    generated_at: str
    status: Literal["hydrated", "blocked"]
    filename: str
    mime_type: Literal["application/json"] = "application/json"
    model_registry: dict[str, Any]
    model_registry_json: str
    model_registry_sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")
    summary: AIRegistryMetadataHydrationSummary
    updates: list[AIRegistryMetadataHydrationUpdate] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    skipped: list[dict[str, str]] = Field(default_factory=list)
    release_plan: AIRegistryReleasePlanReport | None = None
    release_plan_markdown: str | None = None
    model_registry_label: str | None = None
    runtime_registry_label: str | None = None


class AIRegistryArtifactProbeSummary(BaseModel):
    status: Literal["pass", "warn", "blocked"]
    artifact_count: int = 0
    check_count: int = 0
    pass_count: int = 0
    warn_count: int = 0
    pending_count: int = 0
    blocked_count: int = 0
    validation_error_count: int = 0
    validation_warning_count: int = 0


class AIRegistryArtifactProbeArtifact(BaseModel):
    type: Literal["model", "runtime"]
    id: str
    display_name: str
    source_type: str | None = None
    status: Literal["pass", "warn", "blocked"]
    checks: list[AIReadinessCheck] = Field(default_factory=list)
    runtime_name: str | None = None


class AIRegistryArtifactProbeReport(BaseModel):
    generated_at: str
    status: Literal["pass", "warn", "blocked"]
    summary: AIRegistryArtifactProbeSummary
    validation: AIRegistryValidationReport
    artifacts: list[AIRegistryArtifactProbeArtifact] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)


class AIRegistryArtifactProbeEvaluateRequest(BaseModel):
    model_registry: dict[str, Any] | None = None
    runtime_registry: dict[str, Any] | None = None
    model_registry_label: str | None = None
    runtime_registry_label: str | None = None
    timeout_seconds: float = Field(default=10, ge=1, le=120)


class AIRegistryArtifactProbeExportResponse(BaseModel):
    generated_at: str
    filename: str
    mime_type: Literal["text/markdown"] = "text/markdown"
    markdown: str
    report: AIRegistryArtifactProbeReport
    model_registry_label: str | None = None
    runtime_registry_label: str | None = None


class AIRegistryArtifactVerificationSummary(BaseModel):
    status: Literal["pass", "warn", "blocked"]
    artifact_count: int = 0
    file_count: int = 0
    verified_file_count: int = 0
    check_count: int = 0
    pass_count: int = 0
    warn_count: int = 0
    pending_count: int = 0
    blocked_count: int = 0
    validation_error_count: int = 0
    validation_warning_count: int = 0
    evidence_model_count: int = 0
    evidence_runtime_count: int = 0
    max_bytes: int = 0


class AIRegistryArtifactVerificationFile(BaseModel):
    filename: str
    status: Literal["pass", "warn", "blocked"]
    size_bytes: int | None = None
    sha256: str | None = None
    checks: list[AIReadinessCheck] = Field(default_factory=list)


class AIRegistryArtifactVerificationArtifact(BaseModel):
    type: Literal["model", "runtime"]
    id: str
    display_name: str
    source_type: str | None = None
    status: Literal["pass", "warn", "blocked"]
    files: list[AIRegistryArtifactVerificationFile] = Field(default_factory=list)


class AIRegistryArtifactVerificationReport(BaseModel):
    generated_at: str
    status: Literal["pass", "warn", "blocked"]
    summary: AIRegistryArtifactVerificationSummary
    validation: AIRegistryValidationReport
    artifacts: list[AIRegistryArtifactVerificationArtifact] = Field(default_factory=list)
    evidence: dict[str, Any]
    next_actions: list[str] = Field(default_factory=list)


class AIRegistryArtifactVerificationEvaluateRequest(BaseModel):
    model_registry: dict[str, Any] | None = None
    runtime_registry: dict[str, Any] | None = None
    model_registry_label: str | None = None
    runtime_registry_label: str | None = None
    timeout_seconds: float = Field(default=30, ge=1, le=300)
    max_bytes: int = Field(default=10 * 1024 * 1024 * 1024, ge=1)
    artifact_ids: list[str] = Field(default_factory=list)


class AIRegistryArtifactVerificationExportResponse(BaseModel):
    generated_at: str
    filename: str
    mime_type: Literal["text/markdown"] = "text/markdown"
    markdown: str
    evidence_filename: str
    evidence_mime_type: Literal["application/json"] = "application/json"
    evidence_json: str
    report: AIRegistryArtifactVerificationReport
    model_registry_label: str | None = None
    runtime_registry_label: str | None = None


class AIRegistryEvidenceOverlayAppliedField(BaseModel):
    type: Literal["model", "runtime"]
    id: str
    path: str


class AIRegistryEvidenceOverlayRequest(BaseModel):
    model_registry: dict[str, Any] | None = None
    runtime_registry: dict[str, Any] | None = None
    evidence: dict[str, Any]
    model_registry_label: str | None = None
    runtime_registry_label: str | None = None
    evidence_label: str | None = None


class AIRegistryEvidenceOverlayResponse(BaseModel):
    generated_at: str
    status: Literal["applied", "invalid"]
    filename: str
    mime_type: Literal["application/json"] = "application/json"
    bundle_json: str
    applied_count: int = 0
    applied_fields: list[AIRegistryEvidenceOverlayAppliedField] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    model_registry: dict[str, Any]
    runtime_registry: dict[str, Any]
    model_registry_filename: str
    runtime_registry_filename: str
    model_registry_json: str
    runtime_registry_json: str
    patched_model_registry_sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")
    patched_runtime_registry_sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")
    release_plan_filename: str
    release_plan_mime_type: Literal["text/markdown"] = "text/markdown"
    approval_template_filename: str
    approval_template_mime_type: Literal["text/markdown"] = "text/markdown"
    pin_handoff_filename: str
    pin_handoff_mime_type: Literal["text/markdown"] = "text/markdown"
    validation: AIRegistryValidationReport
    release_plan: AIRegistryReleasePlanReport
    approval_template: AIApprovalTemplateReport
    pin_handoff: dict[str, Any]
    release_plan_markdown: str
    approval_template_markdown: str
    pin_handoff_markdown: str
    model_registry_label: str | None = None
    runtime_registry_label: str | None = None
    evidence_label: str | None = None


class AIRegistryReleaseWorkspaceSaveRequest(BaseModel):
    candidate_payload: AIRegistryReleasePlanEvaluateRequest | None = None
    candidate_release_plan: AIRegistryReleasePlanExportResponse | None = None
    candidate_metadata_hydration: AIRegistryMetadataHydrationResponse | None = None
    candidate_artifact_probe: AIRegistryArtifactProbeExportResponse | None = None
    candidate_artifact_verification: AIRegistryArtifactVerificationExportResponse | None = None
    candidate_evidence: AIRegistryEvidenceOverlayResponse | None = None
    candidate_release_packet: AIRegistryReleasePacketPrepareResponse | None = None
    candidate_status: str | None = Field(default=None, max_length=2000)


class AIRegistryReleaseWorkspaceResponse(AIRegistryReleaseWorkspaceSaveRequest):
    schema_version: int = 1
    has_workspace: bool = False
    updated_at: str | None = None
    error: str | None = None


class AIRegistryReleasePacketPrepareRequest(BaseModel):
    candidate_evidence: AIRegistryEvidenceOverlayResponse | None = None
    probe_sources: bool = False
    probe_timeout_seconds: float = Field(default=10, ge=0.1, le=120)
    verify_bytes: bool = False
    verify_timeout_seconds: float = Field(default=30, ge=0.1, le=600)
    verify_max_bytes: int = Field(default=10 * 1024 * 1024 * 1024, ge=1, le=200 * 1024 * 1024 * 1024)
    packet_name: str | None = Field(default=None, max_length=120, pattern=r"^[A-Za-z0-9][A-Za-z0-9._ -]*$")


class AIRegistryReleasePacketArtifact(BaseModel):
    type: str
    filename: str
    path: str
    bytes: int = 0


class AIRegistryReleasePacketPrepareResponse(BaseModel):
    status: Literal["ready_to_pin", "blocked"]
    ready_to_pin: bool
    output_dir: str
    generated_at: str
    applied_count: int = 0
    patched_model_registry_sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")
    patched_runtime_registry_sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")
    release_plan: dict[str, Any]
    acceptance: dict[str, Any]
    artifact_probe: dict[str, Any]
    artifact_verification: dict[str, Any]
    artifacts: list[AIRegistryReleasePacketArtifact] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class AIModelInfo(BaseModel):
    id: str
    display_name: str
    kind: Literal["llm", "embedding", "reranker", "stt", "tts"]
    installed: bool
    download_state: str
    capabilities: list[str]
    downloadable: bool = False
    size_bytes: int | None = None
    disk_path: str | None = None
    license_label: str | None = None
    license_url: str | None = None
    license_path: str | None = None
    recommended_profile: str
    runtime: str | None = None
    format: str | None = None
    source_type: str | None = None
    trust_level: str | None = None
    runtime_tested: bool = False
    readiness_checks: list[AIReadinessCheck] = Field(default_factory=list)


class AIModelPackInfo(BaseModel):
    id: str
    display_name: str
    profile: Literal["tiny", "standard", "strong"]
    release_channel: Literal["demo", "production"] = "production"
    release_status: Literal["demo_ready", "ready", "blocked", "installed"] = "blocked"
    description: str
    privacy_label: str = "Runs on this device"
    model_ids: list[str]
    required_model_ids: list[str]
    optional_model_ids: list[str] = Field(default_factory=list)
    capabilities: list[str]
    disk_bytes: int | None = None
    installed_model_ids: list[str] = Field(default_factory=list)
    missing_model_ids: list[str] = Field(default_factory=list)
    downloadable_model_ids: list[str] = Field(default_factory=list)
    blocked_reasons: list[str] = Field(default_factory=list)
    installable: bool = False
    installed: bool = False
    readiness_checks: list[AIReadinessCheck] = Field(default_factory=list)


class AISetupStepInfo(BaseModel):
    id: Literal["privacy", "hardware", "runtime", "production_pack", "demo_fallback", "capability_routes"]
    title: str
    status: Literal["done", "ready", "blocked", "optional"]
    summary: str
    detail: str | None = None
    action_label: str | None = None
    action_route: str | None = None
    action_payload: dict[str, Any] = Field(default_factory=dict)


class AISetupStatusResponse(BaseModel):
    mode: Literal["local_only"] = "local_only"
    overall_status: Literal["ready", "demo_ready", "blocked", "not_started"]
    recommended_profile: Literal["tiny", "standard", "strong"]
    recommended_pack_id: str | None = None
    demo_pack_id: str | None = None
    privacy_label: str
    next_action: str
    can_use_demo: bool
    blocked_reasons: list[str] = Field(default_factory=list)
    steps: list[AISetupStepInfo]


class AISetupRunRequest(BaseModel):
    mode: Literal["demo", "recommended"] = "demo"
    pack_id: str | None = None
    install_runtimes: bool = True
    download_models: bool = True
    activate_routes: bool = True
    include_optional_models: bool = False
    timeout_seconds: float = 10


class AISetupRunStep(BaseModel):
    id: str
    title: str
    status: Literal["done", "queued", "skipped", "blocked", "failed"]
    detail: str | None = None
    runtime_id: str | None = None
    model_id: str | None = None
    capability: str | None = None


class AISetupRunResponse(BaseModel):
    mode: Literal["demo", "recommended"]
    pack_id: str
    release_channel: Literal["demo", "production"]
    status: Literal["ready", "demo_ready", "partial", "blocked", "failed"]
    selected_capabilities: list[str] = Field(default_factory=list)
    downloads: list[dict[str, Any]] = Field(default_factory=list)
    steps: list[AISetupRunStep]
    setup: AISetupStatusResponse


class CapabilityBinding(BaseModel):
    capability: str
    provider_id: str
    model_id: str | None = None
    local_only: bool = True
    settings: dict[str, Any] = Field(default_factory=dict)


class CapabilityBindingUpdate(BaseModel):
    provider_id: str | None = None
    model_id: str | None = None
    local_only: bool | None = None
    settings: dict[str, Any] | None = None


class ModelDownloadRequest(BaseModel):
    model_id: str


class ModelImportRequest(BaseModel):
    file_path: str
    display_name: str | None = None
    model_id: str | None = None
    capabilities: list[str] = Field(default_factory=lambda: ["summarize", "generate_note", "grounded_answer"])
    license_label: str | None = "manual import"
    license_url: str | None = None
    license_path: str | None = None


class ModelDownloadInfo(BaseModel):
    id: str
    model_id: str
    state: str
    bytes_total: int | None = None
    bytes_downloaded: int = 0
    sha256_expected: str | None = None
    sha256_actual: str | None = None
    error: str | None = None
    target_path: str | None = None
    created_at: str
    updated_at: str
    completed_at: str | None = None


class AIRuntimeInfo(BaseModel):
    id: str
    display_name: str
    runtime: Literal["llama_cpp", "whisper_cpp", "piper"]
    release_channel: Literal["demo", "production"] = "production"
    version: str | None = None
    platform: str
    arch: str
    compatible: bool = True
    host_platform: str | None = None
    host_arch: str | None = None
    compatibility_error: str | None = None
    binary_name: str
    installed: bool = False
    install_state: Literal["not_installed", "installed", "failed"] = "not_installed"
    installable: bool = False
    source_type: str | None = None
    binary_path: str | None = None
    size_bytes: int | None = None
    sha256: str | None = None
    sha256_actual: str | None = None
    integrity_status: Literal["unknown", "verified", "missing", "mismatch", "failed"] = "unknown"
    integrity_error: str | None = None
    license_label: str | None = None
    license_url: str | None = None
    license_path: str | None = None
    blocked_reasons: list[str] = Field(default_factory=list)
    readiness_checks: list[AIReadinessCheck] = Field(default_factory=list)
    install_log: list[dict[str, Any]] = Field(default_factory=list)


class RuntimeBinaryStatus(BaseModel):
    configured: bool
    path: str | None = None
    source: Literal["env", "app_data", "path", "missing"]
    version: str | None = None
    error: str | None = None
    managed_runtime_id: str | None = None
    integrity_status: Literal["unknown", "verified", "missing", "mismatch", "failed"] = "unknown"
    sha256_expected: str | None = None
    sha256_actual: str | None = None


class RuntimeInstalledModel(BaseModel):
    model_id: str
    display_name: str
    kind: str
    runtime: str
    format: str
    file_path: str | None = None
    verified_at: str | None = None
    status: str
    size_bytes: int | None = None
    fixture_only: bool = False
    source_type: str | None = None
    trust_level: str | None = None
    runtime_tested: bool = False


class LlamaCppRuntimeHealth(BaseModel):
    runtime: Literal["llama_cpp"] = "llama_cpp"
    state: Literal["ready", "degraded", "not_configured", "no_installed_model"]
    runtime_dir: str
    cli: RuntimeBinaryStatus
    server: RuntimeBinaryStatus
    server_process: dict[str, Any] = Field(default_factory=dict)
    installed_models: list[RuntimeInstalledModel] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)


class RuntimeHealthResponse(BaseModel):
    llama_cpp: LlamaCppRuntimeHealth
    voice: dict[str, Any]


class RuntimeSmokeRequest(BaseModel):
    model_id: str | None = None
    prompt: str = "Reply with OK."
    max_tokens: int = 16
    dry_run: bool = True


class RuntimeServerStartRequest(BaseModel):
    model_id: str
    host: str = "127.0.0.1"
    port: int = 8767


class HardwareProfile(BaseModel):
    os: Literal["macos", "windows", "linux"]
    arch: Literal["arm64", "x64", "unknown"]
    cpu_brand: str | None = None
    physical_ram_gb: float | None = None
    available_ram_gb: float | None = None
    apple_silicon: bool
    metal_available: bool
    cuda_available: bool
    rocm_available: bool
    vulkan_available: bool
    recommended_profile: Literal["tiny", "standard", "strong"]
    warnings: list[str] = Field(default_factory=list)


class AIGenerateTextRequest(BaseModel):
    capability: str = "summarize"
    prompt: str
    local_only: bool = True
    max_tokens: int = 300


class AIGenerateJsonRequest(BaseModel):
    capability: str = "extract_objects"
    prompt: str
    schema_name: str = "VaultObjectExtraction"
    local_only: bool = True


class AIEmbedRequest(BaseModel):
    texts: list[str]
    capability: str = "embed_text"
    local_only: bool = True


class AIRerankRequest(BaseModel):
    query: str
    candidates: list[dict[str, Any]]
    capability: str = "rerank_results"
    local_only: bool = True


class TranscriptionRequest(BaseModel):
    audio_path: str
    language: str | None = None
    translate_to_english: bool = False
    diarization: bool = False
    timestamps: bool = True
    local_only: bool = True
    create_source: bool = False
    title: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SpeechSynthesisRequest(BaseModel):
    text: str
    language: str | None = None
    voice_id: str | None = None
    speed: float = 1.0
    format: Literal["wav", "mp3"] = "wav"
    local_only: bool = True
    cache: bool = True
