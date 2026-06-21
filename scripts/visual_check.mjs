import { chromium } from "@playwright/test";

const scenario = process.argv[2] ?? "notes-loading";
const outputPath = process.argv[3] ?? `/tmp/vault-${scenario}.png`;
const baseUrl = process.env.VAULT_RENDERER_URL ?? "http://127.0.0.1:5173/";

const scenarios = {
  "app-entry": async (page) => {
    await installEmptyVaultBridge(page);
    await page.goto(baseUrl, { waitUntil: "networkidle" });
  },
  "notes-loading": async (page) => {
    await openNotes(page);
  },
  "notes-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openNotes(page);
  },
  "storage-loading": async (page) => {
    await openStorage(page);
  },
  "storage-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openStorage(page);
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

const browser = await chromium.launch({ headless: true });
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

async function openStorage(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const storage = page.locator('.main-nav button[aria-label="Storage"]');
  if (await storage.count()) await storage.first().click();
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
        if (route === "learning.items") return [];
        if (route === "tools.list") return [];
        if (route === "ai.capabilities") return [];
        return [];
      },
      selectFiles: async () => []
    };
  });
}
