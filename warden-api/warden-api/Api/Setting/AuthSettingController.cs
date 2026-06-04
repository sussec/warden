using Warden.Application;
using Warden.Application.Module.Setting;
using Warden.Authentication;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Setting;

[Route("api/setting/auth")]
[ApiExplorerSettings(GroupName = "Setting")]
public class AuthSettingController(AppDbContext context, AuthProviderManager authProviderManager): BaseController
{
    [HttpGet]
    [Permission(PermissionType.Config, PermissionAction.Read)]
    public Task<AuthSetting> GetAuthSetting()
    {
        return context.GetAuthSettingAsync();
    }

    [HttpPost]
    [Permission(PermissionType.Config, PermissionAction.Update)]
    public async Task UpdateAuthSetting([FromBody] AuthSetting request)
    {
        await context.UpdateAuthSettingAsync(authProviderManager, request);
    }
}