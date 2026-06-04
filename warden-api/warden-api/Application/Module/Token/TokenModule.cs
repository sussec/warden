using Warden.Core;

namespace Warden.Application.Module.Token;

public class TokenModule : IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        builder.AddScoped<ITokenService, TokenService>();
        return builder;
    }
}