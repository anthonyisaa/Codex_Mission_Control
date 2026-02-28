import { test, expect } from "@playwright/test";

test("incident board loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Incident Triage Board" })).toBeVisible();
});
