using Warden.Application.Helpers;
using Warden.Application.Module.SourceControl;
using Warden.Core.Entity;
using Warden.Core.Enum;
using FluentResults;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Integration.GitLab;

/// <summary>
/// Create GitLab issues from findings/packages using a PAT (no OAuth App).
/// Mirrors CodeRabbit's GitLab model: personal/group access token + REST API.
/// </summary>
public class GitLabTicketTracker(AppDbContext context) : ITicketTracker
{
    public async Task<Result<Tickets>> CreateTicketAsync(SastTicket request)
    {
        var setting = await context.GetGitLabSettingAsync();
        if (!setting.Active || string.IsNullOrWhiteSpace(setting.Token))
            return Result.Fail("GitLab is not active or token is missing. Configure Settings → Integrations → GitLab.");

        var projectRef = ResolveProjectRef(request.Project);
        if (string.IsNullOrEmpty(projectRef))
            return Result.Fail(
                "Cannot resolve GitLab project from repo URL. Import from GitLab or set a valid https://…/group/project.git URL.");

        try
        {
            var client = new GitLabClient(setting.ApiUrl, setting.Token);
            var description = request.Finding.Description ?? "";
            description += $"\n\n**Severity:** {request.Finding.Severity.ToString().ToUpperInvariant()}";
            description += $"\n\n**Repo:** [{request.Project.Name}]({request.Project.RepoUrl})";

            var sourceType = (await context.GetSourceControlsByIdAsync(request.Project.SourceControlId)).Value.Type;
            if (!string.IsNullOrEmpty(request.Finding.Location))
            {
                var location = GitRepoHelpers.UrlByCommit(
                    sourceType,
                    request.Project.RepoUrl,
                    request.Commit,
                    request.Finding.Location!,
                    request.Finding.StartLine,
                    request.Finding.EndLine);
                description += $"\n\n**Location:** [{request.Finding.Location}]({location})";
            }

            if (!string.IsNullOrEmpty(request.Finding.Snippet))
                description += $"\n```\n{request.Finding.Snippet}\n```";

            if (!string.IsNullOrEmpty(request.Finding.Recommendation))
                description += $"\n\n**Recommendation**\n{request.Finding.Recommendation}";

            description += $"\n\n**Found by:** {request.Scanner.Name}";
            description += "\n\n---\n*Created by Warden*";

            var issueResult = await client.CreateIssueAsync(projectRef, new GitLabIssueRequest
            {
                Title = $"[{request.Project.Name}] {request.Finding.Name}",
                Description = description,
                Labels = "security,warden"
            });
            if (issueResult.IsFailed)
                return Result.Fail<Tickets>(issueResult.Errors);

            var ticket = await PersistTicketAsync(issueResult.Value);
            await context.Findings.Where(f => f.Id == request.Finding.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(f => f.TicketId, ticket.Id));
            return ticket;
        }
        catch (Exception e)
        {
            return Result.Fail(e.Message);
        }
    }

    public async Task<Result<Tickets>> CreateTicketAsync(ScaTicket request)
    {
        var setting = await context.GetGitLabSettingAsync();
        if (!setting.Active || string.IsNullOrWhiteSpace(setting.Token))
            return Result.Fail("GitLab is not active or token is missing. Configure Settings → Integrations → GitLab.");
        if (request.Vulnerabilities.Count == 0)
            return Result.Fail("No vulnerabilities on package — nothing to ticket.");

        var projectRef = ResolveProjectRef(request.Project);
        if (string.IsNullOrEmpty(projectRef))
            return Result.Fail(
                "Cannot resolve GitLab project from repo URL. Import from GitLab or set a valid https://…/group/project.git URL.");

        try
        {
            var client = new GitLabClient(setting.ApiUrl, setting.Token);
            var package = request.Package;
            request.Vulnerabilities.Sort((v1, v2) => v2.Severity - v1.Severity);
            var description =
                $"The package **{package.FullName()}@{package.Version}** contains known security vulnerabilities.\n\n";
            description += "|Name |Severity |Fix Version |\n|-- |-- |-- |\n";
            foreach (var vulnerability in request.Vulnerabilities)
            {
                description +=
                    $"|{vulnerability.Name}|{vulnerability.Severity.ToString().ToUpperInvariant()}|{vulnerability.FixedVersion}|\n";
            }

            description += $"\n\n**Repo:** [{request.Project.Name}]({request.Project.RepoUrl})";
            description += $"\n\n**Location:** {request.Location}";
            description +=
                $"\n\n**Recommendation**\nUpgrade {package.FullName()}@{package.Version} to version {package.FixedVersion}";
            description += "\n\n---\n*Created by Warden*";

            var issueResult = await client.CreateIssueAsync(projectRef, new GitLabIssueRequest
            {
                Title =
                    $"[{request.Project.Name}] Upgrade {package.FullName()}@{package.Version} → {package.FixedVersion}",
                Description = description,
                Labels = "security,warden,dependency"
            });
            if (issueResult.IsFailed)
                return Result.Fail<Tickets>(issueResult.Errors);

            var ticket = await PersistTicketAsync(issueResult.Value);
            await context.ProjectPackages
                .Where(p => p.ProjectId == request.Project.Id && p.PackageId == request.Package.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.TicketId, ticket.Id));
            return ticket;
        }
        catch (Exception e)
        {
            return Result.Fail(e.Message);
        }
    }

    /// <summary>
    /// Prefer numeric RepoId (GitLab project id from import); else path from clone URL.
    /// </summary>
    internal static string? ResolveProjectRef(Projects project)
    {
        if (!string.IsNullOrWhiteSpace(project.RepoId) && long.TryParse(project.RepoId.Trim(), out _))
            return project.RepoId.Trim();

        return PathFromRepoUrl(project.RepoUrl);
    }

    internal static string? PathFromRepoUrl(string? repoUrl)
    {
        if (string.IsNullOrWhiteSpace(repoUrl)) return null;
        try
        {
            var clean = repoUrl.Trim();
            // strip credentials if any
            if (clean.Contains('@') && clean.Contains("://"))
            {
                var schemeEnd = clean.IndexOf("://", StringComparison.Ordinal);
                var at = clean.IndexOf('@');
                if (at > schemeEnd)
                    clean = clean[..(schemeEnd + 3)] + clean[(at + 1)..];
            }

            if (clean.StartsWith("git@", StringComparison.OrdinalIgnoreCase))
            {
                // git@host:group/project.git
                var colon = clean.IndexOf(':');
                if (colon < 0) return null;
                var path = clean[(colon + 1)..].TrimStart('/');
                if (path.EndsWith(".git", StringComparison.OrdinalIgnoreCase))
                    path = path[..^4];
                return string.IsNullOrEmpty(path) ? null : path;
            }

            if (!Uri.TryCreate(clean, UriKind.Absolute, out var uri))
                return null;
            var segments = uri.AbsolutePath.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length < 2) return null;
            var last = segments[^1];
            if (last.EndsWith(".git", StringComparison.OrdinalIgnoreCase))
                segments[^1] = last[..^4];
            return string.Join('/', segments);
        }
        catch
        {
            return null;
        }
    }

    private async Task<Tickets> PersistTicketAsync(GitLabIssueResponse issue)
    {
        var name = issue.Iid.ToString();
        var ticket = context.Tickets.FirstOrDefault(t =>
            t.Type == TicketType.GitLab && t.Name == name && t.Url == issue.WebUrl);
        if (ticket != null) return ticket;

        ticket = context.Tickets.FirstOrDefault(t =>
            t.Type == TicketType.GitLab && t.Name == name);
        if (ticket == null)
        {
            ticket = new Tickets
            {
                Name = name,
                Type = TicketType.GitLab,
                Url = issue.WebUrl
            };
            context.Tickets.Add(ticket);
            await context.SaveChangesAsync();
        }
        else if (string.IsNullOrEmpty(ticket.Url) && !string.IsNullOrEmpty(issue.WebUrl))
        {
            ticket.Url = issue.WebUrl;
            await context.SaveChangesAsync();
        }

        return ticket;
    }
}
