using Warden.Core;

namespace Warden.Api.CI;

public class CiModule : IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        builder.AddScoped<ICiAuthorize, CiAuthorize>();
        return builder;
    }
}