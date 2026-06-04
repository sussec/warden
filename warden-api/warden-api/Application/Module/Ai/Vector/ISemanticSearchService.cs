using Warden.Core.Enum;

namespace Warden.Application.Module.Ai.Vector;

/// <summary>A single semantic search hit, enriched with finding metadata and the similarity score.</summary>
public sealed record SemanticSearchResult
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public string? Location { get; init; }
    public required FindingSeverity Severity { get; init; }
    public required FindingStatus Status { get; init; }
    public required Guid ProjectId { get; init; }
    public required double Score { get; init; }
}

public interface ISemanticSearchService
{
    /// <summary>
    /// Runs a semantic search over finding embeddings and returns matching findings ordered by score.
    /// Returns an empty list when AI is disabled or pgvector is unavailable.
    /// </summary>
    Task<List<SemanticSearchResult>> SearchFindingsAsync(
        string query, Guid? projectId, int top, CancellationToken cancellationToken = default);
}
