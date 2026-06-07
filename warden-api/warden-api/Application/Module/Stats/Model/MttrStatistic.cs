using System.ComponentModel.DataAnnotations;

namespace Warden.Application.Module.Stats.Model;

/// <summary>Remediation timing: mean time-to-fix and open-finding aging.</summary>
public record MttrStatistic
{
    /// Mean days between a finding's creation and its fix, over findings fixed in the window.
    [Required] public required double MeanDaysToFix { get; set; }

    /// Number of findings fixed in the window.
    [Required] public required int FixedCount { get; set; }

    /// Number of currently open/confirmed findings.
    [Required] public required int OpenCount { get; set; }

    /// Mean age (days) of currently open/confirmed findings.
    [Required] public required double MeanOpenAgeDays { get; set; }
}
