using Warden.Application.Helpers;
using Warden.Application.Module.Integration.GitHub;
using Warden.Core.Utils;
using FluentResults;
using FluentResults.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Project.Integration.GitHub;

public interface IGitHubProjectIntegrationSetting
{
    Task<Result<GitHubProjectSetting>> GetSettingAsync(Guid projectId);
    Task<Result<bool>> UpdateSettingAsync(Guid projectId, GitHubProjectSetting setting);
    Task<Result<GitHubMetadata>> GetGitHubMetadataAsync(bool reload);
}

public class GitHubProjectIntegrationSetting(AppDbContext context) : IGitHubProjectIntegrationSetting
{
    public async Task<Result<GitHubProjectSetting>> GetSettingAsync(Guid projectId)
    {
        return await context.GetProjectSettingsAsync(projectId)
            .Bind(async projectSetting =>
            {
                var globalSetting = await context.GetGitHubSettingAsync();
                var setting = projectSetting.GetGitHubSetting(globalSetting);
                // Prefill owner/repo from the project's own RepoUrl when unset
                // (never from the global default repo — that was the anthropic bug).
                if (string.IsNullOrWhiteSpace(setting.Owner) || string.IsNullOrWhiteSpace(setting.Repo))
                {
                    var project = await context.Projects.AsNoTracking()
                        .FirstOrDefaultAsync(p => p.Id == projectId);
                    if (project != null &&
                        GitRepoHelpers.TryParseGitHubOwnerRepo(project.RepoUrl, out var o, out var r))
                    {
                        if (string.IsNullOrWhiteSpace(setting.Owner)) setting.Owner = o;
                        if (string.IsNullOrWhiteSpace(setting.Repo)) setting.Repo = r;
                    }
                }

                return Result.Ok(new GitHubProjectSetting
                {
                    Active = setting.Active,
                    Owner = setting.Owner,
                    Repo = setting.Repo,
                    Labels = setting.Labels,
                });
            });
    }

    public async Task<Result<bool>> UpdateSettingAsync(Guid projectId, GitHubProjectSetting request)
    {
        return await context.GetProjectSettingsAsync(projectId)
            .Bind(async projectSetting =>
            {
                if (string.IsNullOrEmpty(request.Owner))
                {
                    return Result.Fail("GitHub owner is required");
                }

                if (string.IsNullOrEmpty(request.Repo))
                {
                    return Result.Fail("GitHub repo is required");
                }

                projectSetting.GitHubSetting = JSONSerializer.Serialize(request);
                context.ProjectSettings.Update(projectSetting);
                await context.SaveChangesAsync();
                return Result.Ok(true);
            });
    }

    public async Task<Result<GitHubMetadata>> GetGitHubMetadataAsync(bool reload)
    {
        var globalSetting = await context.GetGitHubSettingAsync();
        var gitHubClient = new GitHubClient(globalSetting.ApiUrl, globalSetting.Token);
        return await gitHubClient.GetMetadataAsync(reload);
    }
}
