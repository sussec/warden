using Warden.Application;
using Warden.Application.Module.Setting;
using Warden.Application.Services;
using Warden.Authentication;
using Warden.Core.Extension;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Setting;

[Route("api/setting/smtp")]
[ApiExplorerSettings(GroupName = "Setting")]
public class SmtpSettingController(AppDbContext context, ISmtpService smtpService): BaseController
{
    [HttpGet]
    [Permission(PermissionType.Config, PermissionAction.Read)]
    public async Task<SmtpSetting> GetSmtpSetting()
    {
        var setting = await context.GetSmtpSettingAsync();
        return setting with { Password = string.Empty };
    }

    [HttpPost]
    [Permission(PermissionType.Config, PermissionAction.Update)]
    public async Task UpdateSmtpSetting([FromBody] SmtpSetting request)
    {
        await context.UpdateSmtpSettingAsync(request);
    }

    [HttpPost]
    [Route("test")]
    [Permission(PermissionType.Config, PermissionAction.Update)]
    public async Task<bool> TestSmtpSetting(string? email)
    {
        if (string.IsNullOrEmpty(email))
        {
            email = CurrentUser.Email;
        }
        var result = await smtpService.TestConnectionAsync(email);
        return result.GetResult();
    }
}