using Warden.Application.Helpers;
using Warden.Application.Module.Integration.Webhook.Client;
using Warden.Core.Enum;
using FluentResults;

namespace Warden.Application.Module.Integration.Webhook;

public class AlertFixedFindingWebhook(string url, WebhookFormat format) : IAlertFixedFinding
{
    public async Task<Result<bool>> AlertAsync(List<string> receivers, AlertStatusFindingModel model)
    {
        try
        {
            var topSeverity = model.Findings.Count != 0
                ? model.Findings.Max(f => f.Severity).ToString().ToUpper()
                : null;
            var payload = new WebhookPayload
            {
                Event = "fixed_finding",
                Project = model.Project.Name,
                Message =
                    $"The latest {model.Scanner.Name} scan has detected {model.Findings.Count} fixed security findings.",
                Severity = topSeverity,
                Scanner = $"{model.Scanner.Name} - {model.Scanner.Type}",
                Commit = model.GitCommit.CommitHash,
                Branch = model.GitCommit.Branch,
                FindingCount = model.Findings.Count,
                Findings = model.Findings.Select(f => new WebhookFinding
                {
                    Name = f.Name,
                    Severity = f.Severity.ToString().ToUpper(),
                    Url = FrontendUrlHelper.FindingUrl(f.Id)
                }).ToList(),
                Url = model.FindingUrl(FindingStatus.Fixed)
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
