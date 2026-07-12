using Warden.Application.Helpers;
using Warden.Application.Services;
using Warden.Core.Extension;
using FluentResults;

namespace Warden.Application.Module.Mail;

public record MailResetPasswordModel
{
    public required string Username { get; set; }

    public required string Token { get; set; }

    public string ResetPasswordLink()
        => FrontendUrlHelper.ResetPasswordUrl(Token.UrlEncode(), Username);
}

public interface IMailResetPassword
{
    Task<Result<bool>> SendAsync(string receiver, MailResetPasswordModel model);
}

public class MailResetPassword(ISmtpService smtpService, IRazorRender render) : IMailResetPassword
{
    public async Task<Result<bool>> SendAsync(string receiver, MailResetPasswordModel model)
    {
        var content =
            await render.RenderAsync(Path.Combine("Resources", "Templates", "MailResetPassword.cshtml"), model);
        return await smtpService.SendAsync(new MailMessage
        {
            Subject = "Password Reset Request",
            Receivers = [receiver],
            Content = content,
        });
    }
}