using Warden.Core.Extension;

namespace Warden.Application.Module.Integration.GitHub;

public interface IGitHubSettingService
{
    Task<GitHubSetting> GetSettingAsync();
    Task<bool> UpdateSettingAsync(GitHubSetting setting);
    Task<bool> TestConnectionAsync();
}

public class GitHubSettingService(AppDbContext context) : IGitHubSettingService
{
    public Task<GitHubSetting> GetSettingAsync()
    {
        return context.GetGitHubSettingAsync();
    }

    public async Task<bool> UpdateSettingAsync(GitHubSetting setting)
    {
        return await context.UpdateGitHubSettingAsync(setting);
    }

    public async Task<bool> TestConnectionAsync()
    {
        var setting = await GetSettingAsync();
        var gitHubClient = new GitHubClient(setting.ApiUrl, setting.Token);
        var result = await gitHubClient.TestConnectionAsync();
        return result.GetResult();
    }
}
