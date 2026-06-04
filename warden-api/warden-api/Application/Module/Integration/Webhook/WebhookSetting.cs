using System.Text.Json.Serialization;

namespace Warden.Application.Module.Integration.Webhook;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum WebhookFormat
{
    Generic,
    Slack
}

public record WebhookSetting : AlertSetting
{
    // Url is treated as a secret: blanked on GET, merged-on-empty on update (mirrors Teams Webhook)
    public string Url { get; set; } = string.Empty;
    public WebhookFormat Format { get; set; } = WebhookFormat.Generic;
}
