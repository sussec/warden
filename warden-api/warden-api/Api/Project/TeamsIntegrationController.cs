using Warden.Application.Module.Project;
using Warden.Application.Module.Project.Integration.Teams;
using Warden.Authentication;
using Warden.Core.Extension;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Project;

[Route("api/project")]
[ApiExplorerSettings(GroupName = "Project")]
public class TeamsIntegrationController(
    IProjectAuthorize projectAuthorize,
    ITeamsProjectIntegrationSetting teamsProjectIntegrationSetting
) : BaseController
{
    [HttpGet]
    [Route("{projectId:guid}/integration/teams")]
    public async Task<TeamsProjectSetting> GetTeamsIntegrationProject(Guid projectId)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Update);
        var result = await teamsProjectIntegrationSetting.GetSettingAsync(projectId);
        return result.GetResult();
    }

    [HttpPost]
    [Route("{projectId:guid}/integration/teams")]
    public async Task<bool> UpdateTeamsIntegrationProject(Guid projectId, [FromBody] TeamsProjectSetting request)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Update);
        var result = await teamsProjectIntegrationSetting.UpdateSettingAsync(projectId, request);
        return result.GetResult();
    }

    [HttpPost]
    [Route("{projectId:guid}/integration/teams/test")]
    public async Task<bool> TestTeamsIntegrationProject(Guid projectId)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Update);
        var result = await teamsProjectIntegrationSetting.TestConnectionAsync(projectId);
        return result.GetResult();
    }
}