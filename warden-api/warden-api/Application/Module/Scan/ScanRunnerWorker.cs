using Warden.Core.Entity;
using Warden.Core.Enum;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Scan;

/// <summary>
/// Hosted queue worker: pulls Queued jobs and runs them via <see cref="IScanExecutionBackend"/>.
/// Backend is Docker today; swap DI registration for K8s without changing UI/API.
/// UI creates jobs only — this worker is the sole executor.
/// </summary>
public class ScanRunnerWorker(
    IServiceScopeFactory scopeFactory,
    IScanExecutionBackend backend,
    IScanJobStreamHub streamHub,
    ILogger<ScanRunnerWorker> logger
) : BackgroundService
{
    // One job at a time keeps host load predictable; raise when moving to K8s.
    private static readonly TimeSpan PollIdle = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan PollUnavailable = TimeSpan.FromSeconds(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Scan runner starting (backend={Kind}, available={Available})",
            backend.Kind, backend.IsAvailable);

        // Wait until backend is ready (socket may appear after sidecars in some deploys)
        while (!stoppingToken.IsCancellationRequested && !backend.IsAvailable)
        {
            logger.LogWarning(
                "Scan runner waiting — backend {Kind} not available yet", backend.Kind);
            await Task.Delay(PollUnavailable, stoppingToken);
        }

        if (stoppingToken.IsCancellationRequested) return;

        logger.LogInformation("Scan runner active (backend={Kind})", backend.Kind);
        await RecoverOrphansAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (!backend.IsAvailable)
                {
                    await Task.Delay(PollUnavailable, stoppingToken);
                    continue;
                }

                await using var scope = scopeFactory.CreateAsyncScope();
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var job = await context.ScanJobs
                    .Where(record => record.Status == ScanJobStatus.Queued)
                    .OrderBy(record => record.CreatedAt)
                    .FirstOrDefaultAsync(stoppingToken);
                if (job == null)
                {
                    await Task.Delay(PollIdle, stoppingToken);
                    continue;
                }

                job.Status = ScanJobStatus.Running;
                job.StartedAt = DateTime.UtcNow;
                await context.SaveChangesAsync(stoppingToken);
                streamHub.Publish(ScanJobStreamEvent.FromStatus(job.Id, job.Scanner, ScanJobStatus.Running, job.Target));

                try
                {
                    await backend.ExecuteAsync(job, stoppingToken);
                    job.Status = ScanJobStatus.Succeeded;
                    job.Log ??= "Scan completed successfully";
                }
                catch (Exception e)
                {
                    job.Status = ScanJobStatus.Failed;
                    if (string.IsNullOrEmpty(job.Log)) job.Log = e.Message;
                    else job.Log += "\n" + e.Message;
                    logger.LogError(e, "Scan job {JobId} ({Scanner}) failed", job.Id, job.Scanner);
                }

                job.CompletedAt = DateTime.UtcNow;
                await context.SaveChangesAsync(stoppingToken);
                streamHub.Publish(ScanJobStreamEvent.FromStatus(job.Id, job.Scanner, job.Status, job.Target) with
                {
                    Log = job.Log
                });
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception e)
            {
                logger.LogError(e, "Scan runner loop error");
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }
    }

    private async Task RecoverOrphansAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var orphans = await context.ScanJobs
                .Where(record => record.Status == ScanJobStatus.Running)
                .ToListAsync(cancellationToken);
            foreach (var job in orphans)
            {
                job.Status = ScanJobStatus.Failed;
                job.Log = "Interrupted by Warden restart";
                job.CompletedAt = DateTime.UtcNow;
                streamHub.Publish(ScanJobStreamEvent.FromStatus(job.Id, job.Scanner, ScanJobStatus.Failed, job.Target) with
                {
                    Log = job.Log
                });
            }
            if (orphans.Count > 0)
            {
                await context.SaveChangesAsync(cancellationToken);
                logger.LogWarning("Failed {Count} orphaned scan job(s) from previous run", orphans.Count);
            }
        }
        catch (Exception e)
        {
            logger.LogError(e, "Scan runner orphan recovery failed");
        }
    }
}
