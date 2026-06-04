using Warden.Core.Enum;

namespace Warden.Application.Module.Finding.Model;

public class UpdateStatusScanFindingRequest
{
    public Guid ScanId { get; init; }
    public FindingStatus Status { get; init; }
}