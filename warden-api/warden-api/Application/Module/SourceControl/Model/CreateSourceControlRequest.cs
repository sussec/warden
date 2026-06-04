using System.ComponentModel.DataAnnotations;
using Warden.Core.Enum;

namespace Warden.Application.Module.SourceControl.Model;

public record CreateSourceControlRequest
{
    [Required]
    public required string Url { get; set; }
    [Required]
    public required SourceType Type { get; set; }
}