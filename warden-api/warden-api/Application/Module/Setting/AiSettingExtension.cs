using Warden.Core.Utils;

namespace Warden.Application.Module.Setting;

public static class AiSettingExtension
{
    // No process-static cache: the Enabled flag is a security kill switch (when off, no
    // finding data leaves the system). A static cache would let disabled/rotated config
    // keep being used on other replicas until restart. AppSettings is a single indexed
    // row, so reading it per call is cheap.
    public static async Task<AiSetting> GetAiSettingAsync(this AppDbContext context)
    {
        var setting = await context.GetAppSettingsAsync();
        return JSONSerializer.DeserializeOrDefault(setting.AiSetting, new AiSetting());
    }

    public static async Task UpdateAiSettingAsync(this AppDbContext context, AiSetting request)
    {
        var currentSetting = await GetAiSettingAsync(context);
        if (string.IsNullOrEmpty(request.ApiKey))
        {
            request.ApiKey = currentSetting.ApiKey;
        }
        if (string.IsNullOrEmpty(request.EmbeddingApiKey))
        {
            request.EmbeddingApiKey = currentSetting.EmbeddingApiKey;
        }

        var setting = await context.GetAppSettingsAsync();
        setting.AiSetting = JSONSerializer.Serialize(request);
        context.AppSettings.Update(setting);
        await context.SaveChangesAsync();
    }
}
