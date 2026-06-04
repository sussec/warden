using Warden.Application.Module.Project.Integration.GitHub;
using Warden.Application.Module.Project.Integration.Jira;
using Warden.Application.Module.Project.Integration.Mail;
using Warden.Application.Module.Project.Integration.Redmine;
using Warden.Application.Module.Project.Integration.Teams;
using Warden.Core;

namespace Warden.Application.Module.Project.Integration;

public class ProjectIntegrationModule : IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        // jira
        builder.AddScoped<IJiraProjectIntegrationSetting, JiraProjectIntegrationSetting>();
        // teams
        builder.AddScoped<ITeamsProjectIntegrationSetting, TeamsProjectIntegrationSetting>();
        // mail
        builder.AddScoped<IMailProjectIntegrationSetting, MailProjectIntegrationSetting>();
        // redmine
        builder.AddScoped<IRedmineProjectIntegrationSetting, RedmineProjectIntegrationSetting>();
        // github
        builder.AddScoped<IGitHubProjectIntegrationSetting, GitHubProjectIntegrationSetting>();
        return builder;
    }
}