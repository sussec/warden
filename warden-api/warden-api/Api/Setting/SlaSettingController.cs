using Warden.Application;
using Warden.Application.Module.Setting;
using Warden.Authentication;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Setting;

[Route("api/setting/sla")]
[ApiExplorerSettings(GroupName = "Setting")]
public class SlaSettingController(
    AppDbContext context
) : BaseController
{
    [HttpGet]
    [Permission(PermissionType.Config, PermissionAction.Read)]
    public async Task<SlaSetting> GetSlaSetting()
    {
        return await context.GetSlaSettingAsync();
    }

    [HttpPost]
    [Permission(PermissionType.Config, PermissionAction.Update)]
    public async Task UpdateSlaSetting([FromBody] SlaSetting request)
    {
        await context.UpdateSlaSettingAsync(request);
    }
}