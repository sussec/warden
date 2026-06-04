using Warden.Application.Module.Project.Integration.Webhook;
using Warden.Core;

namespace Warden.Application.Module.Integration.Webhook;

public class WebhookModule : IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        // global webhook
        builder.AddScoped<IWebhookSettingService, WebhookSettingService>();
        builder.AddScoped<WebhookSetting>(sp =>
        {
            var context = sp.GetRequiredService<AppDbContext>();
            return context.GetWebhookSettingAsync().Result;
        });
        // per-project webhook
        builder.AddScoped<IWebhookProjectIntegrationSetting, WebhookProjectIntegrationSetting>();
        return builder;
    }
}
