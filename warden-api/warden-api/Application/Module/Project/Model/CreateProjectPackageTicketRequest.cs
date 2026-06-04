using System.Text.Json.Serialization;
using Warden.Core.Enum;

namespace Warden.Application.Module.Project.Model;

public record CreateProjectPackageTicketRequest
{
    public TicketType TicketType { get; set; }
    [JsonIgnore] public Guid ProjectId { get; set; }
    [JsonIgnore] public Guid PackageId { get; set; }
}