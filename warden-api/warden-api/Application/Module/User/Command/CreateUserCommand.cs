using Warden.Application.Module.Mail;
using Warden.Application.Module.User.Model;
using Warden.Authentication;
using Warden.Authentication.Jwt;
using Warden.Core.Entity;
using Warden.Core.Enum;
using FluentResults;

namespace Warden.Application.Module.User.Command;

public class CreateUserCommand(JwtUserManager userManager, IMailInviteUser mailInviteUser)
{
    public async Task<Result<Users>> ExecuteAsync(CreateUserRequest request)
    {
        var username = string.IsNullOrWhiteSpace(request.UserName)
            ? request.Email.Split('@')[0]
            : request.UserName.Trim();
        var user = new Users
        {
            Id = Guid.NewGuid(),
            UserName = username,
            Email = request.Email,
            EmailConfirmed = request.Verified,
            TwoFactorEnabled = false,
            FullName = string.IsNullOrWhiteSpace(request.FullName) ? username : request.FullName.Trim(),
            Status = UserStatus.Active,
            Avatar = null,
            IsDefault = false,
            CreatedAt = DateTime.UtcNow
        };
        var password = string.IsNullOrEmpty(request.Password)
            ? PasswordGenerator.GeneratePassword(32)
            : request.Password;
        var result = await userManager.CreateAsync(user, password);
        if (!result.Succeeded) return Result.Fail(result.Errors.First().Description);
        await userManager.AddToRoleAsync(user, request.Role);
        _ = mailInviteUser.SendAsync(user.Email!, new MailInviteUserModel
        {
            Username = user.UserName!,
            Token = userManager.GenerateEmailConfirmationTokenAsync(user).Result,
            IsRegister = true
        });
        return user;
    }
}