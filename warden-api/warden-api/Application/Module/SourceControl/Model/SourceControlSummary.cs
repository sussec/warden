using Warden.Core.Enum;

namespace Warden.Application.Module.SourceControl.Model;

public record SourceControlSummary
{
    public required Guid Id { get; set; }
    public required SourceType Type { get; set; }
    public required string Name { get; set; }
}