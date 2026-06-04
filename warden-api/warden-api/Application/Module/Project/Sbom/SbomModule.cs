using Warden.Core;

namespace Warden.Application.Module.Project.Sbom;

public class SbomModule : IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        builder.AddScoped<ISbomService, SbomService>();
        return builder;
    }
}
