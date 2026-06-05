using Warden.Core.Enum;

namespace Warden.Core.Entity;

/// <summary>
/// A UI-requested on-demand scan, executed by ScanRunnerWorker as a sibling
/// docker container (compose scan-profile images) via the host docker socket.
/// </summary>
public class ScanJobs : BaseEntity
{
    public required string Scanner { get; set; }
    public required ScanTargetType TargetType { get; set; }
    public required string Target { get; set; }
    public string? RepoName { get; set; }
    public string? Branch { get; set; }
    public ScanJobStatus Status { get; set; } = ScanJobStatus.Queued;
    public string? Log { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}
