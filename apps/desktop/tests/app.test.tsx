import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app/App";
import { useUIStore } from "../src/lib/store";

function renderApp() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <App />
    </QueryClientProvider>
  );
}

async function openNoteTools() {
  const summary = (await screen.findByText("Tools")).closest("summary");
  expect(summary).toBeTruthy();
  fireEvent.click(summary as HTMLElement);
}

const registryValidationFixture = {
  status: "pass",
  summary: {
    model_count: 15,
    model_pack_count: 4,
    runtime_count: 4,
    error_count: 0,
    warning_count: 52
  },
  policy: {
    status: "pass",
    path: "/repo/services/core/vault_core/ai/models/registry_policy.json",
    actual: {
      schema_version: 1,
      pin_mode: "app_pinned",
      registries: {
        model_registry: { path: "model_registry.json", sha256: "a".repeat(64) },
        runtime_registry: { path: "runtime_registry.json", sha256: "b".repeat(64) }
      }
    },
    expected: {
      schema_version: 1,
      pin_mode: "app_pinned",
      registries: {
        model_registry: { path: "model_registry.json", sha256: "a".repeat(64) },
        runtime_registry: { path: "runtime_registry.json", sha256: "b".repeat(64) }
      }
    }
  },
  errors: [],
  warnings: ["tiny-gguf-placeholder.files[0].sha256 is pending release approval."]
};

const blockedPromotionStagesFixture = [
  {
    id: "manifest-evidence",
    title: "Manifest evidence",
    status: "active",
    detail: "Backend says 80 manifest blockers remain.",
    action: "Evaluate candidate manifests and clear registry validation."
  },
  {
    id: "metadata-hydration",
    title: "Metadata hydration",
    status: "pending",
    detail: "Backend says metadata is not hydrated.",
    action: "Hydrate upstream metadata before reviewer evidence."
  },
  {
    id: "source-probe",
    title: "Source probe",
    status: "pending",
    detail: "Candidate artifact sources and license references have not been probed.",
    action: "Probe source, size, checksum, and license evidence."
  },
  {
    id: "byte-verification",
    title: "Byte verification",
    status: "pending",
    detail: "Candidate artifact bytes have not been hashed into evidence.",
    action: "Verify artifact bytes before reviewer evidence."
  },
  {
    id: "evidence-overlay",
    title: "Evidence overlay",
    status: "pending",
    detail: "Reviewer evidence has not been applied to candidate registries.",
    action: "Apply reviewer evidence JSON."
  },
  {
    id: "pin-handoff",
    title: "Pin handoff",
    status: "pending",
    detail: "Patched registry handoff is not ready.",
    action: "Export patched registries and handoff."
  },
  {
    id: "final-pin",
    title: "Final pin",
    status: "pending",
    detail: "Bundled registries still reflect blocked production placeholders.",
    action: "Run guarded registry pin command."
  },
  {
    id: "readiness-gate",
    title: "Readiness gate",
    status: "pending",
    detail: "Strict local-AI readiness has not passed with the pinned registries.",
    action: "Run strict local-AI readiness gate."
  }
] as const;

const readyPromotionStagesFixture = blockedPromotionStagesFixture.map((stage) => {
  if (stage.id === "manifest-evidence") {
    return { ...stage, status: "done", detail: "Backend says candidate manifests are pin-ready." };
  }
  if (stage.id === "metadata-hydration") {
    return { ...stage, status: "done", detail: "Backend says pinned metadata is present." };
  }
  if (stage.id === "pin-handoff" || stage.id === "final-pin") {
    return { ...stage, status: "active" };
  }
  return stage;
});

const registryReleasePlanFixture = {
  status: "blocked",
  summary: {
    status: "blocked",
    ready_to_pin: false,
    total_checks: 88,
    blocked_count: 80,
    artifact_warning_count: 0,
    warning_count: 52,
    validation_error_count: 0,
    validation_warning_count: 52,
    production_pack_count: 3,
    ready_production_pack_count: 0,
    production_model_count: 8,
    ready_production_model_count: 0,
    production_runtime_count: 3,
    ready_production_runtime_count: 0
  },
  validation: registryValidationFixture,
  promotion_stages: blockedPromotionStagesFixture,
  next_actions: [
    "Resolve registry warnings before pinning approved production registries.",
    "Resolve source, checksum, size, license, runtime, and approval blockers for required models."
  ],
  artifacts: [
    {
      type: "model",
      id: "tiny-gguf-placeholder",
      display_name: "Tiny GGUF Local Model",
      status: "blocked",
      blocked_count: 7,
      warning_count: 0,
      readiness_checks: [
        {
          id: "tiny-gguf-placeholder:release-approval",
          label: "Release approval",
          status: "blocked",
          detail: "Release approval record pending.",
          action: "Add approval.status, approved_by, approved_at, and evidence before release."
        }
      ]
    },
    {
      type: "runtime",
      id: "llama-cpp-managed-runtime",
      display_name: "Managed llama.cpp Runtime",
      status: "blocked",
      blocked_count: 6,
      warning_count: 0,
      runtime_name: "llama_cpp",
      readiness_checks: [
        {
          id: "llama-cpp-managed-runtime:source",
          label: "Source",
          status: "blocked",
          detail: "Approved runtime source pending.",
          action: "Replace placeholder runtime source with a release URL."
        }
      ]
    }
  ]
};

const registryReleasePlanExportFixture = {
  generated_at: "2026-06-04T00:00:00Z",
  filename: "ai-registry-release-plan.md",
  mime_type: "text/markdown",
  markdown: "# AI Registry Release Plan\n\n- Status: **blocked**\n",
  plan: registryReleasePlanFixture
};

const registryCandidateReleasePlanFixture = {
  status: "ready_to_pin",
  summary: {
    status: "ready_to_pin",
    ready_to_pin: true,
    total_checks: 12,
    blocked_count: 0,
    artifact_warning_count: 0,
    warning_count: 0,
    validation_error_count: 0,
    validation_warning_count: 0,
    production_pack_count: 1,
    ready_production_pack_count: 1,
    production_model_count: 1,
    ready_production_model_count: 1,
    production_runtime_count: 1,
    ready_production_runtime_count: 1
  },
  validation: { ...registryValidationFixture, summary: { ...registryValidationFixture.summary, warning_count: 0 }, warnings: [] },
  promotion_stages: readyPromotionStagesFixture,
  next_actions: [],
  pin_preview: {
    registries: [
      {
        registry: "model_registry",
        path: "model_registry.json",
        current_sha256: "a".repeat(64),
        candidate_sha256: "c".repeat(64),
        changed: true,
        total_added: 2,
        total_changed: 0,
        total_removed: 2,
        changes: [
          {
            artifact_type: "model",
            added: ["candidate-tiny-llm"],
            changed: [],
            removed: ["tiny-gguf-placeholder"],
            unchanged: []
          },
          {
            artifact_type: "model_pack",
            added: ["candidate-tiny-pack"],
            changed: [],
            removed: ["tiny-local-pack"],
            unchanged: []
          }
        ]
      },
      {
        registry: "runtime_registry",
        path: "runtime_registry.json",
        current_sha256: "b".repeat(64),
        candidate_sha256: "d".repeat(64),
        changed: true,
        total_added: 1,
        total_changed: 0,
        total_removed: 4,
        changes: [
          {
            artifact_type: "runtime",
            added: ["candidate-llama-runtime"],
            changed: [],
            removed: ["llama-cpp-managed-runtime"],
            unchanged: []
          }
        ]
      }
    ],
    total_added: 3,
    total_changed: 0,
    total_removed: 3
  },
  artifacts: [
    {
      type: "model_pack",
      id: "candidate-tiny-pack",
      display_name: "Candidate Tiny Pack",
      status: "ready",
      blocked_count: 0,
      warning_count: 0,
      readiness_checks: [
        {
          id: "candidate-tiny-pack:required-models",
          label: "Required models",
          status: "pass",
          detail: "Every required model is release-ready."
        }
      ]
    }
  ]
};

const registryCandidateReleasePlanExportFixture = {
  generated_at: "2026-06-04T00:00:01Z",
  filename: "candidate-ai-registry-release-plan.md",
  mime_type: "text/markdown",
  markdown: "# AI Registry Release Plan\n\n## Sources\n\n- Model registry: `candidate-models.json`\n- Runtime registry: `candidate-runtimes.json`\n",
  plan: registryCandidateReleasePlanFixture,
  model_registry_label: "candidate-models.json",
  runtime_registry_label: "candidate-runtimes.json"
};

const candidateMetadataHydrationFixture = {
  generated_at: "2026-06-04T00:00:01Z",
  status: "hydrated",
  filename: "candidate-model-registry.hydrated.json",
  mime_type: "application/json",
  model_registry: {
    schema_version: 1,
    models: [
      {
        id: "candidate-tiny-llm",
        source: { type: "huggingface", repo_id: "vault/candidate", revision: "1234567890abcdef1234567890abcdef12345678" },
        files: [{ filename: "candidate.gguf", sha256: "e".repeat(64), size_bytes: 1024 }]
      }
    ],
    model_packs: []
  },
  model_registry_json:
    "{\n  \"schema_version\": 1,\n  \"models\": [{ \"id\": \"candidate-tiny-llm\" }],\n  \"model_packs\": []\n}",
  model_registry_sha256: "eeeeeeeeeeee0000000000000000000000000000000000000000000000000000",
  summary: {
    model_count: 1,
    updated_field_count: 4,
    warning_count: 0,
    error_count: 0,
    skipped_count: 0
  },
  updates: [
    { model_id: "candidate-tiny-llm", field: "source.revision", old_value: "REQUIRED_BEFORE_RELEASE", new_value: "1234567890abcdef1234567890abcdef12345678" },
    { model_id: "candidate-tiny-llm", field: "files[0].sha256", old_value: "REQUIRED_BEFORE_RELEASE", new_value: "e".repeat(64) }
  ],
  warnings: [],
  errors: [],
  skipped: [],
  release_plan: registryCandidateReleasePlanFixture,
  release_plan_markdown:
    "# AI Registry Release Plan\n\n## Sources\n\n- Model registry: `candidate-models.hydrated.json`\n- Runtime registry: `candidate-runtimes.json`\n",
  model_registry_label: "candidate-models.hydrated.json",
  runtime_registry_label: "candidate-runtimes.json"
};

const candidateArtifactProbeExportFixture = {
  generated_at: "2026-06-04T00:00:01Z",
  filename: "candidate-ai-registry-artifact-probe.md",
  mime_type: "text/markdown",
  markdown:
    "# AI Registry Artifact Probe\n\n## Sources\n\n- Model registry: `candidate-models.json`\n- Runtime registry: `candidate-runtimes.json`\n",
  model_registry_label: "candidate-models.json",
  runtime_registry_label: "candidate-runtimes.json",
  report: {
    generated_at: "2026-06-04T00:00:01Z",
    status: "pass",
    summary: {
      status: "pass",
      artifact_count: 2,
      check_count: 8,
      pass_count: 8,
      warn_count: 0,
      pending_count: 0,
      blocked_count: 0,
      validation_error_count: 0,
      validation_warning_count: 0
    },
    validation: { ...registryValidationFixture, summary: { ...registryValidationFixture.summary, warning_count: 0 }, warnings: [] },
    next_actions: [],
    artifacts: [
      {
        type: "model",
        id: "candidate-tiny-llm",
        display_name: "Candidate Tiny LLM",
        source_type: "url",
        status: "pass",
        checks: [
          {
            id: "candidate-tiny-llm:files[0]:source",
            label: "Artifact source",
            status: "pass",
            detail: "https://example.test/candidate-tiny.gguf returned HTTP 200. Content-Length: 1024 bytes."
          }
        ]
      },
      {
        type: "runtime",
        id: "candidate-llama-runtime",
        display_name: "Candidate llama.cpp Runtime",
        source_type: "url",
        runtime_name: "llama_cpp",
        status: "pass",
        checks: [
          {
            id: "candidate-llama-runtime:license",
            label: "License URL",
            status: "pass",
            detail: "https://example.test/runtime-license returned HTTP 200."
          }
        ]
      }
    ]
  }
};

const candidateArtifactVerificationExportFixture = {
  generated_at: "2026-06-04T00:00:02Z",
  filename: "candidate-ai-registry-artifact-byte-verification.md",
  mime_type: "text/markdown",
  markdown:
    "# AI Registry Artifact Byte Verification\n\n## Sources\n\n- Model registry: `candidate-models.hydrated.json`\n- Runtime registry: `candidate-runtimes.json`\n",
  evidence_filename: "candidate-ai-byte-evidence.json",
  evidence_mime_type: "application/json",
  evidence_json:
    "{\n  \"schema_version\": 1,\n  \"models\": {\"candidate-tiny-llm\": {\"sha256\": \"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\", \"size_bytes\": 1024, \"filename\": \"candidate.gguf\"}},\n  \"runtimes\": {}\n}",
  model_registry_label: "candidate-models.hydrated.json",
  runtime_registry_label: "candidate-runtimes.json",
  report: {
    generated_at: "2026-06-04T00:00:02Z",
    status: "pass",
    summary: {
      status: "pass",
      artifact_count: 1,
      file_count: 1,
      verified_file_count: 1,
      check_count: 4,
      pass_count: 4,
      warn_count: 0,
      pending_count: 0,
      blocked_count: 0,
      validation_error_count: 0,
      validation_warning_count: 0,
      evidence_model_count: 1,
      evidence_runtime_count: 0,
      max_bytes: 10737418240
    },
    validation: { ...registryValidationFixture, summary: { ...registryValidationFixture.summary, warning_count: 0 }, warnings: [] },
    evidence: {
      schema_version: 1,
      models: {
        "candidate-tiny-llm": {
          filename: "candidate.gguf",
          sha256: "e".repeat(64),
          size_bytes: 1024
        }
      },
      runtimes: {}
    },
    next_actions: [],
    artifacts: [
      {
        type: "model",
        id: "candidate-tiny-llm",
        display_name: "Candidate Tiny LLM",
        source_type: "url",
        status: "pass",
        files: [
          {
            filename: "candidate.gguf",
            status: "pass",
            size_bytes: 1024,
            sha256: "e".repeat(64),
            checks: [
              {
                id: "candidate-tiny-llm:files[0]:download",
                label: "Artifact bytes",
                status: "pass",
                detail: "Downloaded and hashed 1024 bytes."
              }
            ]
          }
        ]
      }
    ]
  }
};

const candidateApprovalTemplateExportFixture = {
  generated_at: "2026-06-04T00:00:02Z",
  filename: "candidate-local-ai-approval-template.md",
  mime_type: "text/markdown",
  markdown:
    "# Local AI Approval Template\n\n## Sources\n\n- Model registry: `candidate-models.json`\n- Runtime registry: `candidate-runtimes.json`\n\n| `approval.evidence` | present |\n",
  evidence_filename: "candidate-local-ai-evidence-template.json",
  evidence_mime_type: "application/json",
  evidence_json: "{\n  \"schema_version\": 1,\n  \"models\": {},\n  \"runtimes\": {}\n}",
  evidence: { schema_version: 1, models: {}, runtimes: {} },
  report: {
    generated_at: "2026-06-04T00:00:02Z",
    status: "ready",
    artifact_count: 2,
    pending_field_count: 0,
    artifacts: [],
    next_actions: []
  },
  model_registry_label: "candidate-models.json",
  runtime_registry_label: "candidate-runtimes.json"
};

const candidateReviewerEvidenceJson = JSON.stringify(
  {
    schema_version: 1,
    models: {
      "candidate-tiny-llm": {
        approval: {
          status: "approved",
          approved_by: "Vault QA",
          approved_at: "2026-06-04",
          evidence: "candidate model approval evidence"
        },
        license_label: "MIT"
      }
    },
    runtimes: {
      "candidate-llama-runtime": {
        version: "b5123",
        approval: {
          status: "approved",
          approved_by: "Vault QA",
          approved_at: "2026-06-04",
          evidence: "candidate runtime approval evidence"
        }
      }
    }
  },
  null,
  2
);

const candidateEvidenceOverlayExportFixture = {
  generated_at: "2026-06-04T00:00:03Z",
  status: "applied",
  filename: "candidate-ai-registry-evidence-bundle.json",
  mime_type: "application/json",
  bundle_json: "{\n  \"status\": \"applied\"\n}",
  applied_count: 14,
  applied_fields: [{ type: "model", id: "candidate-tiny-llm", path: "approval" }],
  errors: [],
  warnings: [],
  model_registry: { schema_version: 1, models: [{ id: "candidate-tiny-llm" }], model_packs: [] },
  runtime_registry: { schema_version: 1, runtimes: [{ id: "candidate-llama-runtime" }] },
  model_registry_filename: "candidate-models.patched.json",
  runtime_registry_filename: "candidate-runtimes.patched.json",
  model_registry_json: "{\n  \"schema_version\": 1,\n  \"models\": [{ \"id\": \"candidate-tiny-llm\" }],\n  \"model_packs\": []\n}",
  runtime_registry_json: "{\n  \"schema_version\": 1,\n  \"runtimes\": [{ \"id\": \"candidate-llama-runtime\" }]\n}",
  patched_model_registry_sha256: "a1b2c3d4e5f60000000000000000000000000000000000000000000000000000",
  patched_runtime_registry_sha256: "f6e5d4c3b2a10000000000000000000000000000000000000000000000000000",
  release_plan_filename: "candidate-ai-registry-release-plan.applied.md",
  release_plan_mime_type: "text/markdown",
  approval_template_filename: "candidate-local-ai-approval-template.applied.md",
  approval_template_mime_type: "text/markdown",
  pin_handoff_filename: "candidate-ai-registry-pin-handoff.applied.md",
  pin_handoff_mime_type: "text/markdown",
  validation: { ...registryValidationFixture, summary: { ...registryValidationFixture.summary, warning_count: 0 }, warnings: [] },
  release_plan: registryCandidateReleasePlanFixture,
  approval_template: candidateApprovalTemplateExportFixture.report,
  pin_handoff: {
    status: "ready_to_pin",
    ready_to_pin: true,
    acceptance_report_filename: "candidate-ai-registry-acceptance.applied.md",
    release_packet_dir: "candidate-ai-registry-release-packet",
    commands: {
      artifact_probe:
        "./scripts/probe_ai_registry_artifacts.sh --model-registry candidate-models.patched.json --runtime-registry candidate-runtimes.patched.json --format markdown --output candidate-ai-registry-artifact-probe.applied.md",
      artifact_verification:
        "./scripts/verify_ai_registry_artifacts.sh --model-registry candidate-models.patched.json --runtime-registry candidate-runtimes.patched.json --format markdown --output candidate-ai-registry-artifact-byte-verification.applied.md --evidence-output candidate-ai-byte-evidence.applied.json",
      release_packet:
        "./scripts/prepare_ai_registry_release_candidate.sh --model-registry candidate-models.json --runtime-registry candidate-runtimes.json --evidence candidate-evidence.json --output-dir candidate-ai-registry-release-packet --probe-sources --verify-bytes",
      acceptance_report:
        "./scripts/pin_ai_registries.sh --check --model-registry candidate-models.patched.json --runtime-registry candidate-runtimes.patched.json --format markdown --output candidate-ai-registry-acceptance.applied.md",
      pin_check:
        "./scripts/pin_ai_registries.sh --check --model-registry candidate-models.patched.json --runtime-registry candidate-runtimes.patched.json --format json",
      pin: "./scripts/pin_ai_registries.sh --model-registry candidate-models.patched.json --runtime-registry candidate-runtimes.patched.json",
      readiness: "./scripts/check_ai_readiness.sh --format text"
    }
  },
  release_plan_markdown: registryCandidateReleasePlanExportFixture.markdown,
  approval_template_markdown: candidateApprovalTemplateExportFixture.markdown,
  pin_handoff_markdown:
    "# Candidate AI Registry Pin Handoff\n\n```sh\n./scripts/probe_ai_registry_artifacts.sh --model-registry candidate-models.patched.json --runtime-registry candidate-runtimes.patched.json --format markdown --output candidate-ai-registry-artifact-probe.applied.md\n./scripts/verify_ai_registry_artifacts.sh --model-registry candidate-models.patched.json --runtime-registry candidate-runtimes.patched.json --format markdown --output candidate-ai-registry-artifact-byte-verification.applied.md --evidence-output candidate-ai-byte-evidence.applied.json\n./scripts/prepare_ai_registry_release_candidate.sh --model-registry candidate-models.json --runtime-registry candidate-runtimes.json --evidence candidate-evidence.json --output-dir candidate-ai-registry-release-packet --probe-sources --verify-bytes\n./scripts/pin_ai_registries.sh --check --model-registry candidate-models.patched.json --runtime-registry candidate-runtimes.patched.json --format markdown --output candidate-ai-registry-acceptance.applied.md\n./scripts/pin_ai_registries.sh --model-registry candidate-models.patched.json --runtime-registry candidate-runtimes.patched.json\n```\n",
  model_registry_label: "candidate-models.json",
  runtime_registry_label: "candidate-runtimes.json",
  evidence_label: "candidate-evidence.json"
};

const candidateReleasePacketFixture = {
  status: "ready_to_pin",
  ready_to_pin: true,
  output_dir: "/tmp/vault/release_packets/candidate-ai-registry-release-packet",
  generated_at: "2026-06-04T00:00:04Z",
  applied_count: 14,
  patched_model_registry_sha256: candidateEvidenceOverlayExportFixture.patched_model_registry_sha256,
  patched_runtime_registry_sha256: candidateEvidenceOverlayExportFixture.patched_runtime_registry_sha256,
  release_plan: registryCandidateReleasePlanFixture,
  acceptance: { status: "ready_to_pin", ready_to_pin: true },
  artifact_probe: { status: "not_run" },
  artifact_verification: { status: "not_run" },
  artifacts: [
    {
      type: "summary",
      filename: "candidate-ai-registry-release-packet.md",
      path: "/tmp/vault/release_packets/candidate-ai-registry-release-packet/candidate-ai-registry-release-packet.md",
      bytes: 2048
    },
    {
      type: "model_registry",
      filename: "candidate-models.patched.json",
      path: "/tmp/vault/release_packets/candidate-ai-registry-release-packet/candidate-models.patched.json",
      bytes: 1024
    },
    {
      type: "runtime_registry",
      filename: "candidate-runtimes.patched.json",
      path: "/tmp/vault/release_packets/candidate-ai-registry-release-packet/candidate-runtimes.patched.json",
      bytes: 768
    },
    {
      type: "handoff",
      filename: "candidate-ai-registry-pin-handoff.applied.md",
      path: "/tmp/vault/release_packets/candidate-ai-registry-release-packet/candidate-ai-registry-pin-handoff.applied.md",
      bytes: 1536
    }
  ],
  next_actions: [],
  errors: [],
  warnings: []
};

describe("App", () => {
  afterEach(() => {
    cleanup();
    useUIStore.setState({
      surface: "notes",
      selectedNoteId: undefined,
      selectedSourceId: undefined,
      selectedSourceBlockId: undefined,
      selectedReviewItemId: undefined,
      selectedClaimId: undefined,
      selectedCapsuleId: undefined,
      quickNoteRequestId: 0,
      quickTaskRequestId: 0,
      sourceDialogRequestId: 0,
      sourceDialogDraftText: ""
    });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the lab shell", async () => {
    window.vault = {
      request: vi.fn(async (route: string, payload?: any) => {
        if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
        if (route === "jobs.list") return [];
        if (route === "stats.get") {
          return {
            sources: 0,
            source_blocks: 0,
            notes: 0,
            claims: 0,
            claims_without_evidence: 0,
            contradicted_claims: 0,
            pending_review_items: 0,
            generated_notes_pending_review: 0,
            installed_tools: 1,
            failed_jobs: 0,
            learning_items: 0
          };
        }
        if (route === "events.list") return [];
        return [];
      }),
      selectFiles: vi.fn(async () => [])
    };
    renderApp();
    expect(await screen.findByText("The Vault")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Notes", level: 1 })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Notes" }).className).toContain("active");
    expect(screen.queryByRole("tablist", { name: "Search style" })).toBeNull();
    expect(screen.getByTitle("Local core ready · Version 0.1.0 · 0 background tasks")).toBeTruthy();
    expect(screen.queryByText("Local core ready")).toBeNull();
    expect(screen.queryByText("Version 0.1.0")).toBeNull();
    expect(screen.queryByText("0 background tasks")).toBeNull();
  });

  it("creates and completes tasks from the Tasks surface", async () => {
    let todoRows: any[] = [];
    const createdTodo = {
      id: "todo_follow_up",
      title: "Email Anna about citation mismatch",
      description: "",
      status: "open",
      priority: 2,
      due_date: "2026-06-17",
      due_time: null,
      recurrence_rule: null,
      list_id: "tdl_paper",
      list_name: "Paper review",
      labels: ["waiting"],
      context_links: [],
      source_kind: "user",
      source_ref: {},
      provenance: {},
      created_at: "2026-06-16T10:00:00Z",
      updated_at: "2026-06-16T10:00:00Z",
      completed_at: null
    };
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "todos.list") {
        const items = payload?.listId
          ? todoRows.filter((todo) => todo.list_id === payload.listId)
          : todoRows.filter((todo) => payload?.view !== "inbox" || !todo.list_id);
        return { items, total: items.length, view: payload?.view ?? "inbox" };
      }
      if (route === "todoLists.list") return [{ id: "tdl_paper", name: "Paper review", status: "active", open_count: todoRows.filter((todo) => todo.status === "open").length }];
      if (route === "todos.create") {
        todoRows = [createdTodo];
        return createdTodo;
      }
      if (route === "todos.update") {
        todoRows = todoRows.map((todo) => (todo.id === payload?.todoId ? { ...todo, ...payload.data, updated_at: "2026-06-16T10:03:00Z" } : todo));
        return todoRows.find((todo) => todo.id === payload?.todoId);
      }
      if (route === "todos.complete") {
        todoRows = todoRows.map((todo) => (todo.id === payload?.todoId ? { ...todo, status: "completed", completed_at: "2026-06-16T10:05:00Z" } : todo));
        return todoRows[0];
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "Tasks" }));
    expect(await screen.findByText("Inbox clear.")).toBeTruthy();
    expect(screen.getByLabelText("Task lists")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Add task"), { target: { value: "Email Anna about citation mismatch tomorrow @waiting #Paper review p2" } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    await waitFor(() => expect(request).toHaveBeenCalledWith("todos.create", { text: "Email Anna about citation mismatch tomorrow @waiting #Paper review p2" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("todos.list", { view: "inbox", listId: "tdl_paper", limit: 100, offset: 0 }));
    expect(await screen.findByText("Email Anna about citation mismatch")).toBeTruthy();
    expect(screen.getByText(/#Paper review/)).toBeTruthy();
    expect(screen.getByText("@waiting")).toBeTruthy();
    fireEvent.click(screen.getByText("Email Anna about citation mismatch"));
    expect(await screen.findByLabelText("Task detail")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Task detail title"), { target: { value: "Email Anna about quote mismatch" } });
    fireEvent.change(screen.getByLabelText("Task due date"), { target: { value: "2026-06-18" } });
    fireEvent.click(within(screen.getByLabelText("Task detail")).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("todos.update", {
        todoId: "todo_follow_up",
        data: {
          title: "Email Anna about quote mismatch",
          description: "",
          due_date: "2026-06-18",
          priority: 2,
          list_id: "tdl_paper",
          labels: ["waiting"],
          recurrence_rule: null
        }
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Close task detail" }));
    expect(await screen.findByText("Email Anna about quote mismatch")).toBeTruthy();
    fireEvent.click(within(screen.getByLabelText("Task lists")).getByRole("button", { name: "Inbox" }));
    expect(await screen.findByText("Inbox clear.")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Paper review"));
    await waitFor(() => expect(request).toHaveBeenCalledWith("todos.list", { view: "inbox", listId: "tdl_paper", limit: 100, offset: 0 }));
    expect(await screen.findByText("Email Anna about quote mismatch")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Complete Email Anna about quote mismatch" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("todos.complete", { todoId: "todo_follow_up" }));
  });

  it("keeps the empty Tasks surface focused on quick entry", async () => {
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list" || route === "events.list") return [];
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "todos.list") return { items: [], total: 0, view: payload?.view ?? "inbox" };
      if (route === "todoLists.list") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "Tasks" }));

    expect(await screen.findByText("Inbox clear.")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Add task" })).toBeTruthy();
    expect(screen.queryByLabelText("Task lists")).toBeNull();
    expect(screen.queryByText("No custom lists")).toBeNull();
    expect(screen.queryByPlaceholderText("New list")).toBeNull();
  });

  it("adds and completes subtasks from the task detail rail", async () => {
    let todoRows: any[] = [
      {
        id: "todo_parent",
        title: "Prepare evidence packet",
        description: "",
        status: "open",
        priority: 3,
        due_date: null,
        due_time: null,
        recurrence_rule: null,
        list_id: null,
        list_name: null,
        labels: [],
        context_links: [],
        subtasks: [
          {
            id: "todo_child_existing",
            parent_todo_id: "todo_parent",
            title: "Collect quotes",
            description: "",
            status: "open",
            priority: 4,
            labels: [],
            context_links: [],
            subtasks: [],
            source_kind: "subtask",
            source_ref: {},
            provenance: {},
            created_at: "2026-06-21T00:00:00Z",
            updated_at: "2026-06-21T00:00:00Z"
          }
        ],
        source_kind: "user",
        source_ref: {},
        provenance: {},
        created_at: "2026-06-21T00:00:00Z",
        updated_at: "2026-06-21T00:00:00Z",
        completed_at: null
      }
    ];
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "todos.list") return { items: todoRows, total: todoRows.length, view: payload?.view ?? "inbox" };
      if (route === "todoLists.list") return [];
      if (route === "todos.create") {
        expect(payload).toEqual({
          text: "Draft summary",
          parent_todo_id: "todo_parent",
          source_kind: "subtask",
          source_ref: { parent_todo_id: "todo_parent" },
          provenance: { created_from: "task_detail", parent_todo_id: "todo_parent" }
        });
        const subtask = {
          id: "todo_child_new",
          parent_todo_id: payload.parent_todo_id,
          title: payload.text,
          description: "",
          status: "open",
          priority: 4,
          labels: [],
          context_links: [],
          subtasks: [],
          source_kind: "subtask",
          source_ref: payload.source_ref,
          provenance: payload.provenance,
          created_at: "2026-06-21T00:00:01Z",
          updated_at: "2026-06-21T00:00:01Z"
        };
        todoRows = todoRows.map((todo) => (todo.id === payload.parent_todo_id ? { ...todo, subtasks: [...todo.subtasks, subtask] } : todo));
        return subtask;
      }
      if (route === "todos.complete") {
        todoRows = todoRows.map((todo) =>
          todo.id === "todo_parent"
            ? {
                ...todo,
                subtasks: todo.subtasks.map((subtask: any) => (subtask.id === payload.todoId ? { ...subtask, status: "completed", completed_at: "2026-06-21T00:00:02Z" } : subtask))
              }
            : todo
        );
        return todoRows[0].subtasks.find((subtask: any) => subtask.id === payload.todoId);
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "Tasks" }));
    expect(await screen.findByText("Prepare evidence packet")).toBeTruthy();
    expect(await screen.findByText("0/1 subtasks")).toBeTruthy();
    fireEvent.click(await screen.findByText("Prepare evidence packet"));
    expect(await screen.findByLabelText("Subtasks")).toBeTruthy();
    fireEvent.change(await screen.findByLabelText("New subtask"), { target: { value: "Draft summary" } });
    fireEvent.click(await screen.findByRole("button", { name: "Add subtask" }));

    await waitFor(() => expect(request).toHaveBeenCalledWith("todos.create", expect.objectContaining({ parent_todo_id: "todo_parent" })));
    expect((await screen.findAllByText("0/2 subtasks")).length).toBeGreaterThan(0);
    fireEvent.click(await screen.findByRole("button", { name: "Complete subtask Draft summary" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("todos.complete", { todoId: "todo_child_new" }));
    expect((await screen.findAllByText("1/2 subtasks")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Complete Prepare evidence packet" })).toBeTruthy();
  });

  it("creates a contextual task from the note editor", async () => {
    const note = {
      id: "note_context_task",
      title: "Citation follow-up",
      content: {},
      content_markdown: "Check this citation.",
      origin: "user_written",
      status: "draft",
      version: 1,
      source_id: "src_note_context",
      updated_at: "2026-06-16T10:00:00Z"
    };
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "notes.list") return [note];
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      if (route === "todos.create") {
        return {
          id: "todo_from_note",
          title: payload.text,
          description: "",
          status: "open",
          priority: 4,
          labels: [],
          context_links: payload.context_links,
          source_kind: "user",
          source_ref: {},
          provenance: payload.provenance,
          created_at: "2026-06-16T10:01:00Z",
          updated_at: "2026-06-16T10:01:00Z"
        };
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "Notes" }));
    await screen.findByDisplayValue("Citation follow-up");
    await openNoteTools();
    const tools = document.querySelector(".note-tools-body");
    expect(tools).toBeTruthy();
    fireEvent.click(within(tools as HTMLElement).getByRole("button", { name: "Task" }));
    expect(await screen.findByDisplayValue("Follow up: Citation follow-up")).toBeTruthy();
    const dialog = screen.getByRole("dialog", { name: "New task" });

    fireEvent.change(within(dialog).getByLabelText("Task title"), { target: { value: "Verify citation tomorrow @review" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("todos.create", {
        text: "Verify citation tomorrow @review",
        provenance: { created_from: "note" },
        context_links: [
          {
            target_type: "note",
            target_id: "note_context_task",
            target_title: "Citation follow-up",
            relation: "follow_up",
            exact_quote: undefined,
            locator: undefined,
            metadata: {}
          }
        ]
      })
    );
  });

  it("creates linked tasks from unchecked Markdown checkboxes in a note", async () => {
    const note = {
      id: "note_checkbox_tasks",
      title: "Experiment checklist",
      content: {
        editor_doc: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "- [ ] Verify the quoted method tomorrow @review" }] },
            { type: "paragraph", content: [{ type: "text", text: "- [x] Already checked" }] },
            { type: "paragraph", content: [{ type: "text", text: "- [ ] Email collaborator #Paper review" }] }
          ]
        }
      },
      content_markdown: "- [ ] Verify the quoted method tomorrow @review\n- [x] Already checked\n- [ ] Email collaborator #Paper review\n",
      origin: "user_written",
      status: "draft",
      version: 1,
      source_id: "src_note_checkbox",
      updated_at: "2026-06-21T00:00:00Z"
    };
    const createdPayloads: any[] = [];
    let updatedContent: any;
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "notes.list") return [note];
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      if (route === "todos.create") {
        createdPayloads.push(payload);
        return {
          id: `todo_checkbox_${createdPayloads.length}`,
          title: payload.text,
          description: "",
          status: "open",
          priority: 4,
          labels: [],
          context_links: payload.context_links,
          source_kind: payload.source_kind,
          source_ref: payload.source_ref,
          provenance: payload.provenance,
          created_at: `2026-06-21T00:00:0${createdPayloads.length}Z`,
          updated_at: `2026-06-21T00:00:0${createdPayloads.length}Z`
        };
      }
      if (route === "notes.update") {
        updatedContent = payload.data.content_json;
        return { ...note, ...payload.data, content: payload.data.content_json, version: 2 };
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "Notes" }));
    await screen.findByDisplayValue("Experiment checklist");
    await openNoteTools();
    fireEvent.click(await screen.findByRole("button", { name: "2 tasks" }));

    await waitFor(() => expect(createdPayloads).toHaveLength(2));
    expect(createdPayloads[0]).toEqual(
      expect.objectContaining({
        text: "Verify the quoted method tomorrow @review",
        source_kind: "note_checkbox",
        source_ref: expect.objectContaining({ note_id: "note_checkbox_tasks", line_number: 1, checkbox_hash: expect.any(String) }),
        provenance: expect.objectContaining({ created_from: "note_checkbox", note_id: "note_checkbox_tasks", checkbox_hash: expect.any(String) }),
        context_links: [
          expect.objectContaining({
            target_type: "note",
            target_id: "note_checkbox_tasks",
            target_title: "Experiment checklist",
            relation: "follow_up_checkbox",
            exact_quote: "- [ ] Verify the quoted method tomorrow @review",
            locator: "line 1",
            metadata: expect.objectContaining({
              created_from: "note_checkbox",
              checkbox_hash: expect.any(String),
              checkbox_line: 1,
              checkbox_index: 1
            })
          })
        ]
      })
    );
    expect(createdPayloads[1]).toEqual(
      expect.objectContaining({
        text: "Email collaborator #Paper review",
        source_kind: "note_checkbox",
        source_ref: expect.objectContaining({ note_id: "note_checkbox_tasks", line_number: 3 }),
        context_links: [expect.objectContaining({ relation: "follow_up_checkbox", exact_quote: "- [ ] Email collaborator #Paper review", locator: "line 3" })]
      })
    );
    expect(createdPayloads.some((payload) => payload.text === "Already checked")).toBe(false);
    await waitFor(() => expect(request).toHaveBeenCalledWith("notes.update", expect.objectContaining({ noteId: "note_checkbox_tasks" })));
    expect(updatedContent.task_checkbox_links).toHaveLength(2);
    expect(updatedContent.task_checkbox_links[0]).toEqual(expect.objectContaining({ todo_id: "todo_checkbox_1", title: "Verify the quoted method tomorrow @review", line_number: 1 }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "2 tasks" })).toBeNull());
  });

  it("creates contextual tasks from Storage sources and exact source blocks", async () => {
    const source = {
      id: "src_task_payload",
      type: "pdf",
      title: "Field study notes",
      content_hash: "hash_field_study",
      metadata: {},
      created_at: "2026-06-21T00:00:00Z",
      updated_at: "2026-06-21T00:00:00Z"
    };
    const block = {
      id: "blk_task_payload",
      source_id: source.id,
      block_index: 2,
      locator: "p3",
      heading_path: "Findings / Method",
      text: "Participants described the local workflow as fragmented."
    };
    const createdPayloads: any[] = [];
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list" || route === "events.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "sources.list") return [source];
      if (route === "sources.blocks") return [block];
      if (route === "sources.pipeline") return { stages: [], source_type: "pdf", source_status: "ready", block_count: 1, pending_review_items: 0, needs_edit_review_items: 0, approved_claims: 0 };
      if (route === "ai.capabilities" || route === "ai.providers") return [];
      if (route === "todos.create") {
        createdPayloads.push(payload);
        return {
          id: `todo_storage_${createdPayloads.length}`,
          title: payload.text,
          status: "open",
          priority: 3,
          labels: [],
          context_links: payload.context_links,
          provenance: payload.provenance,
          created_at: "2026-06-21T00:00:01Z",
          updated_at: "2026-06-21T00:00:01Z"
        };
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "sources", selectedSourceId: source.id, selectedSourceBlockId: block.id });
    const { container } = renderApp();

    expect((await screen.findAllByText("Field study notes")).length).toBeGreaterThan(0);
    const sourceDetail = container.querySelector(".source-detail");
    expect(sourceDetail).toBeTruthy();
    fireEvent.click(within(sourceDetail as HTMLElement).getAllByRole("button", { name: "Task" })[0]);
    fireEvent.click(within(await screen.findByRole("dialog", { name: "New task" })).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(createdPayloads).toHaveLength(1));

    expect(createdPayloads[0]).toEqual({
      text: "Check Field study notes",
      provenance: { created_from: "source" },
      context_links: [
        {
          target_type: "source",
          target_id: source.id,
          target_title: source.title,
          relation: "follow_up",
          exact_quote: undefined,
          locator: undefined,
          metadata: {
            created_from: "storage_source",
            source_type: "pdf",
            content_hash: "hash_field_study",
            block_count: 1
          }
        }
      ]
    });

    const blockInspector = container.querySelector(".source-block-inspector");
    expect(blockInspector).toBeTruthy();
    fireEvent.click(within(blockInspector as HTMLElement).getByRole("button", { name: "Task" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "New task" })).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(createdPayloads).toHaveLength(2));

    expect(createdPayloads[1]).toEqual({
      text: "Check Field study notes p3",
      provenance: { created_from: "source_block" },
      context_links: [
        {
          target_type: "source_block",
          target_id: block.id,
          target_title: "Field study notes p3",
          relation: "follow_up",
          exact_quote: block.text,
          locator: "p3",
          metadata: {
            created_from: "storage_block",
            source_id: source.id,
            source_title: source.title,
            source_type: "pdf",
            block_index: 2,
            heading_path: "Findings / Method",
            exact_quote_hash: expect.any(String)
          }
        }
      ]
    });
  });

  it("creates contextual tasks from Review items with review metadata", async () => {
    const reviewItem = {
      id: "rev_context_task",
      item_type: "claim_status_change",
      title: "Unsupported claim: Evidence is thin",
      summary: "This claim needs a tighter citation.",
      payload: {
        claim_id: "clm_thin",
        source_id: "src_thin",
        source_block_id: "blk_thin",
        current_status: "supported",
        suggested_status: "weakly_supported",
        model_id: "mock-local-llm"
      },
      status: "pending",
      created_by_job_id: "job_review_payload",
      created_at: "2026-06-21T00:00:00Z"
    };
    let createdPayload: any;
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list" || route === "events.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 1,
          claims_without_evidence: 1,
          contradicted_claims: 0,
          pending_review_items: 1,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "review.list") return [reviewItem];
      if (route === "capsules.list") return { items: [], total: 0 };
      if (route === "todos.create") {
        createdPayload = payload;
        return {
          id: "todo_review_payload",
          title: payload.text,
          status: "open",
          priority: 3,
          labels: [],
          context_links: payload.context_links,
          provenance: payload.provenance,
          created_at: "2026-06-21T00:00:01Z",
          updated_at: "2026-06-21T00:00:01Z"
        };
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "review", selectedReviewItemId: reviewItem.id });
    renderApp();

    expect((await screen.findAllByText("Unsupported claim: Evidence is thin")).length).toBeGreaterThan(0);
    fireEvent.click(await screen.findByRole("button", { name: "Task" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "New task" })).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createdPayload).toBeTruthy());
    expect(createdPayload).toEqual({
      text: "Review Unsupported claim: Evidence is thin",
      provenance: { created_from: "review_item" },
      context_links: [
        {
          target_type: "review_item",
          target_id: reviewItem.id,
          target_title: reviewItem.title,
          relation: "follow_up",
          exact_quote: undefined,
          locator: undefined,
          metadata: {
            created_from: "review_item",
            item_type: "claim_status_change",
            status: "pending",
            created_by_job_id: "job_review_payload",
            model_id: "mock-local-llm",
            source_id: "src_thin",
            source_block_id: "blk_thin",
            claim_id: "clm_thin"
          }
        }
      ]
    });
  });

  it("keeps the empty Local tools surface quiet", async () => {
    const request = vi.fn(async (route: string) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "tools.list") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "tools" });
    renderApp();

    expect(await screen.findByText("No helpers")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Local tools", level: 2 })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Helper details", level: 2 })).toBeNull();
    expect(screen.queryByText("None selected")).toBeNull();
    expect(screen.queryByText("No helpers installed.")).toBeNull();
    expect(screen.queryByText("Install or import a trusted helper to run local checks.")).toBeNull();
  });

  it("creates a capsule from the Capsules surface", async () => {
    const capsule = {
      id: "cap_acoustics",
      name: "Acoustic Science Foundations",
      slug: "acoustic-science-foundations",
      description: null,
      purpose: "Reusable acoustics research module.",
      capsule_type: "domain",
      status: "draft",
      version: "0.1.0",
      language: "en",
      domains: ["acoustics"],
      tags: ["sound"],
      epistemic_strictness: "balanced",
      default_source_policy: "reference_only",
      updated_at: "2026-06-14T12:00:00Z",
      counts: { sources: 0, notes: 1, claims: 0, concepts: 0, tools: 0 },
      health: { score: 0, status: "needs_review", warnings: ["No capsule items yet."] },
      items: [
        {
          id: "capitem_note",
          capsule_id: "cap_acoustics",
          target_type: "note",
          target_id: "note_capsule_intro",
          role: "core",
          include_mode: "reference",
          status: "active",
          private_flag: false,
          created_at: "2026-06-14T12:05:00Z",
          target: { type: "note", id: "note_capsule_intro", title: "Acoustics intro note" }
        }
      ],
      versions: [
        { id: "capver_02", version: "0.2.0", title: "Current", changelog: null, created_at: "2026-06-14T12:10:00Z" },
        { id: "capver_01", version: "0.1.0", title: "Baseline", changelog: null, created_at: "2026-06-14T12:00:00Z" }
      ],
      dependencies: [],
      activity: []
    };
    const forkedCapsule = {
      ...capsule,
      id: "cap_acoustics_fork",
      name: "Acoustic Science Foundations Fork",
      slug: "acoustic-science-foundations-fork",
      capsule_type: "project",
      versions: [],
      dependencies: [
        {
          id: "capdep_fork",
          capsule_id: "cap_acoustics_fork",
          dependency_type: "forked_from",
          target_capsule_id: "cap_acoustics",
          target_capsule_name: "Acoustic Science Foundations",
          target_capsule_slug: "acoustic-science-foundations",
          target_capsule_version: "0.1.0",
          version_constraint: "0.1.0",
          created_at: "2026-06-14T12:12:00Z"
        }
      ]
    };
    let capsuleRows: any[] = [];
    let reviewRows: any[] = [];
    let importRows: any[] = [];
    let exportRows: any[] = [];
    const selectFiles = vi.fn(async () => ["/tmp/acoustic-science-foundations.vaultcapsule"]);
    window.vault = {
      request: vi.fn(async (route: string, payload?: any) => {
        if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
        if (route === "jobs.list") return [];
        if (route === "capsules.list") return { items: capsuleRows, total: capsuleRows.length };
        if (route === "capsules.imports") return { items: importRows, total: importRows.length };
        if (route === "capsules.import.get") {
          const row = importRows.find((item) => (item.import_id || item.id) === payload?.importId);
          return row ? { ...row, import_id: row.import_id || row.id } : undefined;
        }
        if (route === "capsules.create") {
          capsuleRows = [capsule];
          return capsule;
        }
        if (route === "capsules.removeItem") {
          capsule.items = capsule.items.filter((item) => item.id !== payload?.itemId);
          capsule.counts = { ...capsule.counts, notes: 0 };
          return { removed: true, item_id: payload?.itemId };
        }
        if (route === "capsules.fork") {
          capsuleRows = [forkedCapsule, capsule];
          return forkedCapsule;
        }
        if (route === "capsules.get") return payload?.capsuleId === forkedCapsule.id ? forkedCapsule : capsule;
        if (route === "capsules.versionDiff") {
          return {
            capsule_id: capsule.id,
            from: capsule.versions[1],
            to: capsule.versions[0],
            counts: { added: 1, removed: 0, changed: 0 },
            added: [{ target_type: "note", target_id: "note_added", role: "overview", include_mode: "reference", status: "active" }],
            removed: [],
            changed: []
          };
        }
        if (route === "capsules.exportPreview") {
          return {
            capsule_id: capsule.id,
            export_mode: "reference_only",
            status: "ready",
            filename: "acoustic-science-foundations.vaultcapsule",
            manifest: { object_counts: { claims: 0, sources: 0, notes: 0 } },
            privacy_report: {
              status: "ready",
              export_mode: "reference_only",
              private_item_count: 0,
              full_source_private_count: 0,
              disabled_tool_count: 0,
              unsupported_claim_count: 0,
              exact_quote_count: 0,
              estimated_record_count: 1,
              checksum_status: "ready",
              warnings: [],
              blockers: []
            },
            validation_report: { status: "ready" }
          };
        }
        if (route === "capsules.export") {
          const exported = {
            export_id: "capexp_test",
            capsule_id: capsule.id,
            export_mode: "reference_only",
            status: "completed",
            filename: "acoustic-science-foundations.vaultcapsule",
            file_path: "/tmp/acoustic-science-foundations.vaultcapsule",
            mime_type: "application/vnd.thevault.capsule+zip",
            size_bytes: 2048,
            sha256: "a".repeat(64),
            created_at: "2026-06-14T12:00:00Z",
            manifest: {},
            privacy_report: {},
            validation_report: {}
          };
          exportRows = [{ id: "capexp_test", ...exported, file_size_bytes: exported.size_bytes, error: null, warnings: [] }];
          return exported;
        }
        if (route === "capsules.exports") return { items: exportRows, total: exportRows.length };
        if (route === "capsules.import") {
          const imported = {
            import_id: "capimp_test",
            status: "quarantined",
            source_file_path: "/tmp/acoustic-science-foundations.vaultcapsule",
            quarantine_path: "/tmp/capsules/imports/capimp_test",
            manifest: { capsule, object_counts: { claims: 1, sources: 1, notes: 0, tools: 0 } },
            validation_report: {
              status: "valid",
              file_count: 8,
              unpacked_bytes: 4096,
              checksum_results: [
                { path: "manifest.json", status: "pass" },
                { path: "data/claims.jsonl", status: "pass" }
              ]
            },
            merge_plan: {
              status: "ready_for_review",
              capsule_name: "Acoustic Science Foundations",
              canonical_mutation: "none",
              object_counts: { claims: 1, sources: 1, notes: 0, tools: 0 },
              actions: [{ target_type: "claims", count: 1, action: "create_review_items" }]
            },
            warnings: [],
            created_at: "2026-06-14T12:00:00Z"
          };
          importRows = [{ ...imported, id: imported.import_id, import_id: undefined }];
          return imported;
        }
        if (route === "capsules.import.reviewItems") {
          reviewRows = [
            {
              id: "rev_import_claim",
              workspace_id: "wrk_default",
              item_type: "capsule_import_claim",
              title: "Imported claim: Resonance depends on boundary conditions",
              summary: "Acoustic Science Foundations: claim requires review before merge.",
              payload: {
                type: "capsule_import",
                capsule_import_id: "capimp_test",
                import_target_type: "claim",
                import_target_id: "clm_remote_resonance",
                body: "Resonance depends on boundary conditions.",
                canonical_mutation: "none",
                merge_action_preview: "created",
                merge_summary: "Approval creates a weakly supported local claim that still needs evidence review.",
                merge_preview: {
                  import_target_type: "claim",
                  import_target_id: "clm_remote_resonance",
                  canonical_target_type: "claim",
                  canonical_target_id: null,
                  action: "created",
                  summary: "Approval creates a weakly supported local claim that still needs evidence review.",
                  requires_review: true,
                  conflict_count: 1,
                  comparison: [
                    {
                      field: "normalized_text",
                      label: "Claim",
                      imported: "Resonance depends on boundary conditions.",
                      local: "Resonance depends on room boundaries.",
                      changed: true
                    }
                  ]
                }
              },
              status: "pending",
              created_at: "2026-06-14T12:20:00Z",
              updated_at: "2026-06-14T12:20:00Z"
            }
          ];
          return {
            import_id: "capimp_test",
            status: "review_ready",
            created_review_items: 2,
            skipped_duplicates: 0,
            review_item_ids: ["rev_import_claim", "rev_import_source"],
            merge_plan: {
              status: "review_items_created",
              review_item_ids: ["rev_import_claim", "rev_import_source"]
            }
          };
        }
        if (route === "notes.list") return [];
        if (route === "sources.list") return [];
        if (route === "claims.list") return [];
        if (route === "graph.nodes") return [{ id: "node_natural_frequency", node_type: "concept", title: "Natural frequency", canonical_text: "Natural frequency", status: "active", updated_at: "2026-06-14T12:00:00Z" }];
        if (route === "learning.items") return [{ id: "learn_natural_frequency", type: "flashcard", title: "Natural frequency recall", status: "active" }];
        if (route === "tools.list") return [{ id: "tool_claim_citation_checker", name: "Claim citation checker", slug: "claim-citation-checker", version: "0.1.0", status: "installed" }];
        if (route === "review.list") return reviewRows;
        return [];
      }),
      selectFiles
    };
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Capsules" }));
    expect(await screen.findByText("No capsules")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("No capsule selected")).toBeNull());
    await waitFor(() => expect(screen.queryByLabelText("Find capsules")).toBeNull());
    expect(screen.getByRole("button", { name: "Import" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "New" })[0]);
    fireEvent.change(await screen.findByLabelText("Capsule name"), { target: { value: "Acoustic Science Foundations" } });
    const detailsSummary = screen.getByText("Details");
    expect((detailsSummary.closest("details") as HTMLDetailsElement).open).toBe(false);
    fireEvent.click(detailsSummary);
    fireEvent.change(screen.getByLabelText("Capsule purpose"), { target: { value: "Reusable acoustics research module." } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Acoustic Science Foundations")).toBeTruthy();
    expect(await screen.findByLabelText("Capsule counts")).toBeTruthy();
    expect(await screen.findByLabelText("Capsule target type")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Add note" })).toBeTruthy();
    expect(await screen.findByText("No notes")).toBeTruthy();
    expect(await screen.findByText("Acoustics intro note")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Remove Acoustics intro note" }));
    await waitFor(() => expect(window.vault.request).toHaveBeenCalledWith("capsules.removeItem", { capsuleId: "cap_acoustics", itemId: "capitem_note" }));
    await waitFor(() => expect(screen.queryByText("Acoustics intro note")).toBeNull());
    await waitFor(() => expect(window.vault.request).toHaveBeenCalledWith("graph.nodes", { limit: 100 }));
    expect(window.vault.request).toHaveBeenCalledWith("learning.items", undefined);
    expect(window.vault.request).toHaveBeenCalledWith("tools.list", undefined);
    fireEvent.click(await screen.findByText("Versions"));
    fireEvent.click(await screen.findByRole("button", { name: "Diff" }));
    expect(await screen.findByLabelText("Capsule version diff")).toBeTruthy();
    expect(await screen.findByText("1 added")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "More capsule actions" }));
    fireEvent.click(await screen.findByRole("button", { name: "Fork" }));
    expect(await screen.findByRole("heading", { name: "Acoustic Science Foundations Fork" })).toBeTruthy();
    expect(await screen.findByText("Fork of Acoustic Science Foundations")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Export capsule" }));
    const dialog = await screen.findByRole("dialog", { name: "Export capsule" });
    expect(await within(dialog).findByLabelText("Capsule export preview")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /^export$/i }));
    const exportResult = await within(dialog).findByLabelText("Capsule export result");
    expect(within(exportResult).getByText("acoustic-science-foundations.vaultcapsule")).toBeTruthy();
    const exportHistory = await within(dialog).findByLabelText("Capsule export history");
    expect(within(exportHistory).getByText("acoustic-science-foundations.vaultcapsule")).toBeTruthy();
    expect(within(exportHistory).getByText(/Reference Only/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close export dialog" }));
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(await screen.findByLabelText("Capsule import quarantine")).toBeTruthy();
    const history = await screen.findByLabelText("Capsule import history");
    expect(within(history).getByRole("button", { name: /Acoustic Science Foundations/i })).toBeTruthy();
    expect(await screen.findByText("quarantined")).toBeTruthy();
    expect(await screen.findByText("Claims")).toBeTruthy();
    expect(await screen.findByText("1 · Create Review Items")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close import" }));
    fireEvent.click(within(history).getByRole("button", { name: /Acoustic Science Foundations/i }));
    await waitFor(() => expect(window.vault.request).toHaveBeenCalledWith("capsules.import.get", { importId: "capimp_test" }));
    expect(await screen.findByLabelText("Capsule import quarantine")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /review items/i }));
    expect(await screen.findByLabelText("Capsule import review items")).toBeTruthy();
    expect(await screen.findByText("2 created")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /review items/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /open review/i }));
    await waitFor(() => expect(useUIStore.getState().surface).toBe("review"));
    expect(await screen.findByLabelText("Capsule import merge preview")).toBeTruthy();
    const conflictComparison = await screen.findByLabelText("Capsule import conflict comparison");
    expect(within(conflictComparison).getByText("Resonance depends on boundary conditions.")).toBeTruthy();
    expect(within(conflictComparison).getByText("Resonance depends on room boundaries.")).toBeTruthy();
    expect(await screen.findByText("Create new")).toBeTruthy();
    expect(await screen.findByText("Approval creates a weakly supported local claim that still needs evidence review.")).toBeTruthy();
  });

  it("creates contextual tasks from Capsule detail with capsule metadata", async () => {
    const capsule = {
      id: "cap_task_payload",
      name: "Focused Research Capsule",
      slug: "focused-research-capsule",
      description: null,
      purpose: "Keep the current synthesis bounded.",
      capsule_type: "project",
      status: "active",
      version: "0.3.0",
      language: "en",
      domains: ["research"],
      tags: [],
      epistemic_strictness: "strict",
      default_source_policy: "reference_only",
      updated_at: "2026-06-21T00:00:00Z",
      counts: { sources: 2, notes: 1, claims: 3, concepts: 0, tools: 0 },
      health: { score: 0.82, status: "healthy", warnings: [] },
      items: [],
      versions: [],
      dependencies: [],
      activity: []
    };
    let createdPayload: any;
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list" || route === "events.list") return [];
      if (route === "stats.get") {
        return {
          sources: 2,
          source_blocks: 4,
          notes: 1,
          claims: 3,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "capsules.list") return { items: [capsule], total: 1 };
      if (route === "capsules.get") return capsule;
      if (route === "capsules.imports") return { items: [], total: 0 };
      if (route === "notes.list" || route === "sources.list" || route === "claims.list" || route === "graph.nodes" || route === "learning.items" || route === "tools.list") return [];
      if (route === "todos.create") {
        createdPayload = payload;
        return {
          id: "todo_capsule_payload",
          title: payload.text,
          status: "open",
          priority: 3,
          labels: [],
          context_links: payload.context_links,
          provenance: payload.provenance,
          created_at: "2026-06-21T00:00:01Z",
          updated_at: "2026-06-21T00:00:01Z"
        };
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "capsules", selectedCapsuleId: capsule.id });
    renderApp();

    expect(await screen.findByRole("heading", { name: "Focused Research Capsule" })).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "More capsule actions" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create task" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "New task" })).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createdPayload).toBeTruthy());
    expect(createdPayload).toEqual({
      text: "Follow up: Focused Research Capsule",
      provenance: { created_from: "capsule" },
      context_links: [
        {
          target_type: "capsule",
          target_id: capsule.id,
          target_title: capsule.name,
          relation: "follow_up",
          exact_quote: undefined,
          locator: undefined,
          metadata: {
            created_from: "capsule",
            capsule_type: "project",
            version: "0.3.0",
            health_status: "healthy",
            health_score: 0.82,
            counts: { sources: 2, notes: 1, claims: 3, concepts: 0, tools: 0 }
          }
        }
      ]
    });
  });

  it("shows invalid capsule import diagnostics without review handoff", async () => {
    const invalidImport = {
      import_id: "capimp_invalid",
      status: "invalid",
      source_file_path: "/tmp/broken.vaultcapsule",
      quarantine_path: "/tmp/capsules/imports/capimp_invalid",
      manifest: {},
      validation_report: {
        status: "invalid",
        file_count: 2,
        unpacked_bytes: 512,
        checksum_results: [{ path: "manifest.json", status: "failed" }],
        errors: ["Package is missing required files: manifest-sha256.txt.", "manifest-sha256.txt does not match manifest.json."],
        warnings: []
      },
      merge_plan: {
        status: "blocked",
        capsule_name: null,
        object_counts: {},
        actions: []
      },
      warnings: [],
      created_at: "2026-06-14T13:00:00Z"
    };
    window.vault = {
      request: vi.fn(async (route: string) => {
        if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
        if (route === "jobs.list") return [];
        if (route === "capsules.list") return { items: [], total: 0 };
        if (route === "capsules.imports") return { items: [invalidImport], total: 1 };
        if (route === "capsules.import.get") return invalidImport;
        return [];
      }),
      selectFiles: vi.fn(async () => [])
    };
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Capsules" }));
    const historyButton = await screen.findByRole("button", { name: /Imported capsule/i });
    fireEvent.click(historyButton);

    const errors = await screen.findByLabelText("Capsule import validation errors");
    expect(within(errors).getByText("Review blocked")).toBeTruthy();
    expect(within(errors).getByText("Package is missing required files: manifest-sha256.txt.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /review items/i }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: /open review/i })).toBeNull();
  });

  it("adds the current note to a capsule from the note editor", async () => {
    const capsule = {
      id: "cap_fieldwork",
      name: "Fieldwork Packet",
      slug: "fieldwork-packet",
      description: null,
      purpose: null,
      capsule_type: "project",
      status: "draft",
      version: "0.1.0",
      language: "en",
      domains: [],
      tags: [],
      epistemic_strictness: "balanced",
      default_source_policy: "reference_only",
      updated_at: "2026-06-14T12:00:00Z",
      counts: { sources: 0, notes: 0, claims: 0, concepts: 0, tools: 0 },
      health: { score: 0, status: "needs_review", warnings: [] },
      items: [],
      versions: [],
      activity: []
    };
    const note = {
      id: "note_fieldwork",
      title: "Fieldwork synthesis",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "A short note." }] }] },
      content_markdown: "A short note.\n",
      origin: "user_written",
      status: "active",
      version: 1,
      source_id: "",
      updated_at: "2026-06-14T12:00:00Z"
    };
    const request = vi.fn(async (route: string) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 1,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          capsules: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "notes.list") return [note];
      if (route === "sources.list") return [];
      if (route === "capsules.list") return { items: [capsule], total: 1 };
      if (route === "capsules.addItems") return { added: 1 };
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "notes", selectedNoteId: "note_fieldwork" });
    renderApp();

    expect(await screen.findByDisplayValue("Fieldwork synthesis")).toBeTruthy();
    await openNoteTools();
    fireEvent.click(await screen.findByRole("button", { name: "Capsule" }));
    const dialog = await screen.findByRole("dialog", { name: "Add to capsule" });
    expect(await within(dialog).findByText("Fieldwork Packet")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /^add$/i }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("capsules.addItems", {
        capsuleId: "cap_fieldwork",
        items: [
          {
            target_type: "note",
            target_id: "note_fieldwork",
            role: "core",
            include_mode: "reference",
            export_policy: undefined,
            auto_include_evidence: false
          }
        ]
      })
    );
  });

  it("surfaces the first-run workspace start from Home", async () => {
    window.vault = {
      request: vi.fn(async (route: string) => {
        if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
        if (route === "jobs.list") return [];
        if (route === "stats.get") {
          return {
            sources: 0,
            source_blocks: 0,
            notes: 0,
            claims: 0,
            claims_without_evidence: 0,
            contradicted_claims: 0,
            pending_review_items: 0,
            generated_notes_pending_review: 0,
            installed_tools: 0,
            failed_jobs: 0,
            learning_items: 0
          };
        }
        if (route === "events.list") return [];
        if (route === "nightLab.latestBrief") return null;
        if (route === "ai.setup.status") {
          return {
            mode: "local_only",
            overall_status: "blocked",
            recommended_profile: "standard",
            recommended_pack_id: "standard-local-pack",
            demo_pack_id: "tiny-local-pack",
            privacy_label: "local only",
            next_action: "Prepare demo lab or approve production local models.",
            can_use_demo: true,
            blocked_reasons: ["Production model approval pending."],
            steps: []
          };
        }
        if (route === "notes.list") return [];
        if (route === "sources.list") return [];
        if (route === "ai.capabilities") return [];
        if (route === "ai.providers") return [];
        return [];
      }),
      selectFiles: vi.fn(async () => [])
    };
    useUIStore.setState({ surface: "dashboard" });
    renderApp();

    const path = await screen.findByLabelText("Workspace start");
    expect(within(path).getByRole("button", { name: /notes empty quick note/i })).toBeTruthy();
    expect(within(path).getByRole("button", { name: /storage empty add source/i })).toBeTruthy();
    expect(within(path).getByRole("button", { name: /review clear open review/i })).toBeTruthy();
    expect(within(path).getByRole("button", { name: /models/i })).toBeTruthy();
    expect(within(path).queryByText("Start here")).toBeNull();
    expect(within(path).queryByText("Capture a thought without choosing a folder first.")).toBeNull();
    expect(within(path).queryByText("Import source material when it should stay unchanged.")).toBeNull();
    expect(within(path).queryByText("Suggestions wait here before becoming knowledge.")).toBeNull();
    expect(await within(path).findByText("blocked")).toBeTruthy();

    fireEvent.click(within(path).getByRole("button", { name: /quick note/i }));
    expect(await screen.findByLabelText("Quick note text")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /close quick note/i }));

    fireEvent.click(within(path).getByRole("button", { name: /add source/i }));
    await waitFor(() => expect(useUIStore.getState().surface).toBe("sources"));
    expect(await screen.findByRole("button", { name: /add source/i })).toBeTruthy();
    expect(await screen.findByText("No sources")).toBeTruthy();
    expect(document.querySelector(".split-view-empty-list")).toBeTruthy();
    expect(document.querySelector(".list-pane")).toBeNull();
    expect(screen.queryByText("Paste text, import files, or transcribe audio.")).toBeNull();
  });

  it("captures a quick note from the global shortcut", async () => {
    let createdNote: any | undefined;
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: createdNote ? 1 : 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "notes.create") {
        createdNote = {
          id: "note_quick",
          title: payload.title,
          content: payload.content_json,
          content_markdown: payload.content_markdown,
          origin: payload.origin,
          status: "active",
          version: 1,
          source_id: "src_quick",
          updated_at: "2026-06-05T00:00:00Z"
        };
        return createdNote;
      }
      if (route === "notes.list") return createdNote ? [createdNote] : [];
      if (route === "sources.list") return [];
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = {
      request,
      selectFiles: vi.fn(async () => [])
    };
    renderApp();

    fireEvent.keyDown(document, { code: "KeyN", key: "N", metaKey: true, shiftKey: true });
    const quickNoteText = await screen.findByLabelText("Quick note text");
    const captureDestination = await screen.findByLabelText("Capture destination");
    expect(within(captureDestination).getByText("Thought")).toBeTruthy();
    expect(within(captureDestination).getByText("Evidence")).toBeTruthy();
    expect(within(captureDestination).queryByText("Note")).toBeNull();
    expect(within(captureDestination).queryByText("Storage")).toBeNull();
    expect(screen.getByRole("button", { name: /save as thought/i }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /^capture as evidence$/i }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.change(quickNoteText, { target: { value: "Shortcut thought\nSecond line" } });
    fireEvent.keyDown(quickNoteText, { key: "Enter", code: "Enter", metaKey: true });

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "notes.create",
        expect.objectContaining({
          title: "Shortcut thought",
          content_markdown: "Shortcut thought\nSecond line\n",
          content_json: expect.objectContaining({
            capture_mode: "quick_note",
            capture_destination: "notes",
            editor_engine: "tiptap"
          }),
          origin: "user_written"
        })
      )
    );
    expect(await screen.findByRole("button", { name: /new note/i })).toBeTruthy();
    expect(await screen.findByDisplayValue("Shortcut thought")).toBeTruthy();
  });

  it("captures a quick task from the global shortcut", async () => {
    let todoRows: any[] = [];
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "todos.create") {
        const todo = {
          id: "todo_quick_task",
          title: "Email Anna about quote mismatch",
          description: "",
          status: "open",
          priority: 2,
          due_date: "2026-06-17",
          due_time: null,
          recurrence_rule: null,
          list_id: null,
          list_name: null,
          labels: [],
          context_links: [],
          source_kind: "user",
          source_ref: {},
          provenance: {},
          created_at: "2026-06-16T10:00:00Z",
          updated_at: "2026-06-16T10:00:00Z",
          completed_at: null
        };
        todoRows = [todo];
        return todo;
      }
      if (route === "todos.list") return { items: todoRows, total: todoRows.length, view: payload?.view ?? "inbox" };
      if (route === "todoLists.list") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    renderApp();

    fireEvent.keyDown(document, { code: "KeyT", key: "T", metaKey: true, shiftKey: true });
    const quickTaskText = await screen.findByLabelText("Quick task text");
    expect(screen.getByRole("button", { name: /save as task/i }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(quickTaskText, { target: { value: "Email Anna about quote mismatch tomorrow p2" } });
    fireEvent.keyDown(quickTaskText, { key: "Enter", code: "Enter", metaKey: true });

    await waitFor(() => expect(request).toHaveBeenCalledWith("todos.create", { text: "Email Anna about quote mismatch tomorrow p2" }));
    await waitFor(() => expect(useUIStore.getState().surface).toBe("tasks"));
    expect(await screen.findByText("Email Anna about quote mismatch")).toBeTruthy();
  });

  it("routes captured evidence from quick note into Storage intake", async () => {
    const request = vi.fn(async (route: string) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "notes.list") return [];
      if (route === "sources.list") return [];
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = {
      request,
      selectFiles: vi.fn(async () => [])
    };
    renderApp();

    fireEvent.keyDown(document, { code: "KeyN", key: "N", metaKey: true, shiftKey: true });
    const quickNoteText = await screen.findByLabelText("Quick note text");
    fireEvent.change(quickNoteText, { target: { value: "Exact excerpt from a paper." } });
    fireEvent.click(screen.getByRole("button", { name: /^capture as evidence$/i }));
    expect(screen.getByRole("button", { name: /save as thought/i }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /^capture as evidence$/i }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTitle("Command or Control Enter")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^save evidence$/i }));

    expect(await screen.findByRole("dialog", { name: /add source/i })).toBeTruthy();
    expect(await screen.findByDisplayValue("Exact excerpt from a paper.")).toBeTruthy();
    expect(request).not.toHaveBeenCalledWith("notes.create", expect.anything());
  });

  it("shows note purpose badges and keeps the editor aligned to the selected note", async () => {
    const notes = [
      {
        id: "note_written",
        title: "Written synthesis",
        content: {},
        content_markdown: "Interpretation belongs in notes.",
        origin: "user_written",
        status: "active",
        version: 1,
        source_id: "src_written",
        updated_at: "2026-06-05T00:00:00Z"
      },
      {
        id: "note_quick_filter",
        title: "Shortcut thought",
        content: { capture_mode: "quick_note" },
        content_markdown: "Shortcut thought\nSecond line.",
        origin: "user_written",
        status: "active",
        version: 1,
        source_id: "src_quick",
        updated_at: "2026-06-05T00:01:00Z"
      },
      {
        id: "note_storage_filter",
        title: "Evidence note",
        content: { capture_mode: "source_block_note" },
        content_markdown: "Quoted source block.",
        origin: "user_written",
        status: "active",
        version: 1,
        source_id: "src_storage",
        updated_at: "2026-06-05T00:02:00Z"
      },
      {
        id: "note_ai_filter",
        title: "Generated memo",
        content: { generation_status: "drafted" },
        content_markdown: "Generated synthesis awaits review.",
        origin: "ai_generated",
        status: "generated_pending_review",
        version: 1,
        source_id: "src_ai",
        updated_at: "2026-06-05T00:03:00Z"
      }
    ];
    const request = vi.fn(async (route: string) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: notes.length,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 1,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "notes.list") return notes;
      if (route === "sources.list") return [];
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "notes", selectedNoteId: "note_written" });
    renderApp();

    expect(await screen.findByDisplayValue("Written synthesis")).toBeTruthy();
    expect(screen.queryByRole("tablist", { name: "Note type" })).toBeNull();
    await openNoteTools();
    const tools = await screen.findByLabelText("Note actions");
    expect(within(tools).getByRole("button", { name: "Propose claims" })).toBeTruthy();
    expect(within(tools).getByRole("button", { name: "Draft memo" })).toBeTruthy();
    expect(within(tools).getByRole("button", { name: "Insert audio" })).toBeTruthy();
    expect(within(tools).getByRole("button", { name: "Open in Storage" })).toBeTruthy();
    expect(within(tools).queryByText("Make from this note")).toBeNull();
    expect(within(tools).queryByText("File and history")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Shortcut thought/i }));
    expect(await screen.findByDisplayValue("Shortcut thought")).toBeTruthy();
    expect(within(screen.getByRole("button", { name: /Shortcut thought.*Quick capture/i })).getByText("Quick capture")).toBeTruthy();
    expect(within(await screen.findByLabelText("Note metadata")).getByText("Quick capture")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Evidence note/i }));
    expect(await screen.findByDisplayValue("Evidence note")).toBeTruthy();
    expect(screen.getAllByText("From Storage").length).toBeGreaterThanOrEqual(1);
    expect(within(await screen.findByLabelText("Note metadata")).getByText("From Storage")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Generated memo/i }));
    expect(await screen.findByDisplayValue("Generated memo")).toBeTruthy();
    expect(within(await screen.findByLabelText("Note metadata")).getByText("Draft")).toBeTruthy();
    expect(await screen.findByText("Needs review")).toBeTruthy();
    expect(screen.queryByText("AI draft")).toBeNull();
    expect(screen.queryByText("generated pending review")).toBeNull();
    expect(screen.getByText("Review generated draft")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Written synthesis/i }));
    expect(await screen.findByDisplayValue("Written synthesis")).toBeTruthy();
  });

  it("runs a scoped Night Lab pass and opens its review proposals and brief", async () => {
    let nightLabRun: any | undefined;
    const briefNote = {
      id: "note_morning",
      title: "Morning Lab Brief",
      content: { generation_status: "approved" },
      content_markdown:
        "# Morning Lab Brief\n\n## What changed\n- 2 review items prepared from recent sources.\n\n## Warnings\n- No canonical knowledge was changed without review approval.",
      origin: "lab_brief",
      status: "active",
      version: 1,
      source_id: "src_morning",
      updated_at: "2026-06-05T00:00:00Z"
    };
    const nightJob = () => ({
      id: "job_night",
      job_type: "night_lab",
      status: "completed",
      input: { tasks: nightLabRun?.tasks ?? [] },
      output: {
        created_review_items: 2,
        brief_note_id: "note_morning",
        task_results: {
          extract_new_objects: { status: "completed", created_review_items: 1 },
          find_unsupported_claims: { status: "completed", created_review_items: 1 }
        }
      },
      created_at: "2026-06-05T00:00:00Z",
      finished_at: "2026-06-05T00:00:02Z"
    });
    const reviewItem = {
      id: "rev_unsupported",
      item_type: "claim_status_change",
      title: "Unsupported claim: Claim needs evidence",
      summary: "Night Lab found a claim without attached evidence.",
      payload: {
        claim_id: "clm_weak",
        body: "Claim needs evidence before it can stay supported.",
        current_status: "supported",
        suggested_status: "weakly_supported",
        reason: "missing_evidence",
        actions: ["Attach supporting evidence in Storage, or approve the status change."]
      },
      status: "pending",
      created_by_job_id: "job_night",
      created_at: "2026-06-05T00:00:00Z"
    };
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return nightLabRun ? [nightJob()] : [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: nightLabRun ? 1 : 0,
          claims: 1,
          claims_without_evidence: 1,
          contradicted_claims: 0,
          pending_review_items: nightLabRun ? 1 : 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return nightLabRun ? [{ id: "evt_night", action: "night_lab.completed", created_at: "2026-06-05T00:00:02Z" }] : [];
      if (route === "nightLab.latestBrief") return nightLabRun ? briefNote : null;
      if (route === "nightLab.run") {
        nightLabRun = { ...payload, brief_note_id: "note_morning", created_review_items: 2 };
        return { job_id: "job_night", status: "completed", brief_note_id: "note_morning", created_review_items: 2, tasks: payload.tasks };
      }
      if (route === "todos.create") {
        expect(payload.text).toBe("Follow up on Morning Lab Brief");
        expect(payload.provenance).toEqual({ created_from: "note" });
        expect(payload.context_links).toEqual([
          expect.objectContaining({
            target_type: "note",
            target_id: "note_morning",
            target_title: "Morning Lab Brief",
            relation: "follow_up_brief",
            metadata: expect.objectContaining({
              created_from: "night_lab_brief",
              lab_job_id: "job_night",
              review_count: 2,
              finished_at: "2026-06-05T00:00:02Z"
            })
          })
        ]);
        expect(payload.context_links[0].metadata.selected_tasks).toEqual(expect.arrayContaining(["extract_new_objects", "find_unsupported_claims"]));
        expect(payload.context_links[0].metadata.selected_tasks).not.toContain("suggest_tools");
        return {
          id: "todo_night_brief",
          title: payload.text,
          status: "open",
          priority: 3,
          list_id: "list_inbox",
          labels: [],
          context_links: payload.context_links,
          created_at: "2026-06-05T00:00:03Z",
          updated_at: "2026-06-05T00:00:03Z"
        };
      }
      if (route === "review.list") return [reviewItem];
      if (route === "notes.list") return [briefNote];
      if (route === "sources.list") return [];
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "dashboard" });
    renderApp();
    fireEvent.click(await screen.findByLabelText(/Helper ideas/i));
    fireEvent.click(await screen.findByRole("button", { name: /run night lab/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "nightLab.run",
        expect.objectContaining({
          mode: "manual",
          autonomy_level: 2,
          tasks: expect.not.arrayContaining(["suggest_tools"])
        })
      )
    );
    expect(await screen.findByText("2 proposals")).toBeTruthy();
    expect(await screen.findByText(/2 review items prepared from recent sources/i)).toBeTruthy();
    expect(await screen.findByText("Complete")).toBeTruthy();
    const nightLabTasks = await screen.findByLabelText("Night Lab tasks");
    expect(within(nightLabTasks).getAllByText("Complete · 1 proposal")).toHaveLength(2);
    expect(within(nightLabTasks).queryByText(/completed ·/i)).toBeNull();
    expect(await screen.findByText("Recent activity")).toBeTruthy();
    expect(await screen.findByText("Night Lab Completed")).toBeTruthy();
    expect(screen.queryByText(/recent mutations/i)).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /create task from night lab brief/i }));
    const taskDialog = await screen.findByRole("dialog", { name: /new task/i });
    fireEvent.click(within(taskDialog).getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "todos.create",
        expect.objectContaining({
          context_links: [expect.objectContaining({ target_type: "note", target_id: "note_morning", relation: "follow_up_brief" })]
        })
      )
    );
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /new task/i })).toBeNull());

    fireEvent.click(await screen.findByRole("button", { name: /review proposals/i }));
    expect((await screen.findAllByText("Unsupported claim: Claim needs evidence")).length).toBeGreaterThan(0);
    expect(await screen.findByText(/supported to weakly supported/i)).toBeTruthy();

    fireEvent.click(await screen.findByRole("button", { name: "Home" }));
    fireEvent.click(await screen.findByRole("button", { name: /open brief/i }));
    expect(await screen.findByDisplayValue("Morning Lab Brief")).toBeTruthy();
  });

  it("runs local tools through JSON input and opens review output", async () => {
    let lastRun: any | undefined;
    const tool = {
      id: "tool_claim_citation_checker",
      name: "Claim Citation Checker",
      slug: "claim-citation-checker",
      version: "0.1.0",
      status: "installed",
      manifest: {
        runtime: "python",
        timeout_ms: 30000,
        description: "Checks whether claim evidence quotes are exact substrings of source blocks.",
        permissions: {
          read_sources: true,
          read_claims: true,
          propose_review_items: true,
          write_canonical_graph: false,
          network: false,
          shell: false
        },
        input_schema: { type: "object" },
        output_schema: { type: "object" }
      }
    };
    const importedTool = {
      id: "tool_imported_capsule",
      name: "Imported Capsule Tool",
      slug: "imported-capsule-tool",
      version: "0.1.0",
      status: "disabled",
      manifest: {
        runtime: "python",
        timeout_ms: 30000,
        description: "Imported from a capsule and held for review.",
        imported_from_capsule: true,
        import_review_required: true,
        permissions: {
          read_sources: true,
          write_canonical_graph: false,
          network: false,
          shell: false
        },
        input_schema: { type: "object" },
        output_schema: { type: "object" }
      }
    };
    const reviewItem = {
      id: "rev_tool",
      item_type: "claim_status_change",
      title: "Claim needs evidence: Tool finding",
      summary: "The citation checker found no evidence links for this claim.",
      payload: {
        claim_id: "clm_missing",
        suggested_status: "weakly_supported",
        reason: "missing_evidence"
      },
      status: "pending",
      created_by_job_id: "run_tool",
      created_at: "2026-06-05T00:00:00Z"
    };
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 1,
          claims_without_evidence: 1,
          contradicted_claims: 0,
          pending_review_items: lastRun ? 1 : 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "tools.list") return [tool, importedTool];
      if (route === "tools.runs") return lastRun ? [lastRun] : [];
      if (route === "tools.enable") {
        expect(payload).toEqual({ toolId: "tool_imported_capsule" });
        importedTool.status = "installed";
        importedTool.manifest.import_review_required = false;
        return { tool_id: "tool_imported_capsule", status: "installed" };
      }
      if (route === "tools.run") {
        expect(payload).toEqual({
          toolId: "tool_claim_citation_checker",
          data: { input: { claim_ids: ["clm_missing"] } }
        });
        lastRun = {
          id: "run_tool",
          tool_id: "tool_claim_citation_checker",
          status: "completed",
          input: payload.data.input,
          output: {
            findings: [{ claim_id: "clm_missing", status: "missing_evidence" }],
            review_items: [{ item_type: "claim_status_change", title: "Claim needs evidence: Tool finding" }],
            warnings: [],
            _review_items_created: 1
          },
          stdout: "checked 1 claim",
          stderr: "",
          started_at: "2026-06-05T00:00:00Z",
          finished_at: "2026-06-05T00:00:01Z"
        };
        return { run_id: "run_tool", status: "completed", output: lastRun.output, stdout: "checked 1 claim", stderr: "" };
      }
      if (route === "todos.create") {
        expect(payload.text).toBe("Follow up on Claim Citation Checker result");
        expect(payload.provenance).toEqual({ created_from: "tool" });
        expect(payload.context_links).toEqual([
          expect.objectContaining({
            target_type: "tool",
            target_id: "tool_claim_citation_checker",
            target_title: "Claim Citation Checker result",
            relation: "follow_up_tool_run",
            locator: "tool run run_tool",
            metadata: expect.objectContaining({
              created_from: "tool_run",
              tool_id: "tool_claim_citation_checker",
              tool_name: "Claim Citation Checker",
              run_id: "run_tool",
              status: "completed",
              finding_count: 1,
              review_count: 1,
              output_hash: expect.any(String)
            })
          })
        ]);
        return {
          id: "todo_tool_run",
          title: payload.text,
          status: "open",
          priority: 3,
          labels: [],
          context_links: payload.context_links,
          created_at: "2026-06-05T00:00:02Z",
          updated_at: "2026-06-05T00:00:02Z"
        };
      }
      if (route === "review.list") return [reviewItem];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "tools" });
    renderApp();
    expect(await screen.findByRole("button", { name: /Imported Capsule Tool/i })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Local tools", level: 2 })).toBeNull();
    expect(screen.queryByText("Sandboxed helpers")).toBeNull();
    expect(screen.queryByText("Run approved local helpers against notes and Storage. Their output can create Review work, but cannot change trusted knowledge directly.")).toBeNull();
    expect(screen.queryByText(/Home Lab/i)).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /Imported Capsule Tool/i }));
    expect(await screen.findByRole("button", { name: "Enable" })).toBeTruthy();
    expect((screen.getByRole("button", { name: /^run$/i }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("tools.enable", { toolId: "tool_imported_capsule" }));
    fireEvent.click(await screen.findByRole("button", { name: /Claim Citation Checker/i }));
    expect(await screen.findByText("write canonical graph")).toBeTruthy();
    expect(await screen.findByText("History")).toBeTruthy();
    fireEvent.change(await screen.findByLabelText("Input"), {
      target: { value: "{\n  \"claim_ids\": [\"clm_missing\"]\n}" }
    });
    fireEvent.click(await screen.findByRole("button", { name: /^run$/i }));

    const helperResult = await screen.findByLabelText("Helper result summary");
    const toolRuns = await screen.findByLabelText("Tool runs");
    expect(within(toolRuns).getByText("Completed")).toBeTruthy();
    expect(within(helperResult).getByText("1 finding")).toBeTruthy();
    expect(within(helperResult).getByText("1 review item")).toBeTruthy();
    expect(within(helperResult).getByText("Completed")).toBeTruthy();
    expect(within(helperResult).queryByText("completed")).toBeNull();
    expect(await screen.findByText("Result JSON")).toBeTruthy();
    expect(await screen.findByText("checked 1 claim")).toBeTruthy();
    expect(await screen.findByText(/missing_evidence/)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /create task from helper result/i }));
    const taskDialog = await screen.findByRole("dialog", { name: /new task/i });
    fireEvent.click(within(taskDialog).getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "todos.create",
        expect.objectContaining({
          context_links: [expect.objectContaining({ target_type: "tool", target_id: "tool_claim_citation_checker", relation: "follow_up_tool_run" })]
        })
      )
    );
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /new task/i })).toBeNull());
    fireEvent.click(await screen.findByRole("button", { name: /review output/i }));
    expect((await screen.findAllByText("Claim needs evidence: Tool finding")).length).toBeGreaterThan(0);
  });

  it("persists Tiptap formatting from the note editor toolbar", async () => {
    const initialDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Existing research note." }]
        }
      ]
    };
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 1,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "notes.list") {
        return [
          {
            id: "note_format",
            title: "Format Draft",
            content: initialDoc,
            content_markdown: "Existing research note.\n",
            origin: "user_written",
            status: "active",
            version: 1,
            source_id: "src_format",
            updated_at: "2026-06-05T00:00:00Z"
          }
        ];
      }
      if (route === "notes.update") {
        return {
          id: payload.noteId,
          title: payload.data.title,
          content: payload.data.content_json,
          content_markdown: payload.data.content_markdown,
          origin: "user_written",
          status: "active",
          version: 2,
          source_id: "src_format",
          updated_at: "2026-06-05T00:00:01Z"
        };
      }
      if (route === "sources.list") {
        return [
          {
            id: "src_format",
            type: "note",
            title: "Format Draft",
            metadata: { note_id: "note_format" },
            created_at: "2026-06-05T00:00:00Z",
            updated_at: "2026-06-05T00:00:00Z"
          }
        ];
      }
      if (route === "sources.blocks") {
        return [
          {
            id: "block_format",
            source_id: "src_format",
            block_index: 0,
            locator: "note:1",
            text: "Existing research note."
          }
        ];
      }
      if (route === "sources.pipeline") {
        return {
          source_id: "src_format",
          source_title: "Format Draft",
          source_type: "note",
          source_status: "active",
          block_count: 1,
          embedded_block_count: 0,
          pending_review_items: 0,
          needs_edit_review_items: 0,
          approved_review_items: 0,
          rejected_review_items: 0,
          quarantined_items: 0,
          approved_claims: 0,
          evidence_links: 0,
          latest_extraction_job: null,
          stages: []
        };
      }
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    const saveTextFile = vi.fn(async () => ({ saved: true, filePath: "/tmp/format-draft-note_format.md", mimeType: "text/markdown", sizeBytes: 180 }));
    window.vault = { request, selectFiles: vi.fn(async () => []), saveTextFile };

    useUIStore.setState({ surface: "notes", selectedNoteId: "note_format" });
    renderApp();
    expect(await screen.findByDisplayValue("Format Draft")).toBeTruthy();
    const saveStatus = await screen.findByRole("status", { name: "Note save status" });
    expect(within(saveStatus).getByText("All changes saved")).toBeTruthy();

    fireEvent.click(await screen.findByRole("button", { name: "Heading 1" }));
    expect(within(saveStatus).getByText("Unsaved changes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "notes.update",
        expect.objectContaining({
          noteId: "note_format",
          data: expect.objectContaining({
            content_json: expect.objectContaining({
              type: "doc",
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: "heading",
                  attrs: expect.objectContaining({ level: 1 })
                })
              ])
            }),
            content_markdown: "# Existing research note.\n"
          })
        })
      )
    );
    await waitFor(() => expect(within(saveStatus).getByText("All changes saved")).toBeTruthy());

    await openNoteTools();
    fireEvent.click(screen.getByRole("button", { name: /export markdown/i }));
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "format-draft-note_format.md",
        contents:
          '---\nid: "note_format"\ntitle: "Format Draft"\norigin: "user_written"\nstatus: "active"\nversion: 1\nsource_id: "src_format"\nupdated_at: "2026-06-05T00:00:00Z"\n---\n\n# Existing research note.\n',
        mimeType: "text/markdown"
      })
    );
    expect(await screen.findByText("format-draft-note_format.md")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /open in storage/i }));
    await waitFor(() => {
      expect(useUIStore.getState().surface).toBe("sources");
      expect(useUIStore.getState().selectedSourceId).toBe("src_format");
    });
    expect(await screen.findByRole("heading", { name: "Format Draft" })).toBeTruthy();
    expect(await screen.findByText("Exact source text")).toBeTruthy();
    expect(screen.getAllByText("Existing research note.").length).toBeGreaterThan(0);
    expect(request).toHaveBeenCalledWith("sources.blocks", { sourceId: "src_format" });
  });

  it("previews and restores an earlier note version", async () => {
    let activeNote = {
      id: "note_restore",
      title: "Recoverable Note",
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Current draft." }] }]
      },
      content_markdown: "Current draft.\n",
      origin: "user_written",
      status: "active",
      version: 2,
      source_id: "src_restore",
      updated_at: "2026-06-05T00:00:02Z"
    };
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 1,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "notes.list") return [activeNote];
      if (route === "notes.versions") {
        expect(payload).toEqual({ noteId: "note_restore" });
        return [
          {
            id: "ver_2",
            note_id: "note_restore",
            version: 2,
            content: activeNote.content,
            content_markdown: "Current draft.\n",
            created_by: "user",
            created_at: "2026-06-05T00:00:02Z"
          },
          {
            id: "ver_1",
            note_id: "note_restore",
            version: 1,
            content: {
              type: "doc",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Earlier evidence." }] }]
            },
            content_markdown: "Earlier evidence.\n",
            created_by: "user",
            created_at: "2026-06-05T00:00:01Z"
          }
        ];
      }
      if (route === "notes.restoreVersion") {
        activeNote = {
          ...activeNote,
          content: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Earlier evidence." }] }]
          },
          content_markdown: "Earlier evidence.\n",
          version: 3,
          updated_at: "2026-06-05T00:00:03Z"
        };
        return activeNote;
      }
      if (route === "sources.list") return [];
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "notes", selectedNoteId: "note_restore" });
    renderApp();
    expect(await screen.findByDisplayValue("Recoverable Note")).toBeTruthy();

    await openNoteTools();
    const tools = document.querySelector(".note-tools-body");
    expect(tools).toBeTruthy();
    fireEvent.click(within(tools as HTMLElement).getByRole("button", { name: "Versions" }));
    expect(await screen.findByText("2 versions")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /v1/i }));
    expect(await screen.findByText(/Earlier evidence/)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /restore v1/i }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("notes.restoreVersion", {
        noteId: "note_restore",
        version: 1
      })
    );
  });

  it("keeps empty note version history quiet", async () => {
    const note = {
      id: "note_versions_empty",
      title: "Quiet Version Note",
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Draft without saved versions." }] }]
      },
      content_markdown: "Draft without saved versions.\n",
      origin: "user_written",
      status: "active",
      version: 1,
      updated_at: "2026-06-05T00:00:00Z"
    };
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 1,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "notes.list") return [note];
      if (route === "notes.versions") {
        expect(payload).toEqual({ noteId: "note_versions_empty" });
        return [];
      }
      if (route === "sources.list") return [];
      if (route === "claims.list") return [];
      if (route === "capsules.list") return { items: [] };
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "notes", selectedNoteId: "note_versions_empty" });
    renderApp();

    expect(await screen.findByDisplayValue("Quiet Version Note")).toBeTruthy();
    await openNoteTools();
    const tools = document.querySelector(".note-tools-body");
    expect(tools).toBeTruthy();
    fireEvent.click(within(tools as HTMLElement).getByRole("button", { name: "Versions" }));
    expect(await screen.findByText("0 versions")).toBeTruthy();
    expect(await screen.findByText("No versions")).toBeTruthy();
    expect(screen.queryByText("Version history")).toBeNull();
    expect(screen.queryByText("No saved versions yet.")).toBeNull();
    expect(screen.queryByText("Loading saved versions...")).toBeNull();
  });

  it("opens quick note from the Electron app shortcut event", async () => {
    let quickNoteListener: (() => void) | undefined;
    window.vault = {
      request: vi.fn(async (route: string) => {
        if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
        if (route === "jobs.list") return [];
        if (route === "stats.get") {
          return {
            sources: 0,
            source_blocks: 0,
            notes: 0,
            claims: 0,
            claims_without_evidence: 0,
            contradicted_claims: 0,
            pending_review_items: 0,
            generated_notes_pending_review: 0,
            installed_tools: 0,
            failed_jobs: 0,
            learning_items: 0
          };
        }
        if (route === "events.list") return [];
        return [];
      }),
      selectFiles: vi.fn(async () => []),
      onQuickNote: vi.fn((callback) => {
        quickNoteListener = callback;
        return vi.fn();
      })
    };
    renderApp();

    await screen.findByText("The Vault");
    act(() => quickNoteListener?.());

    expect(await screen.findByLabelText("Quick note text")).toBeTruthy();
  });

  it("opens quick task from the Electron app shortcut event", async () => {
    let quickTaskListener: (() => void) | undefined;
    window.vault = {
      request: vi.fn(async (route: string) => {
        if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
        if (route === "jobs.list") return [];
        if (route === "stats.get") {
          return {
            sources: 0,
            source_blocks: 0,
            notes: 0,
            claims: 0,
            claims_without_evidence: 0,
            contradicted_claims: 0,
            pending_review_items: 0,
            generated_notes_pending_review: 0,
            installed_tools: 0,
            failed_jobs: 0,
            learning_items: 0
          };
        }
        if (route === "events.list") return [];
        return [];
      }),
      selectFiles: vi.fn(async () => []),
      onQuickTask: vi.fn((callback) => {
        quickTaskListener = callback;
        return vi.fn();
      })
    };
    renderApp();

    await screen.findByText("The Vault");
    act(() => quickTaskListener?.());

    expect(await screen.findByLabelText("Quick task text")).toBeTruthy();
  });

  it("opens Storage source intake from the global shortcut", async () => {
    window.vault = {
      request: vi.fn(async (route: string) => {
        if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
        if (route === "jobs.list") return [];
        if (route === "stats.get") {
          return {
            sources: 0,
            source_blocks: 0,
            notes: 0,
            claims: 0,
            claims_without_evidence: 0,
            contradicted_claims: 0,
            pending_review_items: 0,
            generated_notes_pending_review: 0,
            installed_tools: 0,
            failed_jobs: 0,
            learning_items: 0
          };
        }
        if (route === "events.list") return [];
        if (route === "sources.list") return [];
        return [];
      }),
      selectFiles: vi.fn(async () => [])
    };
    renderApp();

    fireEvent.keyDown(document, { code: "KeyE", key: "E", metaKey: true, shiftKey: true });

    await waitFor(() => expect(useUIStore.getState().surface).toBe("sources"));
    expect(await screen.findByRole("dialog", { name: /add source/i })).toBeTruthy();
    expect(await screen.findByLabelText("Source text")).toBeTruthy();
  });

  it("opens Storage source intake from the Electron app shortcut event", async () => {
    let addSourceListener: (() => void) | undefined;
    window.vault = {
      request: vi.fn(async (route: string) => {
        if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
        if (route === "jobs.list") return [];
        if (route === "stats.get") {
          return {
            sources: 0,
            source_blocks: 0,
            notes: 0,
            claims: 0,
            claims_without_evidence: 0,
            contradicted_claims: 0,
            pending_review_items: 0,
            generated_notes_pending_review: 0,
            installed_tools: 0,
            failed_jobs: 0,
            learning_items: 0
          };
        }
        if (route === "events.list") return [];
        if (route === "sources.list") return [];
        return [];
      }),
      selectFiles: vi.fn(async () => []),
      onAddSource: vi.fn((callback) => {
        addSourceListener = callback;
        return vi.fn();
      })
    };
    renderApp();

    await screen.findByText("The Vault");
    act(() => addSourceListener?.());

    await waitFor(() => expect(useUIStore.getState().surface).toBe("sources"));
    expect(await screen.findByRole("dialog", { name: /add source/i })).toBeTruthy();
  });

  it("opens quick note from the Notes empty state action", async () => {
    useUIStore.setState({ surface: "notes" });
    window.vault = {
      request: vi.fn(async (route: string) => {
        if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
        if (route === "jobs.list") return [];
        if (route === "stats.get") {
          return {
            sources: 0,
            source_blocks: 0,
            notes: 0,
            claims: 0,
            claims_without_evidence: 0,
            contradicted_claims: 0,
            pending_review_items: 0,
            generated_notes_pending_review: 0,
            installed_tools: 0,
            failed_jobs: 0,
            learning_items: 0
          };
        }
        if (route === "events.list") return [];
        if (route === "notes.list") return [];
        return [];
      }),
      selectFiles: vi.fn(async () => [])
    };
    renderApp();

    const editorPane = (await screen.findAllByText("No notes")).find((node) => node.closest(".editor-pane"))?.closest(".editor-pane");
    expect(editorPane).toBeTruthy();
    expect(document.querySelector(".split-view-empty-list")).toBeTruthy();
    expect(document.querySelector(".list-pane")).toBeNull();
    fireEvent.click(await within(editorPane as HTMLElement).findByRole("button", { name: /quick note/i }));

    expect(await screen.findByLabelText("Quick note text")).toBeTruthy();
    expect(screen.getByTitle("Command or Control Enter")).toBeTruthy();
  });

  it("focuses command search from the global shortcut", async () => {
    window.vault = {
      request: vi.fn(async (route: string) => {
        if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
        if (route === "jobs.list") return [];
        if (route === "stats.get") {
          return {
            sources: 0,
            source_blocks: 0,
            notes: 0,
            claims: 0,
            claims_without_evidence: 0,
            contradicted_claims: 0,
            pending_review_items: 0,
            generated_notes_pending_review: 0,
            installed_tools: 0,
            failed_jobs: 0,
            learning_items: 0
          };
        }
        if (route === "events.list") return [];
        return [];
      }),
      selectFiles: vi.fn(async () => [])
    };
    renderApp();

    const search = await screen.findByPlaceholderText("Search notes, Storage, or actions");
    fireEvent.keyDown(document, { code: "KeyK", key: "k", metaKey: true });

    await waitFor(() => expect(document.activeElement).toBe(search));
    const commands = await screen.findByLabelText("Search and actions");
    expect(within(commands).getByLabelText("Suggested actions")).toBeTruthy();
    expect(within(commands).queryByText("Fast actions")).toBeNull();
    expect(within(commands).queryByRole("tablist", { name: "Search style" })).toBeNull();
    expect(within(commands).getByRole("option", { name: /Quick note/i })).toBeTruthy();
    expect(within(commands).getByRole("option", { name: /Quick task/i })).toBeTruthy();
    expect(within(commands).getByRole("option", { name: /New note/i })).toBeTruthy();
    expect(within(commands).getByRole("option", { name: /Add source/i })).toBeTruthy();
    expect(within(commands).getByRole("option", { name: /Open Notes/i })).toBeTruthy();
    expect(within(commands).getByRole("option", { name: /Open Storage/i })).toBeTruthy();
    expect(within(commands).queryByText("Open a blank research note for authored thinking.")).toBeNull();
    expect(within(commands).queryByText("Import pasted text, files, or audio into immutable Storage.")).toBeNull();
    expect(within(commands).queryByText("Go to editable writing, quick captures, and synthesis.")).toBeNull();
    expect(within(commands).queryByText("Go to imported source records and evidence blocks.")).toBeNull();
  });

  it("focuses command search from the Electron app shortcut event", async () => {
    let focusSearchListener: (() => void) | undefined;
    window.vault = {
      request: vi.fn(async (route: string) => {
        if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
        if (route === "jobs.list") return [];
        if (route === "stats.get") {
          return {
            sources: 0,
            source_blocks: 0,
            notes: 0,
            claims: 0,
            claims_without_evidence: 0,
            contradicted_claims: 0,
            pending_review_items: 0,
            generated_notes_pending_review: 0,
            installed_tools: 0,
            failed_jobs: 0,
            learning_items: 0
          };
        }
        if (route === "events.list") return [];
        return [];
      }),
      selectFiles: vi.fn(async () => []),
      onFocusSearch: vi.fn((callback) => {
        focusSearchListener = callback;
        return vi.fn();
      })
    };
    renderApp();

    const search = await screen.findByPlaceholderText("Search notes, Storage, or actions");
    act(() => focusSearchListener?.());

    await waitFor(() => expect(document.activeElement).toBe(search));
  });

  it("creates a note from the command palette", async () => {
    let createdNote: any | undefined;
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: createdNote ? 1 : 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "notes.create") {
        createdNote = {
          id: "note_command",
          title: payload.title,
          content: payload.content_json,
          content_markdown: payload.content_markdown,
          origin: payload.origin,
          status: "active",
          version: 1,
          source_id: "src_command_note",
          updated_at: "2026-06-05T00:00:00Z"
        };
        return createdNote;
      }
      if (route === "notes.list") return createdNote ? [createdNote] : [];
      if (route === "sources.list") return [];
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    renderApp();

    fireEvent.keyDown(document, { code: "KeyK", key: "k", metaKey: true });
    const commands = await screen.findByLabelText("Search and actions");
    fireEvent.click(within(commands).getByRole("option", { name: /New note/i }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "notes.create",
        expect.objectContaining({
          title: "Untitled research note",
          content_markdown: "Untitled research note\n",
          origin: "user_written"
        })
      )
    );
    expect(await screen.findByRole("button", { name: /new note/i })).toBeTruthy();
    expect(await screen.findByDisplayValue("Untitled research note")).toBeTruthy();
  });

  it("opens quick task from the command palette", async () => {
    window.vault = {
      request: vi.fn(async (route: string) => {
        if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
        if (route === "jobs.list") return [];
        if (route === "stats.get") {
          return {
            sources: 0,
            source_blocks: 0,
            notes: 0,
            claims: 0,
            claims_without_evidence: 0,
            contradicted_claims: 0,
            pending_review_items: 0,
            generated_notes_pending_review: 0,
            installed_tools: 0,
            failed_jobs: 0,
            learning_items: 0
          };
        }
        if (route === "events.list") return [];
        return [];
      }),
      selectFiles: vi.fn(async () => [])
    };
    renderApp();

    fireEvent.keyDown(document, { code: "KeyK", key: "k", metaKey: true });
    const commands = await screen.findByLabelText("Search and actions");
    fireEvent.click(within(commands).getByRole("option", { name: /Quick task/i }));

    expect(await screen.findByLabelText("Quick task text")).toBeTruthy();
    expect(screen.getByRole("button", { name: /save as task/i }).getAttribute("aria-pressed")).toBe("true");
  });

  it("opens Storage source intake from the command palette", async () => {
    window.vault = {
      request: vi.fn(async (route: string) => {
        if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
        if (route === "jobs.list") return [];
        if (route === "stats.get") {
          return {
            sources: 0,
            source_blocks: 0,
            notes: 0,
            claims: 0,
            claims_without_evidence: 0,
            contradicted_claims: 0,
            pending_review_items: 0,
            generated_notes_pending_review: 0,
            installed_tools: 0,
            failed_jobs: 0,
            learning_items: 0
          };
        }
        if (route === "events.list") return [];
        if (route === "sources.list") return [];
        if (route === "ai.capabilities") return [];
        if (route === "ai.providers") return [];
        return [];
      }),
      selectFiles: vi.fn(async () => [])
    };
    renderApp();

    fireEvent.keyDown(document, { code: "KeyK", key: "k", metaKey: true });
    const commands = await screen.findByLabelText("Search and actions");
    fireEvent.click(within(commands).getByRole("option", { name: /Add source/i }));

    expect(await screen.findByRole("dialog", { name: /add source/i })).toBeTruthy();
    expect(await screen.findByLabelText("Source text")).toBeTruthy();
  });

  it("opens note search results in Notes", async () => {
    const note = {
      id: "note_search",
      title: "Interview synthesis",
      content_json: {},
      content_markdown: "# Interview synthesis\n\nEvidence belongs in notes when interpreted.",
      origin: "user_written",
      status: "active",
      version: 1,
      source_id: "src_note",
      created_at: "2026-06-05T00:00:00Z",
      updated_at: "2026-06-05T00:00:00Z"
    };
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 1,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "search.query") {
        expect(payload).toEqual(expect.objectContaining({ query: "interview", modes: ["hybrid"], limit: 6 }));
        return {
          results: [
            {
              target_type: "source_block",
              target_id: "block_note",
              title: "Interview synthesis",
              snippet: "Evidence belongs in notes when interpreted.",
              source_refs: ["src_note"],
              source_type: "note",
              source_title: "Interview synthesis",
              note_id: "note_search",
              locator: "p1",
              modes: ["fts"]
            }
          ]
        };
      }
      if (route === "notes.list") return [note];
      if (route === "sources.list") return [];
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    renderApp();

    fireEvent.change(await screen.findByPlaceholderText("Search notes, Storage, or actions"), { target: { value: "interview" } });
    const searchModeTabs = await screen.findByRole("tablist", { name: "Search style" });
    expect(within(searchModeTabs).getByRole("tab", { name: "Smart" }).getAttribute("data-state")).toBe("active");
    expect(within(searchModeTabs).getByRole("tab", { name: "Exact" })).toBeTruthy();
    expect(await screen.findByText(/Note · p1 · Exact/i)).toBeTruthy();
    fireEvent.click(await screen.findByRole("option", { name: /Interview synthesis/i }));

    expect(await screen.findByDisplayValue("Interview synthesis")).toBeTruthy();
    expect(await screen.findByRole("button", { name: /new note/i })).toBeTruthy();
  });

  it("opens storage search results in Storage", async () => {
    const source = {
      id: "src_storage",
      type: "text",
      title: "Participant transcript",
      metadata: {},
      created_at: "2026-06-05T00:00:00Z",
      updated_at: "2026-06-05T00:00:00Z"
    };
    const request = vi.fn(async (route: string) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "search.query") {
        return {
          results: [
            {
              target_type: "source_block",
              target_id: "block_storage",
              title: "Participant transcript",
              snippet: "Storage keeps imported evidence immutable.",
              source_refs: ["src_storage"],
              source_type: "text",
              source_title: "Participant transcript",
              note_id: null,
              locator: "p1",
              modes: ["fts", "vector"]
            }
          ]
        };
      }
      if (route === "sources.list") return [source];
      if (route === "sources.blocks") return [{ id: "block_storage", source_id: "src_storage", block_index: 0, locator: "p1", text: "Storage keeps imported evidence immutable." }];
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    renderApp();

    fireEvent.change(await screen.findByPlaceholderText("Search notes, Storage, or actions"), { target: { value: "storage" } });
    expect(await screen.findByText(/Storage · p1 · Exact \+ Semantic/i)).toBeTruthy();
    fireEvent.click(await screen.findByRole("option", { name: /Participant transcript/i }));

    expect((await screen.findAllByText("Participant transcript")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Storage keeps imported evidence immutable.")).length).toBeGreaterThan(0);
  });

  it("filters Storage records and keeps the evidence inspector aligned", async () => {
    const longRawPath = "/Users/test/Documents/research/literature/very-long-dataset-export-with-many-nested-folders-and-a-filename-that-keeps-going.pdf";
    const sources = [
      {
        id: "src_transcript_filter",
        type: "text",
        title: "Interview transcript",
        metadata: { capture_context: "storage_dialog_paste" },
        created_at: "2026-06-05T00:00:00Z",
        updated_at: "2026-06-05T00:00:00Z"
      },
      {
        id: "src_pdf_filter",
        type: "pdf",
        title: "Dataset export",
        raw_path: longRawPath,
        metadata: { capture_context: "storage_dialog_file" },
        created_at: "2026-06-05T00:01:00Z",
        updated_at: "2026-06-05T00:01:00Z"
      },
      {
        id: "src_note_filter",
        type: "note",
        title: "Generated note source",
        metadata: { capture_context: "note_sync" },
        created_at: "2026-06-05T00:02:00Z",
        updated_at: "2026-06-05T00:02:00Z"
      }
    ];
    const blocksBySource: Record<string, any[]> = {
      src_transcript_filter: [{ id: "block_transcript", source_id: "src_transcript_filter", block_index: 0, locator: "p1", text: "Transcript evidence belongs in Storage." }],
      src_pdf_filter: [{ id: "block_pdf", source_id: "src_pdf_filter", block_index: 0, locator: "p1", text: "PDF evidence." }],
      src_note_filter: [{ id: "block_note_source", source_id: "src_note_filter", block_index: 0, locator: "p1", text: "Note mirror source." }]
    };
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: sources.length,
          source_blocks: 3,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "sources.list") return sources;
      if (route === "sources.blocks") return blocksBySource[payload.sourceId] ?? [];
      if (route === "notes.list") return [];
      if (route === "ai.capabilities") {
        return [
          { capability: "extract_claims", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} },
          { capability: "extract_objects", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} }
        ];
      }
      if (route === "ai.providers") {
        return [
          {
            id: "mock_llm",
            display_name: "Mock Local LLM",
            kind: "llm",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          }
        ];
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "sources", selectedSourceId: "src_pdf_filter" });
    renderApp();

    expect((await screen.findAllByText("Dataset export")).length).toBeGreaterThan(0);
    const analysisTools = await screen.findByLabelText("Storage local analysis tools");
    expect(within(analysisTools).getByText("Claim suggestions")).toBeTruthy();
    expect(within(analysisTools).getByText("Concept suggestions")).toBeTruthy();
    expect(within(analysisTools).queryByText("setup")).toBeNull();
    expect(within(analysisTools).queryByText("mock local")).toBeNull();
    expect(within(analysisTools).queryByText("mock-local-llm")).toBeNull();
    expect(within(analysisTools).queryByText("No model selected")).toBeNull();
    const compactPath = await screen.findByTitle(longRawPath);
    expect(compactPath.textContent).not.toBe(longRawPath);
    expect(compactPath.textContent).toContain("...");
    fireEvent.change(await screen.findByLabelText("Search Storage sources"), { target: { value: "transcript" } });

    expect((await screen.findAllByText("Interview transcript")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Transcript evidence belongs in Storage.")).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByText("Dataset export")).toBeNull());
    expect(screen.getByText("1/3 shown")).toBeTruthy();
    fireEvent.change(await screen.findByLabelText("Search Storage sources"), { target: { value: "missing archive" } });
    expect(await screen.findByText("No sources")).toBeTruthy();
    expect(screen.getAllByText("No sources")).toHaveLength(1);
    expect(await screen.findByText("Source details")).toBeTruthy();
    expect(await screen.findByText("None selected")).toBeTruthy();
    expect(screen.queryByText("No matching sources")).toBeNull();
    expect(screen.queryByText("No matching source")).toBeNull();
    expect(screen.queryByText("Try another search.")).toBeNull();
  });

  it("opens the editable note from a note-backed Storage source", async () => {
    const note = {
      id: "note_storage_roundtrip",
      title: "Roundtrip synthesis",
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Editable synthesis lives in Notes." }] }]
      },
      content_markdown: "Editable synthesis lives in Notes.\n",
      origin: "user_written",
      status: "active",
      version: 1,
      source_id: "src_note_roundtrip",
      updated_at: "2026-06-05T00:00:00Z"
    };
    const source = {
      id: "src_note_roundtrip",
      type: "note",
      title: "Roundtrip synthesis",
      metadata: { note_id: "note_storage_roundtrip" },
      created_at: "2026-06-05T00:00:00Z",
      updated_at: "2026-06-05T00:00:00Z"
    };
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 1,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "sources.list") return [source];
      if (route === "sources.blocks") return [{ id: "block_note_roundtrip", source_id: payload.sourceId, block_index: 0, locator: "p1", text: "Editable synthesis lives in Notes." }];
      if (route === "sources.pipeline") {
        return {
          source_id: "src_note_roundtrip",
          source_title: "Roundtrip synthesis",
          source_type: "note",
          source_status: "active",
          block_count: 1,
          embedded_block_count: 0,
          pending_review_items: 0,
          needs_edit_review_items: 0,
          approved_review_items: 0,
          rejected_review_items: 0,
          quarantined_items: 0,
          approved_claims: 0,
          evidence_links: 0,
          latest_extraction_job: null,
          stages: []
        };
      }
      if (route === "notes.list") return [note];
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "sources", selectedSourceId: "src_note_roundtrip" });
    renderApp();

    expect(await screen.findByRole("heading", { name: "Roundtrip synthesis" })).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /^open note$/i }));

    await waitFor(() => {
      expect(useUIStore.getState().surface).toBe("notes");
      expect(useUIStore.getState().selectedNoteId).toBe("note_storage_roundtrip");
    });
    expect(await screen.findByDisplayValue("Roundtrip synthesis")).toBeTruthy();
  });

  it("shows the Storage source pipeline and opens Review from pending proposals", async () => {
    const source = {
      id: "src_pipeline",
      type: "text",
      title: "Pipeline source",
      metadata: { capture_context: "storage_dialog_paste" },
      created_at: "2026-06-05T00:00:00Z",
      updated_at: "2026-06-05T00:00:00Z"
    };
    const reviewItem = {
      id: "rev_pipeline",
      item_type: "new_claim",
      title: "Pipeline claim",
      summary: "Pipeline proposals should remain reviewable.",
      payload: {
        source_id: "src_pipeline",
        source_block_id: "block_pipeline",
        source_quote: "Pipeline proposals should remain reviewable."
      },
      status: "pending",
      created_at: "2026-06-05T00:00:00Z"
    };
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 1,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "sources.list") return [source];
      if (route === "sources.blocks") return [{ id: "block_pipeline", source_id: payload.sourceId, block_index: 0, locator: "p1", text: "Pipeline proposals should remain reviewable." }];
      if (route === "sources.pipeline") {
        return {
          source_id: "src_pipeline",
          source_title: "Pipeline source",
          source_type: "text",
          source_status: "active",
          block_count: 1,
          embedded_block_count: 1,
          pending_review_items: 1,
          needs_edit_review_items: 1,
          approved_review_items: 0,
          rejected_review_items: 0,
          quarantined_items: 0,
          approved_claims: 0,
          evidence_links: 0,
          latest_extraction_job: {
            id: "job_pipeline",
            status: "completed",
            created_at: "2026-06-05T00:00:00Z",
            finished_at: "2026-06-05T00:00:01Z",
            created_review_items: 2,
            quarantined_items: 0
          },
          stages: [
            { id: "imported", label: "Saved", status: "done", detail: "text source is stored in local Storage." },
            { id: "chunked", label: "Chunked", status: "done", detail: "1 source block ready for citation." },
            { id: "indexed", label: "Search ready", status: "done", detail: "1 FTS block; 1/1 vector indexed." },
            { id: "review", label: "Review proposals", status: "ready", detail: "2 proposals waiting in Review.", action_label: "Open Review", action_route: "review" },
            { id: "knowledge", label: "Trusted knowledge", status: "pending", detail: "0 approved claims with 0 evidence links." }
          ]
        };
      }
      if (route === "review.list") return [reviewItem];
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "sources", selectedSourceId: "src_pipeline" });
    renderApp();

    await screen.findByText("Source status");
    const pipeline = await screen.findByLabelText("Source pipeline");
    await waitFor(() => expect(pipeline.tagName.toLowerCase()).toBe("details"));
    expect((pipeline as HTMLDetailsElement).open).toBe(true);
    expect(within(pipeline).getByText("Source status")).toBeTruthy();
    expect(within(pipeline).getByText("2 review")).toBeTruthy();
    expect(within(pipeline).getByText("Search ready")).toBeTruthy();
    expect(within(pipeline).getByText("1 source block searchable; 1/1 ready for smart search.")).toBeTruthy();
    fireEvent.click(within(pipeline).getByRole("button", { name: /open review/i }));

    await waitFor(() => expect(useUIStore.getState().surface).toBe("review"));
    expect((await screen.findAllByText("Pipeline claim")).length).toBeGreaterThan(0);
  });

  it("creates a cited note from a selected Storage block", async () => {
    const source = {
      id: "src_evidence",
      type: "text",
      title: "Field report",
      metadata: {},
      created_at: "2026-06-05T00:00:00Z",
      updated_at: "2026-06-05T00:00:00Z"
    };
    const sourceBlocks = [
      {
        id: "block_context",
        source_id: "src_evidence",
        block_index: 0,
        locator: "p1",
        heading_path: "Context",
        text: "The observation setup was calibrated before the session."
      },
      {
        id: "block_signal",
        source_id: "src_evidence",
        block_index: 1,
        locator: "p2",
        heading_path: "Signal",
        text: "Participants returned to handwritten notes when synthesis felt uncertain."
      }
    ];
    let createdNote: any | undefined;
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 2,
          notes: createdNote ? 1 : 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "sources.list") return [source];
      if (route === "sources.blocks") return sourceBlocks;
      if (route === "notes.create") {
        createdNote = {
          id: "note_from_block",
          title: payload.title,
          content: payload.content_json,
          content_markdown: payload.content_markdown,
          origin: payload.origin,
          status: "active",
          version: 1,
          source_id: "src_note_from_block",
          updated_at: "2026-06-05T00:00:01Z"
        };
        return createdNote;
      }
      if (route === "notes.list") return createdNote ? [createdNote] : [];
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "sources", selectedSourceId: "src_evidence" });
    renderApp();

    fireEvent.change(await screen.findByLabelText("Filter source blocks"), { target: { value: "handwritten" } });
    expect(screen.queryByText("The observation setup was calibrated before the session.")).toBeNull();
    expect((await screen.findAllByText("Participants returned to handwritten notes when synthesis felt uncertain.")).length).toBeGreaterThan(0);
    fireEvent.change(await screen.findByLabelText("Filter source blocks"), { target: { value: "missing block" } });
    expect(await screen.findByText("No blocks")).toBeTruthy();
    expect(await screen.findByText("Block details")).toBeTruthy();
    expect(await screen.findByText("None selected")).toBeTruthy();
    expect(screen.queryByText("Select a block.")).toBeNull();
    expect(screen.queryByText("No source blocks match this filter.")).toBeNull();
    fireEvent.change(await screen.findByLabelText("Filter source blocks"), { target: { value: "handwritten" } });
    fireEvent.click(await screen.findByRole("button", { name: /new note from block/i }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "notes.create",
        expect.objectContaining({
          title: "Field report - p2",
          content_markdown: expect.stringContaining("Participants returned to handwritten notes when synthesis felt uncertain."),
          content_json: expect.objectContaining({
            source_ids: ["src_evidence"],
            source_block_ids: ["block_signal"],
            citations: [
              expect.objectContaining({
                source_id: "src_evidence",
                source_block_id: "block_signal",
                locator: "p2",
                source_quote: "Participants returned to handwritten notes when synthesis felt uncertain."
              })
            ],
            editor_doc: expect.objectContaining({ type: "doc" })
          }),
          origin: "user_written"
        })
      )
    );
    expect(await screen.findByDisplayValue("Field report - p2")).toBeTruthy();
    expect(await screen.findByText("cited evidence")).toBeTruthy();
  });

  it("imports pasted evidence through the Storage add source dialog", async () => {
    const longImportedSourceTitle = "Imported interview with a long archive title and nested folder context";
    let importedSource: any | undefined;
    let createdNote: any | undefined;
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: importedSource ? 1 : 0,
          source_blocks: importedSource ? 1 : 0,
          notes: createdNote ? 1 : 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "sources.list") return importedSource ? [importedSource] : [];
      if (route === "sources.blocks") {
        return importedSource
          ? [{ id: "block_storage", source_id: importedSource.id, block_index: 0, locator: "p1", text: "Evidence belongs in Storage." }]
          : [];
      }
      if (route === "sources.pipeline") {
        return {
          source_id: importedSource?.id ?? "src_storage",
          source_title: importedSource?.title ?? "Imported interview",
          source_type: importedSource?.type ?? "text",
          source_status: "active",
          block_count: importedSource ? 1 : 0,
          embedded_block_count: 0,
          pending_review_items: 0,
          needs_edit_review_items: 0,
          approved_review_items: 0,
          rejected_review_items: 0,
          quarantined_items: 0,
          approved_claims: 0,
          evidence_links: 0,
          latest_extraction_job: null,
          stages: []
        };
      }
      if (route === "sources.importText") {
        importedSource = {
          id: "src_storage",
          type: payload.type,
          title: payload.title,
          metadata: payload.metadata,
          created_at: "2026-06-05T00:00:00Z",
          updated_at: "2026-06-05T00:00:00Z"
        };
        return { source: importedSource, duplicate: false };
      }
      if (route === "sources.extract") return { created_review_items: 1, quarantined_items: 0 };
      if (route === "notes.create") {
        createdNote = {
          id: "note_from_imported_source",
          title: payload.title,
          content: payload.content_json,
          content_markdown: payload.content_markdown,
          origin: payload.origin,
          status: "active",
          version: 1,
          source_id: "src_note_from_imported_source",
          updated_at: "2026-06-05T00:00:01Z"
        };
        return createdNote;
      }
      if (route === "notes.list") return createdNote ? [createdNote] : [];
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "sources" });
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /add source/i }));
    fireEvent.change(await screen.findByLabelText("Source title"), { target: { value: longImportedSourceTitle } });
    const sourceText = await screen.findByLabelText("Source text");
    fireEvent.change(sourceText, { target: { value: "Evidence belongs in Storage." } });
    expect(await screen.findByText("28 characters · ⌘↵")).toBeTruthy();
    fireEvent.keyDown(sourceText, { key: "Enter", code: "Enter", metaKey: true });

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("sources.importText", {
        title: longImportedSourceTitle,
        type: "text",
        text: "Evidence belongs in Storage.",
        metadata: { capture_context: "storage_dialog_paste" }
      })
    );
    expect((await screen.findAllByText(longImportedSourceTitle)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Evidence belongs in Storage.")).length).toBeGreaterThan(0);
    const importFollowup = await screen.findByLabelText("Storage import next actions");
    expect(importFollowup.getAttribute("title")).toBe(longImportedSourceTitle);
    expect(await screen.findByText("Saved to Storage")).toBeTruthy();
    expect(within(importFollowup).queryByRole("button", { name: /find claims/i })).toBeNull();
    expect(within(importFollowup).queryByRole("button", { name: /check claims/i })).toBeNull();

    fireEvent.click(within(importFollowup).getByRole("button", { name: /review source/i }));
    fireEvent.click(within(importFollowup).getByRole("button", { name: /check claims/i }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("sources.extract", { sourceId: "src_storage" }));

    const startNote = await screen.findByRole("button", { name: /start cited note/i });
    await waitFor(() => expect((startNote as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(startNote);

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "notes.create",
        expect.objectContaining({
          title: `${longImportedSourceTitle} - p1`,
          content_markdown: expect.stringContaining("Evidence belongs in Storage."),
          content_json: expect.objectContaining({
            source_ids: ["src_storage"],
            source_block_ids: ["block_storage"],
            citations: [
              expect.objectContaining({
                source_id: "src_storage",
                source_block_id: "block_storage",
                locator: "p1",
                source_quote: "Evidence belongs in Storage."
              })
            ],
            editor_doc: expect.objectContaining({ type: "doc" })
          }),
          origin: "user_written"
        })
      )
    );
    expect(await screen.findByDisplayValue(`${longImportedSourceTitle} - p1`)).toBeTruthy();
    expect(await screen.findByText("cited evidence")).toBeTruthy();
  });

  it("imports files through the Storage add source dialog", async () => {
    let importedSource: any | undefined;
    const selectFiles = vi.fn(async () => ["/tmp/research-source.pdf"]);
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: importedSource ? 1 : 0,
          source_blocks: importedSource ? 1 : 0,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "sources.list") return importedSource ? [importedSource] : [];
      if (route === "sources.blocks") return [];
      if (route === "sources.importFiles") {
        importedSource = {
          id: "src_file",
          type: "pdf",
          title: "research-source",
          metadata: payload.metadata,
          created_at: "2026-06-05T00:00:00Z",
          updated_at: "2026-06-05T00:00:00Z"
        };
        return { source: importedSource, duplicate: false };
      }
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles };
    useUIStore.setState({ surface: "sources" });
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /add source/i }));
    fireEvent.click(await screen.findByRole("tab", { name: /files/i }));
    fireEvent.click(screen.getByRole("button", { name: /choose files/i }));

    await waitFor(() => expect(selectFiles).toHaveBeenCalled());
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("sources.importFiles", {
        file_path: "/tmp/research-source.pdf",
        metadata: { capture_context: "storage_dialog_file" }
      })
    );
    expect((await screen.findAllByText("research-source")).length).toBeGreaterThan(0);
  });

  it("transcribes audio files into Storage sources from the add source dialog", async () => {
    let importedSource: any | undefined;
    const selectAudioFiles = vi.fn(async () => ["/tmp/lab voice memo.wav"]);
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: importedSource ? 1 : 0,
          source_blocks: importedSource ? 1 : 0,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "sources.list") return importedSource ? [importedSource] : [];
      if (route === "sources.blocks") {
        return importedSource
          ? [{ id: "block_audio", source_id: importedSource.id, block_index: 0, locator: "t=0-1800ms", text: "Mock local transcript from selected audio." }]
          : [];
      }
      if (route === "voice.transcribe") {
        importedSource = {
          id: "src_audio",
          type: "audio",
          title: payload.title,
          metadata: payload.metadata,
          created_at: "2026-06-05T00:00:00Z",
          updated_at: "2026-06-05T00:00:00Z",
          raw_path: payload.audio_path
        };
        return {
          source_id: importedSource.id,
          audio_asset_id: "aud_storage",
          transcript_segments: 1,
          sent_off_device: false
        };
      }
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []), selectAudioFiles };
    useUIStore.setState({ surface: "sources" });
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /add source/i }));
    fireEvent.click(await screen.findByRole("tab", { name: /audio/i }));
    fireEvent.click(screen.getByRole("button", { name: /choose audio/i }));

    await waitFor(() => expect(selectAudioFiles).toHaveBeenCalled());
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("voice.transcribe", {
        audio_path: "/tmp/lab voice memo.wav",
        title: "lab voice memo",
        create_source: true,
        local_only: true,
        metadata: { capture_context: "storage_dialog_audio" }
      })
    );
    expect((await screen.findAllByText("lab voice memo")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("t=0-1800ms")).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText("Mock local transcript from selected audio.")).length).toBeGreaterThanOrEqual(1);
  });

  it("reviews a claim proposal with evidence navigation and a decision note", async () => {
    const longReviewTitle = "Handwriting supports uncertainty in the longitudinal synthesis workflow with a deliberately long reviewer-facing title";
    const longReviewSummary = "Participants returned to handwritten notes when synthesis felt uncertain, and this intentionally long summary should stay available without letting the review list become a wall of text.";
    const capsule = {
      id: "cap_review",
      name: "Review Capsule",
      slug: "review-capsule",
      description: null,
      purpose: null,
      capsule_type: "project",
      status: "draft",
      version: "0.1.0",
      language: "en",
      domains: [],
      tags: [],
      epistemic_strictness: "balanced",
      default_source_policy: "reference_only",
      updated_at: "2026-06-14T12:00:00Z",
      counts: { sources: 0, notes: 0, claims: 0, concepts: 0, tools: 0 },
      health: { score: 0, status: "needs_review", warnings: [] },
      items: [],
      versions: [],
      activity: []
    };
    const reviewItem = {
      id: "rev_claim",
      item_type: "new_claim",
      title: longReviewTitle,
      summary: longReviewSummary,
      status: "pending",
      created_at: "2026-06-05T00:00:00Z",
      payload: {
        type: "claim",
        title: longReviewTitle,
        body: "Participants returned to handwritten notes when synthesis felt uncertain.",
        source_id: "src_review",
        source_block_id: "blk_review",
        source_quote: "Participants returned to handwritten notes when synthesis felt uncertain.",
        confidence: 0.82,
        language: "en",
        tags: ["local_model_extraction"],
        model_id: "mock-local-llm"
      }
    };
    let approved = false;
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: approved ? 1 : 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: approved ? 0 : 1,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "review.list") return approved ? [] : [reviewItem];
      if (route === "review.approve") {
        approved = true;
        return { item_id: payload.itemId, status: "approved", created: { claim_id: "clm_review", evidence_link_id: "ev_review" } };
      }
      if (route === "capsules.list") return { items: [capsule], total: 1 };
      if (route === "capsules.addItems") return { added: 1 };
      if (route === "sources.list") {
        return [
          {
            id: "src_review",
            type: "text",
            title: "Review source",
            metadata: {},
            created_at: "2026-06-05T00:00:00Z",
            updated_at: "2026-06-05T00:00:00Z"
          }
        ];
      }
      if (route === "sources.blocks") {
        return [
          {
            id: "blk_review",
            source_id: "src_review",
            block_index: 0,
            locator: "p2",
            text: "Participants returned to handwritten notes when synthesis felt uncertain."
          }
        ];
      }
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "review", selectedReviewItemId: "rev_claim" });
    renderApp();

    const reviewTabs = await screen.findByRole("tablist", { name: "Review status" });
    expect(within(reviewTabs).getByRole("tab", { name: "To decide" }).getAttribute("data-state")).toBe("active");
    expect(within(reviewTabs).getByRole("tab", { name: "Rejected" })).toBeTruthy();
    const reviewSummary = await screen.findByLabelText("Review decision summary");
    expect(within(reviewSummary).getByText("1 to decide")).toBeTruthy();
    expect(within(reviewSummary).getByText("1 visible proposal.")).toBeTruthy();
    expect((await screen.findAllByTitle(longReviewTitle)).length).toBeGreaterThanOrEqual(2);
    expect((await screen.findAllByTitle(longReviewSummary)).length).toBeGreaterThanOrEqual(1);
    const reviewCard = (await screen.findByTitle(longReviewSummary)).closest(".review-card-main");
    expect(reviewCard).toBeTruthy();
    expect(within(reviewCard as HTMLElement).getByText(/Local model/)).toBeTruthy();
    expect(within(reviewCard as HTMLElement).queryByText(/mock-local-llm/)).toBeNull();
    expect(await screen.findByText("Proposal")).toBeTruthy();
    expect(await screen.findByText("Exact quote")).toBeTruthy();
    const proposal = (await screen.findByText("Proposal")).closest(".review-proposal");
    expect(proposal).toBeTruthy();
    expect(within(proposal as HTMLElement).getByText("Source block")).toBeTruthy();
    expect(within(proposal as HTMLElement).getByText("Local model")).toBeTruthy();
    expect(within(proposal as HTMLElement).queryByText("blk_review")).toBeNull();
    expect(within(proposal as HTMLElement).queryByText("mock-local-llm")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /open evidence/i }));
    expect(await screen.findByRole("heading", { name: "Review source" })).toBeTruthy();
    expect((await screen.findAllByText("Participants returned to handwritten notes when synthesis felt uncertain.")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    fireEvent.click(await screen.findByLabelText("Add approved claim to capsule"));
    fireEvent.click(await screen.findByRole("option", { name: "Review Capsule" }));
    fireEvent.change(await screen.findByLabelText("Decision reason"), { target: { value: "Quote exactly supports the claim." } });
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("review.approve", {
        itemId: "rev_claim",
        data: { decision_note: "Quote exactly supports the claim." }
      })
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("capsules.addItems", {
        capsuleId: "cap_review",
        items: [
          {
            target_type: "claim",
            target_id: "clm_review",
            role: "core",
            include_mode: "reference",
            auto_include_evidence: true
          }
        ]
      })
    );
  });

  it("bulk rejects filtered review proposals with a shared decision note", async () => {
    const reviewItems = [
      {
        id: "rev_bulk_claim",
        item_type: "new_claim",
        title: "Batch claim proposal",
        summary: "A local model found a claim that should be rejected as a group.",
        status: "pending",
        created_by_job_id: "job_night",
        created_at: "2026-06-05T00:00:00Z",
        payload: { body: "Claim body", source_id: "src_bulk", model_id: "mock-local-llm" }
      },
      {
        id: "rev_bulk_learning",
        item_type: "learning_deck",
        title: "Batch learning cards",
        summary: "A generated deck from the same job needs the same decision.",
        status: "pending",
        created_by_job_id: "job_night",
        created_at: "2026-06-05T00:00:01Z",
        payload: { cards: [{ front: "A", back: "B" }], model_id: "mock-local-llm" }
      },
      {
        id: "rev_other",
        item_type: "new_object",
        title: "Different job proposal",
        summary: "This item should remain outside the filtered batch.",
        status: "pending",
        created_by_job_id: "job_other",
        created_at: "2026-06-05T00:00:02Z",
        payload: { title: "Other", body: "Other body" }
      }
    ];
    let bulkDone = false;
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: bulkDone ? 1 : 3,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "review.list") return bulkDone ? [reviewItems[2]] : reviewItems;
      if (route === "review.bulk") {
        bulkDone = true;
        return {
          action: payload.action,
          requested: payload.item_ids.length,
          completed: payload.item_ids.length,
          results: payload.item_ids.map((item_id: string) => ({ item_id, status: payload.action === "reject" ? "rejected" : "approved" }))
        };
      }
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "review" });
    renderApp();

    expect((await screen.findAllByText("Batch claim proposal")).length).toBeGreaterThan(0);
    fireEvent.change(await screen.findByLabelText("Find review proposals"), { target: { value: "job_night" } });
    expect(screen.queryByText("Different job proposal")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /select visible/i }));
    fireEvent.change(await screen.findByLabelText("Bulk decision note"), { target: { value: "Batch rejected after source review." } });
    fireEvent.click(screen.getByRole("button", { name: /reject selected/i }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("review.bulk", {
        action: "reject",
        item_ids: ["rev_bulk_claim", "rev_bulk_learning"],
        decision_note: "Batch rejected after source review."
      })
    );
  });

  it("shows AI task suggestions as review-gated task proposals", async () => {
    let approved = false;
    const reviewItem = {
      id: "rev_task_suggestion",
      item_type: "suggested_todo",
      title: "Suggested task: Verify model follow-up",
      summary: "A local model suggested a task. It should stay in Review until accepted.",
      status: "pending",
      created_by_job_id: "run_ai_task",
      created_at: "2026-06-21T00:00:00Z",
      payload: {
        title: "Verify model-suggested follow-up tomorrow @review",
        description: "Check the suggestion before trusting it.",
        model_id: "mock-local-llm",
        provider_id: "mock_llm"
      }
    };
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list" || route === "events.list") return [];
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: approved ? 0 : 1,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "review.list") return approved ? [] : [reviewItem];
      if (route === "review.approve") {
        approved = true;
        expect(payload).toEqual({
          itemId: "rev_task_suggestion",
          data: { decision_note: "This should become a task." }
        });
        return { item_id: payload.itemId, status: "approved", created: { todo_id: "todo_from_suggestion" } };
      }
      if (route === "capsules.list") return { items: [], total: 0 };
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "review", selectedReviewItemId: "rev_task_suggestion" });
    renderApp();

    expect((await screen.findAllByText("Task suggestion")).length).toBeGreaterThan(0);
    expect(screen.queryByText("suggested_todo")).toBeNull();
    const taskText = await screen.findByText("Verify model-suggested follow-up tomorrow @review");
    const proposal = taskText.closest(".review-proposal");
    expect(proposal).toBeTruthy();
    expect(within(proposal as HTMLElement).getByText("Task")).toBeTruthy();
    expect(await screen.findByText("Approve only if this should become a real task.")).toBeTruthy();
    expect(within(proposal as HTMLElement).getByText("Local model")).toBeTruthy();
    expect(within(proposal as HTMLElement).queryByText("mock-local-llm")).toBeNull();

    fireEvent.change(await screen.findByLabelText("Decision reason"), { target: { value: "This should become a task." } });
    fireEvent.click(await screen.findByRole("button", { name: /^approve$/i }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("review.approve", {
        itemId: "rev_task_suggestion",
        data: { decision_note: "This should become a task." }
      })
    );
    expect((await screen.findAllByText("Review is clear.")).length).toBeGreaterThan(0);
    const queue = await screen.findByLabelText("Review queue");
    expect(within(queue).getByRole("tablist", { name: "Review status" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Review", level: 2 })).toBeNull();
    expect(screen.getAllByRole("heading", { name: "Review" })).toHaveLength(1);
  });

  it("creates contextual tasks from whole Assistant answers with answer metadata", async () => {
    let createdPayload: any;
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list" || route === "events.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 1,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "capsules.list") return { items: [], total: 0 };
      if (route === "ai.capabilities" || route === "ai.providers") return [];
      if (route === "assistant.ask") {
        expect(payload).toEqual(
          expect.objectContaining({
            question: "What should I verify next?",
            answer_style: "concise_research_memo",
            require_citations: true
          })
        );
        return {
          ai_run_id: "run_answer_payload",
          answer_markdown: "Verify the claim against primary Storage before using it.",
          evidence_quality: "missing",
          provider: "mock_llm",
          model_id: "mock-local-llm",
          capability: "grounded_answer",
          sent_off_device: false,
          review_item_id: "rev_answer_payload",
          citations: [],
          uncertainties: ["No approved evidence matched the question."]
        };
      }
      if (route === "todos.create") {
        createdPayload = payload;
        return {
          id: "todo_answer_payload",
          title: payload.text,
          status: "open",
          priority: 3,
          labels: [],
          context_links: payload.context_links,
          provenance: payload.provenance,
          created_at: "2026-06-21T00:00:01Z",
          updated_at: "2026-06-21T00:00:01Z"
        };
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "assistant" });
    renderApp();

    fireEvent.change(await screen.findByLabelText("Assistant question"), {
      target: { value: "What should I verify next?" }
    });
    fireEvent.click(await screen.findByRole("button", { name: /^ask$/i }));
    expect(await screen.findByText("Verify the claim against primary Storage before using it.")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Task" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "New task" })).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createdPayload).toBeTruthy());
    expect(createdPayload).toEqual({
      text: "Follow up on Assistant answer: What should I verify next?",
      provenance: { created_from: "assistant_answer" },
      context_links: [
        {
          target_type: "assistant_answer",
          target_id: "run_answer_payload",
          target_title: "What should I verify next?",
          relation: "follow_up_answer",
          exact_quote: undefined,
          locator: undefined,
          metadata: {
            created_from: "assistant_answer",
            question: "What should I verify next?",
            evidence_quality: "missing",
            provider: "mock_llm",
            model_id: "mock-local-llm",
            capability: "grounded_answer",
            review_item_id: "rev_answer_payload",
            citation_count: 0,
            sent_off_device: false,
            answer_hash: expect.any(String)
          }
        }
      ]
    });
  });

  it("filters graph claims and opens claim evidence in Storage", async () => {
    const claims = [
      {
        id: "clm_supported",
        node_id: "node_supported",
        title: "Typed claims keep evidence exact",
        normalized_text: "Typed claims keep exact source evidence visible.",
        status: "supported",
        confidence: 0.91,
        evidence_strength: 0.86
      },
      {
        id: "clm_weak",
        node_id: "node_weak",
        title: "Loose summaries need review",
        normalized_text: "Loose summaries need review before graph use.",
        status: "weakly_supported",
        confidence: 0.42,
        evidence_strength: 0.21
      }
    ];
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 2,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "claims.list") return claims;
      if (route === "claims.evidence") {
        expect(payload).toEqual({ claimId: "clm_supported" });
        return [
          {
            id: "ev_supported",
            claim_id: "clm_supported",
            source_id: "src_graph",
            source_block_id: "blk_graph",
            support_type: "supports",
            exact_quote: "Typed claims keep exact source evidence visible.",
            strength: 0.86,
            source_title: "Graph evidence source",
            locator: "p4"
          }
        ];
      }
      if (route === "sources.list") {
        return [
          {
            id: "src_graph",
            type: "text",
            title: "Graph evidence source",
            metadata: {},
            created_at: "2026-06-05T00:00:00Z",
            updated_at: "2026-06-05T00:00:00Z"
          }
        ];
      }
      if (route === "sources.blocks") {
        return [
          {
            id: "blk_graph",
            source_id: "src_graph",
            block_index: 0,
            locator: "p4",
            text: "Typed claims keep exact source evidence visible."
          }
        ];
      }
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "graph", selectedClaimId: "clm_supported" });
    renderApp();

    expect(await screen.findByRole("heading", { name: "Evidence graph", level: 2 })).toBeTruthy();
    expect(screen.queryByText("claims and source blocks")).toBeNull();
    expect(screen.queryByText("A working map of approved claims, their strength, and the exact source blocks behind them.")).toBeNull();
    expect((await screen.findAllByText("Typed claims keep evidence exact")).length).toBeGreaterThan(0);
    const graphStatusTabs = await screen.findByRole("tablist", { name: "Claim status filter" });
    expect(within(graphStatusTabs).getByRole("tab", { name: "All" }).getAttribute("data-state")).toBe("active");
    expect(within(graphStatusTabs).getByRole("tab", { name: "Needs review" })).toBeTruthy();
    expect((await screen.findByLabelText("Evidence graph context")).textContent).toContain("2 claims");
    fireEvent.change(await screen.findByLabelText("Find claims"), { target: { value: "typed" } });
    expect(screen.queryByText("Loose summaries need review")).toBeNull();
    const claimStrength = await screen.findByLabelText("Claim strength");
    expect(claimStrength.textContent).toContain("91% confidence");
    expect(claimStrength.textContent).toContain("86% evidence");
    expect((await screen.findAllByText("Typed claims keep exact source evidence visible.")).length).toBeGreaterThan(0);

    fireEvent.click(await screen.findByRole("button", { name: /open source/i }));
    expect(await screen.findByRole("heading", { name: "Graph evidence source" })).toBeTruthy();
    expect((await screen.findAllByText("Typed claims keep exact source evidence visible.")).length).toBeGreaterThan(0);
  });

  it("keeps the empty Evidence graph surface quiet", async () => {
    const request = vi.fn(async (route: string) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "claims.list") return [];
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "graph", selectedClaimId: undefined });
    renderApp();

    expect(await screen.findByText("No claims")).toBeTruthy();
    expect(screen.getByLabelText("Find claims")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Evidence graph", level: 2 })).toBeNull());
    expect(screen.queryByRole("heading", { name: "Evidence", level: 2 })).toBeNull();
    expect(screen.queryByText("No claim selected")).toBeNull();
    expect(screen.queryByText("Approve a claim in Review to start the evidence map.")).toBeNull();
    expect(screen.queryByText("Select a claim to inspect its source links.")).toBeNull();
  });

  it("keeps an empty claim evidence panel quiet", async () => {
    const claim = {
      id: "clm_empty_evidence",
      node_id: "node_empty_evidence",
      title: "Unlinked claim",
      normalized_text: "Unlinked claims should wait for source evidence.",
      status: "weakly_supported",
      confidence: 0.41,
      evidence_strength: 0
    };
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 0,
          claims: 1,
          claims_without_evidence: 1,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "claims.list") return [claim];
      if (route === "claims.evidence") {
        expect(payload).toEqual({ claimId: "clm_empty_evidence" });
        return [];
      }
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "graph", selectedClaimId: "clm_empty_evidence" });
    renderApp();

    expect(await screen.findByRole("heading", { name: "Unlinked claim", level: 2 })).toBeTruthy();
    expect(await screen.findByText("No evidence")).toBeTruthy();
    expect(document.querySelector(".detail-pane .eyebrow")).toBeNull();
    expect(screen.queryByText("No evidence links are attached to this claim yet.")).toBeNull();
  });

  it("keeps the empty Practice surface quiet", async () => {
    const request = vi.fn(async (route: string) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "learning.items") return [];
      if (route === "ai.capabilities") return [];
      if (route === "ai.providers") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "learning" });
    renderApp();

    expect(await screen.findByText("No cards")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create deck" })).toBeTruthy();
    expect(screen.getByLabelText("Deck topic")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Current card", level: 2 })).toBeNull();
    expect(screen.queryByText("Create a deck.")).toBeNull();
    expect(screen.queryByText("No cards yet")).toBeNull();
    expect(screen.queryByText("Create a deck from approved knowledge. New cards wait in Review.")).toBeNull();
    expect(screen.queryByText("Create a deck to choose a practice card.")).toBeNull();
  });

  it("reads learning cards aloud through the local speech route", async () => {
    const learningItem = {
      id: "learn_claims",
      type: "flashcard",
      title: "Claim provenance",
      body: {
        front: "What is claim provenance?",
        back: "Evidence links a claim to a source block."
      },
      status: "active"
    };
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 0,
          claims: 1,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 1
        };
      }
      if (route === "events.list") return [];
      if (route === "learning.items") return [learningItem];
      if (route === "ai.capabilities") return [{ capability: "synthesize_speech", provider_id: "mock_tts", model_id: "mock-local-tts", local_only: true, settings: {} }];
      if (route === "ai.providers") {
        return [
          {
            id: "mock_tts",
            display_name: "Mock TTS",
            kind: "tts",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          }
        ];
      }
      if (route === "voice.synthesize") {
        return {
          run_id: "run_learning_speech",
          provider: "mock_tts",
          model_id: "mock-local-tts",
          audio_path: "/vault/blobs/speech/learning.wav",
          speech_asset_id: "spch_learning",
          cached: true,
          sent_off_device: false,
          voice_id: "mock-local-voice"
        };
      }
      if (route === "voice.speechAssetAudio") {
        return {
          speech_asset_id: payload.speechAssetId,
          mime_type: "audio/wav",
          data_url: "data:audio/wav;base64,UklGRg==",
          size_bytes: 4
        };
      }
      if (route === "todos.create") {
        expect(payload.text).toBe("Follow up on Claim provenance");
        expect(payload.provenance).toEqual({ created_from: "learning_item" });
        expect(payload.context_links).toEqual([
          expect.objectContaining({
            target_type: "learning_item",
            target_id: "learn_claims",
            target_title: "Claim provenance",
            relation: "follow_up_practice",
            metadata: expect.objectContaining({
              created_from: "learning_item",
              learning_type: "flashcard",
              status: "active",
              prompt_hash: expect.any(String),
              answer_hash: expect.any(String)
            })
          })
        ]);
        return {
          id: "todo_learning_item",
          title: payload.text,
          status: "open",
          priority: 3,
          labels: [],
          context_links: payload.context_links,
          created_at: "2026-06-05T00:00:00Z",
          updated_at: "2026-06-05T00:00:00Z"
        };
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };
    useUIStore.setState({ surface: "learning" });
    const { container } = renderApp();

    expect((await screen.findAllByText("Practice")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Cards created from approved knowledge. New cards wait in Review before practice.")).toBeNull();
    expect(screen.queryByText("Practice one card at a time. Voice answers stay local.")).toBeNull();
    expect(await screen.findByText("Deck topic")).toBeTruthy();
    expect(await screen.findByText("Current card")).toBeTruthy();
    expect(await screen.findByLabelText("Practice voice privacy")).toBeTruthy();
    expect((await screen.findAllByText("What is claim provenance?")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Evidence links a claim to a source block.")).length).toBeGreaterThan(0);
    fireEvent.click(await screen.findByRole("button", { name: /create task from practice card/i }));
    const taskDialog = await screen.findByRole("dialog", { name: /new task/i });
    fireEvent.click(within(taskDialog).getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "todos.create",
        expect.objectContaining({
          context_links: [expect.objectContaining({ target_type: "learning_item", target_id: "learn_claims", relation: "follow_up_practice" })]
        })
      )
    );
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /new task/i })).toBeNull());
    fireEvent.click(await screen.findByRole("button", { name: /read aloud/i }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("voice.synthesize", {
        text: "Prompt: What is claim provenance?\n\nAnswer: Evidence links a claim to a source block.",
        voice_id: "mock-local-voice",
        format: "wav",
        local_only: true,
        cache: true
      })
    );
    await waitFor(() => expect(request).toHaveBeenCalledWith("voice.speechAssetAudio", { speechAssetId: "spch_learning" }));
    expect(await screen.findByText("Audio ready")).toBeTruthy();
    expect(await screen.findByText("On device")).toBeTruthy();
    expect(await screen.findByText("Ready to play")).toBeTruthy();
    expect(screen.queryByText("mock-local-tts")).toBeNull();
    expect(screen.queryByText("spch_learning")).toBeNull();
    expect(container.querySelector("audio.speech-player")?.getAttribute("src")).toBe("data:audio/wav;base64,UklGRg==");
  });

  it("records a spoken learning answer through local transcription and review session", async () => {
    const learningItem = {
      id: "learn_claims",
      type: "flashcard",
      title: "Claim provenance",
      body: {
        front: "What is claim provenance?",
        back: "Evidence links a claim to a source block."
      },
      status: "active"
    };
    const stopTrack = vi.fn();
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] }));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia }
    });
    class FakeMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
      state = "inactive";
      mimeType: string;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(_stream: unknown, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? "audio/webm";
      }

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["learning answer bytes"], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);

    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list" || route === "events.list") return [];
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 0,
          claims: 1,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 1
        };
      }
      if (route === "learning.items") return [learningItem];
      if (route === "ai.capabilities") {
        return [
          { capability: "transcribe_audio", provider_id: "mock_stt", model_id: "mock-local-stt", local_only: true, settings: {} },
          { capability: "synthesize_speech", provider_id: "mock_tts", model_id: "mock-local-tts", local_only: true, settings: {} }
        ];
      }
      if (route === "ai.providers") {
        return [
          {
            id: "mock_stt",
            display_name: "Mock STT",
            kind: "stt",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          },
          {
            id: "mock_tts",
            display_name: "Mock TTS",
            kind: "tts",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          }
        ];
      }
      if (route === "voice.transcribe") {
        return {
          run_id: "run_learning_answer",
          provider: "mock_stt",
          model_id: "mock-local-stt",
          text: "My spoken answer.",
          sent_off_device: false,
          segments: [{ start_ms: 0, end_ms: 1200, text: "My spoken answer." }]
        };
      }
      if (route === "learning.session.start") {
        return { session_id: "sess_learning", started_at: "2026-06-05T00:00:00Z", item_ids: payload.item_ids };
      }
      if (route === "learning.session.answer") {
        return { session_id: payload.sessionId, rating: payload.data.rating, next_review: "3 days" };
      }
      return [];
    });
    const saveAudioRecording = vi.fn(async () => ({
      filePath: "/tmp/vault-learning-answer.webm",
      mimeType: "audio/webm",
      sizeBytes: 28
    }));
    window.vault = { request, selectFiles: vi.fn(async () => []), saveAudioRecording };

    useUIStore.setState({ surface: "learning" });
    renderApp();
    expect(await screen.findByText("Current card")).toBeTruthy();
    expect(await screen.findByText("Read aloud and spoken answers stay local.")).toBeTruthy();
    expect((await screen.findAllByText("What is claim provenance?")).length).toBeGreaterThan(0);
    fireEvent.click(await screen.findByRole("button", { name: /^answer by voice$/i }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ audio: true }));
    fireEvent.click(await screen.findByRole("button", { name: /^stop answer$/i }));

    await waitFor(() => expect(saveAudioRecording).toHaveBeenCalledWith(expect.objectContaining({ mimeType: "audio/webm;codecs=opus" })));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("voice.transcribe", {
        audio_path: "/tmp/vault-learning-answer.webm",
        title: "Learning answer",
        create_source: false,
        local_only: true,
        metadata: {
          import_mode: "learning_answer_microphone",
          learning_item_id: "learn_claims",
          mime_type: "audio/webm",
          size_bytes: 28
        }
      })
    );
    await waitFor(() => expect(request).toHaveBeenCalledWith("learning.session.start", { item_ids: ["learn_claims"] }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("learning.session.answer", {
        sessionId: "sess_learning",
        data: {
          item_id: "learn_claims",
          answer_text: "My spoken answer.",
          rating: "good",
          transcribed: true,
          audio_run_id: "run_learning_answer"
        }
      })
    );
    expect(await screen.findByText("Spoken answer")).toBeTruthy();
    const spokenAnswerResult = (await screen.findByText("Spoken answer")).closest(".workflow-result");
    expect(spokenAnswerResult).toBeTruthy();
    expect(within(spokenAnswerResult as HTMLElement).getByText("On device")).toBeTruthy();
    expect(within(spokenAnswerResult as HTMLElement).queryByText("mock-local-stt")).toBeNull();
    expect(await screen.findByText("My spoken answer.")).toBeTruthy();
    expect(await screen.findByText("Next review: 3 days")).toBeTruthy();
    expect(stopTrack).toHaveBeenCalled();
  });

  it("surfaces downloadable local model packs in settings", async () => {
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "settings.get") return {};
      if (route === "ai.providers") return [];
      if (route === "ai.capabilities") return [];
      if (route === "ai.hardware") {
        return {
          os: "macos",
          arch: "arm64",
          physical_ram_gb: 16,
          apple_silicon: true,
          metal_available: true,
          cuda_available: false,
          rocm_available: false,
          vulkan_available: false,
          recommended_profile: "tiny",
          warnings: []
        };
      }
      if (route === "ai.models.registry") {
        return {
          models: [
            {
              id: "tiny-fixture-llm",
              display_name: "Tiny Fixture Local Model",
              kind: "llm",
              installed: false,
              download_state: "not_installed",
              capabilities: ["extract_claims", "generate_note"],
              downloadable: true,
              license_label: "test fixture",
              recommended_profile: "tiny",
              runtime: "llama_cpp",
              format: "gguf",
              source_type: "local_fixture",
              runtime_tested: false
            }
          ]
        };
      }
      if (route === "ai.modelPacks") {
        return [
          {
            id: "tiny-production-pack",
            display_name: "Tiny Production Local Pack",
            profile: "tiny",
            release_channel: "production",
            release_status: "blocked",
            description: "Real tiny local models once approved.",
            privacy_label: "Runs on this device",
            model_ids: ["tiny-gguf-placeholder", "tiny-reranker-placeholder"],
            required_model_ids: ["tiny-gguf-placeholder"],
            optional_model_ids: ["tiny-reranker-placeholder"],
            capabilities: ["extract_claims", "generate_note"],
            disk_bytes: null,
            installed_model_ids: [],
            missing_model_ids: ["tiny-gguf-placeholder"],
            downloadable_model_ids: [],
            blocked_reasons: ["Missing release-ready downloads: Tiny GGUF Local Model."],
            installable: false,
            installed: false,
            readiness_checks: [
              {
                id: "tiny-production-pack:required-downloads",
                label: "Required downloads",
                status: "blocked",
                detail: "Missing release-ready downloads: Tiny GGUF Local Model.",
                action: "Approve sources, filenames, checksums, sizes, and licenses for required models."
              },
              {
                id: "tiny-production-pack:tiny-gguf-placeholder:checksum",
                label: "Tiny GGUF Local Model / Checksum",
                status: "blocked",
                detail: "Checksum pending.",
                action: "Pin the SHA-256 checksum before release."
              }
            ]
          },
          {
            id: "tiny-local-pack",
            display_name: "Demo Fixture Pack",
            profile: "tiny",
            release_channel: "demo",
            release_status: "demo_ready",
            description: "CPU-friendly starter pack for local AI.",
            privacy_label: "Runs on this device",
            model_ids: ["tiny-fixture-llm"],
            required_model_ids: ["tiny-fixture-llm"],
            optional_model_ids: [],
            capabilities: ["extract_claims", "generate_note"],
            disk_bytes: 188,
            installed_model_ids: [],
            missing_model_ids: ["tiny-fixture-llm"],
            downloadable_model_ids: ["tiny-fixture-llm"],
            blocked_reasons: ["Demo fixtures exercise local AI plumbing."],
            installable: true,
            installed: false,
            readiness_checks: []
          }
        ];
      }
      if (route === "ai.setup.status") {
        return {
          mode: "local_only",
          overall_status: "not_started",
          recommended_profile: "tiny",
          recommended_pack_id: "tiny-production-pack",
          demo_pack_id: "tiny-local-pack",
          privacy_label: "Local only: cloud fallback blocked unless explicitly enabled",
          next_action: "Install the demo llama.cpp runtime to unlock local pipeline testing.",
          can_use_demo: true,
          blocked_reasons: ["Missing release-ready downloads: Tiny GGUF Local Model."],
          steps: [
            {
              id: "privacy",
              title: "Privacy mode",
              status: "done",
              summary: "Cloud fallback is blocked",
              detail: "Every core AI route is local-only.",
              action_payload: {}
            },
            {
              id: "runtime",
              title: "Local runtimes",
              status: "blocked",
              summary: "Runtime repair needed",
              detail: "llama.cpp runtime is not configured.",
              action_label: "Install demo runtime",
              action_route: "ai.runtimes.install",
              action_payload: { runtimeId: "llama-cpp-fixture-runtime" }
            },
            {
              id: "production_pack",
              title: "Tiny production pack",
              status: "blocked",
              summary: "blocked",
              detail: "Missing release-ready downloads: Tiny GGUF Local Model.",
              action_payload: {}
            },
            {
              id: "demo_fallback",
              title: "Demo fallback",
              status: "ready",
              summary: "Fixture pack can exercise the pipeline",
              detail: "Demo fixtures exercise local AI plumbing.",
              action_label: "Download demo",
              action_route: "ai.modelPacks.download",
              action_payload: { packId: "tiny-local-pack" }
            }
          ]
        };
      }
      if (route === "ai.readiness.report") {
        return {
          generated_at: "2026-06-04T00:00:00Z",
          status: "blocked",
          production_ready: false,
          demo_available: true,
          recommended_profile: "tiny",
          recommended_pack_id: "tiny-production-pack",
          summary: {
            total_checks: 12,
            pass_count: 3,
            warn_count: 0,
            pending_count: 0,
            blocked_count: 9,
            production_pack_count: 1,
            ready_production_pack_count: 0,
            production_runtime_count: 1,
            ready_production_runtime_count: 0
          },
          next_actions: [
            "Approve sources, filenames, checksums, sizes, and licenses for required models.",
            "Approve runtime manifests with pinned source, checksum, size, and license."
          ],
          approval_items: [
            {
              id: "model_pack:pin-checksums",
              category: "model_pack",
              title: "Pin production model checksums",
              blocker_count: 2,
              next_action: "Pin the SHA-256 checksum before release.",
              check_ids: ["pack:tiny-production-pack:checksum"],
              sample_details: ["Checksum pending."]
            },
            ...Array.from({ length: 8 }, (_, index) => ({
              id: `model_pack:z-blocker-${index + 1}`,
              category: "model_pack",
              title: `Z model release blocker ${index + 1}`,
              blocker_count: 2,
              next_action: "Resolve another production model artifact blocker.",
              check_ids: [`pack:tiny-production-pack:z-blocker-${index + 1}`],
              sample_details: ["Model release evidence pending."]
            })),
            {
              id: "runtime:approve-source",
              category: "runtime",
              title: "Approve production runtime sources",
              blocker_count: 1,
              next_action: "Replace placeholder runtime source with a release URL.",
              check_ids: ["runtime:llama-cpp-managed-runtime:source"],
              sample_details: ["Approved runtime source pending."]
            },
            {
              id: "capability_route:route-production",
              category: "capability_route",
              title: "Route production capabilities",
              blocker_count: 6,
              next_action: "Route this capability to an approved local production model before release.",
              check_ids: ["capability:extract_claims"],
              sample_details: ["extract_claims still uses the mock_llm demo provider."]
            }
          ],
          sections: [
            {
              id: "production-packs",
              title: "Production model packs",
              status: "blocked",
              summary: "Production model packs still have release blockers.",
              blocked_count: 2,
              checks: [
                {
                  id: "pack:tiny-production-pack:required-downloads",
                  label: "Tiny Production Local Pack / Required downloads",
                  status: "blocked",
                  detail: "Missing release-ready downloads: Tiny GGUF Local Model.",
                  action: "Approve sources, filenames, checksums, sizes, and licenses for required models."
                },
                {
                  id: "pack:tiny-production-pack:checksum",
                  label: "Tiny Production Local Pack / Checksum",
                  status: "blocked",
                  detail: "Checksum pending.",
                  action: "Pin the SHA-256 checksum before release."
                }
              ]
            },
            {
              id: "production-runtimes",
              title: "Production runtimes",
              status: "blocked",
              summary: "Production runtime manifests still have release blockers.",
              blocked_count: 1,
              checks: [
                {
                  id: "runtime:llama-cpp-managed-runtime:source",
                  label: "Production llama.cpp Runtime / Source",
                  status: "blocked",
                  detail: "Approved runtime source pending.",
                  action: "Replace placeholder runtime source with a release URL."
                }
              ]
            },
            {
              id: "privacy-boundary",
              title: "Privacy boundary",
              status: "ready",
              summary: "Cloud fallback is blocked by default.",
              blocked_count: 0,
              checks: [
                {
                  id: "privacy:local-only",
                  label: "Local-only default",
                  status: "pass",
                  detail: "All configured AI routes are local-only."
                }
              ]
            },
            {
              id: "capability-routes",
              title: "Capability routes",
              status: "blocked",
              summary: "Required production capabilities are not fully mapped to approved local models.",
              blocked_count: 6,
              checks: [
                {
                  id: "capability:extract_claims",
                  label: "extract_claims route",
                  status: "blocked",
                  detail: "extract_claims still uses the mock_llm demo provider.",
                  action: "Route this capability to an approved local production model before release."
                }
              ]
            }
          ]
        };
      }
      if (route === "ai.readiness.report.export") {
        return {
          generated_at: "2026-06-04T00:00:01Z",
          filename: "local-ai-production-readiness.md",
          mime_type: "text/markdown",
          markdown: "# Local AI Production Readiness\n\n## Approval Board\n\n- [ ] Pin production model checksums\n",
          report: { status: "blocked" }
        };
      }
      if (route === "ai.readiness.approvalTemplate.export") {
        return {
          generated_at: "2026-06-04T00:00:02Z",
          filename: "local-ai-approval-template.md",
          mime_type: "text/markdown",
          markdown: "# Local AI Approval Template\n\n| `approval.evidence` | pending |\n",
          evidence_filename: "local-ai-evidence-template.json",
          evidence_mime_type: "application/json",
          evidence_json: "{\n  \"schema_version\": 1,\n  \"models\": {\"tiny-gguf-placeholder\": {\"approval\": {\"status\": \"approved\"}}},\n  \"runtimes\": {}\n}",
          evidence: { schema_version: 1, models: { "tiny-gguf-placeholder": { approval: { status: "approved" } } }, runtimes: {} },
          report: {
            status: "pending",
            artifact_count: 1,
            pending_field_count: 9,
            artifacts: [{ type: "model", id: "tiny-gguf-placeholder", display_name: "Tiny GGUF Local Model", field_count: 12, pending_field_count: 9 }],
            next_actions: ["Attach evidence for source, checksum, size, license, and runtime review."]
          }
        };
      }
      if (route === "ai.registry.validation") return registryValidationFixture;
      if (route === "ai.registry.releasePlan") return registryReleasePlanFixture;
      if (route === "ai.registry.releasePlan.export") return registryReleasePlanExportFixture;
      if (route === "ai.registry.releasePlan.evaluate") return registryCandidateReleasePlanExportFixture;
      if (route === "ai.registry.metadata.hydrate") return candidateMetadataHydrationFixture;
      if (route === "ai.registry.artifactProbe.evaluate") return candidateArtifactProbeExportFixture;
      if (route === "ai.registry.artifactVerify.evaluate") return candidateArtifactVerificationExportFixture;
      if (route === "ai.readiness.approvalTemplate.evaluate") return candidateApprovalTemplateExportFixture;
      if (route === "ai.registry.evidence.apply") {
        return { ...candidateEvidenceOverlayExportFixture, evidence_label: payload?.evidence_label ?? candidateEvidenceOverlayExportFixture.evidence_label };
      }
      if (route === "ai.registry.releasePacket.prepare") {
        return {
          ...candidateReleasePacketFixture,
          artifact_probe: payload?.probe_sources ? { status: "pass" } : candidateReleasePacketFixture.artifact_probe,
          artifact_verification: payload?.verify_bytes ? { status: "pass" } : candidateReleasePacketFixture.artifact_verification
        };
      }
      if (route === "ai.registry.releaseWorkspace") {
        return { schema_version: 1, has_workspace: false, updated_at: null };
      }
      if (route === "ai.registry.releaseWorkspace.save") {
        return {
          schema_version: 1,
          has_workspace: true,
          updated_at: "2026-06-04T00:00:03Z",
          ...payload
        };
      }
      if (route === "ai.registry.releaseWorkspace.clear") {
        return { schema_version: 1, has_workspace: false, updated_at: null };
      }
      if (route === "ai.modelPacks.download") return { pack_id: payload.packId, downloads: [], skipped: [] };
      if (route === "ai.setup.run") {
        if (payload.dry_run) {
          return {
            mode: payload.mode,
            pack_id: payload.pack_id,
            release_channel: "production",
            status: "partial",
            dry_run: true,
            selected_capabilities: ["extract_claims"],
            planned_download_count: 1,
            planned_download_bytes: 639446688,
            downloads: [],
            steps: [
              {
                id: "runtime-llama_cpp",
                title: "llama_cpp runtime",
                status: "queued",
                detail: "Would install and verify Managed llama.cpp Runtime."
              },
              {
                id: "model-tiny-gguf-placeholder",
                title: "Tiny GGUF Local Model",
                status: "queued",
                detail: "Would download and verify Tiny GGUF Local Model.",
                model_id: "tiny-gguf-placeholder"
              },
              {
                id: "activate-tiny-gguf-placeholder",
                title: "Tiny GGUF Local Model",
                status: "queued",
                detail: "Would test local text runtime and activate Claim suggestions.",
                model_id: "tiny-gguf-placeholder"
              }
            ],
            setup: {}
          };
        }
        if (payload.mode === "recommended") {
          return {
            mode: "recommended",
            pack_id: payload.pack_id,
            release_channel: "production",
            status: "blocked",
            dry_run: false,
            selected_capabilities: [],
            downloads: [],
            steps: [
              {
                id: "pack-blocker-1",
                title: "Required downloads",
                status: "blocked",
                detail: "Missing release-ready downloads: Tiny GGUF Local Model. Action: Approve sources, filenames, checksums, sizes, and licenses for required models."
              },
              {
                id: "pack-blocker-2",
                title: "Tiny GGUF Local Model / Checksum",
                status: "blocked",
                detail: "Checksum pending. Action: Pin the SHA-256 checksum before release."
              }
            ],
            setup: {}
          };
        }
        return {
          mode: payload.mode,
          pack_id: payload.pack_id,
          release_channel: "demo",
          status: "partial",
          dry_run: false,
          selected_capabilities: ["embed_text", "synthesize_speech"],
          planned_download_count: 1,
          planned_download_bytes: 188,
          downloads: [{ model_id: "tiny-fixture-llm", state: "installed" }],
          steps: [
            {
              id: "runtime-llama_cpp",
              title: "llama_cpp runtime",
              status: "done",
              detail: "Installed Demo llama.cpp Runtime Fixture.",
              runtime_id: "llama-cpp-fixture-runtime"
            },
            {
              id: "activate-tiny-fixture-llm",
              title: "Tiny Fixture Local Model",
              status: "skipped",
              detail: "Not activated: fixture_only - The installed model is a tiny checksum fixture and is not inference-capable.",
              model_id: "tiny-fixture-llm"
            },
            {
              id: "activate-mock-local-embedding",
              title: "Mock Local Embeddings",
              status: "done",
              detail: "Activated embed_text.",
              model_id: "mock-local-embedding"
            }
          ],
          setup: {}
        };
      }
      if (route === "ai.runtimes.registry") {
        return [
          {
            id: "llama-cpp-fixture-runtime",
            display_name: "Demo llama.cpp Runtime Fixture",
            runtime: "llama_cpp",
            release_channel: "demo",
            version: "fixture-0.1.0",
            platform: "any",
            arch: "any",
            compatible: true,
            host_platform: "macos",
            host_arch: "arm64",
            compatibility_error: null,
            binary_name: "llama-cli",
            installed: false,
            install_state: "not_installed",
            installable: true,
            source_type: "local_fixture",
            binary_path: null,
            size_bytes: 252,
            sha256: "fixture-sha",
            sha256_actual: null,
            integrity_status: "unknown",
            integrity_error: null,
            license_label: "test fixture",
            blocked_reasons: [],
            readiness_checks: [],
            install_log: []
          },
          {
            id: "llama-cpp-fixture-runtime-broken",
            display_name: "Broken llama.cpp Runtime Fixture",
            runtime: "llama_cpp",
            release_channel: "demo",
            version: "fixture-0.1.0",
            platform: "any",
            arch: "any",
            compatible: true,
            host_platform: "macos",
            host_arch: "arm64",
            compatibility_error: null,
            binary_name: "llama-cli",
            installed: false,
            install_state: "failed",
            installable: true,
            source_type: "local_fixture",
            binary_path: "/tmp/runtime/llama-cli",
            size_bytes: 252,
            sha256: "fixture-sha",
            sha256_actual: "tampered-sha",
            integrity_status: "mismatch",
            integrity_error: "Installed runtime checksum mismatch. Reinstall or delete it before use.",
            license_label: "test fixture",
            blocked_reasons: ["Installed runtime checksum mismatch. Reinstall or delete it before use."],
            readiness_checks: [],
            install_log: [
              {
                created_at: "2026-06-04T00:00:00Z",
                action: "verify",
                status: "failed",
                detail: "Installed runtime checksum mismatch."
              }
            ]
          },
          {
            id: "llama-cpp-managed-runtime",
            display_name: "Production llama.cpp Runtime",
            runtime: "llama_cpp",
            release_channel: "production",
            version: null,
            platform: "macos",
            arch: "arm64",
            compatible: true,
            host_platform: "macos",
            host_arch: "arm64",
            compatibility_error: null,
            binary_name: "llama-cli",
            installed: false,
            install_state: "not_installed",
            installable: false,
            source_type: "url",
            binary_path: null,
            size_bytes: null,
            sha256: null,
            sha256_actual: null,
            integrity_status: "unknown",
            integrity_error: null,
            license_label: "check upstream before release",
            blocked_reasons: ["approved runtime source pending", "runtime checksum pending"],
            install_log: [],
            readiness_checks: [
              {
                id: "llama-cpp-managed-runtime:source",
                label: "Source",
                status: "blocked",
                detail: "Approved runtime source pending.",
                action: "Replace placeholder runtime source with a release URL."
              },
              {
                id: "llama-cpp-managed-runtime:checksum",
                label: "Checksum",
                status: "blocked",
                detail: "Runtime checksum pending.",
                action: "Pin the runtime binary SHA-256 checksum before release."
              }
            ]
          }
        ];
      }
      if (route === "ai.runtimes.install") return { runtime_id: payload.runtimeId, status: "installed" };
      if (route === "ai.models.downloads") return [];
      if (route === "ai.runtime.health") {
        return {
          llama_cpp: {
            runtime: "llama_cpp",
            state: "not_configured",
            runtime_dir: "/tmp/runtime",
            cli: { configured: false, source: "missing" },
            server: { configured: false, source: "missing" },
            installed_models: [],
            warnings: [],
            next_actions: []
          },
          voice: {}
        };
      }
      if (route === "ai.runs") return [];
      if (route === "voice.voices") return [];
      if (route === "voice.audioAssets") return [];
      if (route === "jobs.list") return [];
      return [];
    });
    const saveTextFile = vi.fn(async () => ({ saved: true, filePath: "/tmp/ai-registry-release-plan.md", mimeType: "text/markdown", sizeBytes: 42 }));
    const selectRegistryFiles = vi
      .fn()
      .mockResolvedValueOnce([
        {
          filePath: "/tmp/candidate-models.json",
          filename: "candidate-models.json",
          contents: JSON.stringify({ schema_version: 1, models: [], model_packs: [] })
        },
        {
          filePath: "/tmp/candidate-runtimes.json",
          filename: "candidate-runtimes.json",
          contents: JSON.stringify({ schema_version: 1, runtimes: [] })
        }
      ])
      .mockResolvedValueOnce([
        {
          filePath: "/tmp/candidate-ai-byte-evidence.json",
          filename: "candidate-ai-byte-evidence.json",
          contents: candidateArtifactVerificationExportFixture.evidence_json
        },
        {
          filePath: "/tmp/candidate-reviewer-evidence.json",
          filename: "candidate-reviewer-evidence.json",
          contents: candidateReviewerEvidenceJson
        }
      ]);
    window.vault = { request, selectFiles: vi.fn(async () => []), selectRegistryFiles, saveTextFile };
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    useUIStore.setState({ surface: "settings" });
    renderApp();
    const settingsTabs = await screen.findByRole("tablist", { name: "Settings sections" });
    expect(within(settingsTabs).getByRole("tab", { name: "Local" }).getAttribute("data-state")).toBe("active");
    expect(within(settingsTabs).getByRole("tab", { name: "Search" })).toBeTruthy();
    expect(within(settingsTabs).getByRole("tab", { name: "Advanced" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Local", level: 2 })).toBeTruthy();
    expect(screen.queryByText("local preferences")).toBeNull();
    expect(screen.queryByText("Model approvals, evidence, and setup tools.")).toBeNull();
    expect(screen.queryByText("Installed models, runtimes, downloads, and local pack details.")).toBeNull();
    const commandCenter = await screen.findByLabelText("Local AI setup summary");
    expect(within(commandCenter).getByText("Connect local model tasks")).toBeTruthy();
    expect(within(commandCenter).getByText("0/3 essentials ready")).toBeTruthy();
    expect(within(commandCenter).getByText("0/8 files")).toBeTruthy();
    expect(within(commandCenter).getByText("0/3 runtimes")).toBeTruthy();
    expect(within(commandCenter).getByText("6 unassigned")).toBeTruthy();
    expect(commandCenter.getAttribute("title")).toBe("Choose an approved local model for this task before using it.");
    expect(commandCenter.textContent).not.toContain("Local models");
    expect(commandCenter.textContent).not.toContain("Trusted models");
    expect(commandCenter.textContent).not.toContain("Starter models");
    expect(commandCenter.textContent).not.toContain("Items to finish");
    expect(commandCenter.textContent).not.toContain("Needs proof");
    expect(commandCenter.textContent).not.toContain("blockers");
    expect(commandCenter.textContent).not.toContain("pin-ready");
    expect(commandCenter.textContent).not.toContain("Route production capabilities");
    expect(within(commandCenter).getByRole("button", { name: /open search/i })).toBeTruthy();
    expect(within(commandCenter).getByRole("button", { name: /^starter$/i })).toBeTruthy();
    expect(within(commandCenter).queryByRole("button", { name: /^setup$/i })).toBeNull();
    expect(within(commandCenter).queryByRole("button", { name: /choose candidate files/i })).toBeNull();
    expect(within(commandCenter).getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByText("Runtime missing")).toBeNull();
    expect(screen.queryByText("No local GGUF models")).toBeNull();
    expect(await screen.findByText("Private setup steps")).toBeTruthy();
    const setupGuideSummary = await screen.findByLabelText("Private model setup steps");
    expect(within(setupGuideSummary).getByText("Not set up")).toBeTruthy();
    expect(within(setupGuideSummary).getByText("Trusted pack selected")).toBeTruthy();
    expect(within(setupGuideSummary).getAllByText("Needs action").length).toBeGreaterThan(0);
    expect(within(setupGuideSummary).getByText("Complete")).toBeTruthy();
    expect(within(setupGuideSummary).getByText("Ready")).toBeTruthy();
    expect(setupGuideSummary.textContent).not.toContain("not_started");
    expect(setupGuideSummary.textContent).not.toContain("tiny-production-pack");
    expect(await screen.findByText("Install the starter llama.cpp runtime to unlock local pipeline testing.")).toBeTruthy();
    const modelLibrarySummary = (await screen.findByText("Model library")).closest("summary");
    expect(modelLibrarySummary).toBeTruthy();
    fireEvent.click(modelLibrarySummary as HTMLElement);
    expect(await screen.findByRole("button", { name: /test runtime/i })).toBeTruthy();
    expect(await screen.findByRole("button", { name: /import model/i })).toBeTruthy();
    expect((await screen.findAllByText("Runtimes")).length).toBeGreaterThan(1);
    expect(await screen.findByText("Approved model packs")).toBeTruthy();
    expect((await screen.findAllByText("Starter models")).length).toBeGreaterThan(0);
    const fixtureRuntime = (await screen.findByText("Demo llama.cpp Runtime Fixture")).closest("article");
    expect(fixtureRuntime).toBeTruthy();
    expect(within(fixtureRuntime as HTMLElement).getByText("Needs install")).toBeTruthy();
    expect(within(fixtureRuntime as HTMLElement).getByText("Starter")).toBeTruthy();
    expect(within(fixtureRuntime as HTMLElement).getAllByText("Works here").length).toBeGreaterThan(0);
    expect(within(fixtureRuntime as HTMLElement).getByText("Runtime binary")).toBeTruthy();
    expect(within(fixtureRuntime as HTMLElement).queryByText("not installed")).toBeNull();
    expect(within(fixtureRuntime as HTMLElement).queryByText("demo")).toBeNull();
    expect(within(fixtureRuntime as HTMLElement).queryByText("target any/any")).toBeNull();
    expect(within(fixtureRuntime as HTMLElement).queryByText("host macos/arm64")).toBeNull();
    expect(within(fixtureRuntime as HTMLElement).getByRole("button", { name: /install/i })).toBeTruthy();
    const brokenRuntime = (await screen.findByText("Broken llama.cpp Runtime Fixture")).closest("article");
    expect(brokenRuntime).toBeTruthy();
    expect(within(brokenRuntime as HTMLElement).getAllByText("Needs repair").length).toBeGreaterThan(0);
    expect(within(brokenRuntime as HTMLElement).queryByText("mismatch")).toBeNull();
    expect(within(brokenRuntime as HTMLElement).getByText("Installed runtime checksum mismatch.")).toBeTruthy();
    expect(within(brokenRuntime as HTMLElement).getByRole("button", { name: /repair/i })).toBeTruthy();
    const productionRuntime = (await screen.findByText("Production llama.cpp Runtime")).closest("article");
    expect(productionRuntime).toBeTruthy();
    expect(within(productionRuntime as HTMLElement).getByText("Trusted")).toBeTruthy();
    expect(within(productionRuntime as HTMLElement).getAllByText("Works here").length).toBeGreaterThan(0);
    expect(within(productionRuntime as HTMLElement).queryByText("production")).toBeNull();
    expect(within(productionRuntime as HTMLElement).queryByText("target macos/arm64")).toBeNull();
    expect(within(productionRuntime as HTMLElement).queryByText("host macos/arm64")).toBeNull();
    expect(within(productionRuntime as HTMLElement).getAllByText(/approved runtime source pending/i).length).toBeGreaterThan(0);
    expect(within(productionRuntime as HTMLElement).getByText("Runtime checksum pending.")).toBeTruthy();
    const productionPack = (await screen.findByText("Tiny Production Local Pack")).closest("article");
    expect(productionPack).toBeTruthy();
    expect(within(productionPack as HTMLElement).getAllByText("Needs approval").length).toBeGreaterThan(0);
    expect(within(productionPack as HTMLElement).getAllByText("Needs action").length).toBeGreaterThan(0);
    expect(within(productionPack as HTMLElement).getByText("Recommended")).toBeTruthy();
    expect(within(productionPack as HTMLElement).getAllByText(/Missing approved downloads/i).length).toBeGreaterThan(0);
    expect(within(productionPack as HTMLElement).getByText("Tiny GGUF Local Model / Checksum")).toBeTruthy();
    expect(within(productionPack as HTMLElement).getByText("0/1 models ready")).toBeTruthy();
    expect(within(productionPack as HTMLElement).getByText("0 downloads ready")).toBeTruthy();
    expect(within(productionPack as HTMLElement).getByText("1 optional model")).toBeTruthy();
    expect(within(productionPack as HTMLElement).getByText("Route coverage")).toBeTruthy();
    expect(within(productionPack as HTMLElement).getByText("0/2 trusted local routes")).toBeTruthy();
    expect(within(productionPack as HTMLElement).getAllByText("Needs route").length).toBeGreaterThan(0);
    expect(within(productionPack as HTMLElement).getByText("Claim suggestions + Draft notes")).toBeTruthy();
    expect(within(productionPack as HTMLElement).queryByText("blocked")).toBeNull();
    expect(within(productionPack as HTMLElement).queryByText("Blocked")).toBeNull();
    expect(within(productionPack as HTMLElement).queryByText("missing")).toBeNull();
    expect(within(productionPack as HTMLElement).queryByText("Preflight")).toBeNull();
    expect((productionPack as HTMLElement).textContent).not.toContain("required ready");
    expect((productionPack as HTMLElement).textContent).not.toContain("downloadable");
    expect((productionPack as HTMLElement).textContent).not.toContain("optional add-on");
    expect((productionPack as HTMLElement).textContent).not.toContain("production-local routes");
    expect((productionPack as HTMLElement).textContent).not.toContain("extract_claims, generate_note");
    fireEvent.click(within(productionPack as HTMLElement).getByRole("button", { name: /check readiness/i }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("ai.setup.run", expect.objectContaining({ mode: "recommended", pack_id: "tiny-production-pack", dry_run: true, timeout_seconds: 10 })));
    fireEvent.click(within(productionPack as HTMLElement).getByRole("button", { name: /check add-ons/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "ai.setup.run",
        expect.objectContaining({ mode: "recommended", pack_id: "tiny-production-pack", include_optional_models: true, dry_run: true, timeout_seconds: 10 })
      )
    );
    expect(await screen.findByText("Setup check")).toBeTruthy();
    const setupResult = await screen.findByLabelText("Setup check");
    expect(within(setupResult).getByText("1 routes planned")).toBeTruthy();
    expect(within(setupResult).getByText("Trusted model setup")).toBeTruthy();
    expect(within(setupResult).getByText("1 downloads planned · 609.8 MB")).toBeTruthy();
    expect(setupResult.textContent).not.toContain("tiny-production-pack / production");
    expect(setupResult.textContent).not.toContain("blocked");
    const demoPack = (await screen.findAllByText("Demo Fixture Pack"))
      .find((element) => element.tagName.toLowerCase() === "h4")
      ?.closest("article");
    expect(demoPack).toBeTruthy();
    expect(within(demoPack as HTMLElement).getByText("Starter ready")).toBeTruthy();
    expect(within(demoPack as HTMLElement).getByText("Suggested")).toBeTruthy();
    expect(within(demoPack as HTMLElement).getByText("Claim suggestions + Draft notes")).toBeTruthy();
    expect((demoPack as HTMLElement).textContent).not.toContain("demo_ready");
    expect((demoPack as HTMLElement).textContent).not.toContain("extract_claims, generate_note");
    const modelCard = (await screen.findAllByText("Tiny Fixture Local Model"))
      .find((element) => element.tagName.toLowerCase() === "h4")
      ?.closest("article");
    expect(modelCard).toBeTruthy();
    expect(within(modelCard as HTMLElement).getByText("Needs download")).toBeTruthy();
    expect(within(modelCard as HTMLElement).getByText("Local text runtime")).toBeTruthy();
    expect(within(modelCard as HTMLElement).getByText("GGUF file")).toBeTruthy();
    expect(within(modelCard as HTMLElement).getByText("Starter file")).toBeTruthy();
    expect(within(modelCard as HTMLElement).getByText("Claim suggestions + Draft notes")).toBeTruthy();
    expect(within(modelCard as HTMLElement).getByText("Tiny profile - test fixture")).toBeTruthy();
    expect(within(modelCard as HTMLElement).getByText("License artifact pending")).toBeTruthy();
    expect(within(modelCard as HTMLElement).queryByText("not_installed")).toBeNull();
    expect(within(modelCard as HTMLElement).queryByText("llama_cpp")).toBeNull();
    expect(within(modelCard as HTMLElement).queryByText("extract_claims, generate_note")).toBeNull();
    const approvalDetailsSummary = (await screen.findByText("Approval details")).closest("summary");
    expect(approvalDetailsSummary).toBeTruthy();
    fireEvent.click(approvalDetailsSummary as HTMLElement);
    expect(await screen.findByText("Approval checklist")).toBeTruthy();
    expect(await screen.findByText("Model files")).toBeTruthy();
    expect(await screen.findByText("15 models / 4 packs / 4 runtimes")).toBeTruthy();
    expect(await screen.findByText("0 errors")).toBeTruthy();
    expect(await screen.findByText("52 warnings")).toBeTruthy();
    expect(await screen.findByText("checked")).toBeTruthy();
    expect(await screen.findByText("9")).toBeTruthy();
    const approvalBoard = await screen.findByLabelText("Local AI items to finish");
    expect(within(approvalBoard).getByText("Items to finish")).toBeTruthy();
    expect(within(approvalBoard).getByText("8 setup areas need evidence before local models are trusted.")).toBeTruthy();
    expect(await screen.findByText("Verify model file checksums")).toBeTruthy();
    expect(await screen.findByText("Trust runtime sources")).toBeTruthy();
    expect((await screen.findAllByText("Connect local model tasks")).length).toBeGreaterThan(0);
    expect(approvalBoard.textContent).not.toContain("blockers");
    expect(approvalBoard.textContent).not.toContain("Route production capabilities");
    fireEvent.click(screen.getByRole("button", { name: /export checklist/i }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("ai.readiness.report.export", undefined));
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "local-ai-production-readiness.md",
        contents: "# Local AI Production Readiness\n\n## Approval Board\n\n- [ ] Pin production model checksums\n",
        mimeType: "text/markdown"
      })
    );
    expect(await screen.findByText(/Saved local-ai-production-readiness.md/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /export approval template/i }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("ai.readiness.approvalTemplate.export", undefined));
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "local-ai-approval-template.md",
        contents: "# Local AI Approval Template\n\n| `approval.evidence` | pending |\n",
        mimeType: "text/markdown"
      })
    );
    expect(await screen.findByText(/Saved local-ai-approval-template.md/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /export evidence file/i }));
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "local-ai-evidence-template.json",
        contents: "{\n  \"schema_version\": 1,\n  \"models\": {\"tiny-gguf-placeholder\": {\"approval\": {\"status\": \"approved\"}}},\n  \"runtimes\": {}\n}",
        mimeType: "application/json"
      })
    );
    expect(await screen.findByText(/Saved local-ai-evidence-template.json/)).toBeTruthy();
    expect(await screen.findByText("Local model preparation")).toBeTruthy();
    expect(await screen.findByText("needs evidence")).toBeTruthy();
    const initialPipeline = await screen.findByLabelText("Local AI setup path");
    expect(within(initialPipeline).getByText("Setup path")).toBeTruthy();
    expect(within(initialPipeline).getByText("0/8 stages clear")).toBeTruthy();
    expect(within(initialPipeline).getByText("File evidence")).toBeTruthy();
    expect(within(initialPipeline).getByText("Source metadata")).toBeTruthy();
    expect(within(initialPipeline).getByText("Source check")).toBeTruthy();
    expect(within(initialPipeline).getByText("File verification")).toBeTruthy();
    expect(within(initialPipeline).getByText("Review commands")).toBeTruthy();
    expect(within(initialPipeline).getByText("Final trust")).toBeTruthy();
    expect(within(initialPipeline).getByText("Backend says 80 file items remain.")).toBeTruthy();
    expect(within(initialPipeline).getByText("Readiness gate")).toBeTruthy();
    expect(within(initialPipeline).getAllByText("Needs action").length).toBeGreaterThan(0);
    expect(initialPipeline.textContent).not.toContain("blocked");
    expect(initialPipeline.textContent).not.toContain("Metadata hydration");
    expect(initialPipeline.textContent).not.toContain("Byte verification");
    expect(initialPipeline.textContent).not.toContain("Pin handoff");
    expect(initialPipeline.textContent).not.toContain("Final pin");
    expect(initialPipeline.textContent).not.toContain("Manifest evidence");
    expect(initialPipeline.textContent).not.toContain("manifest items");
    expect(await screen.findByText("packs ready to trust")).toBeTruthy();
    expect(await screen.findByText("models ready to trust")).toBeTruthy();
    expect(await screen.findByText("runtimes ready to trust")).toBeTruthy();
    expect((await screen.findAllByText("Tiny GGUF Local Model")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Managed llama.cpp Runtime")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /export setup checklist/i }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("ai.registry.releasePlan.export", undefined));
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "ai-registry-release-plan.md",
        contents: registryReleasePlanExportFixture.markdown,
        mimeType: "text/markdown"
      })
    );
    expect(await screen.findByText(/Saved ai-registry-release-plan.md/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /evaluate candidate files/i }));
    await waitFor(() => expect(selectRegistryFiles).toHaveBeenCalled());
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "ai.registry.releasePlan.evaluate",
        expect.objectContaining({
          model_registry_label: "candidate-models.json",
          runtime_registry_label: "candidate-runtimes.json",
          model_registry: expect.objectContaining({ models: [] }),
          runtime_registry: expect.objectContaining({ runtimes: [] })
        })
      )
    );
    const candidateCheck = await screen.findByLabelText("Candidate model file check");
    expect(within(candidateCheck).getByText("Candidate check")).toBeTruthy();
    expect(within(candidateCheck).getByText("Ready to trust")).toBeTruthy();
    expect(await screen.findByText("candidate-models.json + candidate-runtimes.json")).toBeTruthy();
    expect(await screen.findByText("File changes")).toBeTruthy();
    expect(await screen.findByText("3 added / 0 changed / 3 removed")).toBeTruthy();
    await waitFor(() => expect(within(screen.getByLabelText("Local AI setup path")).getByText("2/8 stages clear")).toBeTruthy());
    expect(within(screen.getByLabelText("Local AI setup path")).getByText("Backend says candidate files are ready to trust.")).toBeTruthy();
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "ai.registry.releaseWorkspace.save",
        expect.objectContaining({
          candidate_payload: expect.objectContaining({
            model_registry_label: "candidate-models.json",
            runtime_registry_label: "candidate-runtimes.json"
          }),
          candidate_release_plan: expect.objectContaining({ filename: "candidate-ai-registry-release-plan.md" }),
          candidate_status: expect.stringContaining("Evaluated candidate-models.json")
        })
      )
    );
    expect(await screen.findByText("setup draft saved")).toBeTruthy();
    expect(await screen.findByText(/Saved setup draft/)).toBeTruthy();
    expect(await screen.findByText("model file")).toBeTruthy();
    expect(await screen.findByText("cccccccccccc...")).toBeTruthy();
    expect(await screen.findByText("+2 / changed 0 / -2")).toBeTruthy();
    expect(await screen.findByText("All candidate production artifacts are ready to trust.")).toBeTruthy();
    expect(candidateCheck.textContent).not.toContain("candidate blocked");
    expect(candidateCheck.textContent).not.toContain("blockers");
    expect(candidateCheck.textContent).not.toContain("Pin impact");
    fireEvent.click(screen.getByRole("button", { name: /check source metadata/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "ai.registry.metadata.hydrate",
        expect.objectContaining({
          model_registry_label: "candidate-models.json",
          runtime_registry_label: "candidate-runtimes.json",
          model_registry: expect.objectContaining({ models: [] }),
          runtime_registry: expect.objectContaining({ runtimes: [] })
        })
      )
    );
    const hydrationSummary = await screen.findByLabelText("Candidate Hugging Face metadata hydration");
    expect(within(hydrationSummary).getByText("Source metadata")).toBeTruthy();
    expect(within(hydrationSummary).getByText("4")).toBeTruthy();
    expect(await screen.findByText(/Checked 4 metadata fields/)).toBeTruthy();
    expect(await screen.findByText("eeeeeeeeeeee...")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /export checked model file/i }));
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "candidate-model-registry.hydrated.json",
        contents: candidateMetadataHydrationFixture.model_registry_json,
        mimeType: "application/json"
      })
    );
    expect(await screen.findByText(/Saved candidate-model-registry.hydrated.json/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /check sources/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "ai.registry.artifactProbe.evaluate",
        expect.objectContaining({
          model_registry_label: "candidate-models.hydrated.json",
          runtime_registry_label: "candidate-runtimes.json",
          model_registry: expect.objectContaining({
            models: expect.arrayContaining([expect.objectContaining({ id: "candidate-tiny-llm" })])
          }),
          runtime_registry: expect.objectContaining({ runtimes: [] })
        })
      )
    );
    const probeSummary = await screen.findByLabelText("Candidate artifact source probe");
    expect(within(probeSummary).getByText("Source check")).toBeTruthy();
    expect(within(probeSummary).getByText("Complete")).toBeTruthy();
    expect(within(probeSummary).getByText("0 items")).toBeTruthy();
    expect(await screen.findByText("8/8 checks passed")).toBeTruthy();
    await waitFor(() => expect(within(screen.getByLabelText("Local AI setup path")).getByText("3/8 stages clear")).toBeTruthy());
    expect(await screen.findByText("Candidate source and license URLs are reachable.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /export source check/i }));
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "candidate-ai-registry-artifact-probe.md",
        contents: candidateArtifactProbeExportFixture.markdown,
        mimeType: "text/markdown"
      })
    );
    expect(await screen.findByText(/Saved candidate-ai-registry-artifact-probe.md/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /verify files/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "ai.registry.artifactVerify.evaluate",
        expect.objectContaining({
          model_registry_label: "candidate-models.hydrated.json",
          runtime_registry_label: "candidate-runtimes.json",
          model_registry: expect.objectContaining({
            models: expect.arrayContaining([expect.objectContaining({ id: "candidate-tiny-llm" })])
          }),
          runtime_registry: expect.objectContaining({ runtimes: [] })
        })
      )
    );
    const byteSummary = await screen.findByLabelText("Candidate artifact byte verification");
    expect(within(byteSummary).getByText("File verification")).toBeTruthy();
    expect(within(byteSummary).getByText("Complete")).toBeTruthy();
    expect(within(byteSummary).getByText("0 items")).toBeTruthy();
    expect(await screen.findByText("1/1 files verified")).toBeTruthy();
    await waitFor(() => expect(within(screen.getByLabelText("Local AI setup path")).getByText("4/8 stages clear")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /export file check/i }));
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "candidate-ai-registry-artifact-byte-verification.md",
        contents: candidateArtifactVerificationExportFixture.markdown,
        mimeType: "text/markdown"
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /export file evidence/i }));
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "candidate-ai-byte-evidence.json",
        contents: candidateArtifactVerificationExportFixture.evidence_json,
        mimeType: "application/json"
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /export candidate check/i }));
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "candidate-ai-registry-release-plan.md",
        contents: candidateMetadataHydrationFixture.release_plan_markdown,
        mimeType: "text/markdown"
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /export candidate approval template/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "ai.readiness.approvalTemplate.evaluate",
        expect.objectContaining({
          model_registry_label: "candidate-models.hydrated.json",
          runtime_registry_label: "candidate-runtimes.json",
          model_registry: expect.objectContaining({
            models: expect.arrayContaining([expect.objectContaining({ id: "candidate-tiny-llm" })])
          }),
          runtime_registry: expect.objectContaining({ runtimes: [] })
        })
      )
    );
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "candidate-local-ai-approval-template.md",
        contents: candidateApprovalTemplateExportFixture.markdown,
        mimeType: "text/markdown"
      })
    );
    expect(await screen.findByText(/Saved candidate-local-ai-approval-template.md/)).toBeTruthy();
    const evidenceJsonButtons = screen.getAllByRole("button", { name: /export candidate evidence file/i });
    fireEvent.click(evidenceJsonButtons[evidenceJsonButtons.length - 1]);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "ai.readiness.approvalTemplate.evaluate",
        expect.objectContaining({
          model_registry_label: "candidate-models.hydrated.json",
          runtime_registry_label: "candidate-runtimes.json",
          model_registry: expect.objectContaining({
            models: expect.arrayContaining([expect.objectContaining({ id: "candidate-tiny-llm" })])
          }),
          runtime_registry: expect.objectContaining({ runtimes: [] })
        })
      )
    );
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "candidate-local-ai-evidence-template.json",
        contents: candidateApprovalTemplateExportFixture.evidence_json,
        mimeType: "application/json"
      })
    );
    expect(await screen.findByText(/Saved candidate-local-ai-evidence-template.json/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /apply evidence/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "ai.registry.evidence.apply",
        expect.objectContaining({
          model_registry_label: "candidate-models.hydrated.json",
          runtime_registry_label: "candidate-runtimes.json",
          evidence_label: expect.stringContaining("2 evidence files"),
          evidence: expect.objectContaining({
            models: {
              "candidate-tiny-llm": expect.objectContaining({
                filename: "candidate.gguf",
                sha256: "e".repeat(64),
                size_bytes: 1024,
                approval: expect.objectContaining({ status: "approved" }),
                license_label: "MIT"
              })
            },
            runtimes: {
              "candidate-llama-runtime": expect.objectContaining({
                version: "b5123",
                approval: expect.objectContaining({ status: "approved" })
              })
            }
          })
        })
      )
    );
    const evidenceCall = request.mock.calls.find(([route]) => route === "ai.registry.evidence.apply");
    expect(evidenceCall?.[1].evidence_label).toContain("candidate-ai-byte-evidence.json");
    expect(evidenceCall?.[1].evidence_label).toContain("candidate-reviewer-evidence.json");
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "candidate-ai-registry-evidence-bundle.json",
        contents: candidateEvidenceOverlayExportFixture.bundle_json,
        mimeType: "application/json"
      })
    );
    expect(await screen.findByText(/Applied 14 evidence fields/)).toBeTruthy();
    expect(await screen.findByText("Prepared model files")).toBeTruthy();
    expect(await screen.findByText(/Evidence: 2 evidence files/)).toBeTruthy();
    await waitFor(() => expect(within(screen.getByLabelText("Local AI setup path")).getByText("4/8 stages clear")).toBeTruthy());
    expect(await screen.findByText("model a1b2c3d4e5f6...")).toBeTruthy();
    expect(await screen.findByText("runtime f6e5d4c3b2a1...")).toBeTruthy();
    const pinHandoff = await screen.findByLabelText("Candidate review commands");
    expect(within(pinHandoff).getByText("Check sources")).toBeTruthy();
    expect(within(pinHandoff).getByText("Verify files")).toBeTruthy();
    expect(within(pinHandoff).getByText("Setup bundle")).toBeTruthy();
    expect(within(pinHandoff).getByText("Acceptance report")).toBeTruthy();
    expect(within(pinHandoff).getByText("Dry-run approval")).toBeTruthy();
    expect(within(pinHandoff).getByText("Trust model files")).toBeTruthy();
    expect(within(pinHandoff).getByText(/probe_ai_registry_artifacts\.sh/)).toBeTruthy();
    expect(within(pinHandoff).getByText(/verify_ai_registry_artifacts\.sh/)).toBeTruthy();
    expect(within(pinHandoff).getByText(/prepare_ai_registry_release_candidate\.sh/)).toBeTruthy();
    expect(within(pinHandoff).getByText(/--probe-sources/)).toBeTruthy();
    expect(within(pinHandoff).getByText(/--verify-bytes/)).toBeTruthy();
    expect(within(pinHandoff).getByText(/candidate-ai-registry-acceptance\.applied\.md/)).toBeTruthy();
    expect(pinHandoff.textContent).not.toContain("Dry-run pin");
    expect(pinHandoff.textContent).not.toContain("Pin registries");
    expect(pinHandoff.textContent).not.toContain("Probe sources");
    expect(pinHandoff.textContent).not.toContain("Verify bytes");
    fireEvent.click(within(pinHandoff).getByRole("button", { name: /copy setup bundle command/i }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("prepare_ai_registry_release_candidate.sh"))
    );
    expect((await within(pinHandoff).findByRole("button", { name: /copied setup bundle command/i })).getAttribute("title")).toBe("Copied Setup bundle command");
    fireEvent.click(screen.getByRole("button", { name: /^prepare bundle$/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "ai.registry.releasePacket.prepare",
        expect.objectContaining({
          candidate_evidence: expect.objectContaining({
            filename: "candidate-ai-registry-evidence-bundle.json",
            applied_count: 14
          }),
          probe_sources: false,
          verify_bytes: false
        })
      )
    );
    const releasePacket = await screen.findByLabelText("Candidate setup bundle");
    expect(within(releasePacket).getByText("Setup bundle")).toBeTruthy();
    expect(within(releasePacket).getByText("Ready to trust")).toBeTruthy();
    expect(within(releasePacket).getByText(candidateReleasePacketFixture.output_dir)).toBeTruthy();
    expect(within(releasePacket).getByText("candidate-ai-registry-release-packet.md")).toBeTruthy();
    expect(within(releasePacket).getByText("4")).toBeTruthy();
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "ai.registry.releaseWorkspace.save",
        expect.objectContaining({
          candidate_release_packet: expect.objectContaining({
            output_dir: candidateReleasePacketFixture.output_dir,
            artifacts: expect.arrayContaining([
              expect.objectContaining({ filename: "candidate-ai-registry-release-packet.md" })
            ])
          }),
          candidate_status: expect.stringContaining("Prepared setup bundle with 4 files")
        })
      )
    );
    fireEvent.click(screen.getByRole("button", { name: /export applied plan/i }));
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "candidate-ai-registry-release-plan.applied.md",
        contents: candidateEvidenceOverlayExportFixture.release_plan_markdown,
        mimeType: "text/markdown"
      })
    );
    expect(await screen.findByText(/Saved applied release plan candidate-ai-registry-release-plan.applied.md/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /export applied checklist/i }));
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "candidate-local-ai-approval-template.applied.md",
        contents: candidateEvidenceOverlayExportFixture.approval_template_markdown,
        mimeType: "text/markdown"
      })
    );
    expect(await screen.findByText(/Saved applied approval checklist candidate-local-ai-approval-template.applied.md/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /export review commands/i }));
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "candidate-ai-registry-pin-handoff.applied.md",
        contents: candidateEvidenceOverlayExportFixture.pin_handoff_markdown,
        mimeType: "text/markdown"
      })
    );
    expect(await screen.findByText(/Saved review commands candidate-ai-registry-pin-handoff.applied.md/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /export model file/i }));
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "candidate-models.patched.json",
        contents: candidateEvidenceOverlayExportFixture.model_registry_json,
        mimeType: "application/json"
      })
    );
    expect(await screen.findByText(/Saved prepared model file candidate-models.patched.json/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /export runtime file/i }));
    await waitFor(() =>
      expect(saveTextFile).toHaveBeenCalledWith({
        filename: "candidate-runtimes.patched.json",
        contents: candidateEvidenceOverlayExportFixture.runtime_registry_json,
        mimeType: "application/json"
      })
    );
    expect(await screen.findByText(/Saved prepared runtime file candidate-runtimes.patched.json/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /clear draft/i }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("ai.registry.releaseWorkspace.clear", undefined));
    expect(await screen.findByText("Cleared saved setup draft.")).toBeTruthy();
    const workQueue = (await screen.findByLabelText("Local AI items to finish"));
    expect(within(workQueue).getAllByRole("button", { name: /^setup$/i }).length).toBeGreaterThan(0);
    expect(within(workQueue).getAllByRole("button", { name: /open search/i }).length).toBeGreaterThan(0);
    const selectedTask = await screen.findByLabelText("Selected local AI setup item");
    expect(within(selectedTask).getByText("Connect local model tasks")).toBeTruthy();
    expect(within(selectedTask).getByText("Model task routing")).toBeTruthy();
    expect(within(selectedTask).getByText("Claim suggestions task")).toBeTruthy();
    expect(selectedTask.textContent).not.toContain("blocked");
    expect(selectedTask.textContent).not.toContain("Capability routes");
    const checksumTask = (await screen.findByText("Verify model file checksums")).closest("article");
    expect(checksumTask).toBeTruthy();
    fireEvent.click(within(checksumTask as HTMLElement).getByRole("button", { name: /inspect/i }));
    expect(within(selectedTask).getByText("Tiny Trusted Local Pack / Checksum")).toBeTruthy();
    expect(within(selectedTask).getByText("Trusted model packs")).toBeTruthy();
    expect((await screen.findAllByText("Trusted model packs")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Trusted runtimes")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Model task routing")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Approve sources, filenames, checksums/i).length).toBeGreaterThan(0);
    const setupGuide = (await screen.findByText("Private setup steps")).closest("section");
    const currentSetupStep = within(setupGuide as HTMLElement).getByLabelText("Current local AI setup step");
    expect(currentSetupStep).toBeTruthy();
    const setupProgress = within(setupGuide as HTMLElement).getByLabelText("Local AI setup progress");
    expect(setupProgress).toBeTruthy();
    expect(within(currentSetupStep).getByText("Local runtimes")).toBeTruthy();
    expect(within(currentSetupStep).getByText("Runtime repair needed")).toBeTruthy();
    expect(within(setupProgress).getByText("Privacy mode")).toBeTruthy();
    expect(within(setupProgress).getByText("Starter setup")).toBeTruthy();
    const setupRunCallsBeforeGuideCheck = request.mock.calls.filter(([route]) => route === "ai.setup.run").length;
    fireEvent.click(within(setupGuide as HTMLElement).getByRole("button", { name: /^check$/i }));
    await waitFor(() => {
      const setupRunCalls = request.mock.calls.filter(([route]) => route === "ai.setup.run");
      expect(setupRunCalls.length).toBeGreaterThan(setupRunCallsBeforeGuideCheck);
      expect(setupRunCalls.at(-1)?.[1]).toEqual(expect.objectContaining({ mode: "recommended", pack_id: "tiny-production-pack", dry_run: true, timeout_seconds: 10 }));
    });
    const setupCheck = await screen.findByLabelText("Setup check");
    expect(within(setupCheck).getByText("1 routes planned")).toBeTruthy();
    expect(within(setupCheck).getByText("1 downloads planned · 609.8 MB")).toBeTruthy();
    const plannedRoutes = within(setupCheck).getByLabelText("Setup routes planned");
    expect(within(plannedRoutes).getByText("Claim suggestions")).toBeTruthy();
    expect(within(setupCheck).getByText("Would test local text runtime and activate Claim suggestions.")).toBeTruthy();
    expect(setupCheck.textContent).not.toContain("extract_claims");
    fireEvent.click(within(setupGuide as HTMLElement).getByRole("button", { name: /^setup$/i }));
    const wizard = await screen.findByRole("dialog", { name: /model setup/i });
    expect(within(wizard).getByText("Model setup")).toBeTruthy();
    expect(within(wizard).getByText("Install verified local runtimes")).toBeTruthy();
    expect(within(wizard).getAllByText("Needs action").length).toBeGreaterThan(0);
    expect(within(wizard).getAllByText("Runtime binary").length).toBeGreaterThan(0);
    expect(within(wizard).getAllByText("Works here").length).toBeGreaterThan(0);
    expect(within(wizard).queryByText("target any/any")).toBeNull();
    expect(within(wizard).queryByText("Host macos/arm64")).toBeNull();
    expect(within(wizard).queryByText("blocked")).toBeNull();
    fireEvent.click(within(wizard).getByRole("button", { name: /tiny production pack/i }));
    expect(within(wizard).getByText("Tiny Production Local Pack")).toBeTruthy();
    expect(within(wizard).getByText("Needs approval")).toBeTruthy();
    expect(within(wizard).queryByText("blocked")).toBeNull();
    expect(within(wizard).getAllByText(/Missing approved downloads/i).length).toBeGreaterThan(0);
    const setupRunCallsBeforeWizardCheck = request.mock.calls.filter(([route]) => route === "ai.setup.run").length;
    fireEvent.click(within(wizard).getByRole("button", { name: /check setup/i }));
    await waitFor(() => {
      const setupRunCalls = request.mock.calls.filter(([route]) => route === "ai.setup.run");
      expect(setupRunCalls.length).toBeGreaterThan(setupRunCallsBeforeWizardCheck);
      expect(setupRunCalls.at(-1)?.[1]).toEqual(expect.objectContaining({ mode: "recommended", pack_id: "tiny-production-pack", dry_run: true, timeout_seconds: 10 }));
    });
    fireEvent.click(within(wizard).getAllByRole("button", { name: /review setup/i })[0]);
    await waitFor(() => {
      const setupRunCalls = request.mock.calls.filter(([route]) => route === "ai.setup.run");
      expect(setupRunCalls.at(-1)?.[1]).toEqual(expect.objectContaining({ mode: "recommended", pack_id: "tiny-production-pack", timeout_seconds: 120 }));
      expect(setupRunCalls.at(-1)?.[1]?.dry_run).not.toBe(true);
    });
    await waitFor(() => expect(within(wizard).getAllByText("Required downloads").length).toBeGreaterThan(1));
    expect(within(wizard).getAllByText(/Pin the SHA-256 checksum before use/i).length).toBeGreaterThan(1);
    fireEvent.click(within(wizard).getByRole("button", { name: /use starter setup/i }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("ai.setup.run", expect.objectContaining({ mode: "demo", pack_id: "tiny-local-pack" })));
    expect(await within(wizard).findByText("Setup result")).toBeTruthy();
    fireEvent.click(within(wizard).getByRole("button", { name: /local runtimes/i }));
    fireEvent.click(within(wizard).getByRole("button", { name: /^install starter runtime$/i }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("ai.runtimes.install", { runtimeId: "llama-cpp-fixture-runtime" }));
    fireEvent.click(within(wizard).getByRole("button", { name: /close setup/i }));
    fireEvent.click(within(setupGuide as HTMLElement).getByRole("button", { name: /use starter setup/i }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("ai.setup.run", expect.objectContaining({ mode: "demo", pack_id: "tiny-local-pack" })));
    expect(await screen.findByText("Setup result")).toBeTruthy();
    expect(await screen.findByText(/not inference-capable/i)).toBeTruthy();
    fireEvent.click(within(setupGuide as HTMLElement).getByRole("button", { name: /install starter runtime/i }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("ai.runtimes.install", { runtimeId: "llama-cpp-fixture-runtime" }));
    expect(within(setupGuide as HTMLElement).queryByRole("button", { name: /download starter/i })).toBeNull();
    fireEvent.click(within(settingsTabs).getByRole("tab", { name: "Search" }));
    expect(await screen.findByRole("heading", { name: "Search", level: 2 })).toBeTruthy();
    expect(screen.queryByText("local index and ranking")).toBeNull();
    expect(screen.queryByText("Choose which local provider handles each model-backed task.")).toBeNull();
    fireEvent.click(within(settingsTabs).getByRole("tab", { name: "Advanced" }));
    expect(await screen.findByRole("heading", { name: "Advanced", level: 2 })).toBeTruthy();
    const snapshotSummary = (await screen.findByText("Settings snapshot")).closest("summary");
    expect(snapshotSummary).toBeTruthy();
    expect(screen.queryByText("Current local preferences as JSON. Useful when comparing support notes or debugging a setup issue.")).toBeNull();
    expect(screen.queryByLabelText("Settings JSON snapshot")).toBeNull();
    fireEvent.click(snapshotSummary as HTMLElement);
    expect(await screen.findByLabelText("Settings JSON snapshot")).toBeTruthy();
  });

  it("shows successful production setup route activation in settings", async () => {
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list" || route === "events.list") return [];
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "settings.get") return {};
      if (route === "ai.providers") return [];
      if (route === "ai.capabilities") {
        return [
          { capability: "extract_claims", provider_id: "llama_cpp_cli", model_id: "tiny-gguf-placeholder", local_only: true, settings: {} },
          { capability: "generate_note", provider_id: "llama_cpp_cli", model_id: "tiny-gguf-placeholder", local_only: true, settings: {} },
          { capability: "embed_text", provider_id: "local_embedding", model_id: "tiny-embedding-placeholder", local_only: true, settings: {} }
        ];
      }
      if (route === "ai.hardware") {
        return {
          os: "macos",
          arch: "arm64",
          physical_ram_gb: 16,
          apple_silicon: true,
          metal_available: true,
          cuda_available: false,
          rocm_available: false,
          vulkan_available: false,
          recommended_profile: "tiny",
          warnings: []
        };
      }
      if (route === "ai.models.registry") return { models: [] };
      if (route === "ai.modelPacks") {
        return [
          {
            id: "tiny-production-pack",
            display_name: "Tiny Production Local Pack",
            profile: "tiny",
            release_channel: "production",
            release_status: "ready",
            description: "Approved tiny local model pack.",
            privacy_label: "Runs on this device",
            model_ids: ["tiny-gguf-placeholder", "tiny-embedding-placeholder"],
            required_model_ids: ["tiny-gguf-placeholder", "tiny-embedding-placeholder"],
            optional_model_ids: [],
            capabilities: ["extract_claims", "generate_note", "embed_text"],
            disk_bytes: 1024,
            installed_model_ids: [],
            missing_model_ids: ["tiny-gguf-placeholder", "tiny-embedding-placeholder"],
            downloadable_model_ids: ["tiny-gguf-placeholder", "tiny-embedding-placeholder"],
            blocked_reasons: [],
            installable: true,
            installed: false,
            readiness_checks: []
          }
        ];
      }
      if (route === "ai.runtimes.registry") {
        return [
          {
            id: "llama-cpp-managed-runtime",
            display_name: "Production llama.cpp Runtime",
            runtime: "llama_cpp",
            release_channel: "production",
            version: "b9596",
            platform: "macos",
            arch: "arm64",
            compatible: true,
            host_platform: "macos",
            host_arch: "arm64",
            compatibility_error: null,
            binary_name: "llama-cli",
            installed: true,
            install_state: "installed",
            installable: true,
            source_type: "url",
            binary_path: "/tmp/vault-runtimes/llama-cli",
            size_bytes: 252,
            sha256: "fixture-sha",
            sha256_actual: "fixture-sha",
            integrity_status: "pass",
            integrity_error: null,
            license_label: "MIT",
            blocked_reasons: [],
            readiness_checks: [],
            install_log: []
          }
        ];
      }
      if (route === "ai.models.installed" || route === "ai.models.downloads" || route === "ai.runs" || route === "voice.voices" || route === "voice.audioAssets" || route === "voice.speechAssets") {
        return [];
      }
      if (route === "ai.runtime.health") {
        return {
          llama_cpp: {
            runtime: "llama_cpp",
            state: "ready",
            runtime_dir: "/tmp/vault-runtimes",
            cli: { configured: true, source: "managed" },
            server: { configured: false, source: "missing" },
            installed_models: ["tiny-gguf-placeholder"],
            warnings: [],
            next_actions: []
          },
          voice: {}
        };
      }
      if (route === "ai.setup.status") {
        return {
          mode: "local_only",
          overall_status: "ready",
          recommended_profile: "tiny",
          recommended_pack_id: "tiny-production-pack",
          privacy_label: "Local only: cloud fallback blocked unless explicitly enabled",
          next_action: "Install and activate the recommended local model setup.",
          can_use_demo: false,
          blocked_reasons: [],
          steps: [
            { id: "privacy", title: "Privacy mode", status: "done", summary: "Cloud fallback is blocked", detail: "Every core AI route is local-only.", action_payload: {} },
            { id: "runtime", title: "Local runtimes", status: "done", summary: "Runtime ready", detail: "Verified managed runtime is installed.", action_payload: {} },
            { id: "production_pack", title: "Tiny production pack", status: "ready", summary: "Approved pack ready", detail: "Required model files can be installed.", action_payload: {} },
            { id: "capability_routes", title: "Model task routing", status: "ready", summary: "Ready to activate", detail: "Recommended local routes can be activated.", action_payload: {} }
          ]
        };
      }
      if (route === "ai.readiness.report") {
        return {
          generated_at: "2026-06-22T00:00:00Z",
          status: "ready",
          production_ready: true,
          demo_available: false,
          recommended_profile: "tiny",
          recommended_pack_id: "tiny-production-pack",
          summary: {
            total_checks: 6,
            pass_count: 6,
            warn_count: 0,
            pending_count: 0,
            blocked_count: 0,
            production_pack_count: 1,
            ready_production_pack_count: 1,
            production_runtime_count: 1,
            ready_production_runtime_count: 1
          },
          next_actions: [],
          approval_items: [],
          sections: [
            {
              id: "capability-routes",
              title: "Capability routes",
              status: "ready",
              summary: "Required production capabilities use approved local routes.",
              blocked_count: 0,
              checks: []
            }
          ]
        };
      }
      if (route === "ai.registry.validation") {
        return {
          ...registryValidationFixture,
          status: "pass",
          summary: { ...registryValidationFixture.summary, error_count: 0, warning_count: 0 },
          errors: [],
          warnings: []
        };
      }
      if (route === "ai.registry.releasePlan") {
        return {
          generated_at: "2026-06-22T00:00:00Z",
          status: "ready_to_pin",
          summary: {
            production_model_count: 2,
            ready_production_model_count: 2,
            production_runtime_count: 1,
            ready_production_runtime_count: 1
          },
          checks: [],
          pin_preview: {}
        };
      }
      if (route === "ai.registry.releaseWorkspace") return { schema_version: 1, has_workspace: false, updated_at: null };
      if (route === "ai.setup.run") {
        return {
          mode: payload.mode,
          pack_id: payload.pack_id,
          release_channel: "production",
          status: "done",
          dry_run: false,
          selected_capabilities: ["extract_claims", "generate_note", "embed_text"],
          planned_download_count: 2,
          planned_download_bytes: 700000000,
          downloads: [
            { model_id: "tiny-gguf-placeholder", state: "installed" },
            { model_id: "tiny-embedding-placeholder", state: "installed" }
          ],
          steps: [
            { id: "runtime-llama_cpp", title: "llama_cpp runtime", status: "done", detail: "Verified managed runtime.", runtime_id: "llama-cpp-managed-runtime" },
            { id: "model-tiny-gguf-placeholder", title: "Tiny GGUF Local Model", status: "done", detail: "Downloaded and verified.", model_id: "tiny-gguf-placeholder" },
            { id: "activate-extract_claims", title: "Claim suggestions", status: "done", detail: "Activated approved local route.", capability: "extract_claims" },
            { id: "activate-generate_note", title: "Draft notes", status: "done", detail: "Activated approved local route.", capability: "generate_note" },
            { id: "activate-embed_text", title: "Search index", status: "done", detail: "Activated approved local route.", capability: "embed_text" }
          ],
          setup: {}
        };
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "settings" });
    renderApp();

    expect(await screen.findByRole("heading", { name: "Local", level: 2 })).toBeTruthy();
    const setupGuide = (await screen.findByText("Private setup steps")).closest("section");
    expect(setupGuide).toBeTruthy();
    fireEvent.click(within(setupGuide as HTMLElement).getByRole("button", { name: /^setup$/i }));
    const wizard = await screen.findByRole("dialog", { name: /model setup/i });
    const recommendedSetupActions = within(wizard).getAllByRole("button", { name: /use recommended setup/i });
    fireEvent.click(recommendedSetupActions[recommendedSetupActions.length - 1]);
    await waitFor(() => expect(request).toHaveBeenCalledWith("ai.setup.run", expect.objectContaining({ mode: "recommended", pack_id: "tiny-production-pack", timeout_seconds: 120 })));
    const result = await within(wizard).findByLabelText("Setup result");
    expect(within(result).getByText("Trusted model setup")).toBeTruthy();
    expect(within(result).getByText("3 routes activated")).toBeTruthy();
    expect(within(result).getByText("2 downloads checked · 667.6 MB")).toBeTruthy();
    const activatedRoutes = within(result).getByLabelText("Setup routes activated");
    expect(within(activatedRoutes).getByText("Claim suggestions")).toBeTruthy();
    expect(within(activatedRoutes).getByText("Draft notes")).toBeTruthy();
    expect(within(activatedRoutes).getByText("Search index")).toBeTruthy();
    expect(within(result).getAllByText("Claim suggestions").length).toBeGreaterThan(0);
    expect(within(result).getAllByText("Search index").length).toBeGreaterThan(0);
    expect(result.textContent).not.toContain("mock");
    expect(result.textContent).not.toContain("blocked");
  });

  it("shows privacy settings in local-first language", async () => {
    const request = vi.fn(async (route: string) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list" || route === "events.list") return [];
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 0,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "settings.get") return {};
      if (route === "ai.runs") {
        return [{ id: "run_local", capability: "grounded_answer", provider: "mock_local", status: "succeeded", sent_off_device: false }];
      }
      if (route === "ai.providers" || route === "ai.capabilities" || route === "ai.modelPacks" || route === "ai.runtimes.registry" || route === "ai.models.installed" || route === "ai.models.downloads" || route === "voice.voices" || route === "voice.audioAssets" || route === "voice.speechAssets") {
        return [];
      }
      if (route === "ai.hardware") {
        return { os: "macos", arch: "arm64", physical_ram_gb: 16, recommended_profile: "standard", warnings: [] };
      }
      if (route === "ai.models.registry") return { models: [] };
      if (route === "ai.setup.status") return { overall_status: "not_started", steps: [], blocked_reasons: [], can_use_demo: true };
      if (route === "ai.readiness.report") return null;
      if (route === "ai.registry.validation") return { status: "pass", errors: [], warnings: [] };
      if (route === "ai.registry.releasePlan") return null;
      if (route === "ai.registry.releaseWorkspace") return { schema_version: 1, has_workspace: false, updated_at: null };
      if (route === "ai.runtime.health") return { state: "missing", runtimes: [] };
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "settings" });
    renderApp();

    fireEvent.click(await screen.findByRole("tab", { name: /^privacy$/i }));
    expect(await screen.findByText("Cloud stays off")).toBeTruthy();
    expect(await screen.findByText("Private prompts")).toBeTruthy();
    expect(await screen.findByText("Local only")).toBeTruthy();
    expect(await screen.findByText("Hashes only")).toBeTruthy();
    expect(await screen.findByText("Recent model activity")).toBeTruthy();
    expect(await screen.findByText(/Assistant answers - Local model/i)).toBeTruthy();
    expect(await screen.findByText(/Completed \/ Stayed on this device/i)).toBeTruthy();
    expect(screen.queryByText("Local-only mode rejects cloud providers unless you explicitly allow them.")).toBeNull();
    expect(screen.queryByText("Model activity keeps hashes and metadata, not full private prompts.")).toBeNull();
    expect(screen.queryByText(/mock_local/i)).toBeNull();
    expect(screen.queryByText(/grounded_answer - mock_local/i)).toBeNull();
  });

  it("creates a workspace backup from settings", async () => {
    const request = vi.fn(async (route: string) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list" || route === "events.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 2,
          notes: 2,
          claims: 1,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "settings.get") {
        return { general: { workspace_name: "Research Lab", data_folder: "/Users/test/Library/Application Support/The Vault Research Lab" } };
      }
      if (route === "ai.providers" || route === "ai.capabilities" || route === "ai.modelPacks" || route === "ai.runtimes.registry" || route === "ai.models.installed" || route === "ai.models.downloads" || route === "ai.runs" || route === "voice.voices" || route === "voice.audioAssets" || route === "voice.speechAssets") {
        return [];
      }
      if (route === "ai.hardware") {
        return { os: "macos", arch: "arm64", physical_ram_gb: 16, recommended_profile: "standard", warnings: [] };
      }
      if (route === "ai.models.registry") return { models: [] };
      if (route === "ai.setup.status") return { overall_status: "not_started", steps: [], blocked_reasons: [], can_use_demo: true };
      if (route === "ai.readiness.report") return null;
      if (route === "ai.registry.validation") return { status: "pass", errors: [], warnings: [] };
      if (route === "ai.registry.releasePlan") return null;
      if (route === "ai.registry.releaseWorkspace") return { schema_version: 1, has_workspace: false, updated_at: null };
      if (route === "ai.runtime.health") return { state: "missing", runtimes: [] };
      if (route === "export.workspace") {
        return {
          export_id: "export_test",
          filename: "vault-workspace-export-test.zip",
          file_path: "/Users/test/Library/Application Support/The Vault Research Lab/backups/vault-workspace-export-test.zip",
          mime_type: "application/zip",
          size_bytes: 2048,
          created_at: "2026-06-05T00:00:00Z",
          manifest: {
            counts: { notes: 2, sources: 1, claims: 1, graph_edges: 0, review_history: 1, capsules: 1, capsule_items: 3, capsule_versions: 1 },
            formats: { notes: "Markdown + JSONL metadata", capsules: "JSONL" },
            database: { schema_version: 0 },
            blobs: []
          }
        };
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "settings" });
    renderApp();

    fireEvent.click(await screen.findByRole("tab", { name: /^export$/i }));
    expect(await screen.findByText("Workspace backup")).toBeTruthy();
    const backupContents = await screen.findByLabelText("Workspace backup contents");
    expect(backupContents).toBeTruthy();
    expect(within(backupContents).getByText("Capsules")).toBeTruthy();
    expect(within(backupContents).queryByText("Capsule membership, versions, exports, imports, and dependencies.")).toBeNull();
    expect(screen.queryByText(/Save a zip in the Vault backups folder/)).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /create backup/i }));

    await waitFor(() => expect(request).toHaveBeenCalledWith("export.workspace", {}));
    expect(await screen.findByText("vault-workspace-export-test.zip")).toBeTruthy();
    expect(await screen.findByText(/notes: 2/i)).toBeTruthy();
    expect(await screen.findByText(/sources: 1/i)).toBeTruthy();
    expect(await screen.findByText(/claims: 1/i)).toBeTruthy();
    expect(await screen.findByText(/capsules: 1/i)).toBeTruthy();
    expect(await screen.findByText(/capsule items: 3/i)).toBeTruthy();
    expect(await screen.findByText(/Created vault-workspace-export-test.zip/)).toBeTruthy();
  });

  it("inserts a selected local transcript into the active note", async () => {
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 1,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "notes.list") {
        return [
          {
            id: "note_voice",
            title: "Voice Draft",
            content: {},
            content_markdown: "Existing research note.",
            origin: "user_written",
            status: "active",
            version: 1,
            source_id: "src_note",
            updated_at: "2026-06-03T00:00:00Z"
          }
        ];
      }
      if (route === "ai.capabilities") {
        return [
          { capability: "extract_claims", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} },
          { capability: "extract_objects", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} },
          { capability: "generate_note", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} }
        ];
      }
      if (route === "ai.providers") {
        return [
          {
            id: "mock_llm",
            display_name: "Mock Local LLM",
            kind: "llm",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          }
        ];
      }
      if (route === "voice.transcribe") {
        return {
          run_id: "run_voice",
          provider: "mock_stt",
          model_id: "mock-local-stt",
          text: "Local transcript inserted into the note.",
          source_id: "src_voice",
          source_title: "field memo",
          audio_asset_id: "aud_voice",
          sent_off_device: false,
          segments: [{ start_ms: 0, end_ms: 1200, text: "Local transcript inserted into the note." }]
        };
      }
      if (route === "notes.update") {
        return {
          id: payload.noteId,
          title: payload.data.title,
          content: payload.data.content_json,
          content_markdown: payload.data.content_markdown,
          origin: "user_written",
          status: "active",
          version: 2,
          source_id: "src_note",
          updated_at: "2026-06-03T00:00:01Z"
        };
      }
      return [];
    });
    const selectFiles = vi.fn(async () => ["/tmp/field memo.wav"]);
    window.vault = { request, selectFiles };

    useUIStore.setState({ surface: "notes", selectedNoteId: "note_voice" });
    renderApp();
    expect(await screen.findByDisplayValue("Voice Draft")).toBeTruthy();
    await openNoteTools();
    fireEvent.click(await screen.findByRole("button", { name: /insert audio/i }));
    await waitFor(() => expect(selectFiles).toHaveBeenCalled());
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("voice.transcribe", {
        audio_path: "/tmp/field memo.wav",
        title: "field memo",
        create_source: true,
        local_only: true,
        metadata: { import_mode: "note_editor_insert", note_id: "note_voice" }
      })
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "notes.update",
        expect.objectContaining({
          noteId: "note_voice",
          data: expect.objectContaining({
            content_markdown: expect.stringContaining("Local transcript inserted into the note.")
          })
        })
      )
    );
    expect(await screen.findByText("Dictated")).toBeTruthy();
    const dictatedResult = screen.getByText("Dictated").closest(".workflow-result");
    expect(dictatedResult).toBeTruthy();
    expect(within(dictatedResult as HTMLElement).getByText("On device")).toBeTruthy();
    expect(within(dictatedResult as HTMLElement).getByText("Linked to Storage")).toBeTruthy();
    expect(within(dictatedResult as HTMLElement).queryByText("mock-local-stt")).toBeNull();
    expect(within(dictatedResult as HTMLElement).queryByText("src_voice")).toBeNull();
  });

  it("opens generated memos as reviewable drafts with evidence provenance", async () => {
    const longGeneratedCitationLabel = "Source Alpha With A Long Literature Review Collection Name";
    const longGeneratedCitationTitle = `${longGeneratedCitationLabel} (appendix block 1 with a very long locator)`;
    let generated = false;
    let prepared = false;
    let approved = false;
    const originalNote = {
      id: "note_original",
      title: "Original",
      content: {},
      content_markdown: "Summarize this source-backed note.",
      origin: "user_written",
      status: "active",
      version: 1,
      source_id: "src_original",
      updated_at: "2026-06-03T00:00:00Z"
    };
    const generatedNote = () => ({
      id: "note_generated",
      title: "Original memo",
      content: {
        generation_status: approved ? "approved" : "draft",
        requires_review: !approved,
        generated_by: "mock_llm",
        model_id: "mock-local-llm",
        capability: "generate_note",
        ai_run_id: "run_generated",
        source_ids: ["src_original"],
        claim_ids: ["claim_alpha"],
        citations: [{ title: longGeneratedCitationLabel, locator: "appendix block 1 with a very long locator", snippet: "Evidence quote." }],
        generated_claim_review_status: prepared ? "prepared" : "not_prepared",
        generated_claim_review_item_count: prepared ? 2 : 0,
        generated_claim_review_quarantined_count: 0,
        generated_claim_review_job_id: prepared ? "job_claim_review" : undefined,
        sent_off_device: false
      },
      content_markdown: "# Original memo\n\nGenerated synthesis.\n\n## Evidence Pack\n- Evidence quote.",
      origin: "ai_generated",
      status: approved ? "active" : "generated_pending_review",
      version: approved ? 2 : 1,
      source_id: "src_generated",
      updated_at: "2026-06-03T00:00:01Z"
    });
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "notes.list") return generated ? [generatedNote(), originalNote] : [originalNote];
      if (route === "ai.capabilities") {
        return [
          { capability: "extract_claims", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} },
          { capability: "extract_objects", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} },
          { capability: "generate_note", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} }
        ];
      }
      if (route === "ai.providers") {
        return [
          {
            id: "mock_llm",
            display_name: "Mock Local LLM",
            kind: "llm",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          }
        ];
      }
      if (route === "notes.generate") {
        generated = true;
        return {
          note_id: "note_generated",
          status: "generated_pending_review",
          ai_run_id: "run_generated",
          provider: "mock_llm",
          model_id: "mock-local-llm",
          sent_off_device: false
        };
      }
      if (route === "notes.prepareGeneratedReview") {
        prepared = true;
        return {
          note_id: "note_generated",
          status: "prepared",
          created_review_items: 2,
          quarantined_items: 0,
          job_id: "job_claim_review",
          note: generatedNote()
        };
      }
      if (route === "notes.promoteGenerated") {
        approved = true;
        return generatedNote();
      }
      if (route === "ai.runs" || route === "events.list" || route === "stats.get") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "notes", selectedNoteId: "note_original" });
    renderApp();
    await openNoteTools();
    fireEvent.click(await screen.findByRole("button", { name: /draft memo/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "notes.generate",
        expect.objectContaining({
          source_ids: ["src_original"]
        })
      )
    );
    expect(await screen.findByDisplayValue("Original memo")).toBeTruthy();
    expect(await screen.findByText("Review generated draft")).toBeTruthy();
    expect(screen.queryByText("Prepare claim review items before promotion; any edited draft needs a fresh pass.")).toBeNull();
    const draftedResult = (await screen.findByText("Drafted")).closest(".workflow-result");
    expect(draftedResult).toBeTruthy();
    expect(within(draftedResult as HTMLElement).getByText("Drafted locally")).toBeTruthy();
    expect(within(draftedResult as HTMLElement).getByText("Run recorded")).toBeTruthy();
    expect(within(draftedResult as HTMLElement).queryByText("mock-local-llm")).toBeNull();
    expect(within(draftedResult as HTMLElement).queryByText("run_generated")).toBeNull();
    expect(await screen.findByTitle(longGeneratedCitationTitle)).toBeTruthy();
    expect(await screen.findByRole("button", { name: /approve as note/i })).toHaveProperty("disabled", true);
    fireEvent.click(await screen.findByRole("button", { name: /check claims/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("notes.prepareGeneratedReview", {
        noteId: "note_generated",
        data: { force: false, extract: ["claims"] }
      })
    );
    expect(await screen.findByText(/2 claim reviews prepared/i)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /approve as note/i }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("notes.promoteGenerated", { noteId: "note_generated" }));
    expect(await screen.findByText("approved")).toBeTruthy();
  });

  it("shows grounded assistant evidence quality, citations, and review follow-up", async () => {
    const longCitationTitle = "Typed Claim Source With A Long Archive Title And Nested Collection Label";
    const longCitationQuote =
      "Typed claims keep exact evidence, and this deliberately long citation quote should remain available without turning the Assistant citation list into a dense wall of source text.";
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 1,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 1,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "jobs.list") return [];
      if (route === "events.list") return [];
      if (route === "sources.list") {
        return [
          {
            id: "src_unrelated",
            type: "text",
            title: "Unrelated Source",
            created_at: "2026-06-04T00:00:00Z",
            updated_at: "2026-06-04T00:00:00Z"
          },
          {
            id: "src_alpha",
            type: "text",
            title: "Typed Claim Source",
            created_at: "2026-06-04T00:00:00Z",
            updated_at: "2026-06-04T00:00:00Z"
          }
        ];
      }
      if (route === "sources.blocks") {
        expect(payload).toEqual({ sourceId: "src_alpha" });
        return [
          {
            id: "blk_alpha",
            source_id: "src_alpha",
            block_index: 0,
            locator: "block 1",
            text: "Typed claims keep exact evidence. Source block detail."
          }
        ];
      }
      if (route === "review.list") {
        return [
          {
            id: "rev_first",
            item_type: "new_claim",
            title: "First unrelated review",
            summary: "First item should not be selected.",
            payload: { reason: "first_unrelated_marker" },
            status: "pending",
            created_at: "2026-06-04T00:00:00Z"
          },
          {
            id: "rev_missing",
            item_type: "assistant_missing_evidence",
            title: "Assistant answer needs approved claim evidence",
            summary: "The scoped assistant could not fully ground this answer in approved evidence.",
            payload: { reason: "no_approved_claim_evidence" },
            status: "pending",
            created_at: "2026-06-04T00:00:00Z"
          }
        ];
      }
      if (route === "assistant.ask") {
        expect(payload.question).toContain("typed claims");
        expect(payload.scope).toEqual(
          expect.objectContaining({
            evidence_mode: "claims_and_storage",
            include_source_blocks: true
          })
        );
        return {
          answer_markdown:
            "### Evidence-grounded answer\n\nFacts found in the current scope:\n- Typed claims keep exact evidence [1]",
          evidence_quality: "source_blocks",
          provider: "mock_llm",
          model_id: "mock-local-llm",
          capability: "grounded_answer",
          sent_off_device: false,
          review_item_id: "rev_missing",
          uncertainties: ["This answer cites source blocks, but no approved claim evidence matched the question."],
          citations: [
            {
              marker: "[1]",
              source_block_id: "blk_alpha",
              source_id: "src_alpha",
              claim_id: null,
              exact_quote: longCitationQuote,
              title: longCitationTitle,
              locator: "block 1",
              evidence_kind: "source_block"
            }
          ]
        };
      }
      if (route === "todos.create") {
        expect(payload.text).toMatch(/^Check \[1\] Typed Claim Source/);
        expect(payload.provenance).toEqual({ created_from: "source_block" });
        expect(payload.context_links).toEqual([
          expect.objectContaining({
            target_type: "source_block",
            target_id: "blk_alpha",
            target_title: longCitationTitle,
            relation: "follow_up_citation",
            exact_quote: longCitationQuote,
            locator: "block 1",
            metadata: expect.objectContaining({
              created_from: "assistant_citation",
              question: "How do typed claims help?",
              marker: "[1]",
              evidence_kind: "source_block",
              source_id: "src_alpha",
              source_block_id: "blk_alpha",
              citation_title: longCitationTitle,
              exact_quote_hash: "a4c47683"
            })
          })
        ]);
        return {
          id: "todo_assistant_citation",
          title: payload.text,
          status: "open",
          priority: 3,
          list_id: "list_inbox",
          labels: [],
          context_links: payload.context_links,
          created_at: "2026-06-21T00:00:00Z",
          updated_at: "2026-06-21T00:00:00Z"
        };
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "assistant" });
    renderApp();
    fireEvent.click(await screen.findByRole("tab", { name: /claims \+ storage/i }));
    fireEvent.change(await screen.findByLabelText("Assistant question"), {
      target: { value: "How do typed claims help?" }
    });
    fireEvent.click(await screen.findByRole("button", { name: /^ask$/i }));
    const grounding = await screen.findByLabelText("Assistant answer grounding");
    const answerContext = await screen.findByLabelText("Answer context");
    expect(await screen.findByText("How do typed claims help?")).toBeTruthy();
    expect((screen.getByLabelText("Assistant question") as HTMLTextAreaElement).value).toBe("");
    expect(within(grounding).getByText("Claims + Storage")).toBeTruthy();
    expect(within(answerContext).getByText("1 citation")).toBeTruthy();
    expect(within(answerContext).getByText("on device")).toBeTruthy();
    expect(within(answerContext).getByText("Vault")).toBeTruthy();
    expect(within(answerContext).queryByText("Local model")).toBeNull();
    expect(within(grounding).queryByText("source evidence")).toBeNull();
    expect(within(grounding).queryByText("Answered with Storage evidence")).toBeNull();
    expect(within(grounding).queryByText(/Answers may cite reviewed claims and raw source blocks/)).toBeNull();
    expect(within(answerContext).queryByText("mock-local-llm")).toBeNull();
    const citationsList = await screen.findByLabelText("Assistant citations");
    expect(within(citationsList).getByText(/source block/)).toBeTruthy();
    expect(await screen.findByTitle(longCitationTitle)).toBeTruthy();
    expect(await screen.findByTitle(longCitationQuote)).toBeTruthy();
    expect(await screen.findByText(longCitationQuote)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /create task from citation \[1\]/i }));
    const taskDialog = await screen.findByRole("dialog", { name: /new task/i });
    fireEvent.click(within(taskDialog).getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "todos.create",
        expect.objectContaining({
          context_links: [expect.objectContaining({ relation: "follow_up_citation", target_id: "blk_alpha" })]
        })
      )
    );
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /new task/i })).toBeNull());
    expect(await screen.findByText(/no approved claim evidence matched/i)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /review follow-up/i }));
    expect((await screen.findAllByText("Assistant answer needs approved claim evidence")).length).toBeGreaterThan(0);
    expect(await screen.findByText(/no approved claim evidence/i)).toBeTruthy();
    expect(screen.queryByText(/first_unrelated_marker/i)).toBeNull();
  });

  it("asks the assistant in approved-claims mode without raw Storage fallback", async () => {
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 1,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "jobs.list" || route === "events.list") return [];
      if (route === "assistant.ask") {
        expect(payload.scope).toEqual(
          expect.objectContaining({
            claim_statuses: ["supported", "user_confirmed", "verified"],
            evidence_mode: "approved_claims",
            include_source_blocks: false
          })
        );
        return {
          answer_markdown: "I do not have enough approved source evidence to answer that as fact.",
          evidence_quality: "missing",
          review_item_id: "rev_missing",
          uncertainties: ["No matching source block or approved claim evidence was found."],
          citations: []
        };
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "assistant" });
    renderApp();
    fireEvent.change(await screen.findByLabelText("Assistant question"), {
      target: { value: "What evidence supports typed claims?" }
    });
    fireEvent.click(await screen.findByRole("button", { name: /^ask$/i }));

    expect((await screen.findAllByText("Approved claims")).length).toBeGreaterThan(0);
    expect(await screen.findByText("I do not have enough approved source evidence to answer that as fact.")).toBeTruthy();
    const answerContext = await screen.findByLabelText("Answer context");
    expect(within(answerContext).getByText("none")).toBeTruthy();
    expect(screen.queryByText("missing evidence")).toBeNull();
    expect(await screen.findByText("No matching source block or approved claim evidence was found.")).toBeTruthy();
  });

  it("asks the assistant inside the selected capsule context", async () => {
    const capsule = {
      id: "cap_resonance",
      name: "Resonance Capsule",
      slug: "resonance-capsule",
      description: null,
      purpose: "Keep resonance evidence scoped.",
      capsule_type: "domain",
      status: "draft",
      version: "0.1.0",
      language: "en",
      domains: ["physics"],
      tags: ["resonance"],
      epistemic_strictness: "balanced",
      default_source_policy: "reference_only",
      updated_at: "2026-06-15T12:00:00Z",
      counts: { sources: 1, notes: 0, claims: 1, concepts: 0, tools: 0 },
      health: { score: 0.8, status: "healthy", warnings: [] }
    };
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 1,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "jobs.list" || route === "events.list") return [];
      if (route === "capsules.list") return { items: [capsule], total: 1 };
      if (route === "assistant.ask") {
        expect(payload.scope).toEqual(
          expect.objectContaining({
            capsule_id: "cap_resonance",
            evidence_mode: "approved_claims",
            include_source_blocks: false
          })
        );
        return {
          answer_markdown: "The capsule keeps resonance evidence constrained to its approved claims [1].",
          evidence_quality: "approved_claims",
          provider: "mock_llm",
          model_id: "mock-local-llm",
          capability: "grounded_answer",
          sent_off_device: false,
          scope_context: "capsule",
          capsule: { id: "cap_resonance", name: "Resonance Capsule", slug: "resonance-capsule", item_count: 2 },
          citations: [
            {
              marker: "[1]",
              source_block_id: "blk_resonance",
              source_id: "src_resonance",
              claim_id: "clm_resonance",
              exact_quote: "Resonance evidence stays inside the capsule.",
              title: "Capsule Resonance Source",
              evidence_kind: "approved_claim_evidence"
            }
          ]
        };
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "assistant", selectedCapsuleId: "cap_resonance" });
    renderApp();
    expect(await screen.findByLabelText("Assistant context")).toBeTruthy();
    expect((await screen.findAllByText("Resonance Capsule")).length).toBeGreaterThan(0);
    fireEvent.change(await screen.findByLabelText("Assistant question"), {
      target: { value: "What is in this capsule?" }
    });
    fireEvent.click(await screen.findByRole("button", { name: /^ask$/i }));

    const answerContext = await screen.findByLabelText("Answer context");
    expect(within(answerContext).getByText("Resonance Capsule")).toBeTruthy();
    expect(await screen.findByText("The capsule keeps resonance evidence constrained to its approved claims [1].")).toBeTruthy();
    const citationsList = await screen.findByLabelText("Assistant citations");
    expect(within(citationsList).getByText("approved claim · clm_resonance")).toBeTruthy();
    expect(within(citationsList).queryByText(/claim clm_resonance/)).toBeNull();
  });

  it("runs an Assistant starter with the matching evidence policy", async () => {
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 2,
          source_blocks: 8,
          notes: 1,
          claims: 1,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "jobs.list" || route === "events.list") return [];
      if (route === "assistant.ask") {
        expect(payload.question).toBe("What patterns or contradictions should I review in raw Storage, with exact source block citations?");
        expect(payload.scope).toEqual(
          expect.objectContaining({
            evidence_mode: "claims_and_storage",
            include_source_blocks: true
          })
        );
        return {
          answer_markdown: "Storage shows two themes worth reviewing [1].",
          evidence_quality: "source_blocks",
          provider: "mock_llm",
          model_id: "mock-local-llm",
          capability: "grounded_answer",
          sent_off_device: false,
          citations: [
            {
              marker: "[1]",
              source_block_id: "blk_storage_theme",
              source_id: "src_storage_theme",
              exact_quote: "Theme evidence.",
              title: "Storage theme source",
              evidence_kind: "source_block"
            }
          ]
        };
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "assistant" });
    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /Storage themes/i }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "assistant.ask",
        expect.objectContaining({
          question: "What patterns or contradictions should I review in raw Storage, with exact source block citations?",
          require_citations: true
        })
      )
    );
    expect(await screen.findByText("What patterns or contradictions should I review in raw Storage, with exact source block citations?")).toBeTruthy();
    expect((screen.getByLabelText("Assistant question") as HTMLTextAreaElement).value).toBe("");
    expect((await screen.findAllByText("Claims + Storage")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Storage shows two themes worth reviewing [1].")).toBeTruthy();
  });

  it("saves a grounded Assistant answer as a reviewable note draft", async () => {
    let savedNote: any | undefined;
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: savedNote ? 1 : 0,
          claims: 1,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: savedNote ? 1 : 0,
          generated_notes_pending_review: savedNote ? 1 : 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "jobs.list" || route === "events.list") return [];
      if (route === "ai.capabilities" || route === "ai.providers") return [];
      if (route === "notes.list") return savedNote ? [savedNote] : [];
      if (route === "assistant.ask") {
        return {
          answer_markdown: "Typed claims stay grounded in exact evidence [1].",
          evidence_quality: "source_blocks",
          provider: "mock_llm",
          model_id: "mock-local-llm",
          capability: "grounded_answer",
          ai_run_id: "run_assistant_save",
          sent_off_device: false,
          citation_validation: { status: "valid" },
          citations: [
            {
              marker: "[1]",
              source_block_id: "blk_alpha",
              source_id: "src_alpha",
              claim_id: "clm_alpha",
              exact_quote: "Typed claims keep exact evidence.",
              title: "Typed Claim Source",
              locator: "block 1",
              evidence_kind: "approved_claim_evidence"
            }
          ]
        };
      }
      if (route === "notes.create") {
        expect(payload).toEqual(
          expect.objectContaining({
            title: "Assistant answer: How do typed claims help?",
            origin: "ai_generated",
            content_markdown: expect.stringContaining("Typed claims stay grounded in exact evidence")
          })
        );
        expect(payload.content_json).toEqual(
          expect.objectContaining({
            capture_mode: "assistant_answer",
            evidence_mode: "claims_and_storage",
            evidence_quality: "source_blocks",
            requires_review: true,
            editor_engine: "tiptap",
            source_ids: ["src_alpha"],
            claim_ids: ["clm_alpha"],
            model_id: "mock-local-llm",
            sent_off_device: false
          })
        );
        return {
          id: "note_assistant_save",
          title: payload.title,
          content: payload.content_json,
          content_markdown: payload.content_markdown,
          origin: payload.origin,
          status: "active",
          version: 1,
          source_id: "src_note_assistant",
          updated_at: "2026-06-05T00:00:00Z"
        };
      }
      if (route === "notes.update") {
        expect(payload).toEqual(
          expect.objectContaining({
            noteId: "note_assistant_save",
            data: expect.objectContaining({
              status: "generated_pending_review",
              content_json: expect.objectContaining({ generation_status: "draft" })
            })
          })
        );
        savedNote = {
          id: "note_assistant_save",
          title: payload.data.title,
          content: payload.data.content_json,
          content_markdown: payload.data.content_markdown,
          origin: "ai_generated",
          status: payload.data.status,
          version: 2,
          source_id: "src_note_assistant",
          updated_at: "2026-06-05T00:00:01Z"
        };
        return savedNote;
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "assistant" });
    renderApp();
    fireEvent.click(await screen.findByRole("tab", { name: /claims \+ storage/i }));
    fireEvent.change(await screen.findByLabelText("Assistant question"), {
      target: { value: "How do typed claims help?" }
    });
    fireEvent.click(await screen.findByRole("button", { name: /^ask$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /save as note/i }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "notes.update",
        expect.objectContaining({
          noteId: "note_assistant_save",
          data: expect.objectContaining({ status: "generated_pending_review" })
        })
      )
    );
    expect(await screen.findByDisplayValue("Assistant answer: How do typed claims help?")).toBeTruthy();
    expect(await screen.findByText("Review generated draft")).toBeTruthy();
    expect(screen.queryByText("Drafted locally")).toBeNull();
    expect(screen.queryByText("Run recorded")).toBeNull();
    expect(screen.queryByText("mock-local-llm")).toBeNull();
  });

  it("opens cited assistant source blocks from citation records", async () => {
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 2,
          source_blocks: 2,
          notes: 0,
          claims: 1,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "jobs.list") return [];
      if (route === "events.list") return [];
      if (route === "sources.list") {
        return [
          {
            id: "src_unrelated",
            type: "text",
            title: "Unrelated Source",
            created_at: "2026-06-04T00:00:00Z",
            updated_at: "2026-06-04T00:00:00Z"
          },
          {
            id: "src_alpha",
            type: "text",
            title: "Typed Claim Source",
            created_at: "2026-06-04T00:00:00Z",
            updated_at: "2026-06-04T00:00:00Z"
          }
        ];
      }
      if (route === "sources.blocks") {
        expect(payload).toEqual({ sourceId: "src_alpha" });
        return [
          {
            id: "blk_alpha",
            source_id: "src_alpha",
            block_index: 0,
            locator: "block 1",
            text: "Typed claims keep exact evidence. Source block detail."
          }
        ];
      }
      if (route === "assistant.ask") {
        return {
          answer_markdown: "Typed claims keep exact evidence [1]",
          evidence_quality: "source_blocks",
          provider: "mock_llm",
          model_id: "mock-local-llm",
          capability: "grounded_answer",
          sent_off_device: false,
          citations: [
            {
              marker: "[1]",
              source_block_id: "blk_alpha",
              source_id: "src_alpha",
              claim_id: null,
              exact_quote: "Typed claims keep exact evidence.",
              title: "Typed Claim Source",
              locator: "block 1",
              evidence_kind: "source_block"
            }
          ]
        };
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "assistant" });
    renderApp();
    fireEvent.change(await screen.findByLabelText("Assistant question"), {
      target: { value: "How do typed claims help?" }
    });
    fireEvent.click(await screen.findByRole("button", { name: /^ask$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /open source/i }));

    expect(await screen.findByRole("heading", { name: "Typed Claim Source" })).toBeTruthy();
    const selectedBlock = await screen.findByRole("button", { name: /Typed claims keep exact evidence\. Source block detail\./i });
    expect(selectedBlock.className).toContain("active");
  });

  it("opens approved assistant citation claims in the Graph", async () => {
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 1,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "jobs.list" || route === "events.list") return [];
      if (route === "assistant.ask") {
        return {
          answer_markdown: "Typed claims are supported by exact source quotes [1].",
          evidence_quality: "approved_claims",
          provider: "mock_llm",
          model_id: "mock-local-llm",
          capability: "grounded_answer",
          sent_off_device: false,
          citation_validation: { status: "valid" },
          citations: [
            {
              marker: "[1]",
              source_block_id: "blk_alpha",
              source_id: "src_alpha",
              claim_id: "clm_alpha",
              exact_quote: "Typed claims keep exact evidence.",
              title: "Typed Claim Source",
              locator: "block 1",
              evidence_kind: "approved_claim_evidence"
            }
          ]
        };
      }
      if (route === "claims.list") {
        return [
          {
            id: "clm_alpha",
            node_id: "node_alpha",
            title: "Typed claims preserve source quotes",
            normalized_text: "Typed claims keep exact evidence.",
            status: "supported",
            confidence: 0.88,
            evidence_strength: 0.92
          }
        ];
      }
      if (route === "claims.evidence") {
        expect(payload).toEqual({ claimId: "clm_alpha" });
        return [
          {
            id: "evi_alpha",
            claim_id: "clm_alpha",
            source_id: "src_alpha",
            source_block_id: "blk_alpha",
            support_type: "supports",
            exact_quote: "Typed claims keep exact evidence.",
            strength: 0.92,
            source_title: "Typed Claim Source",
            locator: "block 1"
          }
        ];
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "assistant" });
    renderApp();
    fireEvent.change(await screen.findByLabelText("Assistant question"), {
      target: { value: "What evidence supports typed claims?" }
    });
    fireEvent.click(await screen.findByRole("button", { name: /^ask$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /open claim/i }));

    expect(await screen.findByRole("heading", { name: "Typed claims preserve source quotes" })).toBeTruthy();
    expect((await screen.findAllByText("Typed claims keep exact evidence.")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("92% evidence")).length).toBeGreaterThan(0);
  });

  it("records a local voice question and asks the grounded assistant with the transcript", async () => {
    const stopTrack = vi.fn();
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] }));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia }
    });
    class FakeMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
      state = "inactive";
      mimeType: string;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(_stream: unknown, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? "audio/webm";
      }

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["assistant question bytes"], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);

    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 1,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "jobs.list" || route === "events.list") return [];
      if (route === "ai.capabilities") {
        return [{ capability: "transcribe_audio", provider_id: "mock_stt", model_id: "mock-local-stt", local_only: true, settings: {} }];
      }
      if (route === "ai.providers") {
        return [
          {
            id: "mock_stt",
            display_name: "Mock Local STT",
            kind: "stt",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          }
        ];
      }
      if (route === "voice.transcribe") {
        return {
          run_id: "run_voice_question",
          provider: "mock_stt",
          model_id: "mock-local-stt",
          text: "What evidence supports typed claims?",
          sent_off_device: false,
          segments: [{ start_ms: 0, end_ms: 900, text: "What evidence supports typed claims?" }]
        };
      }
      if (route === "assistant.ask") {
        expect(payload.question).toBe("What evidence supports typed claims?");
        return {
          answer_markdown: "Typed claims are supported by exact source quotes [1].",
          evidence_quality: "approved_claims",
          provider: "mock_llm",
          model_id: "mock-local-llm",
          capability: "grounded_answer",
          sent_off_device: false,
          citations: [
            {
              marker: "[1]",
              source_block_id: "blk_alpha",
              source_id: "src_alpha",
              claim_id: "claim_alpha",
              exact_quote: "Typed claims keep exact evidence.",
              title: "Typed Claim Source",
              locator: "block 1",
              evidence_kind: "approved_claim_evidence"
            }
          ]
        };
      }
      return [];
    });
    const saveAudioRecording = vi.fn(async () => ({
      filePath: "/tmp/vault-assistant-question.webm",
      mimeType: "audio/webm",
      sizeBytes: 24
    }));
    window.vault = { request, selectFiles: vi.fn(async () => []), saveAudioRecording };

    useUIStore.setState({ surface: "assistant" });
    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /^voice question$/i }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ audio: true }));
    fireEvent.click(await screen.findByRole("button", { name: /^stop question$/i }));

    await waitFor(() => expect(saveAudioRecording).toHaveBeenCalledWith(expect.objectContaining({ mimeType: "audio/webm;codecs=opus" })));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("voice.transcribe", {
        audio_path: "/tmp/vault-assistant-question.webm",
        title: "Assistant voice question",
        create_source: false,
        local_only: true,
        metadata: {
          import_mode: "assistant_question_microphone",
          mime_type: "audio/webm",
          size_bytes: 24
        }
      })
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "assistant.ask",
        expect.objectContaining({
          question: "What evidence supports typed claims?",
          require_citations: true
        })
      )
    );
    expect((await screen.findAllByText("What evidence supports typed claims?")).length).toBeGreaterThan(0);
    expect((screen.getByLabelText("Assistant question") as HTMLTextAreaElement).value).toBe("");
    expect(await screen.findByRole("button", { name: /^voice question$/i })).toBeTruthy();
    const voiceQuestionResult = (await screen.findAllByText("Voice question"))
      .map((element) => element.closest(".workflow-result"))
      .find(Boolean);
    expect(voiceQuestionResult).toBeTruthy();
    expect(within(voiceQuestionResult as HTMLElement).getByText("On device")).toBeTruthy();
    expect(within(voiceQuestionResult as HTMLElement).queryByText("mock-local-stt")).toBeNull();
    expect(await screen.findByText("Typed claims are supported by exact source quotes [1].")).toBeTruthy();
    expect(stopTrack).toHaveBeenCalled();
  });

  it("rejects generated drafts from the note editor", async () => {
    let rejected = false;
    const generatedNote = () => ({
      id: "note_generated_reject",
      title: "Rejectable memo",
      content: {
        generation_status: rejected ? "rejected" : "draft",
        requires_review: !rejected,
        generated_by: "mock_llm",
        model_id: "mock-local-llm",
        capability: "generate_note",
        ai_run_id: "run_reject",
        source_ids: ["src_reject"],
        citations: [{ title: "Reject Source", locator: "block 2", snippet: "Evidence quote." }],
        sent_off_device: false
      },
      content_markdown: "# Rejectable memo\n\nGenerated synthesis.",
      origin: "ai_generated",
      status: rejected ? "generated_rejected" : "generated_pending_review",
      version: rejected ? 2 : 1,
      source_id: "src_generated_reject",
      updated_at: "2026-06-03T00:00:01Z"
    });
    const request = vi.fn(async (route: string) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "notes.list") return [generatedNote()];
      if (route === "ai.capabilities") {
        return [
          { capability: "extract_claims", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} },
          { capability: "extract_objects", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} },
          { capability: "generate_note", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} }
        ];
      }
      if (route === "ai.providers") {
        return [
          {
            id: "mock_llm",
            display_name: "Mock Local LLM",
            kind: "llm",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          }
        ];
      }
      if (route === "notes.rejectGenerated") {
        rejected = true;
        return generatedNote();
      }
      if (route === "events.list" || route === "stats.get") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "notes", selectedNoteId: "note_generated_reject" });
    renderApp();
    expect(await screen.findByText("Review generated draft")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /^reject$/i }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("notes.rejectGenerated", { noteId: "note_generated_reject" }));
    expect(await screen.findByText("rejected")).toBeTruthy();
  });

  it("synthesizes the active note into a cached local speech asset", async () => {
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 1,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "notes.list") {
        return [
          {
            id: "note_speech",
            title: "Speech Draft",
            content: {},
            content_markdown: "Read this note aloud.",
            origin: "user_written",
            status: "active",
            version: 1,
            source_id: "src_note",
            updated_at: "2026-06-03T00:00:00Z"
          }
        ];
      }
      if (route === "ai.capabilities") {
        return [
          { capability: "extract_claims", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} },
          { capability: "extract_objects", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} },
          { capability: "generate_note", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} }
        ];
      }
      if (route === "ai.providers") {
        return [
          {
            id: "mock_llm",
            display_name: "Mock Local LLM",
            kind: "llm",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          }
        ];
      }
      if (route === "voice.synthesize") {
        return {
          run_id: "run_speech",
          provider: "mock_tts",
          model_id: "mock-local-tts",
          audio_path: "/vault/blobs/speech/note.wav",
          speech_asset_id: "spch_note",
          cached: false,
          sent_off_device: false,
          voice_id: "mock-local-voice"
        };
      }
      if (route === "voice.speechAssetAudio") {
        return {
          speech_asset_id: payload.speechAssetId,
          mime_type: "audio/wav",
          data_url: "data:audio/wav;base64,UklGRg==",
          size_bytes: 4
        };
      }
      if (route === "ai.runs" || route === "events.list") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "notes" });
    renderApp();
    await openNoteTools();
    fireEvent.click(await screen.findByRole("button", { name: /read aloud/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("voice.synthesize", {
        text: "Read this note aloud.",
        voice_id: "mock-local-voice",
        format: "wav",
        local_only: true,
        cache: true
      })
    );
    expect(await screen.findByText("Audio saved")).toBeTruthy();
    expect(await screen.findByText("On device")).toBeTruthy();
    expect(await screen.findByText("Ready to play")).toBeTruthy();
    expect(screen.queryByText("mock-local-tts")).toBeNull();
    expect(screen.queryByText("spch_note")).toBeNull();
    await waitFor(() => expect(request).toHaveBeenCalledWith("voice.speechAssetAudio", { speechAssetId: "spch_note" }));
  });

  it("records microphone audio and inserts the local transcript into the active note", async () => {
    const stopTrack = vi.fn();
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] }));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia }
    });
    class FakeMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
      state = "inactive";
      mimeType: string;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(_stream: unknown, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? "audio/webm";
      }

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["recorded voice bytes"], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);

    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 1,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "notes.list") {
        return [
          {
            id: "note_record",
            title: "Recorded Draft",
            content: {},
            content_markdown: "Before recording.",
            origin: "user_written",
            status: "active",
            version: 1,
            source_id: "src_note",
            updated_at: "2026-06-03T00:00:00Z"
          }
        ];
      }
      if (route === "ai.capabilities") {
        return [
          { capability: "extract_claims", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} },
          { capability: "extract_objects", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} },
          { capability: "generate_note", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} }
        ];
      }
      if (route === "ai.providers") {
        return [
          {
            id: "mock_llm",
            display_name: "Mock Local LLM",
            kind: "llm",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          }
        ];
      }
      if (route === "voice.transcribe") {
        return {
          run_id: "run_record",
          provider: "mock_stt",
          model_id: "mock-local-stt",
          text: "Recorded transcript inserted into the note.",
          source_id: "src_recording",
          source_title: "Recorded dictation",
          audio_asset_id: "aud_recording",
          sent_off_device: false,
          segments: [{ start_ms: 0, end_ms: 1200, text: "Recorded transcript inserted into the note." }]
        };
      }
      if (route === "notes.update") {
        return {
          id: payload.noteId,
          title: payload.data.title,
          content: payload.data.content_json,
          content_markdown: payload.data.content_markdown,
          origin: "user_written",
          status: "active",
          version: 2,
          source_id: "src_note",
          updated_at: "2026-06-03T00:00:01Z"
        };
      }
      return [];
    });
    const saveAudioRecording = vi.fn(async () => ({
      filePath: "/tmp/vault-recording.webm",
      mimeType: "audio/webm",
      sizeBytes: 20
    }));
    window.vault = { request, selectFiles: vi.fn(async () => []), saveAudioRecording };

    useUIStore.setState({ surface: "notes", selectedNoteId: "note_record" });
    renderApp();
    expect(await screen.findByDisplayValue("Recorded Draft")).toBeTruthy();
    await openNoteTools();
    fireEvent.click(await screen.findByRole("button", { name: /^record$/i }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ audio: true }));
    fireEvent.click(await screen.findByRole("button", { name: /^stop$/i }));
    await waitFor(() => expect(saveAudioRecording).toHaveBeenCalledWith(expect.objectContaining({ mimeType: "audio/webm;codecs=opus" })));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("voice.transcribe", {
        audio_path: "/tmp/vault-recording.webm",
        title: "Recorded dictation",
        create_source: true,
        local_only: true,
        metadata: {
          import_mode: "note_editor_microphone",
          note_id: "note_record",
          mime_type: "audio/webm",
          size_bytes: 20
        }
      })
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "notes.update",
        expect.objectContaining({
          noteId: "note_record",
          data: expect.objectContaining({
            content_markdown: expect.stringContaining("Recorded transcript inserted into the note.")
          })
        })
      )
    );
    expect(stopTrack).toHaveBeenCalled();
    const dictatedResult = screen.getByText("Dictated").closest(".workflow-result");
    expect(dictatedResult).toBeTruthy();
    expect(within(dictatedResult as HTMLElement).getByText("On device")).toBeTruthy();
    expect(within(dictatedResult as HTMLElement).getByText("Linked to Storage")).toBeTruthy();
    expect(within(dictatedResult as HTMLElement).queryByText("mock-local-stt")).toBeNull();
    expect(within(dictatedResult as HTMLElement).queryByText("src_recording")).toBeNull();
  });

  it("supports hold-to-talk keyboard dictation into the active note", async () => {
    const stopTrack = vi.fn();
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] }));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia }
    });
    class FakeMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
      state = "inactive";
      mimeType: string;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(_stream: unknown, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? "audio/webm";
      }

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["push to talk bytes"], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);

    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "jobs.list" || route === "events.list") return [];
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 1,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "notes.list") {
        return [
          {
            id: "note_push",
            title: "Push Draft",
            content: {},
            content_markdown: "Before shortcut.",
            origin: "user_written",
            status: "active",
            version: 1,
            source_id: "src_note",
            updated_at: "2026-06-03T00:00:00Z"
          }
        ];
      }
      if (route === "ai.capabilities") {
        return [
          { capability: "extract_claims", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} },
          { capability: "extract_objects", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} },
          { capability: "generate_note", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} }
        ];
      }
      if (route === "ai.providers") {
        return [
          {
            id: "mock_llm",
            display_name: "Mock Local LLM",
            kind: "llm",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          }
        ];
      }
      if (route === "voice.transcribe") {
        return {
          run_id: "run_push",
          provider: "mock_stt",
          model_id: "mock-local-stt",
          text: "Push to talk inserted this transcript.",
          source_id: "src_push_recording",
          source_title: "Recorded dictation",
          audio_asset_id: "aud_push_recording",
          sent_off_device: false,
          segments: [{ start_ms: 0, end_ms: 1200, text: "Push to talk inserted this transcript." }]
        };
      }
      if (route === "notes.update") {
        return {
          id: payload.noteId,
          title: payload.data.title,
          content: payload.data.content_json,
          content_markdown: payload.data.content_markdown,
          origin: "user_written",
          status: "active",
          version: 2,
          source_id: "src_note",
          updated_at: "2026-06-03T00:00:01Z"
        };
      }
      return [];
    });
    const saveAudioRecording = vi.fn(async () => ({
      filePath: "/tmp/vault-push-to-talk.webm",
      mimeType: "audio/webm",
      sizeBytes: 18
    }));
    window.vault = { request, selectFiles: vi.fn(async () => []), saveAudioRecording };

    useUIStore.setState({ surface: "notes", selectedNoteId: "note_push" });
    renderApp();
    await openNoteTools();
    const recordButton = await screen.findByRole("button", { name: /^record$/i });
    expect(recordButton.getAttribute("aria-keyshortcuts")).toBe("Alt+Space");
    fireEvent.keyDown(document, { key: " ", code: "Space", altKey: true });
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ audio: true }));
    expect(await screen.findByRole("button", { name: /^stop$/i })).toBeTruthy();
    fireEvent.keyUp(document, { key: " ", code: "Space", altKey: true });
    await waitFor(() => expect(saveAudioRecording).toHaveBeenCalledWith(expect.objectContaining({ mimeType: "audio/webm;codecs=opus" })));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("voice.transcribe", {
        audio_path: "/tmp/vault-push-to-talk.webm",
        title: "Recorded dictation",
        create_source: true,
        local_only: true,
        metadata: {
          import_mode: "note_editor_microphone",
          note_id: "note_push",
          mime_type: "audio/webm",
          size_bytes: 18
        }
      })
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "notes.update",
        expect.objectContaining({
          noteId: "note_push",
          data: expect.objectContaining({
            content_markdown: expect.stringContaining("Push to talk inserted this transcript.")
          })
        })
      )
    );
    expect(stopTrack).toHaveBeenCalled();
    const dictatedResult = screen.getByText("Dictated").closest(".workflow-result");
    expect(dictatedResult).toBeTruthy();
    expect(within(dictatedResult as HTMLElement).getByText("On device")).toBeTruthy();
    expect(within(dictatedResult as HTMLElement).getByText("Linked to Storage")).toBeTruthy();
    expect(within(dictatedResult as HTMLElement).queryByText("mock-local-stt")).toBeNull();
    expect(within(dictatedResult as HTMLElement).queryByText("src_push_recording")).toBeNull();
  });

  it("shows embedding reindex progress and can cancel the job", async () => {
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "settings.get") return {};
      if (route === "ai-providers" || route === "ai.providers") {
        return [
          {
            id: "mock_embedding",
            display_name: "Mock Local Embeddings",
            kind: "embedding",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          }
        ];
      }
      if (route === "ai.capabilities") {
        return [
          {
            capability: "embed_text",
            provider_id: "mock_embedding",
            model_id: "mock-local-embedding",
            local_only: true,
            settings: { dimensions: 32 }
          }
        ];
      }
      if (route === "ai.hardware") {
        return {
          os: "macos",
          arch: "arm64",
          physical_ram_gb: 16,
          apple_silicon: true,
          metal_available: true,
          cuda_available: false,
          rocm_available: false,
          vulkan_available: false,
          recommended_profile: "standard",
          warnings: []
        };
      }
      if (route === "ai.models.registry") return { models: [] };
      if (route === "ai.models.downloads") return [];
      if (route === "ai.runtime.health") {
        return {
          llama_cpp: {
            runtime: "llama_cpp",
            state: "not_configured",
            runtime_dir: "/tmp/runtime",
            cli: { configured: false, source: "missing" },
            server: { configured: false, source: "missing" },
            installed_models: [],
            warnings: [],
            next_actions: []
          },
          voice: {}
        };
      }
      if (route === "ai.runs") return [];
      if (route === "voice.voices") return [];
      if (route === "jobs.list") {
        return [
          {
            id: "job_embed",
            job_type: "embedding_reindex",
            status: "running",
            input: {},
            output: {
              phase: "running",
              sources_done: 1,
              sources_total: 3,
              blocks_indexed: 4,
              blocks_total: 12,
              percent: 33,
              embedding_space: { space_id: "mock_embedding:mock-local-embedding:32" }
            },
            created_at: "2026-06-03T00:00:00Z"
          }
        ];
      }
      if (route === "jobs.cancel") return { id: payload.jobId, job_type: "embedding_reindex", status: "cancelled", output: {}, created_at: "now" };
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "settings" });
    const { container } = renderApp();
    fireEvent.click(await screen.findByRole("tab", { name: /search/i }));
    expect(await screen.findByRole("heading", { name: "Search index" })).toBeTruthy();
    expect(await screen.findByText("Model task routing")).toBeTruthy();
    expect(screen.queryByText("Choose which local provider handles each model-backed task.")).toBeNull();
    expect(screen.queryByText("No provider selected")).toBeNull();
    expect(screen.queryByText("No saved embedding model")).toBeNull();
    expect(screen.queryByText("No saved reranker model")).toBeNull();
    expect(screen.queryByText(/^setup$/i)).toBeNull();
    expect((await screen.findAllByText("Search index")).length).toBeGreaterThan(1);
    expect(await screen.findByLabelText("Provider for Search index")).toBeTruthy();
    expect(await screen.findByText("Embedding reindex")).toBeTruthy();
    expect(await screen.findByText("4/12 blocks")).toBeTruthy();
    const progressCard = container.querySelector(".job-progress") as HTMLElement;
    expect(progressCard).toBeTruthy();
    expect(within(progressCard).getByText("Running")).toBeTruthy();
    expect(within(progressCard).getByText("Search index selected")).toBeTruthy();
    expect(progressCard.textContent).not.toContain("mock_embedding:mock-local-embedding:32");
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("jobs.cancel", { jobId: "job_embed" }));
  });

  it("configures and tests a loopback local embedding route", async () => {
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "settings.get") return {};
      if (route === "ai.providers") {
        return [
          {
            id: "mock_embedding",
            display_name: "Mock Local Embeddings",
            kind: "embedding",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          },
          {
            id: "local_embedding_http",
            display_name: "Local HTTP Embeddings",
            kind: "embedding",
            locality: "external_local",
            enabled: false,
            configured: false,
            privacy_label: "External local process"
          }
        ];
      }
      if (route === "ai.capabilities") {
        return [
          {
            capability: "embed_text",
            provider_id: "mock_embedding",
            model_id: "mock-local-embedding",
            local_only: true,
            settings: { dimensions: 32 }
          }
        ];
      }
      if (route === "ai.hardware") {
        return {
          os: "macos",
          arch: "arm64",
          physical_ram_gb: 16,
          apple_silicon: true,
          metal_available: true,
          cuda_available: false,
          rocm_available: false,
          vulkan_available: false,
          recommended_profile: "standard",
          warnings: []
        };
      }
      if (route === "ai.models.registry") return { models: [] };
      if (route === "ai.models.downloads") return [];
      if (route === "ai.runtime.health") {
        return {
          llama_cpp: {
            runtime: "llama_cpp",
            state: "not_configured",
            runtime_dir: "/tmp/runtime",
            cli: { configured: false, source: "missing" },
            server: { configured: false, source: "missing" },
            installed_models: [],
            warnings: [],
            next_actions: []
          },
          voice: {}
        };
      }
      if (route === "ai.runs") return [];
      if (route === "voice.voices") return [];
      if (route === "jobs.list") return [];
      if (route === "ai.capability.update") return { capability: payload.capability, ...payload.data };
      if (route === "ai.embed") {
        return {
          provider: "local_embedding_http",
          model_id: "nomic-loopback",
          dimensions: 4,
          vectors: [[1, 0, 0, 0]],
          sent_off_device: false
        };
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "settings" });
    renderApp();
    fireEvent.click(await screen.findByRole("tab", { name: /search/i }));
    fireEvent.click(((await screen.findAllByText("Search index")).find((element) => element.closest("summary")) as HTMLElement).closest("summary") as HTMLElement);
    fireEvent.change(await screen.findByLabelText("Embedding provider"), { target: { value: "local_embedding_http" } });
    fireEvent.change(await screen.findByLabelText("Embedding model ID"), { target: { value: "nomic-loopback" } });
    fireEvent.change(await screen.findByLabelText("Embedding dimensions"), { target: { value: "4" } });
    fireEvent.change(await screen.findByLabelText("Embedding timeout seconds"), { target: { value: "2" } });
    fireEvent.change(await screen.findByLabelText("Local embedding endpoint URL"), {
      target: { value: "http://127.0.0.1:8080/v1/embeddings" }
    });
    fireEvent.click(screen.getByRole("button", { name: /save search index/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("ai.capability.update", {
        capability: "embed_text",
        data: {
          provider_id: "local_embedding_http",
          model_id: "nomic-loopback",
          local_only: true,
          settings: {
            endpoint_url: "http://127.0.0.1:8080/v1/embeddings",
            dimensions: 4,
            timeout_seconds: 2
          }
        }
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /test search index/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("ai.embed", {
        texts: ["Local embedding route smoke vector."],
        local_only: true
      })
    );
    const routeResult = await screen.findByText(/Search index tested \/ 4 dimensions \/ Stayed on this device/);
    expect(routeResult).toBeTruthy();
    expect(routeResult.textContent).not.toContain("local_embedding_http");
    expect(routeResult.textContent).not.toContain("nomic-loopback");
  });

  it("configures and tests an app-managed local embedding route", async () => {
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "settings.get") return {};
      if (route === "ai.providers") {
        return [
          {
            id: "mock_embedding",
            display_name: "Mock Local Embeddings",
            kind: "embedding",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          },
          {
            id: "local_embedding",
            display_name: "App-Managed Local Embeddings",
            kind: "embedding",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          }
        ];
      }
      if (route === "ai.capabilities") {
        return [
          {
            capability: "embed_text",
            provider_id: "local_embedding",
            model_id: "approved-production-embedding",
            local_only: true,
            settings: { dimensions: 12, model_path: "/tmp/approved-embedding.bin" }
          }
        ];
      }
      if (route === "ai.hardware") {
        return {
          os: "macos",
          arch: "arm64",
          physical_ram_gb: 16,
          apple_silicon: true,
          metal_available: true,
          cuda_available: false,
          rocm_available: false,
          vulkan_available: false,
          recommended_profile: "standard",
          warnings: []
        };
      }
      if (route === "ai.models.registry") return { models: [] };
      if (route === "ai.models.downloads") return [];
      if (route === "ai.runtime.health") {
        return {
          llama_cpp: {
            runtime: "llama_cpp",
            state: "not_configured",
            runtime_dir: "/tmp/runtime",
            cli: { configured: false, source: "missing" },
            server: { configured: false, source: "missing" },
            installed_models: [],
            warnings: [],
            next_actions: []
          },
          voice: {}
        };
      }
      if (route === "ai.runs") return [];
      if (route === "voice.voices") return [];
      if (route === "jobs.list") return [];
      if (route === "ai.capability.update") return { capability: payload.capability, ...payload.data };
      if (route === "ai.embed") {
        return {
          provider: "local_embedding",
          model_id: "approved-production-embedding",
          dimensions: 12,
          vectors: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
          model_fingerprint: "abc123def4567890",
          sent_off_device: false
        };
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "settings" });
    renderApp();
    fireEvent.click(await screen.findByRole("tab", { name: /search/i }));
    fireEvent.click(((await screen.findAllByText("Search index")).find((element) => element.closest("summary")) as HTMLElement).closest("summary") as HTMLElement);
    const modelPathInput = (await screen.findByLabelText("Local embedding model path")) as HTMLInputElement;
    expect(modelPathInput.value).toBe("/tmp/approved-embedding.bin");
    fireEvent.change(screen.getByLabelText("Local embedding model path"), {
      target: { value: "/tmp/approved-embedding-v2.bin" }
    });
    fireEvent.click(screen.getByRole("button", { name: /save search index/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("ai.capability.update", {
        capability: "embed_text",
        data: {
          provider_id: "local_embedding",
          model_id: "approved-production-embedding",
          local_only: true,
          settings: {
            model_path: "/tmp/approved-embedding-v2.bin",
            dimensions: 12
          }
        }
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /test search index/i }));
    const routeResult = await screen.findByText(/Search index tested \/ 12 dimensions \/ Stayed on this device \/ Artifact recorded/);
    expect(routeResult).toBeTruthy();
    expect(routeResult.textContent).not.toContain("abc123def4567890");
    expect(routeResult.textContent).not.toContain("approved-production-embedding");
  });

  it("configures and tests a loopback local reranker route", async () => {
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "settings.get") return {};
      if (route === "ai.providers") {
        return [
          {
            id: "mock_embedding",
            display_name: "Mock Local Embeddings",
            kind: "embedding",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          },
          {
            id: "mock_reranker",
            display_name: "Mock Local Reranker",
            kind: "reranker",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          },
          {
            id: "local_reranker_http",
            display_name: "Local HTTP Reranker",
            kind: "reranker",
            locality: "external_local",
            enabled: false,
            configured: false,
            privacy_label: "External local process"
          }
        ];
      }
      if (route === "ai.capabilities") {
        return [
          {
            capability: "embed_text",
            provider_id: "mock_embedding",
            model_id: "mock-local-embedding",
            local_only: true,
            settings: { dimensions: 32 }
          },
          {
            capability: "rerank_results",
            provider_id: "mock_reranker",
            model_id: "mock-local-reranker",
            local_only: true,
            settings: {}
          }
        ];
      }
      if (route === "ai.hardware") {
        return {
          os: "macos",
          arch: "arm64",
          physical_ram_gb: 16,
          apple_silicon: true,
          metal_available: true,
          cuda_available: false,
          rocm_available: false,
          vulkan_available: false,
          recommended_profile: "standard",
          warnings: []
        };
      }
      if (route === "ai.models.registry") return { models: [] };
      if (route === "ai.models.downloads") return [];
      if (route === "ai.runtime.health") {
        return {
          llama_cpp: {
            runtime: "llama_cpp",
            state: "not_configured",
            runtime_dir: "/tmp/runtime",
            cli: { configured: false, source: "missing" },
            server: { configured: false, source: "missing" },
            installed_models: [],
            warnings: [],
            next_actions: []
          },
          voice: {}
        };
      }
      if (route === "ai.runs") return [];
      if (route === "voice.voices") return [];
      if (route === "jobs.list") return [];
      if (route === "ai.capability.update") return { capability: payload.capability, ...payload.data };
      if (route === "ai.rerank") {
        return {
          provider: "local_reranker_http",
          model_id: "bge-loopback-reranker",
          results: [{ id: "a", score: 0.91 }, { id: "b", score: 0.2 }],
          sent_off_device: false
        };
      }
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "settings" });
    renderApp();
    fireEvent.click(await screen.findByRole("tab", { name: /search/i }));
    fireEvent.click(((await screen.findAllByText("Result ranking")).find((element) => element.closest("summary")) as HTMLElement).closest("summary") as HTMLElement);
    fireEvent.change(await screen.findByLabelText("Reranker provider"), { target: { value: "local_reranker_http" } });
    fireEvent.change(await screen.findByLabelText("Reranker model ID"), { target: { value: "bge-loopback-reranker" } });
    fireEvent.change(await screen.findByLabelText("Reranker timeout seconds"), { target: { value: "3" } });
    fireEvent.change(await screen.findByLabelText("Local reranker endpoint URL"), {
      target: { value: "http://127.0.0.1:8081/rerank" }
    });
    fireEvent.click(screen.getByRole("button", { name: /save ranking/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("ai.capability.update", {
        capability: "rerank_results",
        data: {
          provider_id: "local_reranker_http",
          model_id: "bge-loopback-reranker",
          local_only: true,
          settings: {
            endpoint_url: "http://127.0.0.1:8081/rerank",
            timeout_seconds: 3
          }
        }
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /test ranking/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("ai.rerank", {
        query: "local reranker smoke",
        candidates: [
          { id: "a", text: "Local reranker smoke result" },
          { id: "b", text: "Unrelated candidate" }
        ],
        local_only: true
      })
    );
    const routeResult = await screen.findByText(/Ranking tested \/ 2 results \/ Stayed on this device/);
    expect(routeResult).toBeTruthy();
    expect(routeResult.textContent).not.toContain("local_reranker_http");
    expect(routeResult.textContent).not.toContain("bge-loopback-reranker");
  });

  it("transcribes a selected voice file into a source", async () => {
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "settings.get") return {};
      if (route === "ai.providers") return [];
      if (route === "ai.capabilities") return [];
      if (route === "ai.hardware") {
        return {
          os: "macos",
          arch: "arm64",
          physical_ram_gb: 16,
          apple_silicon: true,
          metal_available: true,
          cuda_available: false,
          rocm_available: false,
          vulkan_available: false,
          recommended_profile: "standard",
          warnings: []
        };
      }
      if (route === "ai.models.registry") return { models: [] };
      if (route === "ai.models.downloads") return [];
      if (route === "ai.runtime.health") {
        return {
          llama_cpp: {
            runtime: "llama_cpp",
            state: "not_configured",
            runtime_dir: "/tmp/runtime",
            cli: { configured: false, source: "missing" },
            server: { configured: false, source: "missing" },
            installed_models: [],
            warnings: [],
            next_actions: []
          },
          voice: {}
        };
      }
      if (route === "ai.runs") return [];
      if (route === "voice.voices") return [];
      if (route === "voice.audioAssets") {
        return [
          {
            id: "aud_1",
            kind: "voice_memo",
            original_filename: "lab memo.wav",
            source_id: "src_voice"
          }
        ];
      }
      if (route === "voice.speechAssets") {
        return [
          {
            id: "spch_1",
            provider: "mock_tts",
            voice_id: "mock-local-voice",
            text_preview: null,
            audio_path: "/vault/blobs/speech/settings.wav",
            sent_off_device: false
          }
        ];
      }
      if (route === "jobs.list") return [];
      if (route === "voice.transcribe") {
        return {
          source_id: "src_voice",
          source_title: "lab memo",
          audio_asset_id: "aud_1",
          sent_off_device: false,
          segments: []
        };
      }
      return [];
    });
    const selectFiles = vi.fn(async () => ["/tmp/lab memo.wav"]);
    window.vault = { request, selectFiles };

    useUIStore.setState({ surface: "settings" });
    renderApp();
    fireEvent.click(await screen.findByRole("tab", { name: /voice/i }));
    expect(await screen.findByText("Voice model setup")).toBeTruthy();
    expect(screen.queryByText("Turn spoken notes and recordings into local text.")).toBeNull();
    expect(screen.queryByText("Create cached local audio from notes, cards, and Assistant answers.")).toBeNull();
    expect(screen.queryByText("Dictation, voice memos, Assistant questions.")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /import audio/i }));
    await waitFor(() => expect(selectFiles).toHaveBeenCalled());
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("voice.transcribe", {
        audio_path: "/tmp/lab memo.wav",
        title: "lab memo",
        create_source: true,
        local_only: true,
        metadata: { import_mode: "settings_voice_tab" }
      })
    );
    expect(await screen.findByText("Created source lab memo")).toBeTruthy();
    expect(await screen.findByText("Voice memo")).toBeTruthy();
    expect(await screen.findByText("Linked to Storage")).toBeTruthy();
    expect(screen.queryByText("source src_voice")).toBeNull();
    expect(await screen.findByText("Read-aloud history")).toBeTruthy();
    expect(await screen.findByText("On device")).toBeTruthy();
    expect(await screen.findByText("Cached audio file")).toBeTruthy();
    expect(screen.queryByText("mock_tts")).toBeNull();
    expect(screen.queryByText("/vault/blobs/speech/settings.wav")).toBeNull();
  });

  it("preflights microphone permission in voice settings", async () => {
    const stopTrack = vi.fn();
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] }));
    const queryPermission = vi.fn(async () => ({ state: "prompt", onchange: null }));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia }
    });
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: queryPermission }
    });

    const request = vi.fn(async (route: string) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "settings.get") return {};
      if (route === "ai.providers") {
        return [
          {
            id: "mock_stt",
            display_name: "Mock STT",
            kind: "stt",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          },
          {
            id: "mock_tts",
            display_name: "Mock TTS",
            kind: "tts",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          }
        ];
      }
      if (route === "ai.capabilities") {
        return [
          { capability: "transcribe_audio", provider_id: "mock_stt", model_id: "mock-local-stt", local_only: true, settings: {} },
          { capability: "synthesize_speech", provider_id: "mock_tts", model_id: "mock-local-tts", local_only: true, settings: {} }
        ];
      }
      if (route === "ai.models.registry") return { models: [] };
      if (route === "ai.models.downloads") return [];
      if (route === "ai.runtime.health") return { llama_cpp: { state: "not_configured", cli: {}, server: {}, installed_models: [], warnings: [] }, voice: { state: "mock_only", warnings: [] } };
      if (route === "ai.runs") return [];
      if (route === "voice.voices") return [];
      if (route === "voice.audioAssets") return [];
      if (route === "voice.speechAssets") return [];
      if (route === "jobs.list") return [];
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "settings" });
    renderApp();
    fireEvent.click(await screen.findByRole("tab", { name: /voice/i }));
    expect(await screen.findByLabelText("Microphone permission preflight")).toBeTruthy();
    await waitFor(() => expect(queryPermission).toHaveBeenCalledWith({ name: "microphone" }));
    expect(await screen.findByText("Test needed")).toBeTruthy();
    expect(screen.queryByText("needs test")).toBeNull();
    expect(screen.queryByText("local capture")).toBeNull();
    expect(screen.queryByText("Audio notes")).toBeNull();
    expect(screen.queryByText("Read-aloud history")).toBeNull();
    expect(screen.queryByText("No audio notes yet.")).toBeNull();
    expect(screen.queryByText("No read-aloud audio yet.")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /check microphone/i }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ audio: true }));
    expect(stopTrack).toHaveBeenCalled();
    expect(await screen.findByText("Ready")).toBeTruthy();
    expect(await screen.findByText("Microphone ready for local dictation and voice questions.")).toBeTruthy();
  });

  it("requires explicit consent before saving an off-device voice route", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined
    });
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "settings.get") return {};
      if (route === "ai.providers") {
        return [
          {
            id: "mock_stt",
            display_name: "Mock STT",
            kind: "stt",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          },
          {
            id: "mock_tts",
            display_name: "Mock TTS",
            kind: "tts",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          },
          {
            id: "elevenlabs",
            display_name: "ElevenLabs",
            kind: "tts",
            locality: "cloud",
            enabled: false,
            configured: false,
            privacy_label: "May send data to cloud"
          }
        ];
      }
      if (route === "ai.capabilities") {
        return [
          { capability: "transcribe_audio", provider_id: "mock_stt", model_id: "mock-local-stt", local_only: true, settings: {} },
          { capability: "synthesize_speech", provider_id: "mock_tts", model_id: "mock-local-tts", local_only: true, settings: {} }
        ];
      }
      if (route === "ai.models.registry") return { models: [] };
      if (route === "ai.models.downloads") return [];
      if (route === "ai.runtime.health") return { llama_cpp: { state: "not_configured", cli: {}, server: {}, installed_models: [], warnings: [] }, voice: { state: "mock_only", warnings: [] } };
      if (route === "ai.runs") return [];
      if (route === "voice.voices") return [];
      if (route === "voice.audioAssets") return [];
      if (route === "voice.speechAssets") return [];
      if (route === "jobs.list") return [];
      if (route === "ai.capability.update") return { capability: payload.capability, ...payload.data };
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "settings" });
    renderApp();
    fireEvent.click(await screen.findByRole("tab", { name: /voice/i }));
    const readAloudProvider = await screen.findByLabelText("Read-aloud provider");
    const readAloudPanel = readAloudProvider.closest("section");
    expect(readAloudPanel).toBeTruthy();
    const readAloud = within(readAloudPanel as HTMLElement);
    expect(await readAloud.findByText("Starter voice")).toBeTruthy();
    expect(await readAloud.findByText("Saved model selected")).toBeTruthy();
    expect(readAloud.queryByText("mock_only")).toBeNull();
    expect(readAloud.queryByText("mock-local-tts")).toBeNull();
    fireEvent.change(readAloudProvider, { target: { value: "elevenlabs" } });
    fireEvent.change(await screen.findByLabelText("Read-aloud model ID"), { target: { value: "eleven_multilingual_v2" } });
    const saveButton = await screen.findByRole("button", { name: /save read aloud/i });
    expect(saveButton).toHaveProperty("disabled", true);
    expect(await screen.findByLabelText("Allow off-device read aloud")).toBeTruthy();
    fireEvent.click(await screen.findByLabelText("Allow off-device read aloud"));
    expect(screen.getByRole("button", { name: /save read aloud/i })).toHaveProperty("disabled", false);
    fireEvent.click(screen.getByRole("button", { name: /save read aloud/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("ai.capability.update", {
        capability: "synthesize_speech",
        data: {
          provider_id: "elevenlabs",
          model_id: "eleven_multilingual_v2",
          local_only: false,
          settings: {
            voice_id: "mock-local-voice",
            format: "wav",
            cloud_voice_consent: true
          }
        }
      })
    );
  });

  it("configures a whisper.cpp speech-to-text route", async () => {
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 0,
          source_blocks: 0,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "settings.get") return {};
      if (route === "ai.providers") {
        return [
          {
            id: "mock_stt",
            display_name: "Mock Local Speech-to-Text",
            kind: "stt",
            locality: "local",
            enabled: true,
            configured: true,
            privacy_label: "Runs on this device"
          },
          {
            id: "whisper_cpp",
            display_name: "whisper.cpp",
            kind: "stt",
            locality: "local",
            enabled: false,
            configured: false,
            privacy_label: "Runs on this device"
          }
        ];
      }
      if (route === "ai.capabilities") {
        return [
          {
            capability: "transcribe_audio",
            provider_id: "mock_stt",
            model_id: "mock-local-stt",
            local_only: true,
            settings: { timestamps: true }
          }
        ];
      }
      if (route === "ai.hardware") {
        return {
          os: "macos",
          arch: "arm64",
          physical_ram_gb: 16,
          apple_silicon: true,
          metal_available: true,
          cuda_available: false,
          rocm_available: false,
          vulkan_available: false,
          recommended_profile: "standard",
          warnings: []
        };
      }
      if (route === "ai.models.registry") {
        return {
          models: [
            {
              id: "tiny-fixture-whisper",
              display_name: "Tiny Fixture whisper.cpp Model",
              kind: "stt",
              installed: true,
              download_state: "installed",
              capabilities: ["transcribe_audio"],
              disk_path: "/vault/models/voice/stt/tiny-fixture-whisper/tiny-fixture-whisper.bin",
              license_label: "test fixture",
              recommended_profile: "tiny",
              runtime: "whisper_cpp",
              format: "ggml",
              source_type: "local_fixture",
              runtime_tested: false
            }
          ]
        };
      }
      if (route === "ai.models.downloads") return [];
      if (route === "ai.runtime.health") return { llama_cpp: { state: "not_configured", cli: {}, server: {}, installed_models: [], warnings: [] }, voice: { state: "mock_only", warnings: [] } };
      if (route === "ai.runs") return [];
      if (route === "voice.voices") return [];
      if (route === "voice.audioAssets") return [];
      if (route === "jobs.list") return [];
      if (route === "ai.capability.update") return { capability: payload.capability, ...payload.data };
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "settings" });
    renderApp();
    fireEvent.click(await screen.findByRole("tab", { name: /voice/i }));
    const dictationPanel = (await screen.findByLabelText("Dictation provider")).closest("section");
    expect(dictationPanel).toBeTruthy();
    expect(within(dictationPanel as HTMLElement).getByText("Starter voice")).toBeTruthy();
    expect(within(dictationPanel as HTMLElement).getByText("Saved model selected")).toBeTruthy();
    expect(within(dictationPanel as HTMLElement).queryByText("mock-local-stt")).toBeNull();
    fireEvent.change(await screen.findByLabelText("Dictation provider"), { target: { value: "whisper_cpp" } });
    fireEvent.change(await screen.findByLabelText("Managed dictation model"), { target: { value: "tiny-fixture-whisper" } });
    expect(within(dictationPanel as HTMLElement).getByText("Tiny Fixture whisper.cpp Model - Available")).toBeTruthy();
    expect(within(dictationPanel as HTMLElement).getByText("Available")).toBeTruthy();
    expect(within(dictationPanel as HTMLElement).getByText("Local dictation model ready.")).toBeTruthy();
    expect(within(dictationPanel as HTMLElement).queryByText("installed")).toBeNull();
    expect(within(dictationPanel as HTMLElement).queryByText("/vault/models/voice/stt/tiny-fixture-whisper/tiny-fixture-whisper.bin")).toBeNull();
    fireEvent.change(await screen.findByLabelText("Dictation language"), { target: { value: "en" } });
    fireEvent.change(await screen.findByLabelText("Dictation timeout seconds"), { target: { value: "4" } });
    fireEvent.change(await screen.findByLabelText("whisper.cpp binary path"), { target: { value: "/opt/whisper/whisper-cli" } });
    fireEvent.click(screen.getByRole("button", { name: /save dictation/i }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("ai.capability.update", {
        capability: "transcribe_audio",
        data: {
          provider_id: "whisper_cpp",
          model_id: "tiny-fixture-whisper",
          local_only: true,
          settings: {
            binary_path: "/opt/whisper/whisper-cli",
            model_path: "/vault/models/voice/stt/tiny-fixture-whisper/tiny-fixture-whisper.bin",
            language: "en",
            timestamps: true,
            timeout_seconds: 4
          }
        }
      })
    );
  });

  it("shows model download queue controls", async () => {
    const request = vi.fn(async (route: string, payload?: any) => {
      if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
      if (route === "stats.get") {
        return {
          sources: 1,
          source_blocks: 1,
          notes: 0,
          claims: 0,
          claims_without_evidence: 0,
          contradicted_claims: 0,
          pending_review_items: 0,
          generated_notes_pending_review: 0,
          installed_tools: 1,
          failed_jobs: 0,
          learning_items: 0
        };
      }
      if (route === "events.list") return [];
      if (route === "settings.get") return {};
      if (route === "ai.providers") return [];
      if (route === "ai.capabilities") return [];
      if (route === "ai.hardware") {
        return {
          os: "macos",
          arch: "arm64",
          physical_ram_gb: 16,
          apple_silicon: true,
          metal_available: true,
          cuda_available: false,
          rocm_available: false,
          vulkan_available: false,
          recommended_profile: "standard",
          warnings: []
        };
      }
      if (route === "ai.models.registry") return { models: [] };
      if (route === "ai.models.downloads") {
        return [
          {
            id: "dl_running",
            model_id: "tiny-fixture-llm",
            state: "downloading",
            bytes_downloaded: 64,
            bytes_total: 128,
            created_at: "2026-06-03T00:00:00Z",
            updated_at: "2026-06-03T00:00:01Z"
          },
          {
            id: "dl_paused",
            model_id: "http-resume-fixture-llm",
            state: "paused",
            bytes_downloaded: 350,
            bytes_total: 2200,
            created_at: "2026-06-03T00:00:00Z",
            updated_at: "2026-06-03T00:00:01Z"
          }
        ];
      }
      if (route === "ai.runtime.health") {
        return {
          llama_cpp: {
            runtime: "llama_cpp",
            state: "not_configured",
            runtime_dir: "/tmp/runtime",
            cli: { configured: false, source: "missing" },
            server: { configured: false, source: "missing" },
            installed_models: [],
            warnings: [],
            next_actions: []
          },
          voice: {}
        };
      }
      if (route === "ai.runs") return [];
      if (route === "voice.voices") return [];
      if (route === "jobs.list") return [];
      if (route === "ai.models.download.pause") return { id: payload.downloadId, state: "paused" };
      if (route === "ai.models.download.resume") return { id: payload.downloadId, state: "queued" };
      if (route === "ai.models.download.cancel") return { id: payload.downloadId, state: "cancelled" };
      return [];
    });
    window.vault = { request, selectFiles: vi.fn(async () => []) };

    useUIStore.setState({ surface: "settings" });
    renderApp();
    const modelLibrarySummary = (await screen.findByText("Model library")).closest("summary");
    expect(modelLibrarySummary).toBeTruthy();
    fireEvent.click(modelLibrarySummary as HTMLElement);
    expect(await screen.findByText("tiny-fixture-llm")).toBeTruthy();
    expect(await screen.findByText("64 B / 128 B")).toBeTruthy();
    expect(await screen.findByText("Downloading")).toBeTruthy();
    expect(await screen.findByText("Paused")).toBeTruthy();
    expect(screen.queryByText("downloading")).toBeNull();
    expect(screen.queryByText("paused")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /pause/i })[0]);
    await waitFor(() => expect(request).toHaveBeenCalledWith("ai.models.download.pause", { downloadId: "dl_running" }));
    fireEvent.click(screen.getAllByRole("button", { name: /resume/i })[1]);
    await waitFor(() => expect(request).toHaveBeenCalledWith("ai.models.download.resume", { downloadId: "dl_paused" }));
    fireEvent.click(screen.getAllByRole("button", { name: /cancel/i })[0]);
    await waitFor(() => expect(request).toHaveBeenCalledWith("ai.models.download.cancel", { downloadId: "dl_running" }));
  });
});
