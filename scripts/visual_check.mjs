import { chromium } from "@playwright/test";

const scenario = process.argv[2] ?? "notes-loading";
const outputPath = process.argv[3] ?? `/tmp/vault-${scenario}.png`;
const baseUrl = process.env.VAULT_RENDERER_URL ?? "http://127.0.0.1:5173/";

const scenarios = {
  "app-entry": async (page) => {
    await installEmptyVaultBridge(page);
    await page.goto(baseUrl, { waitUntil: "networkidle" });
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
  "storage-loading": async (page) => {
    await openStorage(page);
  },
  "storage-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openStorage(page);
  },
  "tasks-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openTasks(page);
  },
  "review-loading": async (page) => {
    await openReview(page);
  },
  "review-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openReview(page);
  },
  "settings-models": async (page) => {
    await installEmptyVaultBridge(page);
    await openSettings(page);
  },
  "settings-search": async (page) => {
    await installEmptyVaultBridge(page);
    await openSettings(page);
    await page.getByRole("tab", { name: "Search" }).click();
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
  "practice-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openPractice(page);
  },
  "local-tools-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openLocalTools(page);
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
    await page.getByRole("button", { name: "Capture to Storage" }).click();
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
  chromiumSandbox: false,
  args: ["--no-sandbox", "--disable-setuid-sandbox"]
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
        if (route === "capsules.list") return { items: [] };
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
