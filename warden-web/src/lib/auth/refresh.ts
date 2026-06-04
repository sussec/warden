import { session } from "./session";

// Single-flight token refresh: concurrent 401s share one in-flight refresh.
// The refresh token travels in the warden_refresh httpOnly cookie; the API
// rotates both cookies on success.
let refreshing: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch("/api/refresh-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      session.clear();
      return false;
    }
    return true;
  } catch {
    session.clear();
    return false;
  }
}

export function refreshOnce(): Promise<boolean> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}
