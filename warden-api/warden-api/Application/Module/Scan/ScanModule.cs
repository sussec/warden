using Warden.Core;

namespace Warden.Application.Module.Scan;

public class ScanModule : IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        builder.AddSingleton<IScanJobStreamHub, ScanJobStreamHub>();
        builder.AddSingleton<DockerScanExecutionBackend>();
        builder.AddSingleton<KubernetesScanExecutionBackend>();
        // Auto: Docker when socket present, else Kubernetes Jobs (in-cluster).
        builder.AddSingleton<IScanExecutionBackend, AutoScanExecutionBackend>();
        builder.AddScoped<IScanJobService, ScanJobService>();
        builder.AddHostedService<ScanRunnerWorker>();
        return builder;
    }
}
