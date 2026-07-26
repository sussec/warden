using Warden.Application.Module.Scan.Model;
using Warden.Core.Entity;

namespace Warden.Application.Module.Scan;

/// <summary>
/// Executes a scan job on an orchestration backend.
/// Docker today; swap to Kubernetes Jobs without changing the UI contract.
/// UI only talks to the API — never the backend directly.
/// </summary>
public interface IScanExecutionBackend
{
    /// <summary>docker | kubernetes — surfaced to operators for debugging.</summary>
    string Kind { get; }

    bool IsAvailable { get; }

    /// <summary>Readiness for the operator UI (token, socket, images).</summary>
    Task<ScanRunnerCapability> GetCapabilityAsync(CancellationToken cancellationToken = default);

    Task ExecuteAsync(ScanJobs job, CancellationToken cancellationToken);
}
