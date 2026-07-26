using Warden.Authentication;
using Warden.Core.Entity;
using Warden.Core.Utils;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;

namespace Warden.Application.Module.Setting;

public static class AuthSettingExtension
{
    private static AuthSetting? authSetting;
    
    public static async Task<AuthSetting> GetAuthSettingAsync(this AppDbContext context)
    {
        if (authSetting == null)
        {
            var setting = await context.GetAppSettingsAsync();
            authSetting = JSONSerializer.DeserializeOrDefault(setting.AuthSetting, new AuthSetting());
        }
        return authSetting with {};
    }
    
    public static async Task UpdateAuthSettingAsync(this AppDbContext context, AuthProviderManager authProviderManager, AuthSetting request)
    {
        var setting = await context.GetAppSettingsAsync();
        setting.AuthSetting = JSONSerializer.Serialize(request);
        context.AppSettings.Update(setting);
        await context.SaveChangesAsync();
        authSetting = request;
        var authProvider = await authProviderManager.FindBySchemeAsync(OpenIdConnectDefaults.AuthenticationScheme);
        if (request.OpenIdConnectSetting.Enable)
        {
            if (authProvider == null)
            {
                await authProviderManager.AddAsync(new AuthProviders
                {
                    Scheme = OpenIdConnectDefaults.AuthenticationScheme,
                    HandlerType =
                        authProviderManager.ManagedHandlerType.First(t => t.Name == nameof(OpenIdConnectHandler)),
                    DisplayName = request.OpenIdConnectSetting.DisplayName,
                    Options = request.OpenIdConnectSetting.ToOpenIdConnectOptions(),
                    Enable = true
                });
            }
            else
            {
                // Rebuild options so cookie SameSite/callback path stay in sync with code defaults.
                authProvider.Options = request.OpenIdConnectSetting.ToOpenIdConnectOptions();
                authProvider.DisplayName = request.OpenIdConnectSetting.DisplayName;
                authProvider.Enable = true;
                await authProviderManager.UpdateAsync(authProvider);
            }
        }
        else if (authProvider != null)
        {
            authProvider.Enable = false;
            await authProviderManager.UpdateAsync(authProvider);
        }
    }
}