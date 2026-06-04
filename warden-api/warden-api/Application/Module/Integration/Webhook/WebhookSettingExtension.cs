using Warden.Application.Module.Setting;
using Warden.Core.Utils;

namespace Warden.Application.Module.Integration.Webhook;

public static class WebhookSettingExtension
{
    private static WebhookSetting? setting;
    public static async Task<WebhookSetting> GetWebhookSettingAsync(this AppDbContext context)
    {
        if (setting == null)
        {
            var appSettings = await context.GetAppSettingsAsync();
            setting = JSONSerializer.DeserializeOrDefault(appSettings.WebhookSetting, new WebhookSetting());
        }

        return setting with { };
    }

    public static async Task<bool> UpdateWebhookSettingAsync(this AppDbContext context, WebhookSetting request)
    {
        var currentSetting = await GetWebhookSettingAsync(context);
        if (string.IsNullOrEmpty(request.Url))
        {
            request.Url = currentSetting.Url;
        }

        var appSettings = await context.GetAppSettingsAsync();
        appSettings.WebhookSetting = JSONSerializer.Serialize(request);
        context.AppSettings.Update(appSettings);
        await context.SaveChangesAsync();
        setting = request;
        return true;
    }
}
