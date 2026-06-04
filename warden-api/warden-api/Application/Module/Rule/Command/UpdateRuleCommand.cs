using Warden.Application.Module.Rule.Model;
using Warden.Core.Entity;
using Warden.Core.Enum;
using FluentResults;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Rule.Command;

public class UpdateRuleCommand(AppDbContext context)
{
    public async Task<Result<Rules>> ExecuteAsync(UpdateRuleRequest request)
    {
        var rule = await context.Rules
            .FirstOrDefaultAsync(rule =>
                rule.Id == request.RuleId &&
                rule.ScannerId == request.ScannerId
            );
        if (rule == null)
        {
            return Result.Fail("Rule not found");
        }

        if (request.Confidence != null)
        {
            rule.Confidence = (RuleConfidence)request.Confidence;
        }

        if (request.Status != null)
        {
            rule.Status = (RuleStatus)request.Status;
        }

        context.Rules.Update(rule);
        await context.SaveChangesAsync();
        return rule;
    }
}