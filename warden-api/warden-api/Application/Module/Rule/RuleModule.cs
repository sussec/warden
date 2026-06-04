using Warden.Core;

namespace Warden.Application.Module.Rule;

public class RuleModule : IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        builder.AddScoped<IRuleService, RuleService>();
        return builder;
    }
}