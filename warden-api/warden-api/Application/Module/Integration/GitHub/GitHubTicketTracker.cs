using Warden.Application.Helpers;
using Warden.Application.Module.Project;
using Warden.Application.Module.SourceControl;
using Warden.Core.Entity;
using Warden.Core.Enum;
using FluentResults;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Integration.GitHub;

public class GitHubTicketTracker(AppDbContext context) : ITicketTracker
{
    private readonly GitHubSetting globalSetting = context.GetGitHubSettingAsync().Result;

    public async Task<Result<Tickets>> CreateTicketAsync(SastTicket request)
    {
        if (globalSetting.Active)
        {
            var gitHubClient = new GitHubClient(globalSetting.ApiUrl, globalSetting.Token);
            try
            {
                var projectSetting =
                    (await context.GetProjectSettingsAsync(request.Project.Id)).Value.GetGitHubSetting(globalSetting);
                string description = request.Finding.Description;
                description += $"\n\n**Severity:** {request.Finding.Severity.ToString().ToUpper()}";
                description += $"\n\n**Repo:** [{request.Project.Name}]({request.Project.RepoUrl})";
                var sourceType = (await context.GetSourceControlsByIdAsync(request.Project.SourceControlId)).Value
                    .Type;
                var location = GitRepoHelpers.UrlByCommit(sourceType, request.Project.RepoUrl, request.Commit,
                    request.Finding.Location!, request.Finding.StartLine, request.Finding.EndLine);
                description += $"\n\n**Location:** [{request.Finding.Location}]({location})";
                if (!string.IsNullOrEmpty(request.Finding.Snippet))
                {
                    description += $"\n```\n{request.Finding.Snippet}\n```";
                }

                if (!string.IsNullOrEmpty(request.Finding.Recommendation))
                {
                    description += $"\n\n**Recommendation**\n{request.Finding.Recommendation}";
                }

                description += $"\n\n**Found by:** {request.Scanner.Name}";
                var issueResult = await gitHubClient.CreateIssueAsync(projectSetting.Owner, projectSetting.Repo,
                    new GitHubIssueRequest
                    {
                        Title = $"[{request.Project.Name}] {request.Finding.Name}",
                        Body = description,
                        Labels = projectSetting.Labels
                    });
                if (issueResult.IsFailed)
                {
                    return Result.Fail<Tickets>(issueResult.Errors);
                }

                var ticket = await CreateTicketAsync(issueResult.Value);
                await UpdateTicketFindingAsync(request.Finding.Id, ticket);
                return ticket;
            }
            catch (Exception e)
            {
                return Result.Fail(e.Message);
            }
        }

        return Result.Fail("GitHub is not active");
    }

    public async Task<Result<Tickets>> CreateTicketAsync(ScaTicket request)
    {
        if (globalSetting.Active && request.Vulnerabilities.Count > 0)
        {
            var gitHubClient = new GitHubClient(globalSetting.ApiUrl, globalSetting.Token);
            try
            {
                var package = request.Package;
                var projectSetting = (await context.GetProjectSettingsAsync(request.Project.Id))
                    .Value.GetGitHubSetting(globalSetting);
                request.Vulnerabilities.Sort((v1, v2) => v2.Severity - v1.Severity);
                var description =
                    $"The package **{package.FullName()}@{package.Version}** currently in use contains known security vulnerabilities that may pose a risk to our system’s security and stability. Below is the list of identified vulnerabilities:\n\n";
                description += "|Name |Severity |Fix Version |\n";
                description += "|-- |-- |-- |\n";
                foreach (var vulnerability in request.Vulnerabilities)
                {
                    description +=
                        $"|{vulnerability.Name}|{vulnerability.Severity.ToString().ToUpper()}|{vulnerability.FixedVersion}|\n";
                }

                description += $"\n\n**Repo:** [{request.Project.Name}]({request.Project.RepoUrl})";
                description += $"\n\n**Location:** {request.Location}";
                description +=
                    $"\n\n**Recommendation**\nUpgrade {package.FullName()}@{package.Version} to version {package.FixedVersion}";
                var issueResult = await gitHubClient.CreateIssueAsync(projectSetting.Owner, projectSetting.Repo,
                    new GitHubIssueRequest
                    {
                        Title =
                            $"[{request.Project.Name}] Upgrade package {package.FullName()}@{package.Version} to version {package.FixedVersion} at {request.Location}",
                        Body = description,
                        Labels = projectSetting.Labels
                    });
                if (issueResult.IsFailed)
                {
                    return Result.Fail<Tickets>(issueResult.Errors);
                }

                var ticket = await CreateTicketAsync(issueResult.Value);
                await UpdateTicketPackageProjectAsync(projectId: request.Project.Id, packageId: request.Package.Id,
                    ticket);
                return ticket;
            }
            catch (Exception e)
            {
                return Result.Fail(e.Message);
            }
        }

        return Result.Fail("GitHub is not active");
    }

    private async Task<Tickets> CreateTicketAsync(GitHubIssueResponse issue)
    {
        var ticket = context.Tickets.FirstOrDefault(record =>
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

        return ticket;
    }

    private async Task UpdateTicketPackageProjectAsync(Guid projectId, Guid packageId, Tickets ticket)
    {
        await context.ProjectPackages.Where(record => record.ProjectId == projectId && record.PackageId == packageId)
            .ExecuteUpdateAsync(setter => setter.SetProperty(record => record.TicketId, ticket.Id));
    }

    private async Task UpdateTicketFindingAsync(Guid findingId, Tickets ticket)
    {
        await context.Findings.Where(record => record.Id == findingId)
            .ExecuteUpdateAsync(setter => setter.SetProperty(record => record.TicketId, ticket.Id));
    }
}
