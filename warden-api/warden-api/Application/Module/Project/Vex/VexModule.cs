using Warden.Core;

namespace Warden.Application.Module.Project.Vex;

public class VexModule : IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        builder.AddScoped<IVexService, VexService>();
        return builder;
    }
}
