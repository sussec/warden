using System.ComponentModel.DataAnnotations;
using Warden.Application.Module.Stats.Model;

namespace Warden.Api.Dashboard;

public record TrendStatistic
{
    [Required] public required List<TrendPoint> Sast { get; set; }

    [Required] public required List<TrendPoint> Sca { get; set; }
}
