using Warden.Application.Module.Auth;
using Warden.Application.Module.Auth.Command;
using Warden.Application.Module.Auth.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Auth;

[ApiController]
[Produces("application/json")]
[Consumes("application/json")]
[AllowAnonymous]
public class AuthController(
    IAuthService authService
) : Controller
{
    [HttpGet]
    [Route("/api/auth-config")]
    public async Task<AuthConfig> GetAuthConfig()
    {
        return await authService.GetAuthConfigAsync();
    }

    [HttpPost]
    [Route("/api/login")]
    public async Task<SignInResponse> Login(SignInRequest request)
    {
        var response = await authService.PasswordSignInAsync(request);
        AuthCookies.Append(HttpContext, response); // httpOnly session for the web app
        return response;
    }

    [HttpPost]
    [Route("/api/refresh-token")]
    public async Task<SignInResponse> RefreshToken(RefreshTokenRequest request)
    {
        // header-based clients send the token in the body; the web app relies on the cookie
        request.RefreshToken ??= Request.Cookies[AuthCookies.Refresh];
        try
        {
            var response = await authService.RefreshTokenAsync(request);
            AuthCookies.Append(HttpContext, response);
            return response;
        }
        catch
        {
            AuthCookies.Clear(HttpContext);
            throw;
        }
    }

    [HttpPost]
    [Route("/api/logout")]
    public Task<bool> Logout(LogoutRequest request)
    {
        request.Token ??= Request.Cookies[AuthCookies.Refresh];
        AuthCookies.Clear(HttpContext);
        return authService.LogoutAsync(request);
    }

    [HttpPost]
    [Route("/api/forgot-password")]
    public async Task<bool> ForgotPassword(ForgotPasswordRequest request)
    {
        return await authService.ForgotPasswordAsync(request);
    }

    [HttpPost]
    [Route("/api/reset-password")]
    public Task<bool> ResetPassword(ResetPasswordRequest request)
    {
        return authService.ResetPasswordAsync(request);
    }

    [HttpPost]
    [Route("/api/confirm-email")]
    public async Task<bool> ConfirmEmail(ConfirmEmailRequest request)
    {
        return await authService.ConfirmEmailAsync(request);
    }
}