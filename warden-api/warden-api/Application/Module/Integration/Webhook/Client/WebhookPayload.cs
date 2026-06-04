using Newtonsoft.Json;

namespace Warden.Application.Module.Integration.Webhook.Client
{
    // Generic structured payload. Posted as-is for WebhookFormat.Generic, or rendered to
    // {"text": "..."} via ToText() for WebhookFormat.Slack.
    public record WebhookPayload
    {
        [JsonProperty("event")]
        public string Event { get; init; } = string.Empty;

        [JsonProperty("project")]
        public string Project { get; init; } = string.Empty;

        [JsonProperty("message")]
        public string Message { get; init; } = string.Empty;

        [JsonProperty("severity", NullValueHandling = NullValueHandling.Ignore)]
        public string? Severity { get; init; }

        [JsonProperty("scanner", NullValueHandling = NullValueHandling.Ignore)]
        public string? Scanner { get; init; }

        [JsonProperty("commit", NullValueHandling = NullValueHandling.Ignore)]
        public string? Commit { get; init; }

        [JsonProperty("branch", NullValueHandling = NullValueHandling.Ignore)]
        public string? Branch { get; init; }

        [JsonProperty("findingCount", NullValueHandling = NullValueHandling.Ignore)]
        public int? FindingCount { get; init; }

        [JsonProperty("findings", NullValueHandling = NullValueHandling.Ignore)]
        public List<WebhookFinding>? Findings { get; init; }

        [JsonProperty("url", NullValueHandling = NullValueHandling.Ignore)]
        public string? Url { get; init; }

        public string ToText()
        {
            var parts = new List<string> { $"[{Event}] {Project}" };
            if (!string.IsNullOrEmpty(Message)) parts.Add(Message);
            if (!string.IsNullOrEmpty(Severity)) parts.Add($"Severity: {Severity}");
            if (!string.IsNullOrEmpty(Scanner)) parts.Add($"Scanner: {Scanner}");
            if (!string.IsNullOrEmpty(Branch)) parts.Add($"Branch: {Branch}");
            if (!string.IsNullOrEmpty(Commit)) parts.Add($"Commit: {Commit}");
            if (FindingCount.HasValue) parts.Add($"Findings: {FindingCount}");
            if (!string.IsNullOrEmpty(Url)) parts.Add(Url!);
            return string.Join("\n", parts);
        }
    }

    public record WebhookFinding
    {
        [JsonProperty("name")]
        public string Name { get; init; } = string.Empty;

        [JsonProperty("severity")]
        public string Severity { get; init; } = string.Empty;

        [JsonProperty("url", NullValueHandling = NullValueHandling.Ignore)]
        public string? Url { get; init; }
    }
}
