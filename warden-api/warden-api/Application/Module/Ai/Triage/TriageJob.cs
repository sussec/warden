using Quartz;

namespace Warden.Application.Module.Ai.Triage;

/// <summary>
/// Quartz job that runs the suggest-only AI auto-triage over new Open findings.
/// </summary>
[DisallowConcurrentExecution]
public class TriageJob(
    ITriageAgentService triageAgentService,
    ILogger<TriageJob> logger) : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        logger.LogInformation("AI Triage Job: Start");
        try
        {
            var result = await triageAgentService.TriageNewFindingsAsync();
            logger.LogInformation(
                "AI Triage Job: End. Processed={Processed}, Suggested={Suggested}, Skipped={Skipped}, Errors={Errors}",
                result.Processed, result.Suggested, result.Skipped, result.Errors);
        }
        catch (Exception e)
        {
            logger.LogError(e, "AI Triage Job: Failed");
            throw;
        }
    }
}
