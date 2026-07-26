using System.Text.Json.Serialization;

namespace Warden.Core.Enum;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TicketType
{
    Jira,
    Redmine,
    GitHub,
    /// <summary>GitLab issues via PAT (CodeRabbit-style — no OAuth App required).</summary>
    GitLab
}