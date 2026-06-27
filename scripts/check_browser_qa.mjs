import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { playwrightChromiumLaunchOptions } from "./lib/playwright_headless_shell.mjs";

const launchOptions = playwrightChromiumLaunchOptions();
const executablePath = launchOptions.executablePath;
const assessment = assessExecutable(executablePath);

const browser = await chromium.launch({
  headless: true,
  ...launchOptions
});

try {
  const page = await browser.newPage();
  await page.goto("data:text/html,<title>vault-browser-qa</title><main>ok</main>");
  const text = await page.locator("main").innerText({ timeout: 3000 });
  console.log(
    JSON.stringify(
      {
        ok: text === "ok",
        executablePath,
        gatekeeper: assessment,
        note:
          assessment.accepted === false
            ? "Direct headless launch works, but macOS Gatekeeper assessment rejects this Playwright-managed binary. Keep using repo QA scripts so regular Chromium fallback never runs."
            : "Direct headless launch works and Gatekeeper assessment did not reject the binary."
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}

function assessExecutable(executablePath) {
  try {
    const stdout = execFileSync("spctl", ["--assess", "--type", "execute", "--verbose=4", executablePath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { accepted: true, output: stdout.trim() };
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join("").trim();
    return { accepted: false, output };
  }
}
