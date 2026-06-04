using Warden.Application.Helpers;
using Warden.Application.Services;
using Warden.Core.Entity;
using Warden.Core.Enum;
using FluentResults;

namespace Warden.Application.Module.Mail;

public record MailAddUserToProjectModel
{
    public required string Username { get; init; }
    public required Projects Project { get; init; }
    public required ProjectRole Role { get; init; }

    public string ProjectUrl()
    {
        return FrontendUrlHelper.ProjectUrl(Project.Id);
    }
}

public interface IMailAddUserToProject
{
    Task<Result<bool>> SendAsync(List<string> receivers, MailAddUserToProjectModel model);
}

public class MailAddUserToProject(ISmtpService smtpService, IRazorRender render) : IMailAddUserToProject
{
    public async Task<Result<bool>> SendAsync(List<string> receivers, MailAddUserToProjectModel model)
    {
        var content =
            await render.RenderAsync(Path.Combine("Resources", "Templates", "MailAddUserToProject.cshtml"), model);
        return await smtpService.SendAsync(new MailMessage
        {
            Subject = $"You have been invited to project \"{model.Project.Name}\"",
            Receivers = receivers,
            Content = content,
        });
    }
}