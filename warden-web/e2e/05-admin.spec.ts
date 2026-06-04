import { test, expect } from "@playwright/test";
import { login, trackErrors } from "./helpers";

test.describe("admin", () => {
  test("integration page shows all 7 cards", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/setting/integration");
    for (const name of ["Jira", "Jira Webhook", "Redmine", "GitHub Issues", "Microsoft Teams", "Mail", "Webhook"]) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("webhook configure dialog opens", async ({ page }) => {
    await login(page);
    await page.goto("/setting/integration");
    // Webhook is the last card; its Configure is the last Configure button
    await page.getByRole("button", { name: "Configure" }).last().click();
    await expect(page.getByText("Webhook Configuration")).toBeVisible();
    await expect(page.getByText("Format")).toBeVisible();
  });

  test("user manager lists users", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/user");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByText("system", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Add User/i })).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("rules and ci-token pages load", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto("/rule");
    await expect(page.getByRole("heading", { name: "Rules" })).toBeVisible();
    await page.goto("/setting/ci-token");
    await expect(page.getByRole("heading", { name: /CI Tokens?/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Create Token/i })).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("general settings cards render", async ({ page }) => {
    await login(page);
    await page.goto("/setting/general");
    for (const name of ["SMTP", "Authentication", "SLA", "AI"]) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
  });
});
