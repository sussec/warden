using System.ComponentModel.DataAnnotations;

namespace Warden.Application.Module.Auth.Model;

public record LogoutRequest
{
    [Required] 
    public required string Token { get; set; }
}
