import { test, expect } from "@playwright/test";

test("renderer opens to Notes", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173");
  await expect(page.getByText("The Vault")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Notes", level: 1 })).toBeVisible();
  await expect(page.locator('.main-nav button[aria-label="Notes"]')).toHaveClass(/active/);
});
