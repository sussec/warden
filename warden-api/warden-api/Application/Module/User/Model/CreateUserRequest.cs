using System.ComponentModel.DataAnnotations;

namespace Warden.Application.Module.User.Model;

public record CreateUserRequest
{
    [EmailAddress]
    public required string Email { get; set; }
    public bool Verified { get; set; }
    [Required]
    public required string Role { get; set; }

    /// Optional. Defaults to the email local part.
    public string? UserName { get; set; }

    /// Optional. Defaults to the user name.
    public string? FullName { get; set; }

    /// Optional. When omitted a random password is generated and the user
    /// completes setup through the invite email.
    public string? Password { get; set; }
}