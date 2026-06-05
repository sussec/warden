using FluentResults;

namespace Warden.Application.Module.Ai;

public record AiSuggestion
{
    public required string Content { get; set; }
    public required string Model { get; set; }
}

public interface IFindingAiService
{
    /// <summary>Generates a remediation suggestion for a finding using the configured AI provider.</summary>
    Task<Result<AiSuggestion>> GenerateRemediationAsync(Guid findingId);

    /// <summary>
    /// Streams a remediation suggestion token-by-token. Yields incremental text chunks.
    /// Yields a single error sentinel line when AI is disabled or the finding is missing.
    /// </summary>
    IAsyncEnumerable<string> StreamRemediationAsync(Guid findingId, CancellationToken cancellationToken = default);
}
