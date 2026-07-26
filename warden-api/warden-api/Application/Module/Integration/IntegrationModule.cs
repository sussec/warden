using Warden.Application.Module.Integration.GitHub;
using Warden.Application.Module.Integration.GitLab;
using Warden.Application.Module.Integration.Jira;
using Warden.Application.Module.Integration.JiraWebhook;
using Warden.Application.Module.Integration.Mail;
using Warden.Application.Module.Integration.Redmine;
using Warden.Application.Module.Integration.Scm;
using Warden.Application.Module.Integration.Teams;
using Warden.Application.Services;
using Warden.Core;

namespace Warden.Application.Module.Integration;

public class IntegrationModule : IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        //mail
        builder.AddScoped<IMailAlertSettingService, MailAlertSettingService>();
        builder.AddScoped<MailAlertSetting>(sp =>
        {
            var context = sp.GetRequiredService<AppDbContext>();
            return context.GetMailAlertSettingAsync().Result;
        });
        // teams
        builder.AddScoped<ITeamsAlertSettingService, TeamsAlertSettingService>();
        builder.AddScoped<TeamsAlertSetting>(sp =>
        {
            var context = sp.GetRequiredService<AppDbContext>();
            return context.GetTeamsAlertSettingAsync().Result;
        });
        // jira
        builder.AddScoped<IJiraSettingService, JiraSettingService>();
        builder.AddScoped<JiraTicketTracker>();
        builder.AddScoped<JiraSetting>(sp =>
        {
            var context = sp.GetRequiredService<AppDbContext>();
            return context.GetJiraSettingAsync().Result;
        });
        // jira webhook
        builder.AddScoped<IJiraWebHookService, JiraWebHookService>();
        builder.AddScoped<IJiraWebhookSettingService, JIraWebhookSettingService>();
        // redmine
        builder.AddScoped<IRedmineSettingService, RedmineSettingService>();
        builder.AddScoped<RedmineTicketTracker>();
        // github (PAT issues — no GitHub App)
        builder.AddScoped<IGitHubSettingService, GitHubSettingService>();
        builder.AddScoped<GitHubTicketTracker>();
        builder.AddScoped<GitHubSetting>(sp =>
        {
            var context = sp.GetRequiredService<AppDbContext>();
            return context.GetGitHubSettingAsync().Result;
        });
        // gitlab (PAT issues — CodeRabbit-style, no OAuth App)
        builder.AddScoped<GitLabTicketTracker>();
        // scm bulk import (github + gitlab repo discovery → projects + scan jobs)
        builder.AddScoped<IScmImportService, ScmImportService>();
        //
        builder.AddScoped<ITicketTrackerManager, TicketTrackerManager>();
        builder.AddScoped<IGlobalAlertManager, GlobalAlertManager>();
        return builder;
    }
}