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
    Ai,
    // Cloud security posture (CSPM) findings against a live cloud account
    // (AWS/Azure/GCP). Appended last — integer column unchanged, no migration.
    Cloud
}