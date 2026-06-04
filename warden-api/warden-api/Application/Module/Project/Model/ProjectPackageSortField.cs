using System.Text.Json.Serialization;

namespace Warden.Application.Module.Project.Model;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ProjectPackageSortField
{
    Name,
    RiskLevel
}