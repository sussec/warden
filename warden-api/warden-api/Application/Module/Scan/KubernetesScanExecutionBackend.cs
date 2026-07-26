using System.Text;
using k8s;
using k8s.Models;
using Warden.Application.Module.Scan.Model;
using Warden.Core.Entity;
using Warden.Core.Enum;
using Microsoft.Extensions.DependencyInjection;

namespace Warden.Application.Module.Scan;

/// <summary>
/// Runs scan-profile images as Kubernetes Jobs (in-cluster).
/// Used on k3s/EKS when the Docker socket is not mounted — production path for the full fleet.
/// </summary>
public sealed class KubernetesScanExecutionBackend(
    IScanJobStreamHub streamHub,
    IServiceScopeFactory scopeFactory,
    ILogger<KubernetesScanExecutionBackend> logger
) : IScanExecutionBackend
{
    private static readonly TimeSpan JobTimeout = TimeSpan.FromMinutes(45);
    private const int MaxLogChars = 64_000;
    private const string WorkMount = "/scan-workspace";

    public string Kind => "kubernetes";

    public bool IsAvailable
    {
        get
        {
            // In-cluster SA token is the standard signal that Jobs can be created.
            return File.Exists("/var/run/secrets/kubernetes.io/serviceaccount/token");
        }
    }

    public Task<ScanRunnerCapability> GetCapabilityAsync(CancellationToken cancellationToken = default)
    {
        var tokenOk = !string.IsNullOrWhiteSpace(Configuration.ScanToken);
        var inCluster = IsAvailable;
        var available = inCluster && tokenOk;

        // On K8s we cannot cheaply inspect the registry for every image; treat the
        // full fleet as enabled/runnable when the runner itself is ready. Missing
        // images fail at Job start with a clear pull error in the live log.
        var images = ScanJobService.Fleet.Keys.ToDictionary(
            s => s,
            _ => available,
            StringComparer.OrdinalIgnoreCase);

        string message;
        if (!inCluster)
            message = "Not running in-cluster — Kubernetes scan backend unavailable.";
        else if (!tokenOk)
            message = "WARDEN_TOKEN is empty — scanners cannot report findings. Set a CI token from Settings → Access Token.";
        else
            message =
                $"Kubernetes Jobs ready — all {images.Count} fleet plugins enabled (gitleaks, semgrep, trivy, …). Images pull from {Configuration.ScanImagePrefix.TrimEnd('-')}*.";

        return Task.FromResult(new ScanRunnerCapability
        {
            Backend = Kind,
            Available = available,
            TokenConfigured = tokenOk,
            SocketPresent = false,
            Message = message,
            Images = images,
            Plugins = ScanJobService.BuildFleetPlugins(images, enabled: true)
        });
    }

    public async Task ExecuteAsync(ScanJobs job, CancellationToken cancellationToken)
    {
        if (!IsAvailable)
            throw new InvalidOperationException("Kubernetes scan backend is not available (not in-cluster).");

        if (string.IsNullOrWhiteSpace(Configuration.ScanToken))
            throw new InvalidOperationException(
                "WARDEN_TOKEN is not configured — scanners cannot upload results.");

        var ns = string.IsNullOrWhiteSpace(Configuration.ScanNamespace)
            ? "default"
            : Configuration.ScanNamespace.Trim();
        var image = DockerScanExecutionBackend.ImageName(job.Scanner);
        if (!image.Contains(':')) image = $"{image}:latest";

        var client = CreateClient();
        // DNS-1123 name ≤ 63 chars. Guid "N" is 32 hex chars; prefix is 12 → 44 total.
        var jobName = $"warden-scan-{job.Id:N}";
        if (jobName.Length > 63) jobName = jobName[..63];
        jobName = jobName.TrimEnd('-').ToLowerInvariant();

        streamHub.Publish(ScanJobStreamEvent.LogLine(job.Id, job.Scanner,
            $"[warden] backend={Kind} job={jobName} ns={ns} image={image}"));

        var k8sJob = await BuildJobAsync(job, jobName, ns, image, cancellationToken);
        try
        {
            await client.BatchV1.CreateNamespacedJobAsync(k8sJob, ns, cancellationToken: cancellationToken);
            streamHub.Publish(ScanJobStreamEvent.LogLine(job.Id, job.Scanner, "[warden] Job created — waiting for pod…"));
        }
        catch (Exception e)
        {
            logger.LogError(e, "Failed to create scan Job {Job}", jobName);
            throw new InvalidOperationException($"Failed to create Kubernetes Job: {e.Message}", e);
        }

        var logBuilder = new StringBuilder();
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(JobTimeout);

            var podName = await WaitForPodAsync(client, ns, jobName, job, timeout.Token);
            streamHub.Publish(ScanJobStreamEvent.LogLine(job.Id, job.Scanner, $"[warden] pod {podName}"));

            await StreamPodLogsAsync(client, ns, podName, job, logBuilder, timeout.Token);
            var succeeded = await WaitJobFinishedAsync(client, ns, jobName, timeout.Token);

            job.Log = Truncate(logBuilder.ToString());
            if (!succeeded)
                throw new InvalidOperationException(
                    $"Scanner Job failed. See log. Image: {image}");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            job.Log = Truncate($"Timed out after {JobTimeout.TotalMinutes:0} minutes\n{logBuilder}");
            throw new TimeoutException($"Scan timed out after {JobTimeout.TotalMinutes:0} minutes");
        }
        finally
        {
            try
            {
                await client.BatchV1.DeleteNamespacedJobAsync(
                    jobName,
                    ns,
                    propagationPolicy: "Background",
                    cancellationToken: CancellationToken.None);
            }
            catch (Exception e)
            {
                logger.LogDebug(e, "Job cleanup {Job} ignored", jobName);
            }
        }
    }

    private static IKubernetes CreateClient()
    {
        var config = KubernetesClientConfiguration.InClusterConfig();
        return new Kubernetes(config);
    }

    private async Task<V1Job> BuildJobAsync(
        ScanJobs job,
        string jobName,
        string ns,
        string image,
        CancellationToken cancellationToken)
    {
        var env = BuildEnv(job);
        var volumes = new List<V1Volume>
        {
            new() { Name = "workspace", EmptyDir = new V1EmptyDirVolumeSource() }
        };
        var volumeMounts = new List<V1VolumeMount>
        {
            new() { Name = "workspace", MountPath = WorkMount }
        };

        var initContainers = new List<V1Container>();
        if (job.TargetType == ScanTargetType.Repository &&
            DockerScanExecutionBackend.IsGitUrl(job.Target))
        {
            string cloneUrl;
            using (var scope = scopeFactory.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                cloneUrl = await GitCloneAuth.ResolveCloneUrlAsync(db, job.Target, cancellationToken);
            }

            var branchArg = string.IsNullOrEmpty(job.Branch)
                ? ""
                : $" --branch {EscapeShell(job.Branch)}";
            // GIT_TERMINAL_PROMPT=0 avoids interactive auth; never echo the URL (contains PAT).
            initContainers.Add(new V1Container
            {
                Name = "git-clone",
                Image = string.IsNullOrWhiteSpace(Configuration.ScanGitImage)
                    ? "alpine/git:2.47.2"
                    : Configuration.ScanGitImage,
                Command = ["sh", "-c"],
                Args =
                [
                    "set -e; export GIT_TERMINAL_PROMPT=0; " +
                    $"git clone --depth 1{branchArg} '{EscapeShell(cloneUrl)}' {WorkMount}/src >/dev/null 2>&1; " +
                    $"echo \"[warden] cloned repository into {WorkMount}/src\""
                ],
                VolumeMounts = volumeMounts,
                Resources = new V1ResourceRequirements
                {
                    Requests = new Dictionary<string, ResourceQuantity>
                    {
                        ["cpu"] = new("100m"),
                        ["memory"] = new("128Mi")
                    },
                    Limits = new Dictionary<string, ResourceQuantity>
                    {
                        ["cpu"] = new("1"),
                        ["memory"] = new("512Mi")
                    }
                }
            });
            env.Add(new V1EnvVar { Name = "PROJECT_PATH", Value = $"{WorkMount}/src" });
            if (!string.IsNullOrEmpty(job.RepoName))
                env.Add(new V1EnvVar { Name = "REPO_NAME", Value = job.RepoName });
            else
                env.Add(new V1EnvVar
                {
                    Name = "REPO_NAME",
                    Value = RepoNameFromUrl(job.Target)
                });
            if (!string.IsNullOrEmpty(job.Branch))
                env.Add(new V1EnvVar { Name = "BRANCH", Value = job.Branch });
        }
        else
        {
            // Non-git repository paths are host paths — not available in K8s Jobs.
            if (job.TargetType == ScanTargetType.Repository)
            {
                throw new InvalidOperationException(
                    "Kubernetes backend requires a git repository URL (https://… or git@…). Host paths need the Docker backend.");
            }
        }

        var pullSecrets = new List<V1LocalObjectReference>();
        if (!string.IsNullOrWhiteSpace(Configuration.ScanImagePullSecret))
        {
            pullSecrets.Add(new V1LocalObjectReference { Name = Configuration.ScanImagePullSecret });
        }

        return new V1Job
        {
            Metadata = new V1ObjectMeta
            {
                Name = jobName,
                NamespaceProperty = ns,
                Labels = new Dictionary<string, string>
                {
                    ["app.kubernetes.io/name"] = "warden-scan",
                    ["app.kubernetes.io/managed-by"] = "warden",
                    ["warden.scan-job"] = job.Id.ToString(),
                    ["warden.scanner"] = job.Scanner
                }
            },
            Spec = new V1JobSpec
            {
                BackoffLimit = 0,
                TtlSecondsAfterFinished = 300,
                ActiveDeadlineSeconds = (long)JobTimeout.TotalSeconds,
                Template = new V1PodTemplateSpec
                {
                    Metadata = new V1ObjectMeta
                    {
                        Labels = new Dictionary<string, string>
                        {
                            ["warden.scan-job"] = job.Id.ToString(),
                            ["warden.scanner"] = job.Scanner
                        }
                    },
                    Spec = new V1PodSpec
                    {
                        RestartPolicy = "Never",
                        ImagePullSecrets = pullSecrets.Count > 0 ? pullSecrets : null,
                        InitContainers = initContainers.Count > 0 ? initContainers : null,
                        Containers =
                        [
                            new V1Container
                            {
                                Name = "scanner",
                                Image = image,
                                ImagePullPolicy = "IfNotPresent",
                                Env = env,
                                VolumeMounts = volumeMounts,
                                Resources = new V1ResourceRequirements
                                {
                                    Requests = new Dictionary<string, ResourceQuantity>
                                    {
                                        ["cpu"] = new("250m"),
                                        ["memory"] = new("512Mi")
                                    },
                                    Limits = new Dictionary<string, ResourceQuantity>
                                    {
                                        ["cpu"] = new("2"),
                                        ["memory"] = new("4Gi")
                                    }
                                }
                            }
                        ],
                        Volumes = volumes
                    }
                }
            }
        };
    }

    private static List<V1EnvVar> BuildEnv(ScanJobs job)
    {
        var env = new List<V1EnvVar>
        {
            new() { Name = "WARDEN_URL", Value = Configuration.ScanWardenUrl },
            new() { Name = "WARDEN_TOKEN", Value = Configuration.ScanToken }
        };

        switch (job.TargetType)
        {
            case ScanTargetType.Image:
                env.Add(new V1EnvVar { Name = "IMAGE_REF", Value = job.Target });
                break;
            case ScanTargetType.Url:
                env.Add(new V1EnvVar { Name = "TARGET_URL", Value = job.Target });
                break;
            case ScanTargetType.Llm:
                env.Add(new V1EnvVar { Name = "AUGUSTUS_GENERATOR", Value = job.Target });
                break;
            case ScanTargetType.Cloud:
                env.Add(new V1EnvVar { Name = "PROWLER_PROVIDER", Value = job.Target });
                break;
        }

        return env;
    }

    private async Task<string> WaitForPodAsync(
        IKubernetes client,
        string ns,
        string jobName,
        ScanJobs job,
        CancellationToken cancellationToken)
    {
        var label = $"job-name={jobName}";
        while (!cancellationToken.IsCancellationRequested)
        {
            var pods = await client.CoreV1.ListNamespacedPodAsync(
                ns, labelSelector: label, cancellationToken: cancellationToken);
            var pod = pods.Items.FirstOrDefault();
            if (pod != null)
            {
                var phase = pod.Status?.Phase;
                if (phase is "Running" or "Succeeded" or "Failed")
                    return pod.Metadata.Name;
                if (phase == "Pending")
                {
                    var waiting = pod.Status?.ContainerStatuses?
                        .Select(c => c.State?.Waiting)
                        .FirstOrDefault(w => w != null);
                    if (waiting != null &&
                        (waiting.Reason is "ImagePullBackOff" or "ErrImagePull"))
                    {
                        throw new InvalidOperationException(
                            $"Cannot pull scanner image: {waiting.Message ?? waiting.Reason}. " +
                            $"Build/push with scripts/build-push-scanners.sh and ensure Harbor credentials.");
                    }
                }
            }

            await Task.Delay(1500, cancellationToken);
        }

        throw new OperationCanceledException();
    }

    private async Task StreamPodLogsAsync(
        IKubernetes client,
        string ns,
        string podName,
        ScanJobs job,
        StringBuilder logBuilder,
        CancellationToken cancellationToken)
    {
        // Wait briefly for the scanner container to start accepting logs
        for (var i = 0; i < 30 && !cancellationToken.IsCancellationRequested; i++)
        {
            try
            {
                var pod = await client.CoreV1.ReadNamespacedPodAsync(podName, ns, cancellationToken: cancellationToken);
                var ready = pod.Status?.ContainerStatuses?.Any(c => c.Name == "scanner" && (c.State?.Running != null || c.State?.Terminated != null));
                if (ready == true) break;
            }
            catch { /* retry */ }
            await Task.Delay(1000, cancellationToken);
        }

        try
        {
            var response = await client.CoreV1.ReadNamespacedPodLogWithHttpMessagesAsync(
                podName,
                ns,
                container: "scanner",
                follow: true,
                cancellationToken: cancellationToken);

            await using var stream = response.Body;
            using var reader = new StreamReader(stream);
            while (!cancellationToken.IsCancellationRequested)
            {
                var line = await reader.ReadLineAsync(cancellationToken);
                if (line == null) break;
                if (logBuilder.Length < MaxLogChars)
                {
                    logBuilder.AppendLine(line);
                    streamHub.Publish(ScanJobStreamEvent.LogLine(job.Id, job.Scanner, line));
                }
            }
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception e)
        {
            logger.LogDebug(e, "Log stream ended for {Pod}", podName);
            // Fall back to one-shot log read (KubernetesClient returns a Stream)
            try
            {
                await using var stream = await client.CoreV1.ReadNamespacedPodLogAsync(
                    podName, ns, container: "scanner", cancellationToken: CancellationToken.None);
                using var reader = new StreamReader(stream);
                var text = await reader.ReadToEndAsync(CancellationToken.None);
                if (!string.IsNullOrEmpty(text) && logBuilder.Length == 0)
                {
                    logBuilder.Append(text);
                    foreach (var line in text.Split('\n').Where(l => l.Length > 0).Take(200))
                        streamHub.Publish(ScanJobStreamEvent.LogLine(job.Id, job.Scanner, line));
                }
            }
            catch { /* best-effort */ }
        }
    }

    private static async Task<bool> WaitJobFinishedAsync(
        IKubernetes client,
        string ns,
        string jobName,
        CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            var j = await client.BatchV1.ReadNamespacedJobAsync(jobName, ns, cancellationToken: cancellationToken);
            if ((j.Status?.Succeeded ?? 0) > 0) return true;
            if ((j.Status?.Failed ?? 0) > 0) return false;
            await Task.Delay(2000, cancellationToken);
        }

        throw new OperationCanceledException();
    }

    private static string Truncate(string log) =>
        log.Length <= MaxLogChars ? log : log[^MaxLogChars..];

    private static string EscapeShell(string value) =>
        value.Replace("'", "'\\''", StringComparison.Ordinal);

    private static string RepoNameFromUrl(string url)
    {
        var trimmed = url.TrimEnd('/');
        var slash = trimmed.LastIndexOf('/');
        var name = slash >= 0 ? trimmed[(slash + 1)..] : trimmed;
        return name.EndsWith(".git", StringComparison.OrdinalIgnoreCase)
            ? name[..^4]
            : name;
    }
}
