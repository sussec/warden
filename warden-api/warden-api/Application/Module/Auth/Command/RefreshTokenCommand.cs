using Warden.Application.Module.Auth.Model;
using Warden.Authentication.Jwt;
using FluentResults;

namespace Warden.Application.Module.Auth.Command;

public class RefreshTokenCommand(JwtUserManager userManager)
{
    public async Task<Result<SignInResponse>> ExecuteAsync(RefreshTokenRequest request)
    {
        var result = await userManager.RefreshTokenAsync(request.RefreshToken);
        if (result.IsUnauthorized)
        {
            Result.Fail("Unauthorized");
        }

        return new SignInResponse
        {
            AccessToken = result.AccessToken,
            RefreshToken = result.RefreshToken,
        };
    }
}