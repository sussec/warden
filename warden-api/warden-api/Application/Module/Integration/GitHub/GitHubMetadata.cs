namespace Warden.Application.Module.Integration.GitHub;

public record GitHubRepository
{
    public required string Owner { get; set; }
    public required string Name { get; set; }
    public required string FullName { get; set; }
}

public record GitHubMetadata
{
    public required List<GitHubRepository> Repositories { get; set; }
}
