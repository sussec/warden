using Warden.Application.Module.Integration.Webhook.Client;
using FluentResults;

namespace Warden.Application.Module.Integration.Webhook;

public class AlertProjectWithoutMemberWebhook(string url, WebhookFormat format) : IAlertProjectWithoutMember
{
    public async Task<Result<bool>> AlertAsync(List<string> receivers, AlertProjectWithoutMemberModel model)
    {
        try
        {
            var payload = new WebhookPayload
            {
                Event = "project_without_member",
                Project = model.Project.Name,
                Message = "This project has no members assigned.",
                Url = model.ProjectUrl()
            };
            await new WebhookClient(url, format).PostAsync(payload);
            return true;
        }
        catch (Exception e)
        {
            return Result.Fail(e.Message);
        }
    }
}
