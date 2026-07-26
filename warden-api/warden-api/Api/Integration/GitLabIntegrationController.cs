using Warden.Application;
using Warden.Application.Exceptions;
using Warden.Application.Module.Integration.GitLab;
using Warden.Authentication;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Integration;

[Route("api/integration/gitlab")]
[ApiExplorerSettings(GroupName = "Integration")]
public class GitLabIntegrationController(AppDbContext context) : BaseController
{
    [HttpGet]
    [Permission(PermissionType.Config, PermissionAction.Read)]
    public async Task<GitLabSetting> GetGitLabIntegrationSetting()
    {
        var setting = await context.GetGitLabSettingAsync();
        return setting with
        {
            Token = string.Empty,
            TokenConfigured = setting.TokenConfigured
        };
    }

    [HttpPost]
    [Permission(PermissionType.Config, PermissionAction.Update)]
    public Task<bool> UpdateGitLabIntegrationSetting([FromBody] GitLabSetting request)
    {
        return context.UpdateGitLabSettingAsync(request);
    }

    [HttpPost]
    [Route("test")]
    [Permission(PermissionType.Config, PermissionAction.Update)]
    public async Task<bool> TestGitLabIntegrationSetting()
    {
        var setting = await context.GetGitLabSettingAsync();
        if (string.IsNullOrEmpty(setting.Token))
            throw new BadRequestException(
                "GitLab token is missing. Open Configure, paste a PAT with read_api + read_repository, and Save.");
        var client = new GitLabClient(setting.ApiUrl, setting.Token);
        var result = await client.TestConnectionAsync();
        if (result.IsFailed)
            throw new BadRequestException(
                $"GitLab test failed for {setting.ApiUrl}: {result.Errors[0].Message}");
        return true;
    }
}
