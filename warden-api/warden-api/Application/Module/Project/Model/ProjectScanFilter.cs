using Warden.Core.EntityFramework;
using Warden.Core.Enum;

namespace Warden.Application.Module.Project.Model;

public sealed record ProjectScanFilter : QueryFilter
{
    public string? Scanner { get; set; }
    public ScannerType? Type { get; set; }
    public ScanStatus? Status { get; set; }
}