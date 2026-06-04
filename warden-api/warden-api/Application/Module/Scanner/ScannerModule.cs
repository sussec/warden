using Warden.Core;

namespace Warden.Application.Module.Scanner;

public class ScannerModule : IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        builder.AddScoped<IScannerService, ScannerService>();
        return builder;
    }
}