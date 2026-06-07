using System.ComponentModel.DataAnnotations;

namespace Warden.Application.Module.Stats.Model;

/// <summary>Finding count for one scanner category (ScannerType name).</summary>
public record CategoryCount
{
    [Required] public required string Category { get; set; }

    [Required] public required int Count { get; set; }
}
