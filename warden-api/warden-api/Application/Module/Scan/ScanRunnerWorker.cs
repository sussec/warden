using System.Diagnostics;
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
        var mounts = new List<Mount>();
        string? cloneDir = null; // workspace subdir to clean up after a git-URL clone
        switch (job.TargetType)
        {
            case ScanTargetType.Repository:
                if (IsGitUrl(job.Target))
                {
                    // Clone the repo into the shared workspace volume, then point the
                    // scanner at it via PROJECT_PATH. The volume is mounted into both
                    // this container (we clone here) and the scanner container.
                    cloneDir = $"{Configuration.ScanWorkspacePath.TrimEnd('/')}/{job.Id}";
                    await CloneRepoAsync(job.Target, job.Branch, cloneDir, cancellationToken);
                    mounts.Add(new Mount
                    {
                        Type = "volume",
                        Source = Configuration.ScanWorkspaceVolume,
                        Target = Configuration.ScanWorkspacePath,
                    });
                    env.Add($"PROJECT_PATH={cloneDir}");
                    env.Add($"REPO_NAME={(string.IsNullOrEmpty(job.RepoName) ? RepoNameFromUrl(job.Target) : job.RepoName)}");
                }
                else
                {
                    binds.Add($"{job.Target}:/src:ro");
                    if (!string.IsNullOrEmpty(job.RepoName)) env.Add($"REPO_NAME={job.RepoName}");
                }
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
                Mounts = mounts,
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
            if (cloneDir != null)
            {
                try
                {
                    if (Directory.Exists(cloneDir)) Directory.Delete(cloneDir, recursive: true);
                }
                catch
                {
                    // best-effort cleanup of the cloned working tree
                }
            }
        }
    }

    /// <summary>A repository target that is a git URL (clone) rather than a host path (bind mount).</summary>
    public static bool IsGitUrl(string target) =>
        target.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
        target.StartsWith("https://", StringComparison.OrdinalIgnoreCase) ||
        target.StartsWith("git@", StringComparison.OrdinalIgnoreCase) ||
        target.StartsWith("ssh://", StringComparison.OrdinalIgnoreCase);

    private static string RepoNameFromUrl(string url)
    {
        var name = url.TrimEnd('/');
        var slash = name.LastIndexOf('/');
        if (slash >= 0) name = name[(slash + 1)..];
        return name.EndsWith(".git", StringComparison.OrdinalIgnoreCase) ? name[..^4] : name;
    }

    /// <summary>
    /// Shallow-clones a git repo into <paramref name="dest"/>. For private HTTPS repos,
    /// injects SCAN_GIT_TOKEN as an x-access-token credential. Throws on failure.
    /// </summary>
    private static async Task CloneRepoAsync(string url, string? branch, string dest, CancellationToken cancellationToken)
    {
        var cloneUrl = url;
        var token = Configuration.ScanGitToken;
        if (!string.IsNullOrEmpty(token) && url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            cloneUrl = "https://x-access-token:" + token + "@" + url["https://".Length..];
        }

        var args = new List<string> { "clone", "--depth", "1" };
        if (!string.IsNullOrEmpty(branch)) { args.Add("--branch"); args.Add(branch); }
        args.Add(cloneUrl);
        args.Add(dest);

        var psi = new ProcessStartInfo("git")
        {
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
        };
        foreach (var a in args) psi.ArgumentList.Add(a);
        psi.Environment["GIT_TERMINAL_PROMPT"] = "0"; // never block on credential prompts

        using var proc = Process.Start(psi) ?? throw new InvalidOperationException("git not available");
        var stderr = await proc.StandardError.ReadToEndAsync(cancellationToken);
        await proc.WaitForExitAsync(cancellationToken);
        if (proc.ExitCode != 0)
        {
            // Scrub the token from any echoed URL before surfacing the error.
            var safe = string.IsNullOrEmpty(token) ? stderr : stderr.Replace(token, "***");
            throw new InvalidOperationException($"git clone failed: {safe.Trim()}");
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
