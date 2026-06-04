import { request } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:8080";

/**
 * Fail fast with a clear message if the compose stack isn't reachable, instead
 * of every test timing out. The suite runs against the running stack:
 *   docker compose up -d --build   (web :8080, api :5272, db :54321)
 */
export default async function globalSetup() {
  const ctx = await request.newContext();
  const deadline = Date.now() + 30_000;
  let lastErr = "";
  while (Date.now() < deadline) {
    try {
      const res = await ctx.get(`${BASE}/auth/login`, { timeout: 5_000 });
      if (res.status() < 500) {
        await ctx.dispose();
        return;
      }
      lastErr = `status ${res.status()}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 1_500));
  }
  await ctx.dispose();
  throw new Error(
    `Warden web is not reachable at ${BASE} (${lastErr}).\n` +
      `Start the stack first:  docker compose up -d --build\n` +
      `Or set BASE_URL to a running instance.`,
  );
}
