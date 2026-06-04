using System.Text;
using System.Text.Json;
using Warden.Core.Entity;
using Warden.Core.Enum;
using FluentResults;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Project.Sbom;

/// <summary>
/// Builds a CycloneDX 1.5 JSON SBOM for a project's current package inventory.
/// Packages are resolved from the scan pinned by (branch, commitId) when supplied,
/// otherwise from the latest scan on the project's default branch.
/// </summary>
public class GenerateSbomCommand(AppDbContext context)
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        WriteIndented = true
    };

    public async Task<Result<byte[]>> ExecuteAsync(Guid projectId, string? branch, Guid? commitId)
    {
        var project = await context.Projects
            .FirstOrDefaultAsync(record => record.Id == projectId);
        if (project == null)
        {
            return Result.Fail("Project not found");
        }

        // Resolve the scan to pin the inventory against.
        var scansQuery = context.Scans
            .Include(scan => scan.Commit)
            .Where(scan => scan.ProjectId == projectId);

        if (commitId != null)
        {
            scansQuery = scansQuery.Where(scan => scan.CommitId == commitId);
        }
        else if (!string.IsNullOrEmpty(branch))
        {
            scansQuery = scansQuery.Where(scan => scan.Commit!.Branch == branch);
        }
        else
        {
            scansQuery = scansQuery.Where(scan => scan.Commit!.IsDefault);
        }

        // Only dependency/container scans carry a package inventory; a SAST or
        // secret scan on the same commit has none. Pick the latest scan that
        // actually has packages so the SBOM is not empty.
        var scan = await scansQuery
            .Where(record => context.ScanProjectPackages.Any(p => p.ScanId == record.Id))
            .OrderByDescending(record => record.StartedAt)
            .FirstOrDefaultAsync();
        if (scan == null)
        {
            return Result.Fail("No scan with a package inventory found for the requested project");
        }

        // Packages present in the resolved scan, with their package details.
        var packages = await context.ScanProjectPackages
            .Where(record => record.ScanId == scan.Id)
            .Include(record => record.ProjectPackage)
            .ThenInclude(projectPackage => projectPackage!.Package)
            .Select(record => record.ProjectPackage!.Package!)
            .Distinct()
            .ToListAsync();

        // Vulnerabilities linked to those packages, keyed by package id.
        var packageIds = packages.Select(package => package.Id).ToList();
        var vulnerabilityLinks = await context.PackageVulnerabilities
            .Where(record => packageIds.Contains(record.PackageId))
            .Include(record => record.Vulnerability)
            .Select(record => new { record.PackageId, record.Vulnerability })
            .ToListAsync();

        var vulnerabilitiesByPackage = vulnerabilityLinks
            .Where(link => link.Vulnerability != null)
            .GroupBy(link => link.PackageId)
            .ToDictionary(group => group.Key, group => group.Select(link => link.Vulnerability!).ToList());

        var components = new List<CycloneDxComponent>(packages.Count);
        var vulnerabilities = new List<CycloneDxVulnerability>();

        foreach (var package in packages)
        {
            var bomRef = package.PkgId;
            components.Add(new CycloneDxComponent
            {
                Type = "library",
                BomRef = bomRef,
                Name = package.Name,
                Version = package.Version,
                Purl = package.PkgId,
                Licenses = string.IsNullOrEmpty(package.License)
                    ? null
                    : [new CycloneDxLicenseChoice { License = new CycloneDxLicense { Id = package.License } }]
            });

            if (!vulnerabilitiesByPackage.TryGetValue(package.Id, out var linkedVulns))
            {
                continue;
            }

            foreach (var vulnerability in linkedVulns)
            {
                vulnerabilities.Add(new CycloneDxVulnerability
                {
                    Id = string.IsNullOrEmpty(vulnerability.Identity) ? vulnerability.Name : vulnerability.Identity,
                    Description = string.IsNullOrEmpty(vulnerability.Description) ? null : vulnerability.Description,
                    Ratings = [new CycloneDxRating { Severity = MapSeverity(vulnerability.Severity) }],
                    Affects = [new CycloneDxAffects { Ref = bomRef }]
                });
            }
        }

        var bom = new CycloneDxBom
        {
            Metadata = new CycloneDxMetadata
            {
                Timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                Component = new CycloneDxComponent
                {
                    Type = "application",
                    BomRef = project.Id.ToString(),
                    Name = project.Name
                }
            },
            Components = components,
            Vulnerabilities = vulnerabilities.Count > 0 ? vulnerabilities : null
        };

        var json = JsonSerializer.Serialize(bom, SerializerOptions);
        return Encoding.UTF8.GetBytes(json);
    }

    private static string MapSeverity(FindingSeverity severity) => severity switch
    {
        FindingSeverity.Critical => "critical",
        FindingSeverity.High => "high",
        FindingSeverity.Medium => "medium",
        FindingSeverity.Low => "low",
        FindingSeverity.Info => "info",
        _ => "unknown"
    };
}
