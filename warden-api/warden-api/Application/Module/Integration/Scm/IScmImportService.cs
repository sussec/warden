using Warden.Application.Module.Integration.GitHub;
using Warden.Application.Module.Integration.GitLab;
using Warden.Application.Module.Project;
using Warden.Application.Module.Scan;
using Warden.Application.Module.Scan.Model;
using Warden.Application.Module.SourceControl;
using Warden.Application.Module.SourceControl.Model;
using Warden.Core.Entity;
using Warden.Core.Enum;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Integration.Scm;

public interface IScmImportService
{
    Task<List<ScmRepoInfo>> ListReposAsync(string provider, CancellationToken cancellationToken = default);
    Task<ImportScmReposResponse> ImportAsync(ImportScmReposRequest request, CancellationToken cancellationToken = default);
}

public class ScmImportService(
    AppDbContext context,
    IScanJobService scanJobService,
    ILogger<ScmImportService> logger
) : IScmImportService
{
    public async Task<List<ScmRepoInfo>> ListReposAsync(string provider, CancellationToken cancellationToken = default)
    {
        var p = provider.Trim().ToLowerInvariant();
        return p switch
        {
            "github" => await ListGitHubAsync(cancellationToken),
            "gitlab" => await ListGitLabAsync(cancellationToken),
            _ => throw new ArgumentException("provider must be github or gitlab")
        };
    }

    public async Task<ImportScmReposResponse> ImportAsync(
        ImportScmReposRequest request,
        CancellationToken cancellationToken = default)
    {
        var all = await ListReposAsync(request.Provider, cancellationToken);
        var selected = request.ImportAll
            ? all
            : all.Where(r =>
                    request.RepoIds.Contains(r.Id, StringComparer.OrdinalIgnoreCase) ||
                    request.RepoIds.Contains(r.FullName, StringComparer.OrdinalIgnoreCase))
                .ToList();

        if (selected.Count == 0)
            throw new ArgumentException("No repositories selected (or listing returned empty).");

        var scanners = (request.Scanners ?? [])
            .Select(s => s.Trim().ToLowerInvariant())
            .Where(s => !string.IsNullOrEmpty(s) && ScanJobService.Fleet.ContainsKey(s))
            .Distinct()
            .ToList();
        if (scanners.Count == 0)
            scanners = ["gitleaks"];

        var sourceType = request.Provider.Equals("gitlab", StringComparison.OrdinalIgnoreCase)
            ? SourceType.GitLab
            : SourceType.GitHub;

        var response = new ImportScmReposResponse();
        foreach (var repo in selected)
        {
            var row = new ImportScmRepoResult { FullName = repo.FullName, CloneUrl = repo.CloneUrl };
            try
            {
                var host = new Uri(repo.CloneUrl).GetLeftPart(UriPartial.Authority);
                var source = (await context.CreateSourceControlsAsync(new CreateSourceControlRequest
                {
                    Url = host,
                    Type = sourceType
                })).Value;

                var existing = await context.Projects.FirstOrDefaultAsync(
                    p => p.SourceControlId == source.Id && p.RepoId == repo.Id,
                    cancellationToken);

                var cloneUrl = repo.CloneUrl;
                if (!cloneUrl.EndsWith(".git", StringComparison.OrdinalIgnoreCase))
                    cloneUrl += ".git";

                var project = await context.CreateProjectAsync(new Projects
                {
                    Name = repo.FullName,
                    RepoId = repo.Id,
                    RepoUrl = cloneUrl,
                    SourceControlId = source.Id
                });

                row.ProjectId = project.Id;
                row.Created = existing == null;
                if (row.Created) response.Imported++;
                else response.Updated++;

                // Clean HTTPS URL only — PAT is injected at clone time (never stored on ScanJobs).
                var cloneTarget = project.RepoUrl;

                foreach (var scanner in scanners)
                {
                    try
                    {
                        var job = await scanJobService.CreateAsync(new CreateScanJobRequest
                        {
                            Scanner = scanner,
                            Target = cloneTarget,
                            RepoName = repo.FullName.Replace('/', '-'),
                            Branch = string.IsNullOrWhiteSpace(repo.DefaultBranch) ? null : repo.DefaultBranch
                        });
                        if (job.Id != Guid.Empty)
                        {
                            row.ScanJobIds.Add(job.Id);
                            response.ScansQueued++;
                        }
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning(ex, "Queue {Scanner} for {Repo} failed", scanner, repo.FullName);
                        row.Error = string.IsNullOrEmpty(row.Error)
                            ? $"{scanner}: {ex.Message}"
                            : $"{row.Error}; {scanner}: {ex.Message}";
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Import {Repo} failed", repo.FullName);
                row.Error = ex.Message;
            }

            response.Results.Add(row);
        }

        return response;
    }

    private async Task<List<ScmRepoInfo>> ListGitHubAsync(CancellationToken cancellationToken)
    {
        var setting = await context.GetGitHubSettingAsync();
        if (string.IsNullOrWhiteSpace(setting.Token))
            throw new InvalidOperationException(
                "GitHub token is not configured. Save a PAT under Setting → Integration → GitHub.");

        var client = new GitHubClient(setting.ApiUrl, setting.Token);
        var meta = await client.GetMetadataAsync(reload: true);
        if (meta.IsFailed)
            throw new InvalidOperationException(meta.Errors[0].Message);

        var existingSet = (await context.Projects.Select(p => p.RepoId).ToListAsync(cancellationToken))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return meta.Value.Repositories.Select(r =>
        {
            var id = r.Id > 0 ? r.Id.ToString() : r.FullName;
            return new ScmRepoInfo
            {
                Provider = "github",
                Id = id,
                FullName = r.FullName,
                CloneUrl = string.IsNullOrEmpty(r.CloneUrl)
                    ? $"https://github.com/{r.FullName}.git"
                    : r.CloneUrl,
                HtmlUrl = r.HtmlUrl,
                DefaultBranch = r.DefaultBranch,
                Private = r.Private,
                AlreadyImported = existingSet.Contains(id) || existingSet.Contains(r.FullName)
            };
        }).OrderBy(r => r.FullName, StringComparer.OrdinalIgnoreCase).ToList();
    }

    private async Task<List<ScmRepoInfo>> ListGitLabAsync(CancellationToken cancellationToken)
    {
        var setting = await context.GetGitLabSettingAsync();
        if (string.IsNullOrWhiteSpace(setting.Token))
            throw new InvalidOperationException(
                "GitLab token is not configured. Save a PAT under Setting → Integration → GitLab.");

        var client = new GitLabClient(setting.ApiUrl, setting.Token);
        var projects = await client.ListProjectsAsync(cancellationToken);
        if (projects.IsFailed)
            throw new InvalidOperationException(projects.Errors[0].Message);

        var existingSet = (await context.Projects.Select(p => p.RepoId).ToListAsync(cancellationToken))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return projects.Value.Select(r => new ScmRepoInfo
        {
            Provider = "gitlab",
            Id = r.Id.ToString(),
            FullName = r.PathWithNamespace,
            CloneUrl = r.HttpUrlToRepo,
            HtmlUrl = r.WebUrl,
            DefaultBranch = r.DefaultBranch,
            Private = r.Visibility != "public",
            AlreadyImported = existingSet.Contains(r.Id.ToString()) ||
                              existingSet.Contains(r.PathWithNamespace)
        }).OrderBy(r => r.FullName, StringComparer.OrdinalIgnoreCase).ToList();
    }

}
