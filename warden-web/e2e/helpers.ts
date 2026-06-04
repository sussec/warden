import { Page, expect } from "@playwright/test";

export const USER = process.env.WARDEN_USER ?? "system";
export const PASSWORD = process.env.WARDEN_PASSWORD ?? "ChangeMe_L0cal!";

/** Log in through the real login form and land on the dashboard. */
export async function login(page: Page) {
  await page.goto("/auth/login");
  await page.getByRole("textbox", { name: "Email" }).fill(USER);
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

/** Fail the test if the browser logged any console error or a request 5xx'd. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 500) errors.push(`http ${r.status()}: ${r.url()}`);
  });
  return errors;
}

/** Navigate to the first project's overview, return its id. */
export async function openFirstProject(page: Page): Promise<string> {
  await page.goto("/project");
  const firstLink = page.locator('a[href*="/project/"][href*="/overview"]').first();
  await expect(firstLink).toBeVisible();
  const href = await firstLink.getAttribute("href");
  await firstLink.click();
  await page.waitForURL("**/overview");
  return href?.match(/project\/([^/]+)\//)?.[1] ?? "";
}
