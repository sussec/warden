using Warden.Application.Module.Osv.Model;

namespace Warden.Application.Module.Osv;

public interface IOsvAdvisoryService
{
    /// Whether an OSV service endpoint is configured.
    bool Enabled { get; }

    /// Whether the identity looks like an advisory id (CVE/GHSA/OSV/…)
    /// rather than a SAST-style "ruleId:path:line" fingerprint.
    bool IsAdvisoryIdentity(string identity);

    /// Fetch one advisory by id; null when unknown upstream.
    Task<OsvAdvisory?> GetAdvisoryAsync(string id, CancellationToken cancellationToken = default);

    /// List advisories affecting a package version; ecosystem uses Warden's
    /// package Type ("npm", "maven", …) and is mapped to OSV naming, including
    /// ecosystem-specific group handling (Maven "group:artifact").
    Task<List<OsvAdvisory>> GetPackageAdvisoriesAsync(
        string type, string? group, string name, string version,
        CancellationToken cancellationToken = default);
}
