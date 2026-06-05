using System.ComponentModel.DataAnnotations;
using Warden.Core.Enum;

namespace Warden.Application.Module.Scan.Model;

public record CreateScanJobRequest
{
    [Required] public required string Scanner { get; set; }
    [Required] public required string Target { get; set; }
    public string? RepoName { get; set; }
    public string? Branch { get; set; }
}

public record ScanJobFilter
{
    public string? Scanner { get; set; }
    public ScanJobStatus? Status { get; set; }
}

public record ScanJobInfo
{
    public required Guid Id { get; set; }
    public required string Scanner { get; set; }
    public required ScanTargetType TargetType { get; set; }
    public required string Target { get; set; }
    public string? RepoName { get; set; }
    public string? Branch { get; set; }
    public required ScanJobStatus Status { get; set; }
    public string? Log { get; set; }
    public required DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}
