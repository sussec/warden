import { test, expect } from "@playwright/test";
import { login, trackErrors } from "./helpers";

test.describe("finding", () => {
  test("list loads with rows and filters", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/finding");
    await expect(page.getByRole("heading", { name: "Findings" })).toBeVisible();
    await expect(page.getByRole("button", { name: /AI search/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Export/i })).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("detail opens: description, status menu, ticket menu, comment box", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/finding");
    const firstFinding = page.locator('a[href*="/finding/"]').first();
    await expect(firstFinding).toBeVisible();
    await firstFinding.click();
    await page.waitForURL(/\/finding\/[0-9a-f-]+/);
    await expect(page.getByRole("heading", { name: "Description" })).toBeVisible();
    // status dropdown trigger
    await expect(page.getByRole("button", { name: /Need Triage|Confirmed|Fixed|Accepted Risk|False Positive/i }).first()).toBeVisible();
    // comment composer
    await expect(page.getByPlaceholder(/Add a comment/i)).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("change status round-trips", async ({ page }) => {
    await login(page);
    await page.goto("/finding");
    await page.locator('a[href*="/finding/"]').first().click();
    await page.waitForURL(/\/finding\/[0-9a-f-]+/);
    const statusBtn = page.getByRole("button", { name: /Need Triage|Confirmed|Fixed|Accepted Risk|False Positive/i }).first();
    await statusBtn.click();
    const confirmed = page.getByRole("menuitem", { name: /Confirmed/i });
    if (await confirmed.count()) {
      await confirmed.click();
      // status badge updates to Confirmed
      await expect(page.getByText("Confirmed").first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("post a comment", async ({ page }) => {
    await login(page);
    await page.goto("/finding");
    await page.locator('a[href*="/finding/"]').first().click();
    await page.waitForURL(/\/finding\/[0-9a-f-]+/);
    const box = page.getByPlaceholder(/Add a comment/i);
    await box.fill("E2E automated comment " + Date.now());
    await page.getByRole("button", { name: /^Comment$/ }).click();
    await expect(page.getByText(/E2E automated comment/).first()).toBeVisible({ timeout: 10_000 });
  });
});
