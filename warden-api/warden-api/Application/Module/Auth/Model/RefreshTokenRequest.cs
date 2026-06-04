using System.ComponentModel.DataAnnotations;

namespace Warden.Application.Module.Auth.Model;

public record RefreshTokenRequest
{
    [Required] public required string RefreshToken { get; set; }
}