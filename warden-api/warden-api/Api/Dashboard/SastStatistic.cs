using System.ComponentModel.DataAnnotations;
using Warden.Application.Module.Stats.Model;

namespace Warden.Api.Dashboard;

public record SastStatistic
{
    [Required] public required SeveritySeries Severity { get; set; }

    [Required] public required SastStatus Status { get; set; }

    [Required] public required List<TopFinding> TopFindings { get; set; }
}