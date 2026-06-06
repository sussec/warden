using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Warden.Core.Enum;
using FluentResults;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Project.Vex;

/// <summary>
/// Builds an OpenVEX v0.2.0 document from a project's triage decisions, so
/// downstream scanners (Grype, Trivy, osv-scanner) can suppress findings the
/// security team has already assessed. Status mapping:
///
///   Incorrect (false positive) → not_affected  (+ impact_statement)
///   AcceptedRisk               → affected      (+ action_statement, spec-required)
///   Fixed                      → fixed
///
/// Only findings whose identity is an advisory id (CVE/GHSA/OSV/…) are
/// exported — SAST fingerprints have no meaning in VEX. Products are the
/// purls of packages linked to the same advisory; when none resolve, the
/// project URN is used so the statement remains spec-valid.
/// </summary>
public partial class GenerateVexCommand(AppDbContext context)
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        WriteIndented = true
    };

    [GeneratedRegex("^[A-Za-z]{2,16}-[A-Za-z0-9][A-Za-z0-9.-]*$")]
    private static partial Regex AdvisoryIdPattern();

    public async Task<Result<byte[]>> ExecuteAsync(Guid projectId)
    {
        var project = await context.Projects
            .FirstOrDefaultAsync(record => record.Id == projectId);
        if (project == null)
        {
            return Result.Fail("Project not found");
        }

        var triaged = await context.Findings
            .Where(record => record.ProjectId == projectId)
            .Where(record => record.Status == FindingStatus.Incorrect
                          || record.Status == FindingStatus.AcceptedRisk
                          || record.Status == FindingStatus.Fixed)
            .OrderBy(record => record.Identity)
            .ToListAsync();

        var advisoryFindings = triaged
            .Where(finding => AdvisoryIdPattern().IsMatch(finding.Identity))
            .ToList();

        // Resolve product purls: packages linked to a vulnerability carrying
        // the same advisory identity.
        var identities = advisoryFindings.Select(finding => finding.Identity).Distinct().ToList();
        var purlLinks = await context.PackageVulnerabilities
            .Where(record => record.Vulnerability != null && identities.Contains(record.Vulnerability.Identity))
            .Select(record => new { record.Vulnerability!.Identity, record.Package!.PkgId })
            .Distinct()
            .ToListAsync();
        var purlsByIdentity = purlLinks
            .GroupBy(link => link.Identity)
            .ToDictionary(group => group.Key, group => group.Select(link => link.PkgId).Order().ToList());

        var fallbackProduct = $"urn:warden:project:{project.Id}";
        var statements = new List<OpenVexStatement>(advisoryFindings.Count);
        foreach (var finding in advisoryFindings)
        {
            var products = purlsByIdentity.TryGetValue(finding.Identity, out var purls)
                ? purls.Select(purl => new OpenVexProduct { Id = purl }).ToList()
                : [new OpenVexProduct { Id = fallbackProduct }];

            statements.Add(finding.Status switch
            {
                FindingStatus.Incorrect => new OpenVexStatement
                {
                    Vulnerability = new OpenVexVulnerability { Name = finding.Identity },
                    Products = products,
                    Status = "not_affected",
                    ImpactStatement = "Triaged as a false positive in Techanv Warden.",
                },
                FindingStatus.AcceptedRisk => new OpenVexStatement
                {
                    Vulnerability = new OpenVexVulnerability { Name = finding.Identity },
                    Products = products,
                    Status = "affected",
                    ActionStatement = "Risk accepted in Techanv Warden triage; no remediation planned.",
                },
                _ => new OpenVexStatement
                {
                    Vulnerability = new OpenVexVulnerability { Name = finding.Identity },
                    Products = products,
                    Status = "fixed",
                },
            });
        }

        var now = DateTime.UtcNow;
        var document = new OpenVexDocument
        {
            Id = $"urn:warden:vex:{project.Id}:{now:yyyyMMddTHHmmssZ}",
            Author = "Techanv Warden",
            Timestamp = now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"),
            Statements = statements
        };

        var json = JsonSerializer.Serialize(document, SerializerOptions);
        return Encoding.UTF8.GetBytes(json);
    }
}
