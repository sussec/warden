using Warden.Application.Helpers;
using Warden.Application.Module.Integration.Webhook.Client;
using FluentResults;

namespace Warden.Application.Module.Integration.Webhook;

public class AlertConfirmedFindingWebhook(string url, WebhookFormat format) : IAlertConfirmedFinding
{
    public async Task<Result<bool>> AlertAsync(List<string> receivers, AlertConfirmedFindingModel model)
    {
        try
        {
            var topSeverity = model.Findings.Count != 0
                ? model.Findings.Max(f => f.Severity).ToString().ToUpper()
                : null;
            var payload = new WebhookPayload
            {
                Event = "confirmed_finding",
                Project = model.Project.Name,
                Message = $"There are {model.Findings.Count} confirmed findings that need to be fixed.",
                Severity = topSeverity,
                FindingCount = model.Findings.Count,
                Findings = model.Findings.Select(f => new WebhookFinding
                {
                    Name = f.Name,
                    Severity = f.Severity.ToString().ToUpper(),
                    Url = FrontendUrlHelper.FindingUrl(f.Id)
                }).ToList(),
                Url = model.FindingUrl()
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
