using Warden.Core.Enum;

namespace Warden.Application.Module.Project.Model;

public record ProjectCommitSummary
{
    public required Guid CommitId { get; set; }
    public required string Branch { get; set; }
    public required CommitType Type { get; set; }
    public required string? TargetBranch { get; set; }
    public required bool IsDefault { get; set; }
}