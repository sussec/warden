using System.ComponentModel.DataAnnotations;

namespace Warden.Application.Module.Finding.Model;

public class FindingCommentRequest
{
    [Required]
    public required string Comment { get; set; }
}