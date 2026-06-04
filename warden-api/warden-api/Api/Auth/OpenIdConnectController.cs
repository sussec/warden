using System.Security.Claims;
using Warden.Application;
using Warden.Application.Exceptions;
using Warden.Application.Module.Auth;
using Warden.Core.Extension;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Auth;

[Authorize(AuthenticationSchemes = OpenIdConnectDefaults.AuthenticationScheme)]
public class OpenIdConnectController(
    IAuthService authService,
    ILogger<OpenIdConnectController> logger) : ControllerBase
{
    [HttpGet]
    [Route("/api/login/oidc")]
    [Authorize]
    public async Task<IActionResult> LoginOidc()
    {
        var email = User.FindFirstValue("email") ?? User.FindFirstValue(ClaimTypes.Email);
        if (email == null)
        {
            logger.LogInformation("Not found email claim");
            email = User.FindFirstValue(ClaimTypes.Upn);
            if (email == null)
            {
                logger.LogInformation("Not found upn claim");
            }
        }

        if (email == null)
        {
            throw new BadRequestException(
                "Email and upn claim type not found. Please mapping the email to the email or upn attribute");
        }

        if (!email.IsEmail())
        {
            throw new BadRequestException("Email format invalid");
        }

        var result = await authService.OpenIdConnectSignInAsync(email);
        var queryParams = "oidc=true";
        if (!string.IsNullOrEmpty(result.Message)) queryParams += $"&message={result.Message}";
        if (result.AuthResponse != null)
            queryParams +=
                $"&accessToken={result.AuthResponse.AccessToken}&refreshToken={result.AuthResponse.RefreshToken}";
        // warden-web (Next.js) handles the SSO return at /auth/callback (no hash routing).
        // FRONTEND_URL may be a comma-separated allowlist (CORS); redirect targets the first entry.
        var baseUrl = Configuration.FrontendUrl.Split(',')[0].Trim().TrimEnd('/');
        var frontendUrl = $"{baseUrl}/auth/callback?{queryParams}";
        return Redirect(frontendUrl);
    }
}