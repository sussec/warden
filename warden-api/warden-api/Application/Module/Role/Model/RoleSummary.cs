namespace Warden.Application.Module.Role.Model;

public class RoleSummary
{
    public required Guid Id { get; set; }
    public required bool IsDefault { get; set; }
    public required string? Name { get; set; }
}
