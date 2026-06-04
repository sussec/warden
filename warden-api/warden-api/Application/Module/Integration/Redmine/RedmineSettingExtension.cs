using Warden.Application.Module.Setting;
using Warden.Core.Utils;

namespace Warden.Application.Module.Integration.Redmine;

public static class RedmineSettingExtension
{
    private static RedmineSetting? setting;

    public static async Task<RedmineSetting> GetRedmineSettingAsync(this AppDbContext context)
    {
        if (setting == null)
        {
            var appSettings = await context.GetAppSettingsAsync();
            setting = JSONSerializer.DeserializeOrDefault(appSettings.RedmineSetting, new RedmineSetting());
        }

        return setting with { };
    }

    public static async Task<bool> UpdateRedmineSettingAsync(this AppDbContext context, RedmineSetting request)
    {
        var currentSetting = await context.GetRedmineSettingAsync();
        if (string.IsNullOrEmpty(request.Token))
        {
            request.Token = currentSetting.Token;
        }

        var appSettings = await context.GetAppSettingsAsync();
        appSettings.RedmineSetting = JSONSerializer.Serialize(request);
        context.AppSettings.Update(appSettings);
        await context.SaveChangesAsync();
        setting = request;
        return true;
    }
}