using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Warden.Application;
using Warden.Application.Caching;
using Warden.Application.Module.Stats;
using Warden.Application.Module.Stats.Model;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Dashboard;

/// <summary>
/// Dashboard aggregates are expensive at scale — short TTL hybrid cache (memory + Redis).
/// </summary>
public class DashboardController(AppDbContext context, IAppCache cache)
    : BaseController
{
    private static readonly TimeSpan DashTtl = TimeSpan.FromSeconds(30);

    [HttpPost]
    [Route("sast")]
    public Task<SastStatistic> SastStatistic(StatisticFilter filter, CancellationToken cancellationToken) =>
        cache.GetOrCreateAsync(
            CacheKeys.Dashboard("sast", FilterHash(filter), CurrentUser.Id.ToString()),
            async ct => new SastStatistic
            {
                Severity = await context.StatsSastFindingBySeverityAsync(filter),
                Status = await context.StatsSastFindingByStatusAsync(filter),
                TopFindings = await context.StatsTopSastFindingAsync(filter, top: 10),
                Categories = await context.StatsFindingByCategoryAsync(filter)
            },
            DashTtl,
            cancellationToken)!;

    [HttpPost]
    [Route("sca")]
    public Task<ScaStatistic> ScaStatistic(StatisticFilter filter, CancellationToken cancellationToken) =>
        cache.GetOrCreateAsync(
            CacheKeys.Dashboard("sca", FilterHash(filter), CurrentUser.Id.ToString()),
            async ct => new ScaStatistic
            {
                Severity = await context.StatsPackageProjectBySeverityAsync(filter),
                Status = await context.StatsPackageProjectByStatusAsync(filter),
                TopDependencies = await context.StatsTopDependenciesAsync(filter, top: 10)
            },
            DashTtl,
            cancellationToken)!;

    [HttpPost]
    [Route("trend")]
    public Task<TrendStatistic> TrendStatistic(StatisticFilter filter, CancellationToken cancellationToken) =>
        cache.GetOrCreateAsync(
            CacheKeys.Dashboard("trend", FilterHash(filter), CurrentUser.Id.ToString()),
            async ct => new TrendStatistic
            {
                Sast = await context.StatsSastFindingTrendAsync(filter),
                Sca = await context.StatsPackageProjectTrendAsync(filter)
            },
            DashTtl,
            cancellationToken)!;

    [HttpPost]
    [Route("mttr")]
    public Task<MttrStatistic> MttrStatistic(StatisticFilter filter, CancellationToken cancellationToken) =>
        cache.GetOrCreateAsync(
            CacheKeys.Dashboard("mttr", FilterHash(filter), CurrentUser.Id.ToString()),
            async ct => await context.StatsMttrAsync(filter),
            DashTtl,
            cancellationToken)!;

    private static string FilterHash(StatisticFilter filter)
    {
        var json = JsonSerializer.Serialize(filter);
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(hash.AsSpan(0, 8));
    }
}