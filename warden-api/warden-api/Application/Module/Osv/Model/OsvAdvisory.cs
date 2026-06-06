namespace Warden.Application.Module.Osv.Model;

/// <summary>
/// Flattened OSV.dev advisory as served by the warden-osv sidecar
/// (<c>GET /v1/advisory/{id}</c>). Field names mirror the Go service.
/// </summary>
public record OsvAdvisory
{
    public required string Id { get; set; }
    public List<string>? Aliases { get; set; }
    public string? Summary { get; set; }
    public string? Details { get; set; }
    /// Coarse bucket derived upstream: Critical / High / Medium / Low.
    public string? Severity { get; set; }
    /// CVSS vector string (v4 preferred, else v3).
    public string? Cvss { get; set; }
    public string? Published { get; set; }
    public string? Modified { get; set; }
    /// Non-null when the advisory was withdrawn upstream.
    public string? Withdrawn { get; set; }
    public List<OsvReference>? References { get; set; }
    public List<OsvAffectedPackage>? Affected { get; set; }
}

public record OsvReference
{
    public required string Type { get; set; }
    public required string Url { get; set; }
}

public record OsvAffectedPackage
{
    public required string Ecosystem { get; set; }
    public required string Name { get; set; }
    public string? FixedVersion { get; set; }
}
