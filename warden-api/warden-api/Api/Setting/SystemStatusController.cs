using System.Diagnostics;
using System.Reflection;
using Warden.Application;
using Warden.Application.Module.Integration.GitHub;
using Warden.Application.Module.Integration.GitLab;
using Warden.Application.Module.Scan;
using Warden.Application.Module.Setting;
using Warden.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Warden.Api.Setting;

/// <summary>
/// About + system health for Settings → General (operator-facing, no secrets).
/// </summary>
[Route("api/setting/system")]
[ApiExplorerSettings(GroupName = "Setting")]
public class SystemStatusController(
    AppDbContext context,
    IScanJobService scanJobService
) : BaseController
{
    [HttpGet]
    [Permission(PermissionType.Config, PermissionAction.Read)]
    public async Task<SystemStatusResponse> GetSystemStatus(CancellationToken cancellationToken)
    {
        var assembly = Assembly.GetExecutingAssembly();
        var version = assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()
            ?.InformationalVersion
            ?? assembly.GetName().Version?.ToString()
            ?? "unknown";

        // Strip git hash suffixes like "1.0.0+abc"
        if (version.Contains('+')) version = version.Split('+')[0];

        var process = Process.GetCurrentProcess();
        var started = process.StartTime.ToUniversalTime();

        var dbOk = false;
        string? dbError = null;
        long projectCount = 0, findingCount = 0, scanJobCount = 0, userCount = 0;
        try
        {
            dbOk = await context.Database.CanConnectAsync(cancellationToken);
            if (dbOk)
            {
                projectCount = await context.Projects.LongCountAsync(cancellationToken);
                findingCount = await context.Findings.LongCountAsync(cancellationToken);
                scanJobCount = await context.ScanJobs.LongCountAsync(cancellationToken);
                userCount = await context.Users.LongCountAsync(cancellationToken);
            }
        }
        catch (Exception ex)
        {
            dbError = ex.Message;
        }

        var capability = await scanJobService.GetCapabilityAsync(cancellationToken);
        var pluginsReady = capability.Plugins.Count(p => p.ImageReady);
        var pluginsTotal = capability.Plugins.Count;

        var smtp = await context.GetSmtpSettingAsync();
        var auth = await context.GetAuthSettingAsync();
        var gh = await context.GetGitHubSettingAsync();
        var gl = await context.GetGitLabSettingAsync();

        return new SystemStatusResponse
        {
            About = new AboutInfo
            {
                Product = "Warden",
                Description = "Enterprise application security platform — fleet scanning, findings, and integrations.",
                Version = version,
                Framework = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
                Os = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
                Architecture = System.Runtime.InteropServices.RuntimeInformation.OSArchitecture.ToString(),
                Hostname = Environment.MachineName,
                Environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production",
                StartedAt = started,
                UptimeSeconds = (long)(DateTime.UtcNow - started).TotalSeconds,
                FrontendUrl = string.IsNullOrWhiteSpace(Configuration.FrontendUrl)
                    ? null
                    : Configuration.FrontendUrl
            },
            Health = new HealthInfo
            {
                Status = dbOk && capability.Available ? "healthy"
                    : dbOk ? "degraded"
                    : "unhealthy",
                Database = new ComponentHealth
                {
                    Ok = dbOk,
                    Message = dbOk ? "Connected" : (dbError ?? "Cannot connect")
                },
                ScanRunner = new ComponentHealth
                {
                    Ok = capability.Available,
                    Message = capability.Message,
                    Detail = capability.Backend
                },
                Smtp = new ComponentHealth
                {
                    Ok = !string.IsNullOrWhiteSpace(smtp.Server),
                    Message = string.IsNullOrWhiteSpace(smtp.Server)
                        ? "Not configured"
                        : $"Configured · {smtp.Server}:{smtp.Port}"
                },
                Authentication = new ComponentHealth
                {
                    Ok = true,
                    Message = auth.OpenIdConnectSetting is { Enable: true }
                        ? "OIDC enabled" + (auth.DisablePasswordLogon ? " · password logon off" : "")
                        : auth.DisablePasswordLogon
                            ? "Password logon disabled"
                            : "Password logon"
                },
                GitHub = new ComponentHealth
                {
                    Ok = gh.Active && !string.IsNullOrWhiteSpace(gh.Token),
                    Message = !gh.Active
                        ? "Off"
                        : string.IsNullOrWhiteSpace(gh.Token)
                            ? "Enabled · token missing"
                            : "Enabled · token configured"
                },
                GitLab = new ComponentHealth
                {
                    Ok = gl.Active && !string.IsNullOrWhiteSpace(gl.Token),
                    Message = !gl.Active
                        ? "Off"
                        : string.IsNullOrWhiteSpace(gl.Token)
                            ? "Enabled · token missing"
                            : "Enabled · token configured"
                }
            },
            Scan = new ScanPlatformInfo
            {
                Backend = capability.Backend,
                Available = capability.Available,
                TokenConfigured = capability.TokenConfigured,
                ImagePrefix = Configuration.ScanImagePrefix,
                Namespace = string.IsNullOrWhiteSpace(Configuration.ScanNamespace)
                    ? null
                    : Configuration.ScanNamespace,
                PluginsTotal = pluginsTotal,
                PluginsImageReady = pluginsReady,
                Message = capability.Message
            },
            Counts = new WorkspaceCounts
            {
                Projects = projectCount,
                Findings = findingCount,
                ScanJobs = scanJobCount,
                Users = userCount
            },
            Process = new ProcessInfo
            {
                Pid = process.Id,
                WorkingSetMb = process.WorkingSet64 / (1024 * 1024),
                ThreadCount = process.Threads.Count
            }
        };
    }
}

public record SystemStatusResponse
{
    public required AboutInfo About { get; init; }
    public required HealthInfo Health { get; init; }
    public required ScanPlatformInfo Scan { get; init; }
    public required WorkspaceCounts Counts { get; init; }
    public required ProcessInfo Process { get; init; }
}

public record AboutInfo
{
    public required string Product { get; init; }
    public required string Description { get; init; }
    public required string Version { get; init; }
    public required string Framework { get; init; }
    public required string Os { get; init; }
    public required string Architecture { get; init; }
    public required string Hostname { get; init; }
    public required string Environment { get; init; }
    public required DateTime StartedAt { get; init; }
    public required long UptimeSeconds { get; init; }
    public string? FrontendUrl { get; init; }
}

public record HealthInfo
{
    public required string Status { get; init; }
    public required ComponentHealth Database { get; init; }
    public required ComponentHealth ScanRunner { get; init; }
    public required ComponentHealth Smtp { get; init; }
    public required ComponentHealth Authentication { get; init; }
    public required ComponentHealth GitHub { get; init; }
    public required ComponentHealth GitLab { get; init; }
}

public record ComponentHealth
{
    public required bool Ok { get; init; }
    public required string Message { get; init; }
    public string? Detail { get; init; }
}

public record ScanPlatformInfo
{
    public required string Backend { get; init; }
    public required bool Available { get; init; }
    public required bool TokenConfigured { get; init; }
    public required string ImagePrefix { get; init; }
    public string? Namespace { get; init; }
    public required int PluginsTotal { get; init; }
    public required int PluginsImageReady { get; init; }
    public required string Message { get; init; }
}

public record WorkspaceCounts
{
    public required long Projects { get; init; }
    public required long Findings { get; init; }
    public required long ScanJobs { get; init; }
    public required long Users { get; init; }
}

public record ProcessInfo
{
    public required int Pid { get; init; }
    public required long WorkingSetMb { get; init; }
    public required int ThreadCount { get; init; }
}
