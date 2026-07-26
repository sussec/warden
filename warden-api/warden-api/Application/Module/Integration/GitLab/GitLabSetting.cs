namespace Warden.Application.Module.Integration.GitLab;

/// <summary>
/// Global GitLab PAT settings (mirrors GitHubSetting).
/// Stored as JSON in AppSettings.GitLabSetting.
/// </summary>
public record GitLabSetting
{
    public bool Active { get; set; }
    /// <summary>GitLab API root, e.g. https://gitlab.com/api/v4 or self-managed https://gitlab.example.com/api/v4</summary>
    public string ApiUrl { get; set; } = "https://gitlab.com/api/v4";
    public string Token { get; set; } = string.Empty;
    /// <summary>True when a PAT is stored server-side (token value is never returned to the UI).</summary>
    public bool TokenConfigured { get; set; }
}
