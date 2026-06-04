using Warden.Core;

namespace Warden.Application.Module.Ci;

public class CiModule: IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        builder.AddScoped<ICiService, CiService>();
        return builder;
    }
}