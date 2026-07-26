import { NextRequest, NextResponse } from "next/server";
import { SSO_RETURN_COOKIE } from "@/lib/auth/sso";

/**
 * Next.js-native SSO entrypoint (App Router Route Handler).
 *
 * Lives under /auth/sso (not /api/*) so next.config rewrites to the API
 * never intercept this handler.
 *
 * Flow (same-origin BFF):
 *  1. Login UI → GET /auth/sso?returnUrl=/dashboard
 *  2. Store safe return path cookie, redirect → /api/login/oidc (API challenge)
 *  3. IdP → /auth/oidc/callback (rewritten to API OpenIdConnect middleware)
 *  4. API sets session cookies, redirects → /auth/callback
 *  5. /auth/callback (server) reads return cookie and lands in-app
 *
 * Configure IdP in Setting → Authentication.
 * Register redirect URI: {public-origin}/auth/oidc/callback
 */

const RETURN_MAX_AGE = 60 * 10;

function safeReturnUrl(raw: string | null): string {
  if (!raw) return "/dashboard";
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return "/dashboard";
  }
  if (value.startsWith("/auth/")) return "/dashboard";
  return value;
}

export async function GET(request: NextRequest) {
  const returnUrl = safeReturnUrl(request.nextUrl.searchParams.get("returnUrl"));
  const oidcStart = new URL("/api/login/oidc", request.nextUrl.origin);
  const response = NextResponse.redirect(oidcStart, 302);

  response.cookies.set(SSO_RETURN_COOKIE, returnUrl, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: RETURN_MAX_AGE,
  });

  return response;
}
