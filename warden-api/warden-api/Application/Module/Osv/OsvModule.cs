using Warden.Core;

namespace Warden.Application.Module.Osv;

public class OsvModule : IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        builder.AddSingleton<IOsvAdvisoryService, OsvAdvisoryService>();
        return builder;
    }
}
