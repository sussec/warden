using Warden.Core.EntityFramework;

namespace Warden.Application.Module.Project.Model;

public sealed record ProjectFilter : QueryFilter
{
    public string? Name { get; set; }
    public Guid? MemberUserId { get; set; }
    public Guid? SourceControlId { get; set; }
    public ProjectSortField SortBy { get; set; } = ProjectSortField.CreatedAt;
}