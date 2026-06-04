namespace Warden.Application.Module.Integration.GitHub;

public record GitHubSetting
{
    public bool Active { get; set; }
    public string ApiUrl { get; set; } = "https://api.github.com";
    public string Token { get; set; } = string.Empty;
    public string Owner { get; set; } = string.Empty;
    public string Repo { get; set; } = string.Empty;
}
