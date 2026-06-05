using System.Runtime.CompilerServices;
using System.Text;
using FluentResults;
using Warden.Application.Module.Setting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;

namespace Warden.Application.Module.Ai;

public class FindingAiService(AppDbContext context, IAiClientFactory aiClientFactory, ILogger<FindingAiService> logger) : IFindingAiService
{
    private const string SystemPrompt =
        "You are a senior application security engineer reviewing static analysis findings. " +
        "Provide a concise, practical remediation. Structure the answer in markdown with the sections: " +
        "**Summary** (one sentence on what the issue is and why it matters), " +
        "**Risk** (realistic impact, no fear-mongering), " +
        "**Remediation** (concrete steps; include corrected code when a snippet is provided), " +
        "**References** (relevant CWE/OWASP links if applicable). " +
        "Be specific to the given code and technology. Do not invent file paths or APIs.";

    public async Task<Result<AiSuggestion>> GenerateRemediationAsync(Guid findingId)
    {
        var chatClient = await aiClientFactory.CreateChatClientAsync();
        if (chatClient == null)
        {
            return Result.Fail("AI assistance is not enabled. Configure it under Settings > AI.");
        }

        var finding = await LoadFindingAsync(findingId);
        if (finding == null)
        {
            return Result.Fail("Finding not found");
        }

        try
        {
            var setting = await context.GetAiSettingAsync();
            var response = await chatClient.GetResponseAsync(BuildMessages(finding));
            return Result.Ok(new AiSuggestion
            {
                Content = response.Text,
                Model = setting.Model
            });
        }
        catch (Exception e)
        {
            // Log full detail server-side; return a generic message so provider/internal
            // diagnostics (endpoints, auth errors, rate-limit headers) never reach the client.
            logger.LogError(e, "AI remediation suggestion failed for finding {FindingId}", findingId);
            return Result.Fail("AI request failed. Check the AI configuration and provider availability.");
        }
    }

    public async IAsyncEnumerable<string> StreamRemediationAsync(
        Guid findingId, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var chatClient = await aiClientFactory.CreateChatClientAsync();
        if (chatClient == null)
        {
            yield return "AI assistance is not enabled. Configure it under Settings > AI.";
            yield break;
        }

        var finding = await LoadFindingAsync(findingId);
        if (finding == null)
        {
            yield return "Finding not found.";
            yield break;
        }

        var messages = BuildMessages(finding);
        var stream = chatClient.GetStreamingResponseAsync(messages, cancellationToken: cancellationToken)
            .GetAsyncEnumerator(cancellationToken);
        try
        {
            while (true)
            {
                string? text;
                string? error = null;
                try
                {
                    if (!await stream.MoveNextAsync())
                    {
                        break;
                    }
                    text = stream.Current.Text;
                }
                catch (Exception e)
                {
                    logger.LogError(e, "AI streaming suggestion failed for finding {FindingId}", findingId);
                    error = "AI request failed. Check the AI configuration and provider availability.";
                    text = null;
                }
                if (error != null)
                {
                    yield return error;
                    yield break;
                }
                if (!string.IsNullOrEmpty(text))
                {
                    yield return text;
                }
            }
        }
        finally
        {
            await stream.DisposeAsync();
        }
    }

    private async Task<Core.Entity.Findings?> LoadFindingAsync(Guid findingId) =>
        await context.Findings
            .Include(f => f.Scanner)
            .Include(f => f.Project)
            .FirstOrDefaultAsync(f => f.Id == findingId);

    private static List<ChatMessage> BuildMessages(Core.Entity.Findings finding)
    {
        var prompt = new StringBuilder();
        prompt.AppendLine($"Finding: {finding.Name}");
        prompt.AppendLine($"Severity: {finding.Severity}");
        if (!string.IsNullOrEmpty(finding.Category)) prompt.AppendLine($"Category: {finding.Category}");
        if (!string.IsNullOrEmpty(finding.RuleId)) prompt.AppendLine($"Rule: {finding.RuleId}");
        if (finding.Scanner != null) prompt.AppendLine($"Scanner: {finding.Scanner.Name} ({finding.Scanner.Type})");
        if (!string.IsNullOrEmpty(finding.Location)) prompt.AppendLine($"Location: {finding.Location}:{finding.StartLine}");
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
        return
        [
            new ChatMessage(ChatRole.System, SystemPrompt),
            new ChatMessage(ChatRole.User, prompt.ToString())
        ];
    }
}
