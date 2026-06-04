using Warden.Core.EntityFramework;

namespace Warden.Application.Module.Project.Model;

public record ProjectCommitFilter : QueryFilter
{
    public string? Name { get; set; }
}
