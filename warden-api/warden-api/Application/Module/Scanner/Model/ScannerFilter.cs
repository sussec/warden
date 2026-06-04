using Warden.Core.Enum;

namespace Warden.Application.Module.Scanner.Model;

public record ScannerFilter
{
    public List<ScannerType>? Type { get; set; }
    public Guid? ProjectId { get; set; }
    public string? Name { get; set; }
}