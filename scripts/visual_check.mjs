import { chromium } from "@playwright/test";

const scenario = process.argv[2] ?? "notes-loading";
const outputPath = process.argv[3] ?? `/tmp/vault-${scenario}.png`;
const baseUrl = process.env.VAULT_RENDERER_URL ?? "http://127.0.0.1:5173/";

const scenarios = {
  "notes-loading": async (page) => {
    await openNotes(page);
  },
  "notes-empty": async (page) => {
    await installEmptyVaultBridge(page);
    await openNotes(page);
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
        if (route === "ai.capabilities") return [];
        return [];
      },
      selectFiles: async () => []
    };
  });
}
