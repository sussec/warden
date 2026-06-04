using Warden.Application.Module.Integration.Webhook.Client;
using FluentResults;

namespace Warden.Application.Module.Integration.Webhook;

public class AlertNeedTriageFindingWebhook(string url, WebhookFormat format) : IAlertNeedTriageFinding
{
    public async Task<Result<bool>> AlertAsync(List<string> receivers, AlertNeedTriageFindingModel model)
    {
        try
        {
            var payload = new WebhookPayload
            {
                Event = "need_triage_finding",
                Project = model.Project.Name,
                Message = $"There are {model.NeedTriageCount} findings that need triage.",
                FindingCount = model.NeedTriageCount,
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
