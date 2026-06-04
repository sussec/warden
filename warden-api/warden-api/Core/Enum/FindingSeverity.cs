using System.Text.Json.Serialization;

namespace Warden.Core.Enum;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum FindingSeverity
{
    Info,
    Low,
    Medium,
    High,
    Critical
}