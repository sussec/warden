using Warden.Core.Enum;

namespace Warden.Application.Module.Project.Model;

public record ProjectScanner
{
    public required Guid ScannerId { get; set; }
    public required string Name { get; set; }
    public required ScannerType Type { get; set; }
}