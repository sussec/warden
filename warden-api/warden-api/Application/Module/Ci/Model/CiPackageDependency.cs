using System.ComponentModel.DataAnnotations;

namespace Warden.Application.Module.Ci.Model;

public record CiPackageDependency
{
    [Required] public required string PkgId { get; set; }

    // list PkgId of other Package
    public List<string>? Dependencies { get; set; }
}