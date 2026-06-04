using Warden.Core.Utils;

namespace Warden.Application.Module.Setting;

public static class AiSettingExtension
{
    private static AiSetting? aiSetting;

    public static async Task<AiSetting> GetAiSettingAsync(this AppDbContext context)
    {
        if (aiSetting != null) return aiSetting;
        var setting = await context.GetAppSettingsAsync();
        aiSetting = JSONSerializer.DeserializeOrDefault(setting.AiSetting, new AiSetting());
        return aiSetting with { };
    }

    public static async Task UpdateAiSettingAsync(this AppDbContext context, AiSetting request)
    {
        var currentSetting = await GetAiSettingAsync(context);
        if (string.IsNullOrEmpty(request.ApiKey))
        {
            request.ApiKey = currentSetting.ApiKey;
        }

        var setting = await context.GetAppSettingsAsync();
        setting.AiSetting = JSONSerializer.Serialize(request);
        context.AppSettings.Update(setting);
        await context.SaveChangesAsync();
        aiSetting = request;
    }
}
