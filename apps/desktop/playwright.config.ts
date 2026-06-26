import { defineConfig } from "@playwright/test";

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
      chromiumSandbox: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
  }
});
