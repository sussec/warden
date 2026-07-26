namespace Warden.Application.Module.Integration;

public record TicketTrackerStatus
{
    public required bool Jira { get; set; }
    public required bool Redmine { get; set; }
    /// <summary>Global GitHub integration (PAT) — create issues without a GitHub App.</summary>
    public required bool GitHub { get; set; }
    /// <summary>Global GitLab integration (PAT) — create issues without OAuth App (CodeRabbit-style).</summary>
    public required bool GitLab { get; set; }
}