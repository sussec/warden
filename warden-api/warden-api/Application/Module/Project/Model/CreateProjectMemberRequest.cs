using System.ComponentModel.DataAnnotations;
using Warden.Core.Enum;

namespace Warden.Application.Module.Project.Model;

public record CreateProjectMemberRequest
{
    [Required] public required Guid UserId { get; init; }

    [Required] public required ProjectRole Role { get; init; }
}