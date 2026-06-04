namespace Warden.Application.Module.Project.Integration.GitHub;

public record GitHubProjectSetting
{
    public bool Active { get; set; }
    public string Owner { get; set; } = string.Empty;
    public string Repo { get; set; } = string.Empty;
    public List<string> Labels { get; set; } = [];
}
