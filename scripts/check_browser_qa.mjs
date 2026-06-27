import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { playwrightChromiumLaunchOptions, preparePlaywrightHeadlessShell } from "./lib/playwright_headless_shell.mjs";

const launchOptions = playwrightChromiumLaunchOptions();
const executablePath = launchOptions.executablePath;
const preparation = preparePlaywrightHeadlessShell(executablePath);
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
        preparation,
        gatekeeper: assessment,
        note:
          assessment.accepted === false
            ? "Direct headless launch works without approval prompts. Gatekeeper still rejects Playwright's ad-hoc cached binary for direct Finder-style execution, so keep browser QA on these repo scripts."
            : "Direct headless launch works without approval prompts and Gatekeeper assessment did not reject the binary."
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
