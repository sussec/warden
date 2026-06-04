using Warden.Core;

namespace Warden.Application.Module.Ai.Triage;

public class TriageModule : IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        builder.AddScoped<ITriageAgentService, TriageAgentService>();
        return builder;
    }
}
