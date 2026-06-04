using Warden.Core;

namespace Warden.Application.Module.Ai;

public class AiModule : IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        builder.AddScoped<IAiClientFactory, AiClientFactory>();
        builder.AddScoped<IFindingAiService, FindingAiService>();
        return builder;
    }
}
