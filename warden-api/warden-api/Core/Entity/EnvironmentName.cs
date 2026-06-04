using System.ComponentModel.DataAnnotations;

namespace Warden.Core.Entity;

public class EnvironmentName
{
    [Key] public required string Name { get; set; }
}