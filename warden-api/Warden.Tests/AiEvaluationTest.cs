using Warden.Application.Module.Ai.Triage;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.AI.Evaluation;
using Microsoft.Extensions.AI.Evaluation.Quality;
using OpenAI;
using System.ClientModel;

namespace Warden.Tests;

/// <summary>
/// Unit tests for the AI triage JSON verdict parser, plus one opt-in evaluation test that
/// scores a sample triage justification with Microsoft.Extensions.AI.Evaluation.Quality.
/// </summary>
public class AiEvaluationTest
{
    [Test]
    public void ParseVerdict_ValidJson_ReturnsParsedValues()
    {
        const string raw =
            "{\"verdict\":\"LIKELY_TRUE_POSITIVE\",\"confidence\":87," +
            "\"justification\":\"User input flows into a SQL query without parameterisation.\"}";

        var result = TriageAgentService.ParseVerdict(raw);

        Assert.Multiple(() =>
        {
            Assert.That(result.Verdict, Is.EqualTo("LIKELY_TRUE_POSITIVE"));
            Assert.That(result.Confidence, Is.EqualTo(87));
            Assert.That(result.Justification, Does.Contain("parameterisation"));
        });
    }

    [Test]
    public void ParseVerdict_FencedJson_StripsCodeFenceAndParses()
    {
        const string raw =
            "Here is my assessment:\n```json\n" +
            "{\"verdict\":\"LIKELY_FALSE_POSITIVE\",\"confidence\":40," +
            "\"justification\":\"The tainted value is a compile-time constant.\"}\n" +
            "```\nThanks!";

        var result = TriageAgentService.ParseVerdict(raw);

        Assert.Multiple(() =>
        {
            Assert.That(result.Verdict, Is.EqualTo("LIKELY_FALSE_POSITIVE"));
            Assert.That(result.Confidence, Is.EqualTo(40));
            Assert.That(result.Justification, Does.Contain("compile-time constant"));
        });
    }

    [Test]
    public void ParseVerdict_PlainFence_NoLanguageTag_Parses()
    {
        const string raw =
            "```\n{\"verdict\":\"NEEDS_HUMAN_REVIEW\",\"confidence\":55,\"justification\":\"Insufficient context.\"}\n```";

        var result = TriageAgentService.ParseVerdict(raw);

        Assert.That(result.Verdict, Is.EqualTo("NEEDS_HUMAN_REVIEW"));
        Assert.That(result.Confidence, Is.EqualTo(55));
    }

    [Test]
    public void ParseVerdict_ConfidenceOutOfRange_IsClamped()
    {
        const string raw =
            "{\"verdict\":\"LIKELY_TRUE_POSITIVE\",\"confidence\":150,\"justification\":\"x\"}";

        var result = TriageAgentService.ParseVerdict(raw);

        Assert.That(result.Confidence, Is.EqualTo(100));
    }

    [Test]
    public void ParseVerdict_VerdictWithSpacesOrHyphens_IsNormalized()
    {
        const string raw =
            "{\"verdict\":\"likely-true positive\",\"confidence\":\"70\",\"justification\":\"y\"}";

        var result = TriageAgentService.ParseVerdict(raw);

        Assert.Multiple(() =>
        {
            Assert.That(result.Verdict, Is.EqualTo("LIKELY_TRUE_POSITIVE"));
            // confidence supplied as a string is still parsed.
            Assert.That(result.Confidence, Is.EqualTo(70));
        });
    }

    [TestCase("this is not json at all")]
    [TestCase("")]
    [TestCase("   ")]
    [TestCase(null)]
    [TestCase("{\"verdict\":\"WHO_KNOWS\",\"confidence\":99,\"justification\":\"bad verdict\"}")]
    [TestCase("{ broken json")]
    public void ParseVerdict_Garbage_FallsBackToNeedsHumanReview(string? raw)
    {
        var result = TriageAgentService.ParseVerdict(raw);

        Assert.Multiple(() =>
        {
            Assert.That(result.Verdict, Is.EqualTo("NEEDS_HUMAN_REVIEW"));
            Assert.That(result.Confidence, Is.EqualTo(0));
        });
    }

    /// <summary>
    /// Opt-in evaluation: scores a sample triage justification for coherence using a real AI
    /// provider. Skips cleanly (Assert.Ignore) unless WARDEN_AI_ENDPOINT is configured.
    /// Run explicitly, e.g.: dotnet test --filter "TestCategory!=Explicit" excludes this.
    /// </summary>
    [Test]
    [Explicit("requires configured AI provider")]
    public async Task TriageJustification_IsCoherent_WhenAiConfigured()
    {
        var endpoint = Environment.GetEnvironmentVariable("WARDEN_AI_ENDPOINT");
        if (string.IsNullOrWhiteSpace(endpoint))
        {
            Assert.Ignore("WARDEN_AI_ENDPOINT not set; skipping AI evaluation test.");
            return;
        }

        var model = Environment.GetEnvironmentVariable("WARDEN_AI_MODEL") ?? "gpt-4o-mini";
        var apiKey = Environment.GetEnvironmentVariable("WARDEN_AI_API_KEY") ?? "warden";

        var options = new OpenAIClientOptions { Endpoint = new Uri(endpoint) };
        IChatClient chatClient = new OpenAIClient(new ApiKeyCredential(apiKey), options)
            .GetChatClient(model)
            .AsIChatClient();

        var chatConfiguration = new ChatConfiguration(chatClient);

        const string userRequest =
            "Triage this finding: SQL Injection in OrderController where the 'id' query parameter " +
            "is concatenated directly into a SQL command string.";
        const string modelResponse =
            "This is likely a true positive: the 'id' query parameter is concatenated into the SQL " +
            "command without parameterisation, allowing an attacker to inject arbitrary SQL. " +
            "Remediation is to use a parameterised query or an ORM. Confidence is high.";

        IEvaluator evaluator = new CoherenceEvaluator();
        EvaluationResult result =
            await evaluator.EvaluateAsync(userRequest, modelResponse, chatConfiguration);

        Assert.That(result, Is.Not.Null);
        Assert.That(result.Metrics, Is.Not.Empty, "Evaluation produced no metrics.");

        // The evaluator should return at least one metric with no error diagnostics.
        foreach (var metric in result.Metrics.Values)
        {
            Assert.That(
                metric.ContainsDiagnostics(d => d.Severity == EvaluationDiagnosticSeverity.Error),
                Is.False,
                $"Metric '{metric.Name}' reported error diagnostics.");
        }
    }
}
