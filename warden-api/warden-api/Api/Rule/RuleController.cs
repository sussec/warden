using Warden.Application.Module.Rule;
using Warden.Application.Module.Rule.Model;
using Warden.Authentication;
using Warden.Core.Entity;
using Warden.Core.EntityFramework;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Rule;

public class RuleController(
    IRuleService ruleService
) : BaseController
{
    [HttpPost]
    [Route("filter")]
    public Task<Page<RuleInfo>> GetRuleByFilter(RuleFilter filter)
    {
        return ruleService.GetRuleByFilterAsync(filter);
    }

    [HttpPost]
    [Route("update")]
    [Permission(PermissionType.Rule, PermissionAction.Update)]
    public Task UpdateRule(UpdateRuleRequest request)
    {
        return ruleService.UpdateRuleAsync(request);
    }

    [HttpGet]
    [Route("scanner")]
    public Task<List<Scanners>> GetRuleScanners()
    {
        return ruleService.ListScannersAsync();
    }

    [HttpPost]
    [Route("sync")]
    [Permission(PermissionType.Rule, PermissionAction.Update)]
    public Task<bool> SyncRules()
    {
        return ruleService.SyncRuleAsync();
    }
}