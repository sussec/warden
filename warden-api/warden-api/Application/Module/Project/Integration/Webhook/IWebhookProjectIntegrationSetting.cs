using Warden.Application.Module.Integration.Webhook.Client;
using Warden.Core.Utils;
using FluentResults;
using FluentResults.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Project.Integration.Webhook;

public interface IWebhookProjectIntegrationSetting
{
    Task<Result<WebhookProjectSetting>> GetSettingAsync(Guid projectId);
    Task<Result<bool>> UpdateSettingAsync(Guid projectId, WebhookProjectSetting setting);
    Task<Result<bool>> TestConnectionAsync(Guid projectId);
}

public class WebhookProjectIntegrationSetting(AppDbContext context) : IWebhookProjectIntegrationSetting
{
    public async Task<Result<WebhookProjectSetting>> GetSettingAsync(Guid projectId)
    {
        var projectSetting = await context.ProjectSettings.FirstOrDefaultAsync(record => record.ProjectId == projectId);
        if (projectSetting == null) return Result.Fail("Project not found");
        return projectSetting.GetWebhookAlertSetting();
    }

    public async Task<Result<bool>> UpdateSettingAsync(Guid projectId, WebhookProjectSetting request)
    {
        var projectSetting =
            await context.ProjectSettings.FirstOrDefaultAsync(record => record.ProjectId == projectId);
        if (projectSetting == null) return Result.Fail("Project not found");
        var currentSetting =
            JSONSerializer.DeserializeOrDefault(projectSetting.WebhookSetting, new WebhookProjectSetting());
        if (string.IsNullOrEmpty(request.Url))
        {
            request.Url = currentSetting.Url;
        }

        projectSetting.WebhookSetting = JSONSerializer.Serialize(request);
        context.ProjectSettings.Update(projectSetting);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<Result<bool>> TestConnectionAsync(Guid projectId)
    {
        return await GetSettingAsync(projectId)
            .Bind(setting => new WebhookClient(setting.Url, setting.Format).TestConnectionAsync());
    }
}
