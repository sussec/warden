using System.Text.Json.Serialization;

namespace Warden.Core.Enum;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ScanJobStatus
{
    Queued,
    Running,
    Succeeded,
    Failed
}
