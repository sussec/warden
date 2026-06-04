using System.ComponentModel.DataAnnotations;
using Warden.Core.Enum;

namespace Warden.Application.Module.Rule.Model;

public class UpdateRuleRequest
{
    [Required]
    public required string RuleId { get; set; }
    [Required]
    public required Guid ScannerId { get; set; }
    public RuleStatus? Status { get; set; }
    public RuleConfidence? Confidence { get; set; }
}