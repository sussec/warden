using System.Text.Json.Serialization;

namespace Warden.Core.Enum;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ScanTargetType
{
    Repository,
    Image,
    Url,
    // LLM generator/endpoint target (e.g. Augustus AUGUSTUS_GENERATOR).
    // Appended last so existing persisted int values are unchanged — no migration.
    Llm,
    // Cloud provider/account to assess (aws|azure|gcp) for CSPM (e.g. Prowler).
    // Appended last — integer column unchanged, no migration.
    Cloud
}
