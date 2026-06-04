using System.ComponentModel.DataAnnotations;

namespace Warden.Application.Module.Finding.Model;

public record CreateCommentFindingRequest
{
    [Required]
    public required string Comment { get; set; }
}