using System.ComponentModel.DataAnnotations;

namespace Warden.Application.Module.Token.Model;

public record CreateTokenRequest
{
    [Required] 
    public required string Name { get; set; }
}