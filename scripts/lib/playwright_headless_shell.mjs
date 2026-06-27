import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HEADLESS_SHELL_NAMES = [
  ["chrome-headless-shell-mac-arm64", "chrome-headless-shell"],
  ["chrome-headless-shell-mac-x64", "chrome-headless-shell"],
  ["chrome-linux", "headless_shell"],
  ["chrome-linux", "chrome-headless-shell"],
  ["chrome-win", "headless_shell.exe"],
  ["chrome-win", "chrome-headless-shell.exe"]
];

export function playwrightChromiumLaunchOptions() {
  return {
    executablePath: playwrightHeadlessShellPath(),
    chromiumSandbox: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  };
}

export function playwrightHeadlessShellPath() {
  if (process.env.PW_CHROMIUM_EXECUTABLE_PATH) {
    return requireExecutable(process.env.PW_CHROMIUM_EXECUTABLE_PATH, "PW_CHROMIUM_EXECUTABLE_PATH");
  }

  const cacheRoot = playwrightBrowserCacheRoot();
  if (!fs.existsSync(cacheRoot)) {
    throw new Error(
      `Playwright browser cache was not found at ${cacheRoot}. Run "pnpm exec playwright install chromium" before browser QA.`
    );
  }

  const shellDirs = fs
    .readdirSync(cacheRoot)
    .filter((entry) => entry.startsWith("chromium_headless_shell-"))
    .sort()
    .reverse();

  for (const dir of shellDirs) {
    const absoluteDir = path.join(cacheRoot, dir);
    for (const [subdir, file] of HEADLESS_SHELL_NAMES) {
      const executable = path.join(absoluteDir, subdir, file);
      if (fs.existsSync(executable)) return executable;
    }
  }

  throw new Error(
    `Playwright Chrome Headless Shell was not found in ${cacheRoot}. Run "pnpm exec playwright install chromium" before browser QA.`
  );
}

function playwrightBrowserCacheRoot() {
  return process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== "0"
    ? process.env.PLAYWRIGHT_BROWSERS_PATH
    : path.join(os.homedir(), "Library", "Caches", "ms-playwright");
}

function requireExecutable(executablePath, envName) {
  if (!fs.existsSync(executablePath)) {
    throw new Error(`${envName} does not exist: ${executablePath}`);
  }
  return executablePath;
}
