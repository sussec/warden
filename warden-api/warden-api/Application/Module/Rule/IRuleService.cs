using Warden.Application.Module.Rule.Command;
using Warden.Application.Module.Rule.Model;
using Warden.Core.Entity;
using Warden.Core.EntityFramework;
using Warden.Core.Extension;

namespace Warden.Application.Module.Rule;

public interface IRuleService
{
    Task<Rules> CreateRuleAsync(CreateRuleRequest request);
    Task<Page<RuleInfo>> GetRuleByFilterAsync(RuleFilter filter);
    Task<List<string>> ListRuleIdAsync(RuleFilter filter);
    Task<List<Scanners>> ListScannersAsync();
    Task<bool> SyncRuleAsync();
    Task<Rules> UpdateRuleAsync(UpdateRuleRequest request);
}

public class RuleService(AppDbContext context): IRuleService
{
    public async Task<Rules> CreateRuleAsync(CreateRuleRequest request)
    {
        return (await new CreateRuleCommand(context).ExecuteAsync(request)).GetResult();
    }

    public async Task<Page<RuleInfo>> GetRuleByFilterAsync(RuleFilter filter)
    {
        return (await new GetRuleByFilterCommand(context).ExecuteAsync(filter)).GetResult();
    }

    public async Task<List<string>> ListRuleIdAsync(RuleFilter filter)
    {
        return (await new ListRuleIdCommand(context).ExecuteAsync(filter)).GetResult();
    }

    public async Task<List<Scanners>> ListScannersAsync()
    {
        return (await new ListRuleScannerCommand(context).ExecuteAsync()).GetResult();
    }

    public async Task<bool> SyncRuleAsync()
    {
        return (await new SyncRuleCommand(context).ExecuteAsync()).GetResult();
    }

    public async Task<Rules> UpdateRuleAsync(UpdateRuleRequest request)
    {
        return (await new UpdateRuleCommand(context).ExecuteAsync(request)).GetResult();
    }
}