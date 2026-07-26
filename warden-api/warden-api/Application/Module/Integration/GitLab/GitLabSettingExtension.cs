using Warden.Application.Module.Setting;
using Warden.Core.Utils;

namespace Warden.Application.Module.Integration.GitLab;

public static class GitLabSettingExtension
{
    public static async Task<GitLabSetting> GetGitLabSettingAsync(this AppDbContext context)
    {
        // Always read from DB — static cache caused "off" to stick after SQL/UI updates.
        var appSettings = await context.GetAppSettingsAsync();
        var setting = JSONSerializer.DeserializeOrDefault(appSettings.GitLabSetting, new GitLabSetting());
        setting.Token = setting.Token?.Trim() ?? string.Empty;
        setting.ApiUrl = NormalizeApiUrl(setting.ApiUrl);
        setting.TokenConfigured = !string.IsNullOrWhiteSpace(setting.Token);
        return setting;
    }

    public static async Task<bool> UpdateGitLabSettingAsync(this AppDbContext context, GitLabSetting request)
    {
        var current = await context.GetGitLabSettingAsync();
        request.Token = request.Token?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(request.Token))
            request.Token = current.Token;

        request.ApiUrl = NormalizeApiUrl(request.ApiUrl);
        request.TokenConfigured = !string.IsNullOrWhiteSpace(request.Token);

        var appSettings = await context.GetAppSettingsAsync();
        appSettings.GitLabSetting = JSONSerializer.Serialize(request);
        context.AppSettings.Update(appSettings);
        await context.SaveChangesAsync();
        return true;
    }

    private static string NormalizeApiUrl(string? apiUrl)
    {
        var u = (apiUrl ?? "").Trim().TrimEnd('/');
        if (string.IsNullOrEmpty(u))
            return "https://gitlab.com/api/v4";
        if (!u.EndsWith("/api/v4", StringComparison.OrdinalIgnoreCase))
            u += "/api/v4";
        return u;
    }
}
