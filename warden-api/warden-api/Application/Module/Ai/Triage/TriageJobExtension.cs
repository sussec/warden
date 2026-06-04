// ORCHESTRATOR WIRING: inside the `builder.AddQuartz(configure => { ... })` lambda in
// Application/Schedulers/SchedulerExtensions.cs, add the single line:
//
//     configure.AddAiTriageJob();
//
// (requires `using Warden.Application.Module.Ai.Triage;`). This registers the daily 06:00 trigger.

using Quartz;

namespace Warden.Application.Module.Ai.Triage;

public static class TriageJobExtension
{
    /// <summary>
    /// Registers the AI auto-triage job and a daily 06:00 cron trigger on the supplied Quartz configurator.
    /// Mirrors the registration idiom in <c>SchedulerExtensions.AddScheduleJobs</c>.
    /// </summary>
    public static IServiceCollectionQuartzConfigurator AddAiTriageJob(
        this IServiceCollectionQuartzConfigurator configure)
    {
        // AI auto-triage of new findings, daily at 06:00.
        var triageJobKey = new JobKey(nameof(TriageJob));
        configure
            .AddJob<TriageJob>(triageJobKey)
            .AddTrigger(trigger => trigger
                .ForJob(triageJobKey)
                .WithCronSchedule("0 0 6 ? * *")
            );
        return configure;
    }
}
