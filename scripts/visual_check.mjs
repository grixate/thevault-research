import { chromium } from "@playwright/test";
import { playwrightChromiumLaunchOptions } from "./lib/playwright_headless_shell.mjs";

const scenario = process.argv[2] ?? "notes-loading";
const outputPath = process.argv[3] ?? `/tmp/vault-${scenario}.png`;
const baseUrl = process.env.VAULT_RENDERER_URL ?? "http://127.0.0.1:5173/";

const scenarios = {
  "app-entry": async (page) => {
    await installEmptyVaultBridge(page);
    await page.goto(baseUrl, { waitUntil: "networkidle" });
  },
  "home-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openHome(page);
    await page.waitForFunction(() => {
      const start = document.querySelector("[aria-label='Workspace start']");
      const text = start?.textContent ?? "";
      return (
        Boolean(start) &&
        text.includes("Notes") &&
        text.includes("Quick note") &&
        text.includes("Storage") &&
        text.includes("Add source") &&
        text.includes("Review") &&
        text.includes("Open") &&
        text.includes("Models") &&
        text.includes("Setup") &&
        !text.includes("empty") &&
        !text.includes("clear") &&
        !text.includes("checking") &&
        !text.includes("Start here") &&
        !text.includes("Recent activity") &&
        !text.includes("0 updates") &&
        !text.includes("No activity")
      );
    });
  },
  "assistant-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openAssistant(page);
  },
  "assistant-answer": async (page) => {
    await installEmptyVaultBridge(page);
    await openAssistant(page);
    await page.getByRole("textbox", { name: "Assistant question" }).fill("What should I verify next?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await page.getByText("Approved claims point to two review priorities.").waitFor();
    await page.waitForFunction(() => {
      const grounding = document.querySelector("[aria-label='Assistant answer grounding']");
      const citations = document.querySelector("[aria-label='Assistant citations']");
      const text = document.body.innerText ?? "";
      return Boolean(
        grounding &&
          citations &&
          grounding.textContent?.includes("Approved claims") &&
          grounding.textContent?.includes("Vault") &&
          grounding.textContent?.includes("1 citation") &&
          grounding.textContent?.includes("on device") &&
          !text.includes("Answered from approved claims") &&
          !text.includes("approved evidence") &&
          !text.includes("claim claim_") &&
          !text.includes("citations valid")
      );
    });
  },
  "notes-loading": async (page) => {
    await openNotes(page);
  },
  "notes-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openNotes(page);
  },
  "editor-tools": async (page) => {
    await installNoteVaultBridge(page);
    await openNotes(page);
    await page.getByText("Tools", { exact: true }).click();
  },
  "editor-versions-empty": async (page) => {
    await installNoteVaultBridge(page);
    await openNotes(page);
    await page.getByText("Tools", { exact: true }).click();
    await page.getByRole("button", { name: "Versions" }).click();
    await page.getByText("No versions").waitFor();
  },
  "generated-draft": async (page) => {
    await installGeneratedDraftVaultBridge(page);
    await openNotes(page);
    await page.getByText("Review generated draft").waitFor();
    await page.waitForFunction(() => {
      const text = document.body.innerText ?? "";
      return (
        text.includes("1 source") &&
        text.includes("1 claim") &&
        text.includes("Review generated draft") &&
        !text.includes("Drafted locally") &&
        !text.includes("Run recorded") &&
        !text.includes("AI draft") &&
        !text.includes("generated pending review") &&
        !text.includes("Draft notes")
      );
    });
  },
  "storage-loading": async (page) => {
    await openStorage(page);
  },
  "storage-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openStorage(page);
  },
  "storage-import-followup": async (page) => {
    await installStorageImportVaultBridge(page);
    await openStorage(page);
    await page.getByRole("button", { name: "Add source" }).click();
    await page.getByRole("textbox", { name: "Source title" }).fill("Imported interview with a long archive title and nested folder context");
    await page.getByRole("textbox", { name: "Source text" }).fill("Evidence belongs in Storage until it is quoted inside a note.");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByLabel("Storage import next actions").waitFor();
    await page.getByRole("button", { name: "Start cited note" }).waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const startNote = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Start cited note"));
      return Boolean(startNote && !startNote.disabled);
    });
    await page.waitForFunction(() => {
      const tools = document.querySelector("[aria-label='Storage local analysis tools']");
      return Boolean(
        tools &&
          tools.textContent?.includes("Claim suggestions") &&
          tools.textContent?.includes("Concept suggestions") &&
          !tools.textContent?.includes("setup")
      );
    });
  },
  "storage-filter-empty": async (page) => {
    await installStorageFilterVaultBridge(page);
    await openStorage(page);
    await page.getByRole("textbox", { name: "Search Storage sources" }).fill("missing archive");
    await page.waitForFunction(() => {
      const noSourceCount = Array.from(document.querySelectorAll("strong")).filter((element) => element.textContent === "No sources").length;
      const hasNeutralDetail = Array.from(document.querySelectorAll("strong")).some((element) => element.textContent === "Source details") &&
        Array.from(document.querySelectorAll("span")).some((element) => element.textContent === "None selected");
      return noSourceCount === 1 && hasNeutralDetail;
    });
  },
  "storage-block-filter-empty": async (page) => {
    await installStorageFilterVaultBridge(page);
    await openStorage(page);
    await page.getByRole("textbox", { name: "Filter source blocks" }).fill("missing block");
    await page.getByText("No blocks", { exact: true }).waitFor();
    await page.waitForFunction(() => {
      const hasNeutralDetail = Array.from(document.querySelectorAll("strong")).some((element) => element.textContent === "Block details") &&
        Array.from(document.querySelectorAll("span")).some((element) => element.textContent === "None selected");
      return hasNeutralDetail && !document.body.textContent?.includes("Select a block.");
    });
    await page.getByLabel("Storage local analysis tools").waitFor();
    await page.waitForFunction(() => {
      const tools = document.querySelector("[aria-label='Storage local analysis tools']");
      return Boolean(
        tools &&
          tools.textContent?.includes("Claim suggestions") &&
          tools.textContent?.includes("Concept suggestions") &&
          !tools.textContent?.includes("setup") &&
          !tools.textContent?.includes("mock local") &&
          !tools.textContent?.includes("mock-local-llm") &&
          !tools.textContent?.includes("No model selected")
      );
    });
  },
  "tasks-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openTasks(page);
    await page.waitForFunction(() => {
      const text = document.body.innerText ?? "";
      return text.includes("No tasks") && !text.includes("Inbox clear.");
    });
  },
  "review-loading": async (page) => {
    await openReview(page);
  },
  "review-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openReview(page);
    await page.waitForFunction(() => {
      const text = document.body.innerText ?? "";
      return text.includes("No proposals") && !text.includes("Review is clear.");
    });
  },
  "review-rejected-only": async (page) => {
    await installRejectedReviewVaultBridge(page);
    await openReview(page);
    await page.getByRole("tab", { name: "Rejected" }).click();
    await page.getByText("Rejected synthesis proposal").first().waitFor();
    await page.waitForFunction(() => {
      const text = document.body.innerText ?? "";
      const typeChipCount = (text.match(/\bnew claim\b/g) ?? []).length;
      return (
        text.includes("Rejected synthesis proposal") &&
        typeChipCount <= 1 &&
        !text.includes("NEW CLAIM") &&
        !document.querySelector("[aria-label='Review decision summary']") &&
        !text.includes("clear")
      );
    });
  },
  "settings-models": async (page) => {
    await installEmptyVaultBridge(page);
    await openSettings(page);
  },
  "settings-search": async (page) => {
    await installEmptyVaultBridge(page);
    await openSettings(page);
    await page.getByRole("tab", { name: "Search" }).click();
    await page.waitForFunction(() => {
      const text = document.body.innerText ?? "";
      return (
        text.includes("Search index") &&
        text.includes("Result ranking") &&
        text.includes("Model task routing") &&
        !text.includes("No saved embedding model") &&
        !text.includes("No saved reranker model")
      );
    });
  },
  "settings-voice": async (page) => {
    await installEmptyVaultBridge(page);
    await openSettings(page);
    await page.getByRole("tab", { name: "Voice" }).click();
    await page.waitForFunction(() => {
      const text = document.body.innerText ?? "";
      return (
        text.includes("Microphone access") &&
        text.includes("Test needed") &&
        text.includes("Dictation") &&
        text.includes("Read aloud") &&
        !text.includes("needs test") &&
        !text.includes("local capture") &&
        !text.includes("No audio notes yet.") &&
        !text.includes("No read-aloud audio yet.")
      );
    });
  },
  "settings-privacy": async (page) => {
    await installEmptyVaultBridge(page);
    await openSettings(page);
    await page.getByRole("tab", { name: "Privacy" }).click();
  },
  "settings-export": async (page) => {
    await installEmptyVaultBridge(page);
    await openSettings(page);
    await page.getByRole("tab", { name: "Export" }).click();
  },
  "settings-advanced": async (page) => {
    await installEmptyVaultBridge(page);
    await openSettings(page);
    await page.getByRole("tab", { name: "Advanced" }).click();
  },
  "graph-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openGraph(page);
  },
  "graph-claim-no-evidence": async (page) => {
    await installGraphClaimNoEvidenceVaultBridge(page);
    await openGraph(page);
    await page.getByText("No evidence", { exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector(".detail-pane .eyebrow"));
  },
  "practice-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openPractice(page);
  },
  "local-tools-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openLocalTools(page);
  },
  "local-tools-installed": async (page) => {
    await installToolVaultBridge(page);
    await openLocalTools(page);
    await page.getByText("Claim Citation Checker").first().waitFor();
    await page.waitForFunction(() => {
      const text = document.body.innerText ?? "";
      const runRow = document.querySelector(".tool-run-list button");
      const runRowHeight = runRow?.getBoundingClientRect().height ?? 0;
      return (
        text.includes("Claim Citation Checker") &&
        text.includes("History") &&
        text.includes("Result JSON") &&
        !text.includes('"findings"') &&
        runRowHeight > 0 &&
        runRowHeight < 90 &&
        !document.querySelector(".tool-studio-view .detail-pane .eyebrow")
      );
    });
  },
  "capsules-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openCapsules(page);
    await page.waitForFunction(() => {
      const text = document.body.innerText ?? "";
      const noCapsuleCount = Array.from(document.querySelectorAll("strong")).filter((element) => element.textContent === "No capsules").length;
      return (
        noCapsuleCount === 1 &&
        text.includes("No capsules") &&
        text.includes("New") &&
        text.includes("Import") &&
        !text.includes("No capsule selected") &&
        !text.includes("Find capsules")
      );
    });
  },
  "command-actions": async (page) => {
    await installEmptyVaultBridge(page);
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator(".command-search input").focus();
  },
  "quick-note": async (page) => {
    await installEmptyVaultBridge(page);
    await openQuickNote(page);
  },
  "quick-storage": async (page) => {
    await installEmptyVaultBridge(page);
    await openQuickNote(page);
    await page.getByRole("button", { name: "Capture as evidence" }).click();
  },
  "quick-source": async (page) => {
    await scenarios["quick-storage"](page);
  },
  "quick-task": async (page) => {
    await installEmptyVaultBridge(page);
    await openQuickNote(page);
    await page.getByRole("button", { name: "Save as task" }).click();
  }
};

if (!scenarios[scenario]) {
  console.error(`Unknown visual scenario: ${scenario}`);
  console.error(`Available scenarios: ${Object.keys(scenarios).join(", ")}`);
  process.exit(2);
}

const browser = await chromium.launch({
  headless: true,
  ...playwrightChromiumLaunchOptions()
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await scenarios[scenario](page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: outputPath, fullPage: true });
  const text = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  console.log(JSON.stringify({ scenario, outputPath, text }, null, 2));
} finally {
  await browser.close();
}

async function openNotes(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const notes = page.locator('.main-nav button[aria-label="Notes"]');
  if (await notes.count()) await notes.first().click();
}

async function openHome(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const home = page.locator('.main-nav button[aria-label="Home"]');
  if (await home.count()) await home.first().click();
}

async function openAssistant(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const assistant = page.locator('.main-nav button[aria-label="Assistant"]');
  if (await assistant.count()) await assistant.first().click();
}

async function openStorage(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const storage = page.locator('.main-nav button[aria-label="Storage"]');
  if (await storage.count()) await storage.first().click();
}

async function openTasks(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const tasks = page.locator('.main-nav button[aria-label="Tasks"]');
  if (await tasks.count()) await tasks.first().click();
}

async function openReview(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const review = page.locator('.main-nav button[aria-label="Review"]');
  if (await review.count()) await review.first().click();
}

async function openSettings(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const settings = page.locator('.main-nav button[aria-label="Models"]');
  if (await settings.count()) await settings.first().click();
}

async function openGraph(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const graph = page.locator('.main-nav button[aria-label="Graph"]');
  if (await graph.count()) await graph.first().click();
}

async function openPractice(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const learning = page.locator('.main-nav button[aria-label="Learning"]');
  if (await learning.count()) await learning.first().click();
}

async function openLocalTools(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const tools = page.locator('.main-nav button[aria-label="Local tools"]');
  if (await tools.count()) await tools.first().click();
}

async function openCapsules(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const capsules = page.locator('.main-nav button[aria-label="Capsules"]');
  if (await capsules.count()) await capsules.first().click();
}

async function openQuickNote(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator('.topbar button[aria-label="Quick note"]').click();
}

async function installEmptyVaultBridge(page) {
  await page.addInitScript(() => {
    window.vault = {
      request: async (route) => {
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
        if (route === "claims.list") return [];
        if (route === "todos.list") return { items: [], total: 0, limit: 100, offset: 0 };
        if (route === "todoLists.list") return [];
        if (route === "capsules.list") return { items: [], total: 0 };
        if (route === "capsules.imports") return { items: [], total: 0 };
        if (route === "learning.items") return [];
        if (route === "tools.list") return [];
        if (route === "ai.capabilities") return [];
        if (route === "assistant.ask") {
          return {
            answer_markdown: "Approved claims point to two review priorities.\n\n1. Confirm the strongest source-backed claim.\n2. Move unresolved source blocks into Review before drafting.",
            ai_run_id: "visual-ai-run",
            evidence_quality: "approved_claims",
            provider: "mock-local-llm",
            model_id: "mock-local-llm",
            sent_off_device: false,
            citation_validation: { status: "valid" },
            citations: [
              {
                marker: "[1]",
                title: "Review queue",
                exact_quote: "Typed claims keep source context attached to review decisions.",
                evidence_kind: "approved_claim_evidence",
                source_id: "src_visual",
                source_block_id: "block_visual",
                claim_id: "claim_visual"
              }
            ],
            uncertainties: []
          };
        }
        return [];
      },
      selectFiles: async () => []
    };
  });
}

async function installRejectedReviewVaultBridge(page) {
  await page.addInitScript(() => {
    const rejectedItem = {
      id: "rev_rejected_visual",
      item_type: "new_claim",
      title: "Rejected synthesis proposal",
      summary: "Already rejected proposals should read like archive rows, not a success announcement.",
      status: "rejected",
      created_at: "2026-06-27T00:00:00Z",
      payload: {
        body: "This rejected claim remains available for inspection.",
        model_id: "mock-local-llm"
      }
    };
    window.vault = {
      request: async (route, payload) => {
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
        if (route === "review.list") return payload?.status === "dismissed" ? [rejectedItem] : [];
        if (route === "capsules.list") return { items: [], total: 0 };
        return [];
      },
      selectFiles: async () => []
    };
  });
}

async function installNoteVaultBridge(page) {
  await page.addInitScript(() => {
    const note = {
      id: "note_visual_editor",
      title: "Field synthesis",
      content: {
        editor_doc: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Editable synthesis lives here. Raw excerpts stay in Storage until they are cited." }]
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Use the tools strip only when this note needs review, voice, export, or capsule work." }]
            }
          ]
        }
      },
      content_markdown: "Editable synthesis lives here. Raw excerpts stay in Storage until they are cited.\n\nUse the tools strip only when this note needs review, voice, export, or capsule work.",
      origin: "user_written",
      status: "active",
      version: 3,
      source_id: "src_visual_editor",
      updated_at: "2026-06-27T00:00:00Z"
    };
    window.vault = {
      request: async (route) => {
        if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
        if (route === "jobs.list") return [];
        if (route === "stats.get") {
          return {
            sources: 1,
            source_blocks: 2,
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
        if (route === "sources.list") return [];
        if (route === "claims.list") return [];
        if (route === "capsules.list") return { items: [] };
        if (route === "ai.capabilities") return [
          { capability: "extract_claims", provider_id: "llama_cpp_cli", model_id: "standard-gguf-placeholder", local_only: true, settings: {} },
          { capability: "extract_objects", provider_id: "llama_cpp_cli", model_id: "standard-gguf-placeholder", local_only: true, settings: {} },
          { capability: "generate_note", provider_id: "llama_cpp_cli", model_id: "standard-gguf-placeholder", local_only: true, settings: {} }
        ];
        if (route === "ai.providers") return [];
        return [];
      },
      selectFiles: async () => []
    };
  });
}

async function installGeneratedDraftVaultBridge(page) {
  await page.addInitScript(() => {
    const longCitationTitle = "Archive source with a very long collection title for a generated local synthesis draft (appendix block 24 with nested locator)";
    const note = {
      id: "note_visual_generated",
      title: "Local synthesis draft",
      content: {
        generation_status: "draft",
        requires_review: true,
        generated_by: "llama_cpp_cli",
        model_id: "standard-gguf-placeholder",
        capability: "generate_note",
        ai_run_id: "run_visual_generated",
        source_ids: ["src_visual_generated"],
        claim_ids: ["claim_visual_generated"],
        citations: [
          {
            title: "Archive source with a very long collection title for a generated local synthesis draft",
            locator: "appendix block 24 with nested locator",
            snippet: "Evidence quote remains inspectable without expanding the banner."
          }
        ],
        generated_claim_review_status: "not_prepared",
        generated_claim_review_item_count: 0,
        generated_claim_review_quarantined_count: 0,
        sent_off_device: false,
        editor_doc: {
          type: "doc",
          content: [
            { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Local synthesis draft" }] },
            { type: "paragraph", content: [{ type: "text", text: "Generated synthesis awaits review before it becomes a normal note." }] }
          ]
        }
      },
      content_markdown: "# Local synthesis draft\n\nGenerated synthesis awaits review before it becomes a normal note.",
      origin: "ai_generated",
      status: "generated_pending_review",
      version: 1,
      source_id: "src_visual_generated",
      updated_at: "2026-06-27T00:00:00Z"
    };
    window.vault = {
      request: async (route) => {
        if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
        if (route === "jobs.list") return [];
        if (route === "stats.get") {
          return {
            sources: 1,
            source_blocks: 1,
            notes: 1,
            claims: 1,
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
        if (route === "notes.list") return [note];
        if (route === "sources.list") return [];
        if (route === "claims.list") return [];
        if (route === "capsules.list") return { items: [] };
        if (route === "ai.capabilities") return [
          { capability: "extract_claims", provider_id: "llama_cpp_cli", model_id: "standard-gguf-placeholder", local_only: true, settings: {} },
          { capability: "extract_objects", provider_id: "llama_cpp_cli", model_id: "standard-gguf-placeholder", local_only: true, settings: {} },
          { capability: "generate_note", provider_id: "llama_cpp_cli", model_id: "standard-gguf-placeholder", local_only: true, settings: {} }
        ];
        if (route === "ai.providers") return [];
        return [];
      },
      selectFiles: async () => []
    };
    window.__vaultVisualLongCitationTitle = longCitationTitle;
  });
}

async function installStorageImportVaultBridge(page) {
  await page.addInitScript(() => {
    let importedSource = null;
    const sourceBlock = {
      id: "block_storage_visual",
      source_id: "src_storage_visual",
      block_index: 0,
      locator: "p1",
      text: "Evidence belongs in Storage until it is quoted inside a note."
    };
    window.vault = {
      request: async (route, payload) => {
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
        if (route === "notes.list") return [];
        if (route === "sources.list") return importedSource ? [importedSource] : [];
        if (route === "sources.blocks") return importedSource ? [sourceBlock] : [];
        if (route === "sources.pipeline") {
          return {
            source_id: importedSource?.id ?? "src_storage_visual",
            source_title: importedSource?.title ?? "",
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
            id: "src_storage_visual",
            type: payload.type,
            title: payload.title,
            metadata: payload.metadata,
            created_at: "2026-06-27T00:00:00Z",
            updated_at: "2026-06-27T00:00:00Z"
          };
          return { source: importedSource, duplicate: false };
        }
        if (route === "sources.extract") return { created_review_items: 1, quarantined_items: 0 };
        if (route === "claims.list") return [];
        if (route === "todos.list") return { items: [], total: 0, limit: 100, offset: 0 };
        if (route === "todoLists.list") return [];
        if (route === "capsules.list") return { items: [] };
        if (route === "learning.items") return [];
        if (route === "tools.list") return [];
        if (route === "ai.capabilities") return [];
        if (route === "ai.providers") return [];
        return [];
      },
      selectFiles: async () => []
    };
  });
}

async function installStorageFilterVaultBridge(page) {
  await page.addInitScript(() => {
    const source = {
      id: "src_storage_filter_visual",
      type: "text",
      title: "Interview transcript",
      metadata: { capture_context: "storage_dialog_paste" },
      created_at: "2026-06-27T00:00:00Z",
      updated_at: "2026-06-27T00:00:00Z"
    };
    const sourceBlock = {
      id: "block_storage_filter_visual",
      source_id: source.id,
      block_index: 0,
      locator: "p1",
      text: "Transcript evidence belongs in Storage."
    };
    window.vault = {
      request: async (route) => {
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
        if (route === "notes.list") return [];
        if (route === "sources.list") return [source];
        if (route === "sources.blocks") return [sourceBlock];
        if (route === "sources.pipeline") {
          return {
            source_id: source.id,
            source_title: source.title,
            source_type: source.type,
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
        if (route === "claims.list") return [];
        if (route === "todos.list") return { items: [], total: 0, limit: 100, offset: 0 };
        if (route === "todoLists.list") return [];
        if (route === "capsules.list") return { items: [] };
        if (route === "learning.items") return [];
        if (route === "tools.list") return [];
        if (route === "ai.capabilities") return [
          { capability: "extract_claims", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} },
          { capability: "extract_objects", provider_id: "mock_llm", model_id: "mock-local-llm", local_only: true, settings: {} }
        ];
        if (route === "ai.providers") return [
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
        return [];
      },
      selectFiles: async () => []
    };
  });
}

async function installToolVaultBridge(page) {
  await page.addInitScript(() => {
    const tool = {
      id: "tool_claim_citation_checker",
      name: "Claim Citation Checker",
      slug: "claim-citation-checker",
      version: "0.1.0",
      status: "installed",
      manifest: {
        runtime: "python",
        timeout_ms: 120000,
        description: "Checks selected claims against cited source blocks.",
        permissions: {
          read_sources: true,
          read_claims: true,
          write_review: true,
          write_canonical_graph: false,
          network: false,
          shell: false
        }
      }
    };
    const run = {
      id: "run_visual_tool",
      tool_id: tool.id,
      status: "completed",
      input: { claim_ids: ["clm_visual"] },
      output: {
        findings: [{ claim_id: "clm_visual", status: "supported" }],
        review_items: [],
        warnings: []
      },
      stdout: "checked 1 claim",
      stderr: "",
      started_at: "2026-06-27T00:00:00Z",
      finished_at: "2026-06-27T00:00:01Z"
    };
    window.vault = {
      request: async (route) => {
        if (route === "health.get") return { ok: true, version: "0.1.0", db_ready: true, workspace_id: "wrk_default" };
        if (route === "jobs.list") return [];
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
        if (route === "events.list") return [];
        if (route === "tools.list") return [tool];
        if (route === "tools.runs") return [run];
        if (route === "review.list") return [];
        return [];
      },
      selectFiles: async () => []
    };
  });
}

async function installGraphClaimNoEvidenceVaultBridge(page) {
  await page.addInitScript(() => {
    const claim = {
      id: "clm_visual_no_evidence",
      node_id: "node_visual_no_evidence",
      title: "Unlinked claim",
      normalized_text: "Unlinked claims should wait for source evidence.",
      status: "weakly_supported",
      confidence: 0.41,
      evidence_strength: 0
    };
    window.vault = {
      request: async (route) => {
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
        if (route === "notes.list") return [];
        if (route === "sources.list") return [];
        if (route === "claims.list") return [claim];
        if (route === "claims.evidence") return [];
        if (route === "todos.list") return { items: [], total: 0, limit: 100, offset: 0 };
        if (route === "todoLists.list") return [];
        if (route === "capsules.list") return { items: [] };
        if (route === "learning.items") return [];
        if (route === "tools.list") return [];
        if (route === "ai.capabilities") return [];
        if (route === "ai.providers") return [];
        return [];
      },
      selectFiles: async () => []
    };
  });
}
