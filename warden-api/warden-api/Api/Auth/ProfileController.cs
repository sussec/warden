using Warden.Application.Module.Auth;
using Warden.Application.Module.Auth.Model;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Auth;

public class ProfileController(IAuthService authService) : BaseController
{
    [HttpGet]
    public Task<UserProfile> GetProfile()
    {
        return authService.GetUserProfileAsync(CurrentUser.Id);
    }

    [HttpPost("change-password")]
    public Task<bool> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        return authService.ChangePasswordAsync(CurrentUser.Id, request);
    }
}