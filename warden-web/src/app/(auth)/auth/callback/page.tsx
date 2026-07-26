import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SSO_RETURN_COOKIE } from "@/lib/auth/sso";

function safeReturnUrl(raw: string | undefined): string {
  if (!raw) return "/dashboard";
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return "/dashboard";
  }
  if (value.startsWith("/auth/")) return "/dashboard";
  return value;
}

/**
 * OIDC return target (server component).
 * The API redirects here after OpenIdConnectSignInAsync with:
 *   ?oidc=true[&message=…]
 * Session cookies (warden_access / warden_auth) are already set httpOnly.
 */
export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ oidc?: string; message?: string }>;
}) {
  const params = await searchParams;
  const jar = await cookies();
  const returnUrl = safeReturnUrl(jar.get(SSO_RETURN_COOKIE)?.value);

  if (params.message) {
    redirect(`/auth/login?error=${encodeURIComponent(params.message)}`);
  }

  // Authenticated via httpOnly cookies — send user to the pre-SSO destination.
  redirect(returnUrl);
}
