using Warden.Application.Module.Auth.Model;

namespace Warden.Api.Auth;

/// <summary>
/// httpOnly cookie session for the web app. Tokens are also returned in the
/// response body for header-based clients (CI, MCP, direct API use).
///  - warden_access / warden_refresh: httpOnly, SameSite=Strict
///  - warden_auth: non-httpOnly flag the SPA reads for "signed in" state
/// </summary>
public static class AuthCookies
{
    public const string Access = "warden_access";
    public const string Refresh = "warden_refresh";
    public const string AuthFlag = "warden_auth";

    private static readonly TimeSpan Lifetime = TimeSpan.FromDays(30); // refresh-token window

    public static void Append(HttpContext context, SignInResponse response)
    {
        if (string.IsNullOrEmpty(response.AccessToken)) return;
        var secure = context.Request.IsHttps;
        var expires = DateTimeOffset.UtcNow.Add(Lifetime);

        context.Response.Cookies.Append(Access, response.AccessToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = expires
        });
        if (!string.IsNullOrEmpty(response.RefreshToken))
            context.Response.Cookies.Append(Refresh, response.RefreshToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = secure,
                SameSite = SameSiteMode.Strict,
                Path = "/api",
                Expires = expires
            });
        context.Response.Cookies.Append(AuthFlag, "1", new CookieOptions
        {
            HttpOnly = false,
            Secure = secure,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = expires
        });
    }

    public static void Clear(HttpContext context)
    {
        context.Response.Cookies.Delete(Access, new CookieOptions { Path = "/" });
        context.Response.Cookies.Delete(Refresh, new CookieOptions { Path = "/api" });
        context.Response.Cookies.Delete(AuthFlag, new CookieOptions { Path = "/" });
    }
}
