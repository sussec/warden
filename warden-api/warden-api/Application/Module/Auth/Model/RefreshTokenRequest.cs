namespace Warden.Application.Module.Auth.Model;

public record RefreshTokenRequest
{
    /// Optional — falls back to the warden_refresh httpOnly cookie.
    public string? RefreshToken { get; set; }
}
