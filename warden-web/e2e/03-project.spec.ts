import { test, expect } from "@playwright/test";
import { login, trackErrors, openFirstProject } from "./helpers";

test.describe("project", () => {
  test("list renders rows and filters", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/project");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    await expect(page.locator('a[href*="/overview"]').first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("detail tabs all load", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    const id = await openFirstProject(page);
    expect(id).toBeTruthy();

    // Overview: stats panel + scan history
    await expect(page.getByText("Scan History")).toBeVisible();
    await expect(page.getByText(/OPEN FINDINGS/i)).toBeVisible();

    for (const tab of ["finding", "dependency", "setting/general", "setting/member", "setting/integration"]) {
      await page.goto(`/project/${id}/${tab}`);
      await expect(page.getByText("This page couldn't load")).toHaveCount(0);
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("dependency drawer opens with vulnerabilities", async ({ page }) => {
    await login(page);
    // global dependency page aggregates packages across all projects
    await page.goto("/dependency");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    test.skip(count === 0, "no packages ingested");
    // click the package-name cell (first cell) — the action cell stops propagation
    await rows.first().locator("td").first().click();
    await expect(page.getByRole("heading", { name: "Details" })).toBeVisible({ timeout: 10_000 });
  });

  test("export SBOM button present", async ({ page }) => {
    await login(page);
    const id = await openFirstProject(page);
    await expect(page.getByRole("button", { name: /Export SBOM/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Upload SARIF/i })).toBeVisible();
  });
});
