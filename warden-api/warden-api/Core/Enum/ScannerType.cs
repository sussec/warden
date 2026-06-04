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
    Secret
}