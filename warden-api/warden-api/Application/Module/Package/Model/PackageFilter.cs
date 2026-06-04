using Warden.Application.Module.Project.Model;
using Warden.Core.EntityFramework;
using Warden.Core.Enum;

namespace Warden.Application.Module.Package.Model;

public record PackageFilter : QueryFilter
{
    public string? Name { get; set; }
    public PackageStatus? Status { get; set; } = PackageStatus.Open;
    public List<RiskLevel>? Severity { get; set; }
    public ProjectPackageSortField SortBy { get; set; } = ProjectPackageSortField.RiskLevel;
}