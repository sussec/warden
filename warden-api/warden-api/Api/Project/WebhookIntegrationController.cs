using Warden.Application.Module.Project;
using Warden.Application.Module.Project.Integration.Webhook;
using Warden.Authentication;
using Warden.Core.Extension;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Project;

[Route("api/project")]
[ApiExplorerSettings(GroupName = "Project")]
public class WebhookIntegrationController(
    IProjectAuthorize projectAuthorize,
    IWebhookProjectIntegrationSetting webhookProjectIntegrationSetting
) : BaseController
{
    [HttpGet]
    [Route("{projectId:guid}/integration/webhook")]
    public async Task<WebhookProjectSetting> GetWebhookIntegrationProject(Guid projectId)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Update);
        var result = await webhookProjectIntegrationSetting.GetSettingAsync(projectId);
        // url is a secret — blank it like the global Webhook endpoint does
        return result.GetResult() with { Url = string.Empty };
    }

    [HttpPost]
    [Route("{projectId:guid}/integration/webhook")]
    public async Task<bool> UpdateWebhookIntegrationProject(Guid projectId, [FromBody] WebhookProjectSetting request)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Update);
        var result = await webhookProjectIntegrationSetting.UpdateSettingAsync(projectId, request);
        return result.GetResult();
    }

    [HttpPost]
    [Route("{projectId:guid}/integration/webhook/test")]
    public async Task<bool> TestWebhookIntegrationProject(Guid projectId)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Update);
        var result = await webhookProjectIntegrationSetting.TestConnectionAsync(projectId);
        return result.GetResult();
    }
}
