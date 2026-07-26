using Warden.Application.Module.Scan.Model;
using Warden.Core.Entity;

namespace Warden.Application.Module.Scan;

/// <summary>
/// Picks Docker (local compose / socket) or Kubernetes Jobs (in-cluster) so the
/// full scanner fleet works in both dev and production without UI changes.
/// Override with SCAN_BACKEND=docker|kubernetes|auto (default auto).
/// </summary>
public sealed class AutoScanExecutionBackend(
    DockerScanExecutionBackend docker,
    KubernetesScanExecutionBackend kubernetes
) : IScanExecutionBackend
{
    private IScanExecutionBackend Active
    {
        get
        {
            var mode = (Configuration.ScanBackend ?? "auto").Trim().ToLowerInvariant();
            return mode switch
            {
                "docker" => docker,
                "kubernetes" or "k8s" => kubernetes,
                _ => docker.IsAvailable ? docker : kubernetes
            };
        }
    }

    public string Kind => Active.Kind;

    public bool IsAvailable => Active.IsAvailable;

    public Task<ScanRunnerCapability> GetCapabilityAsync(CancellationToken cancellationToken = default) =>
        Active.GetCapabilityAsync(cancellationToken);

    public Task ExecuteAsync(ScanJobs job, CancellationToken cancellationToken) =>
        Active.ExecuteAsync(job, cancellationToken);
}
