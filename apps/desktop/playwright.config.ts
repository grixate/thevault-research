import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "pnpm dev:renderer",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    launchOptions: {
      executablePath: playwrightHeadlessShellPath(),
      chromiumSandbox: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
  }
});

function playwrightHeadlessShellPath() {
  if (process.env.PW_CHROMIUM_EXECUTABLE_PATH) {
    if (!fs.existsSync(process.env.PW_CHROMIUM_EXECUTABLE_PATH)) {
      throw new Error(`PW_CHROMIUM_EXECUTABLE_PATH does not exist: ${process.env.PW_CHROMIUM_EXECUTABLE_PATH}`);
    }
    return process.env.PW_CHROMIUM_EXECUTABLE_PATH;
  }
  const cacheRoot = process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== "0"
    ? process.env.PLAYWRIGHT_BROWSERS_PATH
    : path.join(os.homedir(), "Library", "Caches", "ms-playwright");
  if (!fs.existsSync(cacheRoot)) return undefined;
  const shellDirs = fs.readdirSync(cacheRoot)
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
  throw new Error(
    `Playwright Chrome Headless Shell was not found in ${cacheRoot}. Run "pnpm exec playwright install chromium" before browser QA.`
  );
}
