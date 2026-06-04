using Warden.Application.Module.Integration.GitHub;
using Warden.Application.Module.Project;
using Warden.Application.Module.Project.Integration.GitHub;
using Warden.Authentication;
using Warden.Core.Extension;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Project;

[Route("api/project")]
[ApiExplorerSettings(GroupName = "Project")]
public class GitHubIntegrationController(
    IProjectAuthorize projectAuthorize,
    IGitHubProjectIntegrationSetting gitHubProjectIntegrationSetting
) : BaseController
{
    [HttpGet]
    [Route("{projectId:guid}/integration/github")]
    public async Task<GitHubProjectSetting> GetGitHubIntegrationProject(Guid projectId)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Update);
        var result = await gitHubProjectIntegrationSetting.GetSettingAsync(projectId);
        return result.GetResult();
    }

    [HttpPost]
    [Route("{projectId:guid}/integration/github")]
    public async Task<bool> UpdateGitHubIntegrationProject(Guid projectId, [FromBody] GitHubProjectSetting request)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Update);
        var result = await gitHubProjectIntegrationSetting.UpdateSettingAsync(projectId, request);
        return result.GetResult();
    }

    [HttpGet]
    [Route("{projectId:guid}/integration/github/metadata")]
    public async Task<GitHubMetadata> GetGitHubMetadata(Guid projectId, bool reload)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Update);
        var result = await gitHubProjectIntegrationSetting.GetGitHubMetadataAsync(reload);
        return result.GetResult();
    }
}
