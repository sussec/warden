using System.ComponentModel.DataAnnotations;

namespace Warden.Application.Module.Auth.Model;

public record ForgotPasswordRequest
{
    [Required]
    public required string Username { get; set; }
}