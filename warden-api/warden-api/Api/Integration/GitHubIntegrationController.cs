using Warden.Application.Exceptions;
using Warden.Application.Module.Integration.GitHub;
using Warden.Authentication;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Integration;

[Route("api/integration/github")]
[ApiExplorerSettings(GroupName = "Integration")]
public class GitHubIntegrationController(IGitHubSettingService gitHubSettingService) : BaseController
{
    [HttpGet]
    [Permission(PermissionType.Config, PermissionAction.Read)]
    public async Task<GitHubSetting> GetGitHubIntegrationSetting()
    {
        var setting = await gitHubSettingService.GetSettingAsync();
        return setting with { Token = string.Empty };
    }

    [HttpPost]
    [Permission(PermissionType.Config, PermissionAction.Update)]
    public Task<bool> UpdateGitHubIntegrationSetting([FromBody] GitHubSetting request)
    {
        return gitHubSettingService.UpdateSettingAsync(request);
    }

    [HttpPost]
    [Route("test")]
    [Permission(PermissionType.Config, PermissionAction.Update)]
    public Task<bool> TestGitHubIntegrationSetting()
    {
        return gitHubSettingService.TestConnectionAsync();
    }

    [HttpPost]
    [Route("metadata")]
    [Permission(PermissionType.Config, PermissionAction.Read)]
    public async Task<GitHubMetadata> GetGitHubMetadataIntegration([FromBody] GitHubSetting? setting = null,
        bool reload = false)
    {
        setting ??= await gitHubSettingService.GetSettingAsync();
        if (string.IsNullOrEmpty(setting.Token))
        {
            throw new BadRequestException("token is missing");
        }

        var gitHubClient = new GitHubClient(setting.ApiUrl, setting.Token);
        var result = await gitHubClient.GetMetadataAsync(reload);
        if (result.IsFailed)
        {
            throw new BadRequestException(result.Errors[0].Message);
        }

        return result.Value;
    }
}
