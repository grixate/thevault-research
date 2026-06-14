import { test, expect } from "@playwright/test";

test("renderer shows dashboard", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173");
  await expect(page.getByText("The Vault")).toBeVisible();
});
