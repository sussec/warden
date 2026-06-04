using System.ComponentModel.DataAnnotations;
using Warden.Application.Module.Stats.Model;

namespace Warden.Application.Module.Project.Model;

public record ProjectStatistics
{
    [Required] public required ScaStatus StatusSca { get; set; }

    [Required] public required SastStatus StatusSast { get; set; }

    [Required] public required SeveritySeries SeveritySast { get; set; }

    [Required] public required SeveritySeries SeveritySca { get; set; }

    public required int OpenFinding { get; set; }
}