using Warden.Application.Module.Integration.Jira.Client;

namespace Warden.Application.Module.Project.Integration.Jira;

public record JiraProjectSettingResponse: JiraProjectSetting
{
    public required List<JiraProject> JiraProjects { get; set; }
}