using Warden.Application.Module.Integration.Webhook;
using Warden.Authentication;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Integration;

[Route("api/integration/webhook")]
[ApiExplorerSettings(GroupName = "Integration")]
public class WebhookIntegrationController(IWebhookSettingService webhookSettingService) : BaseController
{
    [HttpGet]
    [Permission(PermissionType.Config, PermissionAction.Read)]
    public async Task<WebhookSetting> GetWebhookIntegrationSetting()
    {
        // Url is a secret — blank it like the global Teams endpoint does
        return (await webhookSettingService.GetSettingAsync()) with { Url = string.Empty };
    }

    [HttpPost]
    [Permission(PermissionType.Config, PermissionAction.Update)]
    public Task<bool> UpdateWebhookIntegrationSetting([FromBody] WebhookSetting request)
    {
        return webhookSettingService.UpdateSettingAsync(request);
    }

    [HttpPost]
    [Route("test")]
    [Permission(PermissionType.Config, PermissionAction.Update)]
    public Task<bool> TestWebhookIntegrationSetting()
    {
        return webhookSettingService.TestConnectionAsync();
    }
}
