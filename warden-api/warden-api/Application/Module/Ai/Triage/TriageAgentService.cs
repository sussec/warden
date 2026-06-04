using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Warden.Application.Module.Setting;
using Warden.Core.Entity;
using Warden.Core.Enum;
using Microsoft.Agents.AI;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Ai.Triage;

/// <summary>
/// Verdict produced by the triage agent for a single finding.
/// </summary>
public record TriageVerdict(string Verdict, int Confidence, string Justification);

public partial class TriageAgentService(
    AppDbContext context,
    IAiClientFactory aiClientFactory,
    ILogger<TriageAgentService> logger) : ITriageAgentService
{
    /// <summary>Prefix used to mark (and later detect) AI-generated triage comments.</summary>
    public const string TriageCommentPrefix = "[AI Triage]";

    private const string Verdict_TruePositive = "LIKELY_TRUE_POSITIVE";
    private const string Verdict_FalsePositive = "LIKELY_FALSE_POSITIVE";
    private const string Verdict_NeedsReview = "NEEDS_HUMAN_REVIEW";

    private const string AgentInstructions =
        "You are an application security triage analyst. You are given a single static-analysis " +
        "security finding with its metadata and code context. Classify it as exactly one of: " +
        Verdict_TruePositive + ", " + Verdict_FalsePositive + ", or " + Verdict_NeedsReview + ". " +
        "Provide a 2-3 sentence justification grounded in the supplied context (do not invent code, " +
        "file paths, or APIs) and a confidence score from 0 to 100. " +
        "Respond with STRICT JSON only, no markdown, no code fences, exactly in the shape: " +
        "{\"verdict\":\"LIKELY_TRUE_POSITIVE|LIKELY_FALSE_POSITIVE|NEEDS_HUMAN_REVIEW\"," +
        "\"confidence\":<integer 0-100>,\"justification\":\"<text>\"}.";

    public async Task<TriageRunResult> TriageNewFindingsAsync(int maxFindings = 20)
    {
        var chatClient = await aiClientFactory.CreateChatClientAsync();
        if (chatClient == null)
        {
            logger.LogInformation("AI triage skipped: AI assistance is not enabled.");
            return new TriageRunResult(Processed: 0, Suggested: 0, Skipped: 0, Errors: 0);
        }

        // Load Open findings that do not yet have an AI triage comment.
        var findings = await context.Findings
            .Include(f => f.Scanner)
            .Where(f => f.Status == FindingStatus.Open)
            .Where(f => !context.FindingActivities.Any(a =>
                a.FindingId == f.Id &&
                a.Type == FindingActivityType.Comment &&
                a.Comment != null &&
                a.Comment.StartsWith(TriageCommentPrefix)))
            .OrderByDescending(f => f.CreatedAt)
            .Take(maxFindings)
            .ToListAsync();

        if (findings.Count == 0)
        {
            return new TriageRunResult(Processed: 0, Suggested: 0, Skipped: 0, Errors: 0);
        }

        AIAgent agent = new ChatClientAgent(
            chatClient,
            instructions: AgentInstructions,
            name: "WardenTriageAnalyst");

        var processed = 0;
        var suggested = 0;
        var errors = 0;

        foreach (var finding in findings)
        {
            processed++;
            try
            {
                var prompt = BuildContext(finding);
                var response = await agent.RunAsync(prompt);
                var verdict = ParseVerdict(response.Text);

                context.FindingActivities.Add(new FindingActivities
                {
                    Id = Guid.NewGuid(),
                    Type = FindingActivityType.Comment,
                    FindingId = finding.Id,
                    Comment =
                        $"{TriageCommentPrefix} {verdict.Verdict} ({verdict.Confidence}%) — {verdict.Justification}"
                });
                suggested++;
            }
            catch (Exception e)
            {
                errors++;
                logger.LogError(e, "AI triage failed for finding {FindingId}", finding.Id);
            }
        }

        if (suggested > 0)
        {
            await context.SaveChangesAsync();
        }

        logger.LogInformation(
            "AI triage run complete. Processed: {Processed}, Suggested: {Suggested}, Errors: {Errors}",
            processed, suggested, errors);

        // Skipped is reserved for findings filtered out before processing; the query already
        // excludes them, so within a run there are none.
        return new TriageRunResult(Processed: processed, Suggested: suggested, Skipped: 0, Errors: errors);
    }

    private static string BuildContext(Findings finding)
    {
        var prompt = new StringBuilder();
        prompt.AppendLine($"Finding: {finding.Name}");
        prompt.AppendLine($"Severity: {finding.Severity}");
        if (!string.IsNullOrEmpty(finding.Category)) prompt.AppendLine($"Category: {finding.Category}");
        if (!string.IsNullOrEmpty(finding.RuleId)) prompt.AppendLine($"Rule: {finding.RuleId}");
        if (finding.Scanner != null) prompt.AppendLine($"Scanner: {finding.Scanner.Name} ({finding.Scanner.Type})");
        if (!string.IsNullOrEmpty(finding.Location))
            prompt.AppendLine($"Location: {finding.Location}:{finding.StartLine}");
        if (!string.IsNullOrEmpty(finding.Description))
        {
            prompt.AppendLine();
            prompt.AppendLine("Description:");
            prompt.AppendLine(finding.Description);
        }

        if (!string.IsNullOrEmpty(finding.Snippet))
        {
            prompt.AppendLine();
            prompt.AppendLine("Code snippet:");
            prompt.AppendLine("```");
            prompt.AppendLine(finding.Snippet);
            prompt.AppendLine("```");
        }

        return prompt.ToString();
    }

    /// <summary>
    /// Robustly parses the agent's JSON verdict. Strips markdown code fences and tolerates
    /// surrounding prose. Any unparseable / unrecognised input falls back to NEEDS_HUMAN_REVIEW
    /// with confidence 0.
    /// </summary>
    public static TriageVerdict ParseVerdict(string? raw)
    {
        var fallback = new TriageVerdict(Verdict_NeedsReview, 0,
            "Could not parse the AI response; defaulting to human review.");

        if (string.IsNullOrWhiteSpace(raw))
        {
            return fallback;
        }

        var json = ExtractJson(raw);
        if (json == null)
        {
            return fallback;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return fallback;
            }

            var verdict = NormalizeVerdict(GetString(root, "verdict"));
            if (verdict == null)
            {
                return fallback;
            }

            var confidence = GetConfidence(root);
            var justification = GetString(root, "justification") ?? string.Empty;

            return new TriageVerdict(verdict, confidence, justification.Trim());
        }
        catch (JsonException)
        {
            return fallback;
        }
    }

    private static string? ExtractJson(string raw)
    {
        // Remove markdown code fences such as ```json ... ``` or ``` ... ```.
        var fenced = CodeFenceRegex().Match(raw);
        var candidate = fenced.Success ? fenced.Groups["body"].Value : raw;

        // Narrow down to the first balanced-looking JSON object.
        var start = candidate.IndexOf('{');
        var end = candidate.LastIndexOf('}');
        if (start < 0 || end <= start)
        {
            return null;
        }

        return candidate.Substring(start, end - start + 1);
    }

    private static string? NormalizeVerdict(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim().ToUpperInvariant().Replace(' ', '_').Replace('-', '_');
        return normalized switch
        {
            Verdict_TruePositive => Verdict_TruePositive,
            Verdict_FalsePositive => Verdict_FalsePositive,
            Verdict_NeedsReview => Verdict_NeedsReview,
            _ => null
        };
    }

    private static string? GetString(JsonElement root, string property)
    {
        return root.TryGetProperty(property, out var element) && element.ValueKind == JsonValueKind.String
            ? element.GetString()
            : null;
    }

    private static int GetConfidence(JsonElement root)
    {
        if (!root.TryGetProperty("confidence", out var element))
        {
            return 0;
        }

        var value = element.ValueKind switch
        {
            JsonValueKind.Number when element.TryGetInt32(out var i) => i,
            JsonValueKind.Number => (int)Math.Round(element.GetDouble()),
            JsonValueKind.String when int.TryParse(element.GetString(), out var s) => s,
            _ => 0
        };

        return Math.Clamp(value, 0, 100);
    }

    [GeneratedRegex(@"```[a-zA-Z]*\s*(?<body>[\s\S]*?)\s*```", RegexOptions.Compiled)]
    private static partial Regex CodeFenceRegex();
}
