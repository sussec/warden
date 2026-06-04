import { session } from "./session";

// Single-flight token refresh: concurrent 401s share one in-flight refresh
// (port of the Angular interceptor's BehaviorSubject queue).
let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = session.getRefresh();
  if (!refreshToken) return null;
  try {
    // Raw fetch on purpose — must bypass the intercepted client to avoid loops.
    const res = await fetch("/api/refresh-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      session.clear();
      return null;
    }
    const data = (await res.json()) as {
      accessToken?: string | null;
      refreshToken?: string | null;
    };
    if (!data.accessToken) {
      session.clear();
      return null;
    }
    session.set(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    session.clear();
    return null;
  }
}

export function refreshOnce(): Promise<string | null> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}
