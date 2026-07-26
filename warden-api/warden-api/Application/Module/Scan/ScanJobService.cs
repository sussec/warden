using Warden.Application.Module.Scan.Model;
using Warden.Core.Entity;
using Warden.Core.Enum;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Scan;

public interface IScanJobService
{
    Task<ScanJobInfo> CreateAsync(CreateScanJobRequest request);
    Task<List<ScanJobInfo>> ListAsync(ScanJobFilter filter, int limit = 50);
    Task<ScanJobInfo?> GetAsync(Guid id);
    Task<ScanRunnerCapability> GetCapabilityAsync(CancellationToken cancellationToken = default);
    Task<List<FleetPluginInfo>> ListFleetAsync(CancellationToken cancellationToken = default);
}

public class ScanJobService(
    AppDbContext context,
    IScanJobStreamHub streamHub,
    IScanExecutionBackend backend
) : IScanJobService
{
    /// Compose scan-profile services and the kind of target each expects.
    public static readonly IReadOnlyDictionary<string, ScanTargetType> Fleet =
        new Dictionary<string, ScanTargetType>(StringComparer.OrdinalIgnoreCase)
        {
            ["semgrep"] = ScanTargetType.Repository,
            ["gitleaks"] = ScanTargetType.Repository,
            ["trufflehog"] = ScanTargetType.Repository,
            ["trivy"] = ScanTargetType.Repository,
            ["grype"] = ScanTargetType.Repository,
            ["osv"] = ScanTargetType.Repository,
            ["cve-lite"] = ScanTargetType.Repository,
            ["cargo-audit"] = ScanTargetType.Repository,
            ["cargo-deny"] = ScanTargetType.Repository,
            ["cargo-geiger"] = ScanTargetType.Repository,
            ["trivy-license"] = ScanTargetType.Repository,
            ["kubescape"] = ScanTargetType.Repository,
            ["prowler"] = ScanTargetType.Cloud,
            ["syft"] = ScanTargetType.Repository,
            ["checkov"] = ScanTargetType.Repository,
            ["guarddog"] = ScanTargetType.Repository,
            ["deepsec"] = ScanTargetType.Repository,
            ["codeql"] = ScanTargetType.Repository,
            ["trivy-iac"] = ScanTargetType.Repository,
            ["dependency-check"] = ScanTargetType.Repository,
            ["kingfisher"] = ScanTargetType.Repository,
            ["trivy-image"] = ScanTargetType.Image,
            ["zap"] = ScanTargetType.Url,
            ["nuclei"] = ScanTargetType.Url,
            ["nikto"] = ScanTargetType.Url,
            ["augustus"] = ScanTargetType.Llm,
        };

    /// <summary>Full fleet as operator-facing plugin rows (all enabled for UI Run).</summary>
    public static List<FleetPluginInfo> BuildFleetPlugins(
        IReadOnlyDictionary<string, bool>? images,
        bool enabled = true)
    {
        return Fleet
            .OrderBy(kv => kv.Key, StringComparer.OrdinalIgnoreCase)
            .Select(kv => new FleetPluginInfo
            {
                Service = kv.Key,
                TargetType = kv.Value.ToString(),
                Enabled = enabled,
                ImageReady = images != null &&
                             images.TryGetValue(kv.Key, out var ready) && ready
            })
            .ToList();
    }

    public Task<ScanRunnerCapability> GetCapabilityAsync(CancellationToken cancellationToken = default) =>
        backend.GetCapabilityAsync(cancellationToken);

    public Task<List<FleetPluginInfo>> ListFleetAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(BuildFleetPlugins(null, enabled: true));

    public async Task<ScanJobInfo> CreateAsync(CreateScanJobRequest request)
    {
        if (!Fleet.TryGetValue(request.Scanner.Trim(), out var targetType))
            throw new ArgumentException($"Unknown scanner '{request.Scanner}'");
        var target = request.Target.Trim();
        if (string.IsNullOrEmpty(target))
            throw new ArgumentException("Target is required");
        // Persist clean URLs only — credentials are injected at clone time.
        if (targetType == ScanTargetType.Repository && DockerScanExecutionBackend.IsGitUrl(target))
            target = Core.Utils.SecretRedactor.StripUrlCredentials(target);
        if (targetType == ScanTargetType.Repository && !target.StartsWith('/') && !DockerScanExecutionBackend.IsGitUrl(target))
            throw new ArgumentException(
                "Repository target must be a git URL (recommended) or an absolute host path");
        if (targetType == ScanTargetType.Url && !Uri.TryCreate(target, UriKind.Absolute, out _))
            throw new ArgumentException("Target must be an absolute URL");

        // Fail fast so the UI never queues jobs that the worker will immediately reject.
        if (!backend.IsAvailable)
            throw new InvalidOperationException(
                "Scan runner is not available. Mount the Docker socket and set DOCKER_GID (or switch to the K8s backend).");
        if (string.IsNullOrWhiteSpace(Configuration.ScanToken))
            throw new InvalidOperationException(
                "WARDEN_TOKEN is not set. Create a CI token under Settings → Access Token and put it in .env.");

        var job = new ScanJobs
        {
            Scanner = request.Scanner.Trim().ToLowerInvariant(),
            TargetType = targetType,
            Target = target,
            RepoName = request.RepoName?.Trim(),
            Branch = request.Branch?.Trim(),
            Status = ScanJobStatus.Queued,
            CreatedAt = DateTime.UtcNow
        };
        context.ScanJobs.Add(job);
        await context.SaveChangesAsync();
        var info = ToInfo(job);
        streamHub.Publish(ScanJobStreamEvent.FromJob(info, "job.queued"));
        return info;
    }

    public async Task<List<ScanJobInfo>> ListAsync(ScanJobFilter filter, int limit = 50)
    {
        return await context.ScanJobs
            .Where(job =>
                (filter.Scanner == null || job.Scanner == filter.Scanner) &&
                (filter.Status == null || job.Status == filter.Status))
            .OrderByDescending(job => job.CreatedAt)
            .Take(limit)
            .Select(job => ToInfo(job))
            .ToListAsync();
    }

    public async Task<ScanJobInfo?> GetAsync(Guid id)
    {
        var job = await context.ScanJobs.FirstOrDefaultAsync(record => record.Id == id);
        return job == null ? null : ToInfo(job);
    }

    private static ScanJobInfo ToInfo(ScanJobs job) => new()
    {
        Id = job.Id,
        Scanner = job.Scanner,
        TargetType = job.TargetType,
        // Never expose embedded PATs / basic-auth in clone URLs to the UI.
        Target = Core.Utils.SecretRedactor.Redact(job.Target),
        RepoName = job.RepoName,
        Branch = job.Branch,
        Status = job.Status,
        Log = Core.Utils.SecretRedactor.Redact(job.Log),
        CreatedAt = job.CreatedAt,
        StartedAt = job.StartedAt,
        CompletedAt = job.CompletedAt
    };
}
