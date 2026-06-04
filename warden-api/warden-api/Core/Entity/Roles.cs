using Microsoft.AspNetCore.Identity;

namespace Warden.Core.Entity;

public class Roles : IdentityRole<Guid>
{
    public required bool IsDefault { get; set; }
}