using Warden.Application;
using Warden.Application.Module.Setting;
using Warden.Authentication;
using Warden.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Setting;

[Route("api/setting/auth")]
[ApiExplorerSettings(GroupName = "Setting")]
public class AuthSettingController(AppDbContext context, AuthProviderManager authProviderManager): BaseController
{
    [HttpGet]
    [Permission(PermissionType.Config, PermissionAction.Read)]
    public async Task<AuthSetting> GetAuthSetting()
    {
        // never expose the OIDC client secret to API clients
        var setting = await context.GetAuthSettingAsync();
        var oidc = setting.OpenIdConnectSetting;
        return setting with
        {
            OpenIdConnectSetting = new OpenIdConnectSetting
            {
                DisplayName = oidc.DisplayName,
                Authority = oidc.Authority,
                ClientId = oidc.ClientId,
                ClientSecret = string.Empty,
                Enable = oidc.Enable,
                SchemeOverride = oidc.SchemeOverride
            }
        };
    }

    [HttpPost]
    [Permission(PermissionType.Config, PermissionAction.Update)]
    public async Task UpdateAuthSetting([FromBody] AuthSetting request)
    {
        // empty secret means "keep the stored one" (GET blanks it)
        if (string.IsNullOrEmpty(request.OpenIdConnectSetting.ClientSecret))
        {
            var current = await context.GetAuthSettingAsync();
            request.OpenIdConnectSetting.ClientSecret = current.OpenIdConnectSetting.ClientSecret;
        }
        await context.UpdateAuthSettingAsync(authProviderManager, request);
    }
}