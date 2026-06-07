using Warden.Application.Module.Stats.Model;
using Warden.Core.Enum;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Stats;

public static class StatsMttrExtension
{
    /// <summary>
    /// Remediation metrics: mean time-to-fix (days between create and fix, over
    /// findings fixed in the window) and the count + mean age of still-open
    /// findings. Drives the dashboard's SLA / remediation widget.
    /// </summary>
    public static async Task<MttrStatistic> StatsMttrAsync(this AppDbContext context, StatisticFilter filter)
    {
        filter.StartDate ??= DateTime.MinValue;
        filter.EndDate ??= DateTime.UtcNow;
        var end = filter.EndDate.Value;

        var fixedRows = await context.Findings
            .Where(finding =>
                (filter.ProjectId == null || finding.ProjectId == filter.ProjectId) &&
                finding.Status == FindingStatus.Fixed && finding.FixedAt != null &&
                finding.FixedAt >= filter.StartDate && finding.FixedAt < filter.EndDate &&
                (filter.SourceId == null || context.Projects.Any(record =>
                    record.Id == finding.ProjectId && record.SourceControlId == filter.SourceId)))
            .Select(finding => new { finding.CreatedAt, FixedAt = finding.FixedAt!.Value })
            .ToListAsync();

        var meanDaysToFix = fixedRows.Count > 0
            ? fixedRows.Average(row => (row.FixedAt - row.CreatedAt).TotalDays)
            : 0d;

        var openAges = await context.Findings
            .Where(finding =>
                (filter.ProjectId == null || finding.ProjectId == filter.ProjectId) &&
                (finding.Status == FindingStatus.Open || finding.Status == FindingStatus.Confirmed) &&
                (filter.SourceId == null || context.Projects.Any(record =>
                    record.Id == finding.ProjectId && record.SourceControlId == filter.SourceId)))
            .Select(finding => finding.CreatedAt)
            .ToListAsync();

        var meanOpenAge = openAges.Count > 0
            ? openAges.Average(created => (end - created).TotalDays)
            : 0d;

        return new MttrStatistic
        {
            MeanDaysToFix = Math.Round(meanDaysToFix, 1),
            FixedCount = fixedRows.Count,
            OpenCount = openAges.Count,
            MeanOpenAgeDays = Math.Round(meanOpenAge, 1),
        };
    }
}
