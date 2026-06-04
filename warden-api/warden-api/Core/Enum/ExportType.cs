using System.Text.Json.Serialization;

namespace Warden.Core.Enum;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ExportType
{
    Pdf,
    Excel,
    JSON
}