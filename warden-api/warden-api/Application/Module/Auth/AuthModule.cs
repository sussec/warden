using Warden.Core;

namespace Warden.Application.Module.Auth;

public class AuthModule : IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        builder.AddScoped<IAuthService, AuthService>();
        return builder;
    }
}