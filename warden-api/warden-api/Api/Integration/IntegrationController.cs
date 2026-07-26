using Warden.Application;
using Warden.Application.Module.Integration;
using Warden.Application.Module.Integration.GitHub;
using Warden.Application.Module.Integration.GitLab;
using Warden.Application.Module.Integration.Jira;
using Warden.Application.Module.Integration.JiraWebhook;
using Warden.Application.Module.Integration.Mail;
using Warden.Application.Module.Integration.Redmine;
using Warden.Application.Module.Integration.Teams;
using Warden.Authentication;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Integration;

[ApiExplorerSettings(GroupName = "Integration")]
public class IntegrationController(
    AppDbContext context
) : BaseController
{
    [HttpGet]
    [Permission(PermissionType.Config, PermissionAction.Read)]
    public async Task<IntegrationStatus> GetIntegrationSetting()
    {
        return new IntegrationStatus
        {
            Mail = (await context.GetMailAlertSettingAsync()).Active,
            Jira = (await context.GetJiraSettingAsync()).Active,
            Teams = (await context.GetTeamsAlertSettingAsync()).Active,
            JiraWebhook = (await context.GetJiraWebhookSettingAsync()).Active,
            Redmine = (await context.GetRedmineSettingAsync()).Active,
        };
    }

    [HttpGet]
    [Route("ticket-tracker-status")]
    public async Task<TicketTrackerStatus> GetTicketTrackerStatus()
    {
        var gh = await context.GetGitHubSettingAsync();
        var gl = await context.GetGitLabSettingAsync();
        return new TicketTrackerStatus
        {
            Jira = (await context.GetJiraSettingAsync()).Active,
            Redmine = (await context.GetRedmineSettingAsync()).Active,
            // PAT-based issues — no GitHub App / GitLab OAuth App required.
            GitHub = gh.Active && !string.IsNullOrWhiteSpace(gh.Token),
            GitLab = gl.Active && !string.IsNullOrWhiteSpace(gl.Token)
        };
    }
}