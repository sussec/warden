using System.ComponentModel;
using System.Text.Json;
using ModelContextProtocol.Server;
using Warden.Application;
using Warden.Core.Entity;
using Warden.Core.Enum;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Mcp;

/// <summary>
/// Model Context Protocol tools that expose Warden ASPM data (findings, project
/// posture, SLA breaches) and mutations (finding status updates) to MCP clients.
///
/// Tool methods take <see cref="AppDbContext"/> as a parameter; the MCP SDK
/// resolves it from the request's <see cref="IServiceProvider"/> per invocation
/// (scoped DbContext), so these methods are stateless and thread-safe.
/// </summary>
[McpServerToolType]
public static class WardenMcpTools
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    [McpServerTool(Name = "query_findings")]
    [Description(
        "Query security findings across projects. Optionally filter by project name " +
        "(case-insensitive contains), severity (Info, Low, Medium, High, Critical) and " +
        "status (Open, Confirmed, AcceptedRisk, Fixed, Incorrect). Returns a JSON array of " +
        "findings with id, name, severity, status, project, location and createdAt.")]
    public static async Task<string> QueryFindings(
        AppDbContext context,
        [Description("Optional project name to filter by (case-insensitive substring match).")]
        string? projectName = null,
        [Description("Optional severity filter: Info, Low, Medium, High or Critical.")]
        string? severity = null,
        [Description("Optional status filter: Open, Confirmed, AcceptedRisk, Fixed or Incorrect.")]
        string? status = null,
        [Description("Maximum number of findings to return. Defaults to 20.")]
        int limit = 20,
        CancellationToken cancellationToken = default)
    {
        if (limit <= 0) limit = 20;

        var query = context.Findings
            .AsNoTracking()
            .Include(f => f.Project)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(projectName))
        {
            var name = projectName.Trim();
            query = query.Where(f => f.Project != null &&
                                     EF.Functions.Like(f.Project.Name, $"%{name}%"));
        }

        if (TryParseEnum<FindingSeverity>(severity, out var sev))
        {
            query = query.Where(f => f.Severity == sev);
        }

        if (TryParseEnum<FindingStatus>(status, out var stat))
        {
            query = query.Where(f => f.Status == stat);
        }

        var findings = await query
            .OrderByDescending(f => f.CreatedAt)
            .Take(limit)
            .Select(f => new
            {
                id = f.Id,
                name = f.Name,
                severity = f.Severity.ToString(),
                status = f.Status.ToString(),
                project = f.Project != null ? f.Project.Name : null,
                location = f.Location,
                createdAt = f.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return JsonSerializer.Serialize(findings, JsonOptions);
    }

    [McpServerTool(Name = "get_project_posture")]
    [Description(
        "Get the security posture for a single project: counts of findings broken down by " +
        "severity and by status, plus the timestamp of the project's last scan. " +
        "Returns a JSON object.")]
    public static async Task<string> GetProjectPosture(
        AppDbContext context,
        [Description("Project name to inspect (case-insensitive substring match; first match wins).")]
        string projectName,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(projectName))
        {
            return JsonSerializer.Serialize(new { error = "projectName is required." }, JsonOptions);
        }

        var name = projectName.Trim();
        var project = await context.Projects
            .AsNoTracking()
            .Where(p => EF.Functions.Like(p.Name, $"%{name}%"))
            .OrderBy(p => p.Name)
            .FirstOrDefaultAsync(cancellationToken);

        if (project == null)
        {
            return JsonSerializer.Serialize(
                new { error = $"No project found matching '{projectName}'." }, JsonOptions);
        }

        var findings = await context.Findings
            .AsNoTracking()
            .Where(f => f.ProjectId == project.Id)
            .Select(f => new { f.Severity, f.Status })
            .ToListAsync(cancellationToken);

        var bySeverity = findings
            .GroupBy(f => f.Severity)
            .ToDictionary(g => g.Key.ToString(), g => g.Count());

        var byStatus = findings
            .GroupBy(f => f.Status)
            .ToDictionary(g => g.Key.ToString(), g => g.Count());

        var lastScanAt = await context.Scans
            .AsNoTracking()
            .Where(s => s.ProjectId == project.Id)
            .OrderByDescending(s => s.StartedAt)
            .Select(s => (DateTime?)s.StartedAt)
            .FirstOrDefaultAsync(cancellationToken);

        var result = new
        {
            project = project.Name,
            projectId = project.Id,
            totalFindings = findings.Count,
            bySeverity,
            byStatus,
            lastScanAt
        };

        return JsonSerializer.Serialize(result, JsonOptions);
    }

    [McpServerTool(Name = "update_finding_status")]
    [Description(
        "Update the status of a finding (Open, Confirmed, AcceptedRisk, Fixed or Incorrect) " +
        "and record a ChangeStatus activity with an optional comment. Returns a JSON object " +
        "describing the change.")]
    public static async Task<string> UpdateFindingStatus(
        AppDbContext context,
        [Description("The GUID id of the finding to update.")]
        string findingId,
        [Description("The new status: Open, Confirmed, AcceptedRisk, Fixed or Incorrect.")]
        string status,
        [Description("Optional comment to attach to the status-change activity.")]
        string? comment = null,
        CancellationToken cancellationToken = default)
    {
        if (!Guid.TryParse(findingId, out var id))
        {
            return JsonSerializer.Serialize(
                new { error = $"'{findingId}' is not a valid finding id." }, JsonOptions);
        }

        if (!TryParseEnum<FindingStatus>(status, out var newStatus))
        {
            return JsonSerializer.Serialize(
                new { error = $"'{status}' is not a valid status. Valid values: " +
                              string.Join(", ", Enum.GetNames<FindingStatus>()) + "." },
                JsonOptions);
        }

        var finding = await context.Findings
            .FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
        if (finding == null)
        {
            return JsonSerializer.Serialize(
                new { error = $"Finding '{findingId}' not found." }, JsonOptions);
        }

        var oldStatus = finding.Status;
        if (oldStatus == newStatus && string.IsNullOrWhiteSpace(comment))
        {
            return JsonSerializer.Serialize(
                new
                {
                    id = finding.Id,
                    status = finding.Status.ToString(),
                    changed = false,
                    message = "Finding already has the requested status."
                }, JsonOptions);
        }

        // Record the status change as a FindingActivities row. The MCP transport
        // is not tied to an interactive user, so UserId is left null (system actor).
        // CreatedAt/UpdatedAt are stamped automatically by AppDbContext.SaveChangesAsync.
        var activity = new FindingActivities
        {
            Id = Guid.NewGuid(),
            UserId = null,
            Type = FindingActivityType.ChangeStatus,
            OldState = oldStatus.ToString(),
            NewState = newStatus.ToString(),
            Comment = string.IsNullOrWhiteSpace(comment) ? null : comment,
            FindingId = finding.Id
        };
        context.FindingActivities.Add(activity);

        finding.Status = newStatus;
        if (newStatus == FindingStatus.Fixed)
        {
            finding.FixedAt = DateTime.UtcNow;
        }

        await context.SaveChangesAsync(cancellationToken);

        var result = new
        {
            id = finding.Id,
            previousStatus = oldStatus.ToString(),
            status = finding.Status.ToString(),
            changed = true,
            activityId = activity.Id,
            comment = activity.Comment
        };

        return JsonSerializer.Serialize(result, JsonOptions);
    }

    [McpServerTool(Name = "list_sla_breaches")]
    [Description(
        "List open or confirmed findings whose remediation deadline (FixDeadline) has passed, " +
        "ordered by most overdue first. Returns a JSON array including daysOverdue.")]
    public static async Task<string> ListSlaBreaches(
        AppDbContext context,
        [Description("Maximum number of breaching findings to return. Defaults to 20.")]
        int limit = 20,
        CancellationToken cancellationToken = default)
    {
        if (limit <= 0) limit = 20;
        var now = DateTime.UtcNow;

        var breaches = await context.Findings
            .AsNoTracking()
            .Include(f => f.Project)
            .Where(f => (f.Status == FindingStatus.Open || f.Status == FindingStatus.Confirmed)
                        && f.FixDeadline != null
                        && f.FixDeadline < now)
            .OrderBy(f => f.FixDeadline)
            .Take(limit)
            .Select(f => new
            {
                id = f.Id,
                name = f.Name,
                severity = f.Severity.ToString(),
                status = f.Status.ToString(),
                project = f.Project != null ? f.Project.Name : null,
                location = f.Location,
                fixDeadline = f.FixDeadline,
                daysOverdue = (int)Math.Floor((now - f.FixDeadline!.Value).TotalDays)
            })
            .ToListAsync(cancellationToken);

        return JsonSerializer.Serialize(breaches, JsonOptions);
    }

    private static bool TryParseEnum<TEnum>(string? value, out TEnum result) where TEnum : struct, Enum
    {
        result = default;
        return !string.IsNullOrWhiteSpace(value) && Enum.TryParse(value.Trim(), ignoreCase: true, out result);
    }
}
