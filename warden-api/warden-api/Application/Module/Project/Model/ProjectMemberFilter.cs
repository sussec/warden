using Warden.Core.EntityFramework;
using Warden.Core.Enum;

namespace Warden.Application.Module.Project.Model;

public record ProjectMemberFilter : QueryFilter
{
    public string? Name { get; set; }
    public ProjectRole? Role { get; set; }
}
