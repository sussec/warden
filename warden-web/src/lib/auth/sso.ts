/** Cookie set by GET /auth/sso before the OIDC round-trip. */
export const SSO_RETURN_COOKIE = "warden_sso_return";

/**
 * Build the Next.js SSO start URL.
 * Prefer this over linking /api/login/oidc directly so returnUrl survives the IdP hop.
 */
export function ssoStartUrl(returnUrl?: string | null): string {
  const params = new URLSearchParams();
  const safe =
    returnUrl &&
    returnUrl.startsWith("/") &&
    !returnUrl.startsWith("//") &&
    !returnUrl.includes("://") &&
    !returnUrl.startsWith("/auth/")
      ? returnUrl
      : "/dashboard";
  params.set("returnUrl", safe);
  return `/auth/sso?${params.toString()}`;
}
