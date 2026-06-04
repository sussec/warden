using Warden.Application.Module.Auth.Model;
using Warden.Application.Module.Setting;
using Warden.Authentication.Jwt;
using Warden.Core.Entity;
using Warden.Core.Enum;
using FluentResults;
using Microsoft.AspNetCore.Identity;

namespace Warden.Application.Module.Auth.Command;

public class PasswordSignInCommand(
    AppDbContext context,
    JwtUserManager userManager,
    SignInManager<Users> signInManager) 
{
    public async Task<Result<SignInResponse>> ExecuteAsync(SignInRequest request)
    {
        if ((await context.GetAuthSettingAsync()).DisablePasswordLogon)
        {
            return Result.Fail("The admin disabled password logon");
        }

        var user = await userManager.FindByNameAsync(request.UserName) ??
                   await userManager.FindByEmailAsync(request.UserName);
        if (user == null)
        {
            return Result.Fail("Invalid username or password");
        }

        if (user.Status != UserStatus.Active)
        {
            return Result.Fail("The user was disabled");
        }

        var result = await signInManager.PasswordSignInAsync(user, request.Password, true, true);
        if (result.Succeeded)
        {
            return new SignInResponse
            {
                AccessToken = userManager.GenerateAccessToken(user),
                RefreshToken = userManager.GenerateRefreshToken(user)
            };
        }

        if (result.RequiresTwoFactor)
        {
            return SignInResponse.NeedTwoFactor;
        }

        if (result.IsNotAllowed)
        {
            return SignInResponse.NeedConfirmEmail;
        }

        return Result.Fail(result.IsLockedOut ? "The account was locked out" : "Invalid username or password");
    }
}