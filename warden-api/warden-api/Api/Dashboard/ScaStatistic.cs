using System.ComponentModel.DataAnnotations;
using Warden.Application.Module.Stats.Model;

namespace Warden.Api.Dashboard;

public record ScaStatistic
{
    [Required] public required SeveritySeries Severity { get; set; }

    [Required] public required ScaStatus Status { get; set; }

    [Required] public required List<TopDependency> TopDependencies { get; set; }
}