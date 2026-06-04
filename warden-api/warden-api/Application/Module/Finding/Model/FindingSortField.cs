using System.Text.Json.Serialization;

namespace Warden.Application.Module.Finding.Model;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum FindingSortField
{
    Severity,
    Status,
    CreatedAt,
    UpdatedAt,
    Name
}