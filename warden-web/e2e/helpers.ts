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

/**
 * Track browser console errors, uncaught page errors, and failing responses.
 * Ignores the expected 401 on token refresh and benign noise.
 */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  const ignore = (url: string, status?: number) =>
    // 401 on refresh-token is the normal "no session yet" path
    (status === 401 && url.includes("/refresh-token")) ||
    url.includes("/_next/") ||
    url.includes("favicon");

  page.on("console", (m) => {
    if (m.type() === "error") {
      const t = m.text();
      if (!t.includes("Failed to load resource") && !t.includes("401")) {
        errors.push(`console: ${t}`);
      }
    }
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    const s = r.status();
    if (s >= 400 && !ignore(r.url(), s)) {
      errors.push(`http ${s}: ${r.request().method()} ${new URL(r.url()).pathname}`);
    }
  });
  return errors;
}

/** First project's id via its overview link (no navigation). */
export async function firstProjectId(page: Page): Promise<string> {
  await page.goto("/project");
  const link = page.locator('a[href*="/project/"][href*="/overview"]').first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  return href?.match(/project\/([^/]+)\//)?.[1] ?? "";
}

/** Open the first project's overview and return its id. */
export async function openFirstProject(page: Page): Promise<string> {
  const id = await firstProjectId(page);
  await page.goto(`/project/${id}/overview`);
  await page.waitForURL("**/overview");
  return id;
}
