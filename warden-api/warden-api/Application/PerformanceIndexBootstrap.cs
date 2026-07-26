using Microsoft.EntityFrameworkCore;

namespace Warden.Application;

/// <summary>
/// Idempotent covering indexes for high-volume list/filter/dashboard paths.
/// Safe to re-run on every boot (IF NOT EXISTS).
/// </summary>
public static class PerformanceIndexBootstrap
{
    private static readonly string[] Statements =
    [
        // Findings: project dashboards + filters
        """
        CREATE INDEX IF NOT EXISTS "IX_Findings_Project_Status_Severity_Created"
        ON "Findings" ("ProjectId", "Status", "Severity", "CreatedAt" DESC)
        """,
        """
        CREATE INDEX IF NOT EXISTS "IX_Findings_Status_Severity_Created"
        ON "Findings" ("Status", "Severity", "CreatedAt" DESC)
        """,
        """
        CREATE INDEX IF NOT EXISTS "IX_Findings_CreatedAt"
        ON "Findings" ("CreatedAt" DESC)
        """,
        // Membership checks in FindingFilter
        """
        CREATE INDEX IF NOT EXISTS "IX_ProjectUsers_UserId_ProjectId"
        ON "ProjectUsers" ("UserId", "ProjectId")
        """,
        // Scan-job fleet UI
        """
        CREATE INDEX IF NOT EXISTS "IX_ScanJobs_Status_CreatedAt"
        ON "ScanJobs" ("Status", "CreatedAt" DESC)
        """,
        """
        CREATE INDEX IF NOT EXISTS "IX_ScanJobs_Scanner_CreatedAt"
        ON "ScanJobs" ("Scanner", "CreatedAt" DESC)
        """,
        // Status-at-commit filters
        """
        CREATE INDEX IF NOT EXISTS "IX_ScanFindings_FindingId_Status"
        ON "ScanFindings" ("FindingId", "Status")
        """,
        // Packages / SCA
        """
        CREATE INDEX IF NOT EXISTS "IX_ProjectPackages_ProjectId_Status"
        ON "ProjectPackages" ("ProjectId", "Status")
        """
    ];

    public static async Task EnsureAsync(AppDbContext context, CancellationToken cancellationToken = default)
    {
        foreach (var sql in Statements)
        {
            try
            {
                await context.Database.ExecuteSqlRawAsync(sql, cancellationToken);
            }
            catch (Exception)
            {
                // Table may not exist yet on brand-new installs before all migrations — ignore.
            }
        }
    }
}
