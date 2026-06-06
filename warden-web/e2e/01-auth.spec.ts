import { test, expect } from "@playwright/test";
import { login, trackErrors } from "./helpers";

test.describe("auth", () => {
  test("rejects bad credentials", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("textbox", { name: "Email" }).fill("system");
    await page.getByRole("textbox", { name: "Password" }).fill("definitely-wrong");
    await page.getByRole("button", { name: "Sign In" }).click();
    // must NOT reach dashboard
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/auth/login");
  });

  test("logs in and reaches dashboard", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await expect(page.getByRole("heading", { name: /Security Overview/i })).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("unauthenticated access redirects to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/finding");
    await page.waitForURL("**/auth/login**", { timeout: 10_000 });
    expect(page.url()).toContain("/auth/login");
  });

  test("logout returns to login", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "Profile menu" }).click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await page.waitForURL("**/auth/login", { timeout: 10_000 });
  });
});
