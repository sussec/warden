using Warden.Application.Module.Integration.Webhook;

namespace Warden.Application.Module.Project.Integration.Webhook;

public record WebhookProjectSetting : ProjectAlertEvent
{
    // Url is a secret: blanked on GET, merged-on-empty on update (mirrors Teams Webhook)
    public string Url { get; set; } = string.Empty;
    public WebhookFormat Format { get; set; } = WebhookFormat.Generic;
}
