using System.Text.Json.Serialization;
using Warden.Core.Enum;

namespace Warden.Application.Module.Project.Model;

public record UpdateProjectMemberRequest
{
    public required ProjectRole Role { get; set; }
    [JsonIgnore] public Guid UserId { get; set; }
}