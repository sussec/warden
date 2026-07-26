using Warden.Application.Module.Ai;
using Warden.Application.Module.Integration;
using Warden.Application.Module.Integration.GitHub;
using Warden.Application.Module.Integration.GitLab;
using Warden.Application.Module.Integration.Jira;
using Warden.Application.Module.Integration.Redmine;
using Warden.Core.Entity;
using Warden.Core.Enum;
using FluentResults;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Finding.Command;

public class CreateFindingTicketCommand(
    AppDbContext context,
    IFindingAiService? findingAiService = null
)
{
    public async Task<Result<Tickets>> ExecuteAsync(Guid findingId, TicketType ticketType)
    {
        var finding = await context.Findings.FirstOrDefaultAsync(finding => finding.Id == findingId);
        if (finding == null)
        {
            return Result.Fail("Finding not found");
        }

        var project = context.Projects.First(record => record.Id == finding.ProjectId);
        var scanner = context.Scanners.First(record => record.Id == finding.ScannerId);
        var scanFinding = await context.ScanFindings
            .Include(record => record.Scan!)
            .OrderByDescending(record => record.Scan!.CompletedAt)
            .Where(record => record.FindingId == finding.Id)
            .FirstAsync();

        // Optional AI enrichment for ticket body (PAT trackers / Jira / Redmine).
        // Never fails ticket creation if AI is off or errors — falls back to stored recommendation.
        if (findingAiService != null && string.IsNullOrWhiteSpace(finding.Recommendation))
        {
            try
            {
                var ai = await findingAiService.GenerateRemediationAsync(findingId);
                if (ai.IsSuccess && !string.IsNullOrWhiteSpace(ai.Value.Content))
                {
                    finding.Recommendation = ai.Value.Content;
                }
            }
            catch
            {
                /* ticket still created without AI body */
            }
        }

        var ticket = new SastTicket
        {
            Commit = scanFinding.CommitHash,
            Project = project,
            Finding = finding,
            Scanner = scanner
        };
        if (ticketType == TicketType.Jira)
        {
            var jiraTicketTracker = new JiraTicketTracker(context);
            return await jiraTicketTracker.CreateTicketAsync(ticket);
        }

        if (ticketType == TicketType.Redmine)
        {
            var redmineTicketTracker = new RedmineTicketTracker(context);
            return await redmineTicketTracker.CreateTicketAsync(ticket);
        }

        if (ticketType == TicketType.GitHub)
        {
            var gitHubTicketTracker = new GitHubTicketTracker(context);
            return await gitHubTicketTracker.CreateTicketAsync(ticket);
        }

        if (ticketType == TicketType.GitLab)
        {
            var gitLabTicketTracker = new GitLabTicketTracker(context);
            return await gitLabTicketTracker.CreateTicketAsync(ticket);
        }

        return Result.Fail("Ticket type not supported");
    }
}