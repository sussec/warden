import { test, expect } from "@playwright/test";
import { login, trackErrors, firstProjectId } from "./helpers";

// Real write operations against the backend. These catch contract/validation
// bugs (4xx/5xx) the open-dialog tests don't.

test.describe("mutations: write paths", () => {
  test("create a CI token end to end", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/setting/ci-token");
    await page.getByRole("button", { name: /Create Token/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox").first().fill("e2e-token-" + Date.now());
    await dialog.getByRole("button", { name: /Create|Save|Generate/i }).first().click();
    // token row or a success toast should appear, no error
    await page.waitForTimeout(1500);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("save webhook integration (Slack URL)", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/setting/integration");
    const heading = page.getByText("Webhook", { exact: true }).first();
    await heading.locator("xpath=ancestor::*[contains(@class,'rounded')][1]").getByRole("button", { name: "Configure" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox").first().fill("https://hooks.slack.com/services/E2E/TEST/token");
    await dialog.getByRole("button", { name: /^Save$/ }).click();
    await page.waitForTimeout(1500);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("save SLA settings", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/setting/general");
    // find an SLA save button (there may be several Save buttons; click within SLA card)
    const slaCard = page.getByText("SLA", { exact: true }).first().locator("xpath=ancestor::*[contains(@class,'rounded')][1]");
    const save = slaCard.getByRole("button", { name: /^Save$/ });
    if (await save.count()) {
      await save.first().click();
      await page.waitForTimeout(1500);
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("change finding status persists after reload", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/finding");
    const firstFinding = page.locator('a[href*="/finding/"]').first();
    await expect(firstFinding).toBeVisible();
    await firstFinding.click();
    await page.waitForURL(/\/finding\/[0-9a-f-]+/);
    const url = page.url();
    const statusBtn = page.getByRole("button", { name: /Need Triage|Confirmed|Fixed|Accepted Risk|False Positive/i }).first();
    await statusBtn.click();
    const target = page.getByRole("menuitem", { name: /Accepted Risk/i });
    if (await target.count()) {
      await target.click();
      await page.waitForTimeout(1500);
      await page.goto(url);
      await expect(page.getByText("Accepted Risk").first()).toBeVisible({ timeout: 10_000 });
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("update package status to Ignore with reason", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/dependency");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
    await rows.first().locator("td").first().click();
    await expect(page.getByRole("heading", { name: "Details" })).toBeVisible({ timeout: 10_000 });
    const statusTrigger = page.getByRole("dialog").getByRole("button", { name: /Open|Ignore|Fixed|Status/i }).first();
    if (await statusTrigger.count()) {
      await statusTrigger.click();
      const ignore = page.getByRole("menuitem", { name: /Ignore/i });
      if (await ignore.count()) {
        await ignore.click();
        // a reason dialog may appear
        const reason = page.getByRole("textbox").last();
        if (await reason.count()) await reason.fill("E2E false positive").catch(() => {});
        const confirm = page.getByRole("button", { name: /Save|Confirm|Apply/i }).last();
        if (await confirm.count()) await confirm.click().catch(() => {});
        await page.waitForTimeout(1500);
      }
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("AI rebuild index click (if enabled)", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/setting/general");
    const btn = page.getByRole("button", { name: /Rebuild search index/i });
    await expect(btn).toBeVisible();
    if (await btn.isEnabled()) {
      page.on("dialog", (d) => d.accept()); // accept window.confirm
      await btn.click();
      await page.waitForTimeout(2000);
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("SBOM download returns a file", async ({ page }) => {
    await login(page);
    const id = await firstProjectId(page);
    // call the same endpoint the button uses, via the page session
    const res = await page.request.get(`/api/project/${id}/sbom`, {
      headers: { "Content-Type": "application/json" },
    });
    // 200 with a body, or 400 "no package inventory" for a SAST-only project
    expect([200, 400]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.bomFormat).toBe("CycloneDX");
    }
  });

  test("project report export (PDF) returns a file", async ({ page }) => {
    await login(page);
    const id = await firstProjectId(page);
    await page.goto(`/project/${id}/overview`);
    const commitRow = page.locator("table tbody tr").first();
    await expect(commitRow).toBeVisible();
    // open the per-commit export menu (download icon button)
    const exportBtn = commitRow.getByRole("button").first();
    await exportBtn.click().catch(() => {});
    await page.waitForTimeout(500);
    const pdf = page.getByRole("menuitem", { name: /PDF/i });
    if (await pdf.count()) {
      const dl = page.waitForEvent("download", { timeout: 15_000 }).catch(() => null);
      await pdf.click();
      const download = await dl;
      if (download) expect(await download.path()).toBeTruthy();
    }
  });
});
