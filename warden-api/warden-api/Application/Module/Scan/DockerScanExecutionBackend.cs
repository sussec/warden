using System.Diagnostics;
using System.Text;
using Docker.DotNet;
using Docker.DotNet.Models;
using Warden.Application;
using Warden.Application.Module.Scan.Model;
using Warden.Core.Entity;
using Warden.Core.Enum;

namespace Warden.Application.Module.Scan;

/// <summary>
/// Launches compose scan-profile images as sibling containers (docker-out-of-docker).
/// Streams stdout/stderr into <see cref="IScanJobStreamHub"/> for live UI.
/// Future: replace with K8s Job backend implementing the same interface.
/// </summary>
public sealed class DockerScanExecutionBackend(
    IScanJobStreamHub streamHub,
    ILogger<DockerScanExecutionBackend> logger
) : IScanExecutionBackend
{
    private const int MaxLogChars = 64_000;
    private static readonly TimeSpan JobTimeout = TimeSpan.FromMinutes(30);

    public string Kind => "docker";

    public bool IsAvailable
    {
        get
        {
            var socketPath = Configuration.ScanDockerSocket.Replace("unix://", "");
            return File.Exists(socketPath);
        }
    }

    public async Task<ScanRunnerCapability> GetCapabilityAsync(CancellationToken cancellationToken = default)
    {
        var socketPresent = IsAvailable;
        var tokenOk = !string.IsNullOrWhiteSpace(Configuration.ScanToken);
        var images = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);

        if (socketPresent)
        {
            try
            {
                using var docker = CreateClient();
                var list = await docker.Images.ListImagesAsync(new ImagesListParameters { All = true }, cancellationToken);
                var tags = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var img in list)
                {
                    if (img.RepoTags == null) continue;
                    foreach (var t in img.RepoTags)
                        tags.Add(t);
                }

                foreach (var scanner in ScanJobService.Fleet.Keys)
                {
                    var name = ImageName(scanner);
                    images[scanner] = tags.Contains(name) || tags.Contains($"{name}:latest") ||
                                      tags.Any(t => t.StartsWith($"{name}:", StringComparison.OrdinalIgnoreCase));
                }
            }
            catch (Exception e)
            {
                logger.LogWarning(e, "Could not list docker images for capability probe");
            }
        }

        string message;
        var available = socketPresent && tokenOk;
        if (!socketPresent)
            message = "Docker socket not mounted — UI scans disabled. Mount /var/run/docker.sock and set DOCKER_GID.";
        else if (!tokenOk)
            message = "WARDEN_TOKEN is empty — scanners cannot report findings. Set a CI token from Settings → Access Token.";
        else if (images.Count > 0 && images.Values.All(v => !v))
            message = "Runner ready, but no scanner images found. Build with: docker compose --profile scan build";
        else if (images.Count > 0 && images.Values.Any(v => !v))
            message = "Runner ready. Some scanner images are missing — build missing ones before running them.";
        else
            message = "Runner ready — launch scans from the UI.";

        return new ScanRunnerCapability
        {
            Backend = Kind,
            Available = available,
            TokenConfigured = tokenOk,
            SocketPresent = socketPresent,
            Message = message,
            Images = images
        };
    }

    public async Task ExecuteAsync(ScanJobs job, CancellationToken cancellationToken)
    {
        if (!IsAvailable)
            throw new InvalidOperationException(
                "Scan runner unavailable — docker socket not mounted (set DOCKER_GID + socket volume; K8s backend later)");

        if (string.IsNullOrWhiteSpace(Configuration.ScanToken))
            throw new InvalidOperationException(
                "WARDEN_TOKEN is not configured — scanners cannot upload results. Create a CI token and set WARDEN_TOKEN.");

        using var docker = CreateClient();
        var image = ImageName(job.Scanner);
        await EnsureImageAsync(docker, image, job, cancellationToken);

        var env = new List<string>
        {
            $"WARDEN_URL={Configuration.ScanWardenUrl}",
            $"WARDEN_TOKEN={Configuration.ScanToken}"
        };
        var binds = new List<string>();
        var mounts = new List<Mount>();
        string? cloneDir = null;

        switch (job.TargetType)
        {
            case ScanTargetType.Repository:
                if (IsGitUrl(job.Target))
                {
                    cloneDir = $"{Configuration.ScanWorkspacePath.TrimEnd('/')}/{job.Id}";
                    await CloneRepoAsync(job.Target, job.Branch, cloneDir, job, cancellationToken);
                    // Shared volume so sibling scanner sees the clone; scanners read PROJECT_PATH.
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
                    // Host path bind (absolute path on the Docker host).
                    if (!Directory.Exists(job.Target) && !File.Exists(job.Target))
                    {
                        // Path may only exist on the host, not inside the API container — warn only.
                        streamHub.Publish(ScanJobStreamEvent.LogLine(job.Id, job.Scanner,
                            $"[warden] binding host path {job.Target} → /src (must exist on Docker host)"));
                    }
                    binds.Add($"{job.Target}:/src:ro");
                    env.Add("PROJECT_PATH=/src");
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
            case ScanTargetType.Llm:
                env.Add($"AUGUSTUS_GENERATOR={job.Target}");
                break;
            case ScanTargetType.Cloud:
                env.Add($"PROWLER_PROVIDER={job.Target}");
                break;
        }

        streamHub.Publish(ScanJobStreamEvent.LogLine(job.Id, job.Scanner,
            $"[warden] backend={Kind} image={image} network={Configuration.ScanNetwork}"));

        CreateContainerResponse created;
        try
        {
            created = await docker.Containers.CreateContainerAsync(new CreateContainerParameters
            {
                Image = image,
                Env = env,
                Labels = new Dictionary<string, string>
                {
                    ["warden.scan-job"] = job.Id.ToString(),
                    ["warden.scanner"] = job.Scanner,
                    ["warden.managed"] = "true"
                },
                HostConfig = new HostConfig
                {
                    Binds = binds,
                    Mounts = mounts,
                    NetworkMode = Configuration.ScanNetwork,
                    AutoRemove = false
                }
            }, cancellationToken);
        }
        catch (DockerApiException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            throw new InvalidOperationException(
                $"Scanner image '{image}' not found. Build it: docker compose --profile scan build {job.Scanner}");
        }

        var logBuilder = new StringBuilder();
        try
        {
            await docker.Containers.StartContainerAsync(
                created.ID, new ContainerStartParameters(), cancellationToken);
            streamHub.Publish(ScanJobStreamEvent.LogLine(job.Id, job.Scanner,
                $"[warden] container started {created.ID[..12]}"));

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(JobTimeout);

            var logTask = StreamLogsAsync(docker, created.ID, job, logBuilder, timeout.Token);
            try
            {
                var wait = await docker.Containers.WaitContainerAsync(created.ID, timeout.Token);
                try { await logTask; } catch { /* log stream may end with container */ }
                var log = Truncate(logBuilder.ToString());
                job.Log = log;
                if (wait.StatusCode != 0)
                    throw new InvalidOperationException(
                        $"Scanner exited with code {wait.StatusCode}");
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                job.Log = Truncate($"Timed out after {JobTimeout.TotalMinutes:0} minutes\n{logBuilder}");
                try
                {
                    await docker.Containers.KillContainerAsync(created.ID, new ContainerKillParameters(), CancellationToken.None);
                }
                catch { /* best-effort */ }
                throw new TimeoutException($"Scan timed out after {JobTimeout.TotalMinutes:0} minutes");
            }
        }
        finally
        {
            try
            {
                await docker.Containers.RemoveContainerAsync(created.ID,
                    new ContainerRemoveParameters { Force = true }, CancellationToken.None);
            }
            catch { /* best-effort */ }

            if (cloneDir != null)
            {
                try
                {
                    if (Directory.Exists(cloneDir)) Directory.Delete(cloneDir, recursive: true);
                }
                catch { /* best-effort */ }
            }
        }
    }

    private static DockerClient CreateClient() =>
        new DockerClientConfiguration(new Uri(Configuration.ScanDockerSocket)).CreateClient();

    /// <summary>
    /// Local compose builds use warden-{scanner}; override with SCAN_IMAGE_PREFIX
    /// (e.g. ghcr.io/sussec/warden-) for registry images.
    /// </summary>
    public static string ImageName(string scanner)
    {
        var prefix = Configuration.ScanImagePrefix;
        if (string.IsNullOrEmpty(prefix)) prefix = "warden-";
        // Allow full name already including tag
        if (scanner.Contains('/') || scanner.Contains(':')) return scanner;
        return $"{prefix}{scanner}";
    }

    private async Task EnsureImageAsync(
        IDockerClient docker,
        string image,
        ScanJobs job,
        CancellationToken cancellationToken)
    {
        var withTag = image.Contains(':') ? image : $"{image}:latest";
        try
        {
            await docker.Images.InspectImageAsync(image, cancellationToken);
            return;
        }
        catch (DockerApiException)
        {
            // try tagged name
        }

        try
        {
            await docker.Images.InspectImageAsync(withTag, cancellationToken);
            return;
        }
        catch (DockerApiException)
        {
            // not local
        }

        streamHub.Publish(ScanJobStreamEvent.LogLine(job.Id, job.Scanner,
            $"[warden] image {withTag} not local — attempting pull…"));
        try
        {
            var colon = withTag.LastIndexOf(':');
            var repo = colon > 0 ? withTag[..colon] : withTag;
            var tag = colon > 0 ? withTag[(colon + 1)..] : "latest";
            await docker.Images.CreateImageAsync(
                new ImagesCreateParameters { FromImage = repo, Tag = tag },
                null,
                new Progress<JSONMessage>(),
                cancellationToken);
            streamHub.Publish(ScanJobStreamEvent.LogLine(job.Id, job.Scanner, $"[warden] pulled {withTag}"));
        }
        catch (Exception e)
        {
            logger.LogWarning(e, "Pull failed for {Image}", withTag);
            throw new InvalidOperationException(
                $"Scanner image '{withTag}' is not available. Build it with: docker compose --profile scan build {job.Scanner}");
        }
    }

    private async Task StreamLogsAsync(
        IDockerClient docker,
        string containerId,
        ScanJobs job,
        StringBuilder logBuilder,
        CancellationToken cancellationToken)
    {
        try
        {
            using var stream = await docker.Containers.GetContainerLogsAsync(
                containerId,
                false,
                new ContainerLogsParameters
                {
                    ShowStdout = true,
                    ShowStderr = true,
                    Follow = true,
                    Timestamps = false
                },
                cancellationToken);

            var buffer = new byte[4096];
            while (!cancellationToken.IsCancellationRequested)
            {
                var result = await stream.ReadOutputAsync(buffer, 0, buffer.Length, cancellationToken);
                if (result.EOF) break;
                if (result.Count <= 0) continue;
                var text = Encoding.UTF8.GetString(buffer, 0, result.Count);
                logBuilder.Append(text);
                foreach (var line in text.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                {
                    if (line.Length == 0) continue;
                    streamHub.Publish(ScanJobStreamEvent.LogLine(job.Id, job.Scanner, line));
                }
                if (logBuilder.Length > MaxLogChars * 2)
                {
                    var keep = logBuilder.ToString()[^MaxLogChars..];
                    logBuilder.Clear();
                    logBuilder.Append(keep);
                }
            }
        }
        catch (OperationCanceledException)
        {
            // timeout or shutdown
        }
        catch (Exception e)
        {
            logger.LogDebug(e, "Log stream ended for job {JobId}", job.Id);
        }
    }

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

    private async Task CloneRepoAsync(string url, string? branch, string dest, ScanJobs job, CancellationToken cancellationToken)
    {
        streamHub.Publish(ScanJobStreamEvent.LogLine(job.Id, job.Scanner, $"[warden] cloning {url}…"));
        var cloneUrl = url;
        var token = Configuration.ScanGitToken;
        if (!string.IsNullOrEmpty(token) && url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            cloneUrl = "https://x-access-token:" + token + "@" + url["https://".Length..];

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
        psi.Environment["GIT_TERMINAL_PROMPT"] = "0";

        using var proc = Process.Start(psi) ?? throw new InvalidOperationException("git not available");
        var stderr = await proc.StandardError.ReadToEndAsync(cancellationToken);
        await proc.WaitForExitAsync(cancellationToken);
        if (proc.ExitCode != 0)
        {
            var safe = string.IsNullOrEmpty(token) ? stderr : stderr.Replace(token, "***");
            throw new InvalidOperationException($"git clone failed: {safe.Trim()}");
        }
        streamHub.Publish(ScanJobStreamEvent.LogLine(job.Id, job.Scanner, "[warden] clone complete"));
    }

    private static string Truncate(string log) =>
        log.Length <= MaxLogChars ? log : log[^MaxLogChars..];
}
