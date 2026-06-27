import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HEADLESS_SHELL_NAMES = [
  ["chrome-headless-shell-mac-arm64", "chrome-headless-shell"],
  ["chrome-headless-shell-mac-x64", "chrome-headless-shell"],
  ["chrome-linux", "headless_shell"],
  ["chrome-linux", "chrome-headless-shell"],
  ["chrome-win", "headless_shell.exe"],
  ["chrome-win", "chrome-headless-shell.exe"]
];

const HEADLESS_SHELL_EXECUTABLE_NAMES = new Set(HEADLESS_SHELL_NAMES.map(([, file]) => file));

export function playwrightChromiumLaunchOptions() {
  const executablePath = playwrightHeadlessShellPath();
  preparePlaywrightHeadlessShell(executablePath);

  return {
    executablePath,
    chromiumSandbox: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-features=DialMediaRouteProvider,HardwareMediaKeyHandling",
      "--use-fake-ui-for-media-stream",
      "--use-mock-keychain",
      "--password-store=basic"
    ]
  };
}

export function playwrightHeadlessShellPath() {
  if (process.env.PW_CHROMIUM_EXECUTABLE_PATH) {
    return requireHeadlessShellExecutable(process.env.PW_CHROMIUM_EXECUTABLE_PATH, "PW_CHROMIUM_EXECUTABLE_PATH");
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

function requireHeadlessShellExecutable(executablePath, envName) {
  const resolved = requireExecutable(executablePath, envName);
  if (process.env.VAULT_BROWSER_QA_ALLOW_CUSTOM_CHROMIUM === "1") return resolved;

  if (!HEADLESS_SHELL_EXECUTABLE_NAMES.has(path.basename(resolved))) {
    throw new Error(
      `${envName} must point to Playwright Chrome Headless Shell for unattended browser QA: ${resolved}. ` +
        "Unset it to use the repo resolver, or set VAULT_BROWSER_QA_ALLOW_CUSTOM_CHROMIUM=1 to opt into a custom browser."
    );
  }

  return resolved;
}

export function preparePlaywrightHeadlessShell(executablePath = playwrightHeadlessShellPath()) {
  if (process.platform !== "darwin" || process.env.VAULT_BROWSER_QA_REPAIR === "0") return { prepared: false };

  const browserRoot = findBrowserRoot(executablePath);
  if (!browserRoot) return { prepared: false };

  try {
    execFileSync("xattr", ["-dr", "com.apple.quarantine", browserRoot], { stdio: "ignore" });
    return { prepared: true, browserRoot };
  } catch (error) {
    return { prepared: false, browserRoot, error: error instanceof Error ? error.message : String(error) };
  }
}

function findBrowserRoot(executablePath) {
  let current = path.dirname(executablePath);
  const cacheRoot = playwrightBrowserCacheRoot();
  while (current.startsWith(cacheRoot)) {
    if (path.basename(current).startsWith("chromium_headless_shell-")) return current;
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
  return null;
}
