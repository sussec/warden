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
            var wait = await docker.Containers.WaitContainerAsync(created.ID, cancellationToken);
            var log = await ReadLogsAsync(docker, created.ID, cancellationToken);
            return (wait.StatusCode, log);
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
