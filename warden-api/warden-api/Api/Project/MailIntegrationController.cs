using Warden.Application.Module.Project;
using Warden.Application.Module.Project.Integration;
using Warden.Application.Module.Project.Integration.Mail;
using Warden.Authentication;
using Warden.Core.Extension;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Project;

[Route("api/project")]
[ApiExplorerSettings(GroupName = "Project")]
public class MailIntegrationController(
    IMailProjectIntegrationSetting mailProjectIntegrationSetting,
    IProjectAuthorize projectAuthorize
) : BaseController
{
    [HttpGet]
    [Route("{projectId:guid}/integration/mail")]
    public async Task<ProjectAlertEvent> GetMailIntegrationProject(Guid projectId)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Update);
        var result = await mailProjectIntegrationSetting.GetSettingAsync(projectId);
        return result.GetResult();
    }

    [HttpPost]
    [Route("{projectId:guid}/integration/mail")]
    public async Task<bool> UpdateMailIntegrationProject(Guid projectId, [FromBody] MailProjectAlertSetting request)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Update);
        var result = await mailProjectIntegrationSetting.UpdateSettingAsync(projectId, request);
        return result.GetResult();
    }
}