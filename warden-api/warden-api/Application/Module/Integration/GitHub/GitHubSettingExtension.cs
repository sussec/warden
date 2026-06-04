using Warden.Application.Module.Setting;
using Warden.Core.Utils;

namespace Warden.Application.Module.Integration.GitHub;

public static class GitHubSettingExtension
{
    private static GitHubSetting? setting;

    public static async Task<GitHubSetting> GetGitHubSettingAsync(this AppDbContext context)
    {
        if (setting == null)
        {
            var appSettings = await context.GetAppSettingsAsync();
            setting = JSONSerializer.DeserializeOrDefault(appSettings.GitHubSetting, new GitHubSetting());
        }

        return setting with { };
    }

    public static async Task<bool> UpdateGitHubSettingAsync(this AppDbContext context, GitHubSetting request)
    {
        var currentSetting = await context.GetGitHubSettingAsync();
        if (string.IsNullOrEmpty(request.Token))
        {
            request.Token = currentSetting.Token;
        }

        var appSettings = await context.GetAppSettingsAsync();
        appSettings.GitHubSetting = JSONSerializer.Serialize(request);
        context.AppSettings.Update(appSettings);
        await context.SaveChangesAsync();
        setting = request;
        return true;
    }
}
