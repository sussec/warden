using System.Text.Json.Serialization;

namespace Warden.Core.Enum;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum RiskImpact
{
    None,
    Indirect,
    Direct
}