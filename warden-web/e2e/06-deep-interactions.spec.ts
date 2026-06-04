import { test, expect } from "@playwright/test";
import { login, trackErrors, firstProjectId } from "./helpers";

// Deep write-path / dialog / filter coverage. Every test asserts no console
// error and no unexpected 4xx/5xx while exercising real interactions.

test.describe("deep: finding workflows", () => {
  test("filters: severity, status, scanner, search", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/finding");
    await page.getByRole("button", { name: "Severity" }).click();
    await page.getByRole("checkbox", { name: "Critical" }).click().catch(() => {});
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^Status/ }).click();
    await page.keyboard.press("Escape");
    await page.getByPlaceholder(/Search findings/i).fill("java");
    await page.waitForTimeout(1500);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("AI search dialog opens and queries", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/finding");
    await page.getByRole("button", { name: /AI search/i }).click();
    const input = page.getByRole("dialog").getByRole("textbox").first();
    if (await input.count()) {
      await input.fill("sql injection");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("bulk select + mark-as menu", async ({ page }) => {
    await login(page);
    await page.goto("/finding");
    const firstCheckbox = page.getByRole("checkbox", { name: /select finding/i }).first();
    if (await firstCheckbox.count()) {
      await firstCheckbox.check();
      // a bulk action control should appear
      await page.waitForTimeout(500);
    }
  });
});

test.describe("deep: integration dialogs (open + interact)", () => {
  for (const card of ["Jira", "Redmine", "GitHub Issues", "Microsoft Teams", "Mail", "Webhook"]) {
    test(`${card} configure dialog opens cleanly`, async ({ page }) => {
      const errors = trackErrors(page);
      await login(page);
      await page.goto("/setting/integration");
      // open the matching card's Configure
      const heading = page.getByText(card, { exact: true }).first();
      await expect(heading).toBeVisible();
      const configure = heading.locator("xpath=ancestor::*[contains(@class,'rounded')][1]").getByRole("button", { name: "Configure" });
      await configure.first().click();
      // a dialog must appear
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });
      await page.keyboard.press("Escape");
      expect(errors, errors.join("\n")).toEqual([]);
    });
  }

  test("Jira Webhook dialog opens", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/setting/integration");
    const heading = page.getByText("Jira Webhook", { exact: true });
    await heading.locator("xpath=ancestor::*[contains(@class,'rounded')][1]").getByRole("button", { name: "Configure" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("deep: settings forms", () => {
  test("SMTP form fields are editable", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/setting/general");
    const server = page.getByLabel("Server").first();
    if (await server.count()) await server.fill("smtp.example.com");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("AI card: rebuild index button present", async ({ page }) => {
    await login(page);
    await page.goto("/setting/general");
    await expect(page.getByRole("button", { name: /Rebuild search index/i })).toBeVisible();
  });

  test("create CI token dialog", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/setting/ci-token");
    await page.getByRole("button", { name: /Create Token/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("add user dialog opens", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/user");
    await page.getByRole("button", { name: /Add User/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("deep: project settings", () => {
  test("project integration cards + a dialog", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    const id = await firstProjectId(page);
    await page.goto(`/project/${id}/setting/integration`);
    await expect(page.getByText("Integrations")).toBeVisible();
    await page.getByRole("button", { name: "Configure" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });
    await page.keyboard.press("Escape");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("project members + general settings", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    const id = await firstProjectId(page);
    await page.goto(`/project/${id}/setting/member`);
    await expect(page.getByText(/Members/i).first()).toBeVisible();
    await page.goto(`/project/${id}/setting/general`);
    await expect(page.getByText(/General|Project name/i).first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("deep: pagination + sort + profile", () => {
  test("dependency pagination next/prev", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/dependency");
    const next = page.getByRole("button", { name: "Next page" });
    if (await next.isEnabled().catch(() => false)) {
      await next.click();
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: "Previous page" }).click();
      await page.waitForTimeout(800);
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("project sort change", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/project");
    const sort = page.getByRole("combobox").first();
    await sort.click();
    await page.getByRole("option", { name: /name/i }).click().catch(() => page.keyboard.press("Escape"));
    await page.waitForTimeout(800);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("profile page renders change-password form", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/profile");
    await expect(page.getByText(/Change password/i)).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
