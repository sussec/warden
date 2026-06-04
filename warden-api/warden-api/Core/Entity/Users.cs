using Warden.Core.Enum;
using Microsoft.AspNetCore.Identity;

namespace Warden.Core.Entity;

public class Users : IdentityUser<Guid>
{
    public required string FullName { get; set; }
    public required UserStatus Status { get; set; }
    public string? Avatar { get; set; }
    public required bool IsDefault { get; set; }
    public required DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}