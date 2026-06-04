using Warden.Core.Enum;

namespace Warden.Application.Module.Finding.Model;

public record UpdateFindingRequest
{
    public FindingStatus? Status { get; set; }
    public FindingSeverity? Severity { get; set; }
    public DateTime? FixDeadline { get; set; }
    public string? Recommendation { get; set; }
}