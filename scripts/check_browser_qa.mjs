import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const executablePath = playwrightHeadlessShellPath();
const assessment = assessExecutable(executablePath);

const browser = await chromium.launch({
  headless: true,
  executablePath,
  chromiumSandbox: false,
  args: ["--no-sandbox", "--disable-setuid-sandbox"]
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

function playwrightHeadlessShellPath() {
  if (process.env.PW_CHROMIUM_EXECUTABLE_PATH) {
    if (!fs.existsSync(process.env.PW_CHROMIUM_EXECUTABLE_PATH)) {
      throw new Error(`PW_CHROMIUM_EXECUTABLE_PATH does not exist: ${process.env.PW_CHROMIUM_EXECUTABLE_PATH}`);
    }
    return process.env.PW_CHROMIUM_EXECUTABLE_PATH;
  }
  const cacheRoot =
    process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== "0"
      ? process.env.PLAYWRIGHT_BROWSERS_PATH
      : path.join(os.homedir(), "Library", "Caches", "ms-playwright");
  if (!fs.existsSync(cacheRoot)) {
    throw new Error(`Playwright browser cache was not found at ${cacheRoot}. Run "pnpm exec playwright install chromium".`);
  }
  const shellDirs = fs
    .readdirSync(cacheRoot)
    .filter((entry) => entry.startsWith("chromium_headless_shell-"))
    .sort()
    .reverse();
  for (const dir of shellDirs) {
    const absoluteDir = path.join(cacheRoot, dir);
    const candidates = [
      path.join(absoluteDir, "chrome-headless-shell-mac-arm64", "chrome-headless-shell"),
      path.join(absoluteDir, "chrome-headless-shell-mac-x64", "chrome-headless-shell"),
      path.join(absoluteDir, "chrome-linux", "headless_shell"),
      path.join(absoluteDir, "chrome-linux", "chrome-headless-shell"),
      path.join(absoluteDir, "chrome-win", "headless_shell.exe"),
      path.join(absoluteDir, "chrome-win", "chrome-headless-shell.exe")
    ];
    const executable = candidates.find((candidate) => fs.existsSync(candidate));
    if (executable) return executable;
  }
  throw new Error(`Playwright Chrome Headless Shell was not found in ${cacheRoot}. Run "pnpm exec playwright install chromium".`);
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
