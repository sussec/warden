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
}

public class ScanJobService(AppDbContext context) : IScanJobService
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
            ["syft"] = ScanTargetType.Repository,
            ["checkov"] = ScanTargetType.Repository,
            ["guarddog"] = ScanTargetType.Repository,
            ["deepsec"] = ScanTargetType.Repository,
            ["trivy-iac"] = ScanTargetType.Repository,
            ["dependency-check"] = ScanTargetType.Repository,
            ["kingfisher"] = ScanTargetType.Repository,
            ["trivy-image"] = ScanTargetType.Image,
            ["zap"] = ScanTargetType.Url,
            ["nuclei"] = ScanTargetType.Url,
            ["nikto"] = ScanTargetType.Url,
            ["augustus"] = ScanTargetType.Llm,
        };

    public async Task<ScanJobInfo> CreateAsync(CreateScanJobRequest request)
    {
        if (!Fleet.TryGetValue(request.Scanner.Trim(), out var targetType))
            throw new ArgumentException($"Unknown scanner '{request.Scanner}'");
        var target = request.Target.Trim();
        if (string.IsNullOrEmpty(target))
            throw new ArgumentException("Target is required");
        if (targetType == ScanTargetType.Repository && !target.StartsWith('/') && !ScanRunnerWorker.IsGitUrl(target))
            throw new ArgumentException("Repository target must be an absolute host path or a git URL");
        if (targetType == ScanTargetType.Url && !Uri.TryCreate(target, UriKind.Absolute, out _))
            throw new ArgumentException("Target must be an absolute URL");

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
        return ToInfo(job);
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
        Target = job.Target,
        RepoName = job.RepoName,
        Branch = job.Branch,
        Status = job.Status,
        Log = job.Log,
        CreatedAt = job.CreatedAt,
        StartedAt = job.StartedAt,
        CompletedAt = job.CompletedAt
    };
}
