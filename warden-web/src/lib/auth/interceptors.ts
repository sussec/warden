"use client";

import { toast } from "sonner";
import { client } from "@/client/client.gen";
import { refreshOnce } from "./refresh";
import { session } from "./session";

// Cookie-based auth (httpOnly) — the browser attaches the session cookies on
// same-origin requests, so no Authorization header is needed here.
//  - 401 → single-flight refresh, retry original request once, else login redirect
//  - 400 → surface API error messages as toasts
let installed = false;

function redirectToLogin() {
  const returnUrl = encodeURIComponent(
    window.location.pathname + window.location.search,
  );
  window.location.href = `/auth/login?returnUrl=${returnUrl}`;
}

export function installAuthInterceptors() {
  if (installed) return;
  installed = true;

  client.interceptors.response.use(async (response, request) => {
    if (response.status === 401 && !request.url.includes("/refresh-token")) {
      const refreshed = await refreshOnce();
      if (refreshed) {
        return fetch(new Request(request, { headers: new Headers(request.headers) }));
      }
      session.clear();
      if (!window.location.pathname.startsWith("/auth")) redirectToLogin();
      return response;
    }

    if (response.status === 400) {
      try {
        const body = await response.clone().json();
        const messages: string[] = Array.isArray(body?.errors)
          ? body.errors
          : body?.message
            ? [body.message]
            : [];
        messages.forEach((m) => toast.error(m));
      } catch {
        /* non-JSON 400 — let the caller handle it */
      }
    }

    return response;
  });
}
