// Cookie-based session (v2): tokens live in httpOnly cookies set by the API
// (warden_access / warden_refresh). The browser sends them automatically on
// same-origin requests. The SPA only reads the non-httpOnly warden_auth flag
// for "signed in" state — tokens are never accessible to JS.

const AUTH_FLAG = "warden_auth";

const isBrowser = () => typeof window !== "undefined";

export const session = {
  isAuthenticated(): boolean {
    if (!isBrowser()) return false;
    return document.cookie.split("; ").some((c) => c.startsWith(`${AUTH_FLAG}=`));
  },
  /** Local best-effort clear; the API clears the httpOnly cookies on logout. */
  clear() {
    if (!isBrowser()) return;
    document.cookie = `${AUTH_FLAG}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  },
};
