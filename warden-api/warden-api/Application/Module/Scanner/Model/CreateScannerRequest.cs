using System.ComponentModel.DataAnnotations;
using Warden.Core.Enum;

namespace Warden.Application.Module.Scanner.Model;

public record CreateScannerRequest
{
    [Required]
    public required string Name { get; set; }
    [Required]
    public required ScannerType Type { get; set; }
}