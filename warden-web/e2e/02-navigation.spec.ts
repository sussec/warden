import { test, expect } from "@playwright/test";
import { login, trackErrors } from "./helpers";

// Every top-level route must load with no console error / 5xx and no error screen.
const ROUTES = [
  "/dashboard",
  "/project",
  "/finding",
  "/dependency",
  "/scanner",
  "/rule",
  "/user",
  "/setting/general",
  "/setting/ci-token",
  "/setting/integration",
  "/profile",
];

test.describe("navigation", () => {
  test("all primary routes load cleanly", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    for (const route of ROUTES) {
      await page.goto(route);
      // not crashed into the Next error boundary
      await expect(page.getByText("This page couldn't load")).toHaveCount(0);
      // sidebar present = app shell rendered
      await expect(page.getByText("APPLICATION", { exact: true })).toBeVisible();
    }
    expect(errors, "errors across routes:\n" + errors.join("\n")).toEqual([]);
  });

  test("dark mode toggle persists", async ({ page }) => {
    await login(page);
    const html = page.locator("html");
    const before = await html.getAttribute("class");
    await page.getByRole("button", { name: "Toggle dark mode" }).click();
    await page.waitForTimeout(500);
    const after = await html.getAttribute("class");
    expect(before).not.toEqual(after);
  });
});
