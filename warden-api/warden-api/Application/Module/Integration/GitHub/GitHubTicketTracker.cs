using Warden.Application.Helpers;
using Warden.Application.Module.Project;
using Warden.Application.Module.Project.Integration.GitHub;
using Warden.Application.Module.SourceControl;
using Warden.Core.Entity;
using Warden.Core.Enum;
using FluentResults;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Integration.GitHub;

/// <summary>
/// Creates GitHub issues via PAT. Target repo is resolved per-project:
/// 1) Project.RepoUrl (source of truth for imported projects)
/// 2) Project-level Owner/Repo override
/// 3) Global Owner/Repo only as last resort
/// </summary>
public class GitHubTicketTracker(AppDbContext context) : ITicketTracker
{
    public async Task<Result<Tickets>> CreateTicketAsync(SastTicket request)
    {
        var globalSetting = await context.GetGitHubSettingAsync();
        if (!globalSetting.Active || string.IsNullOrWhiteSpace(globalSetting.Token))
            return Result.Fail("GitHub is not active or token is missing. Configure Settings → Integrations → GitHub.");

        try
        {
            var projectSettings = (await context.GetProjectSettingsAsync(request.Project.Id)).Value;
            var rawProject = projectSettings.GetGitHubSettingRaw();
            if (!TryResolveOwnerRepo(request.Project, rawProject, globalSetting, out var owner, out var repo))
            {
                return Result.Fail(
                    "Cannot resolve GitHub owner/repo for this project. " +
                    "Set Project → Integrations → GitHub Issues (owner/repo), or ensure Repo URL is a github.com clone URL.");
            }

            var gitHubClient = new GitHubClient(globalSetting.ApiUrl, globalSetting.Token);
            var description = request.Finding.Description ?? "";
            description += $"\n\n**Severity:** {request.Finding.Severity.ToString().ToUpperInvariant()}";
            description += $"\n\n**Project:** {request.Project.Name}";
            if (!string.IsNullOrWhiteSpace(request.Project.RepoUrl))
                description +=
                    $"\n\n**Repo:** [{owner}/{repo}]({GitRepoHelpers.NormalizeBrowseUrl(request.Project.RepoUrl)})";

            var sourceType = (await context.GetSourceControlsByIdAsync(request.Project.SourceControlId)).Value.Type;
            if (!string.IsNullOrEmpty(request.Finding.Location) && !string.IsNullOrEmpty(request.Commit))
            {
                var location = GitRepoHelpers.UrlByCommit(
                    sourceType,
                    request.Project.RepoUrl ?? $"https://github.com/{owner}/{repo}",
                    request.Commit,
                    request.Finding.Location!,
                    request.Finding.StartLine,
                    request.Finding.EndLine);
                description += $"\n\n**Location:** [{request.Finding.Location}]({location})";
            }
            else if (!string.IsNullOrEmpty(request.Finding.Location))
            {
                description += $"\n\n**Location:** `{request.Finding.Location}`";
            }

            if (!string.IsNullOrEmpty(request.Finding.Snippet))
                description += $"\n```\n{request.Finding.Snippet}\n```";

            if (!string.IsNullOrEmpty(request.Finding.Recommendation))
                description += $"\n\n**Recommendation**\n{request.Finding.Recommendation}";

            description += $"\n\n**Found by:** {request.Scanner.Name}";
            description += "\n\n---\n*Created by Warden*";

            var labels = rawProject.Labels is { Count: > 0 }
                ? rawProject.Labels
                : new List<string> { "security", "warden" };

            var issueResult = await gitHubClient.CreateIssueAsync(owner, repo, new GitHubIssueRequest
            {
                Title = $"[{request.Project.Name}] {request.Finding.Name}",
                Body = description,
                Labels = labels
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
        var globalSetting = await context.GetGitHubSettingAsync();
        if (!globalSetting.Active || string.IsNullOrWhiteSpace(globalSetting.Token))
            return Result.Fail("GitHub is not active or token is missing.");
        if (request.Vulnerabilities.Count == 0)
            return Result.Fail("No vulnerabilities on package — nothing to ticket.");

        try
        {
            var projectSettings = (await context.GetProjectSettingsAsync(request.Project.Id)).Value;
            var rawProject = projectSettings.GetGitHubSettingRaw();
            if (!TryResolveOwnerRepo(request.Project, rawProject, globalSetting, out var owner, out var repo))
            {
                return Result.Fail(
                    "Cannot resolve GitHub owner/repo for this project. " +
                    "Configure Project → Integrations → GitHub Issues or a valid Repo URL.");
            }

            var gitHubClient = new GitHubClient(globalSetting.ApiUrl, globalSetting.Token);
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

            description += $"\n\n**Project:** {request.Project.Name}";
            description += $"\n\n**Repo:** https://github.com/{owner}/{repo}";
            description += $"\n\n**Location:** {request.Location}";
            description +=
                $"\n\n**Recommendation**\nUpgrade {package.FullName()}@{package.Version} to version {package.FixedVersion}";
            description += "\n\n---\n*Created by Warden*";

            var labels = rawProject.Labels is { Count: > 0 }
                ? rawProject.Labels
                : new List<string> { "security", "warden", "dependency" };

            var issueResult = await gitHubClient.CreateIssueAsync(owner, repo, new GitHubIssueRequest
            {
                Title =
                    $"[{request.Project.Name}] Upgrade {package.FullName()}@{package.Version} → {package.FixedVersion}",
                Body = description,
                Labels = labels
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
    /// Priority: project RepoUrl → project Owner/Repo → global Owner/Repo (last resort).
    /// </summary>
    internal static bool TryResolveOwnerRepo(
        Projects project,
        GitHubProjectSetting projectSetting,
        GitHubSetting globalSetting,
        out string owner,
        out string repo)
    {
        if (GitRepoHelpers.TryParseGitHubOwnerRepo(project.RepoUrl, out owner, out repo))
            return true;

        if (!string.IsNullOrWhiteSpace(projectSetting.Owner) && !string.IsNullOrWhiteSpace(projectSetting.Repo))
        {
            owner = projectSetting.Owner.Trim();
            repo = projectSetting.Repo.Trim();
            return true;
        }

        if (!string.IsNullOrWhiteSpace(globalSetting.Owner) && !string.IsNullOrWhiteSpace(globalSetting.Repo))
        {
            owner = globalSetting.Owner.Trim();
            repo = globalSetting.Repo.Trim();
            return true;
        }

        owner = string.Empty;
        repo = string.Empty;
        return false;
    }

    private async Task<Tickets> PersistTicketAsync(GitHubIssueResponse issue)
    {
        var ticket = context.Tickets.FirstOrDefault(record =>
            record.Type == TicketType.GitHub &&
            record.Name == issue.Number.ToString() &&
            record.Url == issue.HtmlUrl);
        if (ticket != null) return ticket;

        ticket = context.Tickets.FirstOrDefault(record =>
            record.Type == TicketType.GitHub && record.Name == issue.Number.ToString());
        if (ticket == null)
        {
            ticket = new Tickets
            {
                Name = issue.Number.ToString(),
                Type = TicketType.GitHub,
                Url = issue.HtmlUrl
            };
            context.Tickets.Add(ticket);
            await context.SaveChangesAsync();
        }
        else if (string.IsNullOrEmpty(ticket.Url))
        {
            ticket.Url = issue.HtmlUrl;
            await context.SaveChangesAsync();
        }

        return ticket;
    }
}
