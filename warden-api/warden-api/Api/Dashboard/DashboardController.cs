using Warden.Application;
using Warden.Application.Module.Stats;
using Warden.Application.Module.Stats.Model;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Dashboard;

public class DashboardController(AppDbContext context)
    : BaseController
{
    [HttpPost]
    [Route("sast")]
    public async Task<SastStatistic> SastStatistic(StatisticFilter filter)
    {
        return new SastStatistic
        {
            Severity = await context.StatsSastFindingBySeverityAsync(filter),
            Status = await context.StatsSastFindingByStatusAsync(filter),
            TopFindings = await context.StatsTopSastFindingAsync(filter, top: 10),
            Categories = await context.StatsFindingByCategoryAsync(filter)
        };
    }

    [HttpPost]
    [Route("sca")]
    public async Task<ScaStatistic> ScaStatistic(StatisticFilter filter)
    {
        return new ScaStatistic
        {
            Severity = await context.StatsPackageProjectBySeverityAsync(filter),
            Status = await context.StatsPackageProjectByStatusAsync(filter),
            TopDependencies = await context.StatsTopDependenciesAsync(filter, top: 10)
        };
    }

    [HttpPost]
    [Route("trend")]
    public async Task<TrendStatistic> TrendStatistic(StatisticFilter filter)
    {
        return new TrendStatistic
        {
            Sast = await context.StatsSastFindingTrendAsync(filter),
            Sca = await context.StatsPackageProjectTrendAsync(filter)
        };
    }

    [HttpPost]
    [Route("mttr")]
    public async Task<MttrStatistic> MttrStatistic(StatisticFilter filter)
    {
        return await context.StatsMttrAsync(filter);
    }
}