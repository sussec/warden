using Warden.Application.Module.Stats.Model;
using Warden.Core.Enum;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Stats;

public static class StatsTrendExtension
{
    public static async Task<List<TrendPoint>> StatsSastFindingTrendAsync(this AppDbContext context, StatisticFilter filter)
    {
        filter.StartDate ??= DateTime.MinValue;
        filter.EndDate ??= DateTime.UtcNow;
        var points = await context.Findings.Where(finding =>
                (filter.ProjectId == null || finding.ProjectId == filter.ProjectId) &&
                finding.Status != FindingStatus.Incorrect &&
                (finding.CreatedAt >= filter.StartDate && finding.CreatedAt < filter.EndDate) &&
                (filter.SourceId == null || context.Projects.Any(record =>
                    record.Id == finding.ProjectId && record.SourceControlId == filter.SourceId))
            )
            .GroupBy(finding => finding.CreatedAt.Date)
            .Select(g => new TrendPoint
            {
                Date = g.Key,
                Critical = g.Count(finding => finding.Severity == FindingSeverity.Critical),
                High = g.Count(finding => finding.Severity == FindingSeverity.High),
                Medium = g.Count(finding => finding.Severity == FindingSeverity.Medium),
                Low = g.Count(finding => finding.Severity == FindingSeverity.Low)
            })
            .OrderBy(point => point.Date)
            .ToListAsync();
        return points;
    }

    public static async Task<List<TrendPoint>> StatsPackageProjectTrendAsync(this AppDbContext context, StatisticFilter filter)
    {
        filter.StartDate ??= DateTime.MinValue;
        filter.EndDate ??= DateTime.UtcNow;
        var points = await context.ProjectPackages.Where(package =>
                (filter.ProjectId == null || package.ProjectId == filter.ProjectId) &&
                package.Package!.RiskLevel != RiskLevel.None &&
                (package.CreatedAt >= filter.StartDate && package.CreatedAt < filter.EndDate) &&
                (filter.SourceId == null || context.Projects.Any(record =>
                    record.Id == package.ProjectId && record.SourceControlId == filter.SourceId))
            )
            .GroupBy(package => package.CreatedAt.Date)
            .Select(g => new TrendPoint
            {
                Date = g.Key,
                Critical = g.Count(package => package.Package!.RiskLevel == RiskLevel.Critical),
                High = g.Count(package => package.Package!.RiskLevel == RiskLevel.High),
                Medium = g.Count(package => package.Package!.RiskLevel == RiskLevel.Medium),
                Low = g.Count(package => package.Package!.RiskLevel == RiskLevel.Low)
            })
            .OrderBy(point => point.Date)
            .ToListAsync();
        return points;
    }
}
