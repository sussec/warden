using System.Text.Json.Serialization;

namespace Warden.Core.Enum;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ScannerType
{
    Sast,
    Dast,
    Iast,
    Dependency,
    Container,
    Secret,
    // LLM/GenAI red-team findings (prompt injection, jailbreak, data leakage).
    // Appended last so existing persisted int values are unchanged — no migration.
    Ai
}