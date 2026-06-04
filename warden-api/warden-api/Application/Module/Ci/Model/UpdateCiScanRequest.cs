using Warden.Core.Enum;

namespace Warden.Application.Module.Ci.Model;

public class UpdateCiScanRequest
{
    public ScanStatus? Status { get; set; }
    public string? Description { get; set; }
}