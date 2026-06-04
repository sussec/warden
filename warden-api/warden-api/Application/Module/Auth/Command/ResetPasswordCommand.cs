using Warden.Application.Module.Auth.Model;
using Warden.Authentication.Jwt;
using FluentResults;

namespace Warden.Application.Module.Auth.Command;

public class ResetPasswordCommand(JwtUserManager userManager)
{
    public async Task<Result<bool>> ExecuteAsync(ResetPasswordRequest request)
    {
        var user = await userManager.FindByEmailAsync(request.Username) ??
                   await userManager.FindByNameAsync(request.Username);
        if (user == null)
        {
            return Result.Fail("Invalid username");
        }

        var result = await userManager.ResetPasswordAsync(user, request.Token, request.Password);
        if (!result.Succeeded)
        {
            return Result.Fail(result.Errors.First().Description);
        }

        return true;
    }
}