using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace Warden.Authentication.OpenIdConnect;

public class OpenIdConnectSetting
{
    public string DisplayName { get; set; } = "Open ID Connect";
    public string Authority { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public bool Enable { get; set; } = false;
    /// <summary>
    /// Override the scheme used in the redirect_uri sent to the OIDC provider (e.g. "https").
    /// Useful when running behind a reverse proxy that terminates TLS.
    /// </summary>
    public string SchemeOverride { get; set; } = string.Empty;

    public OpenIdConnectOptions ToOpenIdConnectOptions()
    {
        var options = new OpenIdConnectOptions
        {
            Authority = Authority,
            ClientId = ClientId,
            ClientSecret = ClientSecret,
            // Public path on the same origin as the web UI (Next.js rewrites this to the API).
            CallbackPath = "/auth/oidc/callback",
            RequireHttpsMetadata = false,
            ResponseType = OpenIdConnectResponseType.Code,
            SaveTokens = true,
            GetClaimsFromUserInfoEndpoint = true,
            Scope = { OpenIdConnectScope.OpenIdProfile, OpenIdConnectScope.Email },
            TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateLifetime = true
            }
        };

        // IdP redirect is a cross-site top-level navigation — Strict cookies would
        // drop correlation/nonce state and break the code exchange.
        options.CorrelationCookie.SameSite = SameSiteMode.Lax;
        options.NonceCookie.SameSite = SameSiteMode.Lax;
        options.CorrelationCookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.NonceCookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;

        return options;
    }
}