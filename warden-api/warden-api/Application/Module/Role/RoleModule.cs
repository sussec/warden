using Warden.Core;

namespace Warden.Application.Module.Role;

public class RoleModule: IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        builder.AddScoped<IRoleService, RoleService>();
        return builder;
    }
}