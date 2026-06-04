using Warden.Application.Module.Finding.Model;
using Warden.Core.EntityFramework;
using Warden.Core.Enum;

namespace Warden.Application.Module.Project.Model;

public record ProjectFindingFilter : QueryFilter
{
    public Guid? CommitId { get; set; }
    public string? Name { get; set; }
    public string? RuleId { get; set; }
    public List<FindingSeverity>? Severity { get; set; }
    public List<FindingStatus>? Status { get; set; }
    public List<Guid>? Scanner { get; set; }
    public FindingSortField SortBy { get; set; } = FindingSortField.CreatedAt;
}