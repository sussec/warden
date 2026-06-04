using Warden.Application.Module.Integration.Webhook.Client;
using FluentResults;

namespace Warden.Application.Module.Integration.Webhook;

public class AlertVulnerableProjectPackageWebhook(string url, WebhookFormat format) : IAlertVulnerableProjectPackage
{
    public async Task<Result<bool>> AlertAsync(List<string> receivers, AlertVulnerableProjectPackageModel model)
    {
        try
        {
            var payload = new WebhookPayload
            {
                Event = "vulnerable_project_package",
                Project = model.Project.Name,
                Message = $"There are {model.ProjectPackages.Count} vulnerable packages in the project.",
                FindingCount = model.ProjectPackages.Count,
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
