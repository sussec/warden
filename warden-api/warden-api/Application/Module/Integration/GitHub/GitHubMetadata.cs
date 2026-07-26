namespace Warden.Application.Module.Integration.GitHub;

public record GitHubRepository
{
    public required string Owner { get; set; }
    public required string Name { get; set; }
    public required string FullName { get; set; }
    /// <summary>HTTPS clone URL for the scan runner.</summary>
    public string CloneUrl { get; set; } = string.Empty;
    public string HtmlUrl { get; set; } = string.Empty;
    public string DefaultBranch { get; set; } = "main";
    public bool Private { get; set; }
    /// <summary>Stable GitHub repo id used as Projects.RepoId.</summary>
    public long Id { get; set; }
}

public record GitHubMetadata
{
    public required List<GitHubRepository> Repositories { get; set; }
}
