using System.Text.Json.Serialization;

namespace Warden.Core.Enum;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum FindingStatus
{
    Open,
    Confirmed,
    AcceptedRisk,
    Fixed,
    Incorrect
}