using Warden.Application.Module.Auth.Model;
using Warden.Application.Module.Mail;
using Warden.Authentication.Jwt;
using FluentResults;

namespace Warden.Application.Module.Auth.Command;

public class ForgotPasswordCommand(JwtUserManager userManager, IMailResetPassword mailResetPassword)
{
    public async Task<Result<bool>> ExecuteAsync(ForgotPasswordRequest request)
    {
        var user = await userManager.FindByEmailAsync(request.Username) ??
                   await userManager.FindByNameAsync(request.Username);
        if (user == null)
        {
            return Result.Fail("User not found");
        }

        _ = mailResetPassword.SendAsync(user.Email!, new MailResetPasswordModel
        {
            Username = user.UserName!,
            Token = await userManager.GeneratePasswordResetTokenAsync(user)
        });
        return Result.Ok();
    }
}