using Docker.DotNet;
using Docker.DotNet.Models;
using Warden.Core.Entity;
using Warden.Core.Enum;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Scan;

/// <summary>
/// Executes queued scan jobs by launching the compose scan-profile images as
/// sibling containers over the host docker socket (docker-out-of-docker).
/// Idle no-op when the socket is not mounted.
/// </summary>
public class ScanRunnerWorker(IServiceScopeFactory scopeFactory, ILogger<ScanRunnerWorker> logger)
    : BackgroundService
{
    private const int MaxLogChars = 16_000;
    private static readonly TimeSpan JobTimeout = TimeSpan.FromMinutes(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var socketPath = Configuration.ScanDockerSocket.Replace("unix://", "");
        if (!File.Exists(socketPath))
        {
            logger.LogInformation(
                "Scan runner disabled — docker socket {Socket} not mounted", socketPath);
            return;
        }

        using var docker = new DockerClientConfiguration(
            new Uri(Configuration.ScanDockerSocket)).CreateClient();
        logger.LogInformation("Scan runner active on {Socket}", Configuration.ScanDockerSocket);
        await RecoverOrphansAsync(docker, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var job = await context.ScanJobs
                    .Where(record => record.Status == ScanJobStatus.Queued)
                    .OrderBy(record => record.CreatedAt)
                    .FirstOrDefaultAsync(stoppingToken);
                if (job == null)
                {
                    await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
                    continue;
                }

                job.Status = ScanJobStatus.Running;
                job.StartedAt = DateTime.UtcNow;
                await context.SaveChangesAsync(stoppingToken);

                try
                {
                    var (exitCode, log) = await RunContainerAsync(docker, job, stoppingToken);
                    job.Status = exitCode == 0 ? ScanJobStatus.Succeeded : ScanJobStatus.Failed;
                    job.Log = log;
                }
                catch (Exception e)
                {
                    job.Status = ScanJobStatus.Failed;
                    job.Log = e.Message;
                    logger.LogError(e, "Scan job {JobId} ({Scanner}) failed", job.Id, job.Scanner);
                }

                job.CompletedAt = DateTime.UtcNow;
                await context.SaveChangesAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                // shutting down
            }
            catch (Exception e)
            {
                logger.LogError(e, "Scan runner loop error");
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }
    }

    /// Jobs left Running by a previous process (restart/crash) can never
    /// complete — fail them and remove their leftover containers.
    private async Task RecoverOrphansAsync(IDockerClient docker, CancellationToken cancellationToken)
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
            }
            if (orphans.Count > 0)
            {
                await context.SaveChangesAsync(cancellationToken);
                logger.LogWarning("Failed {Count} orphaned scan job(s) from previous run", orphans.Count);
            }

            var containers = await docker.Containers.ListContainersAsync(
                new ContainersListParameters
                {
                    All = true,
                    Filters = new Dictionary<string, IDictionary<string, bool>>
                    {
                        ["label"] = new Dictionary<string, bool> { ["warden.scan-job"] = true }
                    }
                }, cancellationToken);
            foreach (var container in containers)
                await docker.Containers.RemoveContainerAsync(container.ID,
                    new ContainerRemoveParameters { Force = true }, cancellationToken);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Scan runner orphan recovery failed");
        }
    }

    private static async Task<(long exitCode, string log)> RunContainerAsync(
        IDockerClient docker, ScanJobs job, CancellationToken cancellationToken)
    {
        var env = new List<string>
        {
            $"WARDEN_URL={Configuration.ScanWardenUrl}",
            $"WARDEN_TOKEN={Configuration.ScanToken}"
        };
        var binds = new List<string>();
        switch (job.TargetType)
        {
            case ScanTargetType.Repository:
                binds.Add($"{job.Target}:/src:ro");
                if (!string.IsNullOrEmpty(job.RepoName)) env.Add($"REPO_NAME={job.RepoName}");
                if (!string.IsNullOrEmpty(job.Branch)) env.Add($"BRANCH={job.Branch}");
                break;
            case ScanTargetType.Image:
                env.Add($"IMAGE_REF={job.Target}");
                break;
            case ScanTargetType.Url:
                env.Add($"TARGET_URL={job.Target}");
                break;
        }

        var created = await docker.Containers.CreateContainerAsync(new CreateContainerParameters
        {
            Image = $"{Configuration.ScanImagePrefix}{job.Scanner}",
            Env = env,
            Labels = new Dictionary<string, string> { ["warden.scan-job"] = job.Id.ToString() },
            HostConfig = new HostConfig
            {
                Binds = binds,
                NetworkMode = Configuration.ScanNetwork,
                AutoRemove = false
            }
        }, cancellationToken);

        try
        {
            await docker.Containers.StartContainerAsync(
                created.ID, new ContainerStartParameters(), cancellationToken);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(JobTimeout);
            try
            {
                var wait = await docker.Containers.WaitContainerAsync(created.ID, timeout.Token);
                var log = await ReadLogsAsync(docker, created.ID, cancellationToken);
                return (wait.StatusCode, log);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                var log = await ReadLogsAsync(docker, created.ID, cancellationToken);
                return (-1, $"Timed out after {JobTimeout.TotalMinutes:0} minutes\n{log}");
            }
        }
        finally
        {
            try
            {
                await docker.Containers.RemoveContainerAsync(created.ID,
                    new ContainerRemoveParameters { Force = true }, CancellationToken.None);
            }
            catch
            {
                // best-effort cleanup
            }
        }
    }

    private static async Task<string> ReadLogsAsync(
        IDockerClient docker, string containerId, CancellationToken cancellationToken)
    {
        using var stream = await docker.Containers.GetContainerLogsAsync(containerId, false,
            new ContainerLogsParameters { ShowStdout = true, ShowStderr = true, Tail = "300" },
            cancellationToken);
        var (stdout, stderr) = await stream.ReadOutputToEndAsync(cancellationToken);
        var log = string.IsNullOrEmpty(stderr) ? stdout : $"{stdout}\n{stderr}";
        return log.Length <= MaxLogChars ? log : log[^MaxLogChars..];
    }
}
