using Warden.Application.Module.Integration.Webhook.Client;
using Warden.Core.Extension;

namespace Warden.Application.Module.Integration.Webhook;

public interface IWebhookSettingService
{
    Task<WebhookSetting> GetSettingAsync();
    Task<bool> UpdateSettingAsync(WebhookSetting alertSetting);
    Task<bool> TestConnectionAsync();
}

public class WebhookSettingService(AppDbContext context) : IWebhookSettingService
{
    public Task<WebhookSetting> GetSettingAsync()
    {
        return context.GetWebhookSettingAsync();
    }

    public async Task<bool> UpdateSettingAsync(WebhookSetting request)
    {
        return await context.UpdateWebhookSettingAsync(request);
    }

    public async Task<bool> TestConnectionAsync()
    {
        var currentSetting = await GetSettingAsync();
        var result = await new WebhookClient(currentSetting.Url, currentSetting.Format).TestConnectionAsync();
        return result.GetResult();
    }
}
