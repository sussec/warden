namespace Warden.Application.Module.Auth.Model;

public record LogoutRequest
{
    /// Optional — falls back to the warden_refresh httpOnly cookie.
    public string? Token { get; set; }
}
