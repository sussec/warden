namespace Warden.Application.Module.Ai.Triage;

/// <summary>
/// Result of a single auto-triage run.
/// </summary>
/// <param name="Processed">Number of findings examined and sent to the AI.</param>
/// <param name="Suggested">Number of findings that received an AI triage suggestion comment.</param>
/// <param name="Skipped">Number of findings skipped (e.g. AI disabled, or already triaged).</param>
/// <param name="Errors">Number of findings that failed during processing.</param>
public record TriageRunResult(int Processed, int Suggested, int Skipped, int Errors);

/// <summary>
/// Suggest-only auto-triage. Classifies new Open findings using an AI agent and records the
/// suggestion as a finding activity comment. Never mutates <c>Findings.Status</c>.
/// </summary>
public interface ITriageAgentService
{
    Task<TriageRunResult> TriageNewFindingsAsync(int maxFindings = 20);
}
