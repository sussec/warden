// Token session storage — parity with the Angular app (localStorage JWTs).
// v2 follow-up: migrate to httpOnly cookies (requires API changes).

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

const isBrowser = () => typeof window !== "undefined";

export const session = {
  getAccess(): string | null {
    return isBrowser() ? localStorage.getItem(ACCESS_KEY) : null;
  },
  getRefresh(): string | null {
    return isBrowser() ? localStorage.getItem(REFRESH_KEY) : null;
  },
  set(accessToken: string, refreshToken?: string | null) {
    if (!isBrowser()) return;
    localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    if (!isBrowser()) return;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
  isAuthenticated(): boolean {
    return !!session.getAccess();
  },
};
