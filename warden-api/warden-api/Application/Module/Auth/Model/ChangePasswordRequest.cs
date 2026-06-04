using System.ComponentModel.DataAnnotations;

namespace Warden.Application.Module.Auth.Model;

public class ChangePasswordRequest
{
    [Required] public string CurrentPassword { get; set; } = string.Empty;
    [Required] public string NewPassword { get; set; } = string.Empty;
}
