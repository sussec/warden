using Warden.Core.Enum;

namespace Warden.Application.Module.Project.Model;

public class UpdateProjectPackageRequest
{
    public PackageStatus? Status { get; set; }
    public string? IgnoreReason { get; set; }
}