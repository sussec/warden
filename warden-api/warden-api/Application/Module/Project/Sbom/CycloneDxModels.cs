using System.Text.Json.Serialization;

namespace Warden.Application.Module.Project.Sbom;

/// <summary>
/// Minimal typed representation of a CycloneDX 1.5 JSON BOM.
/// Property names that differ from camelCase serialization (e.g. bom-ref)
/// are pinned explicitly via <see cref="JsonPropertyNameAttribute"/>.
/// </summary>
public record CycloneDxBom
{
    [JsonPropertyName("bomFormat")]
    public string BomFormat { get; init; } = "CycloneDX";

    [JsonPropertyName("specVersion")]
    public string SpecVersion { get; init; } = "1.5";

    [JsonPropertyName("version")]
    public int Version { get; init; } = 1;

    [JsonPropertyName("metadata")]
    public CycloneDxMetadata? Metadata { get; init; }

    [JsonPropertyName("components")]
    public List<CycloneDxComponent> Components { get; init; } = [];

    [JsonPropertyName("vulnerabilities")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<CycloneDxVulnerability>? Vulnerabilities { get; init; }
}

public record CycloneDxMetadata
{
    [JsonPropertyName("timestamp")]
    public string Timestamp { get; init; } = string.Empty;

    [JsonPropertyName("component")]
    public CycloneDxComponent? Component { get; init; }
}

public record CycloneDxComponent
{
    [JsonPropertyName("type")]
    public string Type { get; init; } = "library";

    [JsonPropertyName("bom-ref")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? BomRef { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("version")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Version { get; init; }

    [JsonPropertyName("purl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Purl { get; init; }

    [JsonPropertyName("licenses")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<CycloneDxLicenseChoice>? Licenses { get; init; }
}

public record CycloneDxLicenseChoice
{
    [JsonPropertyName("license")]
    public CycloneDxLicense License { get; init; } = new();
}

public record CycloneDxLicense
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;
}

public record CycloneDxVulnerability
{
    [JsonPropertyName("bom-ref")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? BomRef { get; init; }

    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; init; }

    [JsonPropertyName("ratings")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<CycloneDxRating>? Ratings { get; init; }

    [JsonPropertyName("affects")]
    public List<CycloneDxAffects> Affects { get; init; } = [];
}

public record CycloneDxRating
{
    [JsonPropertyName("severity")]
    public string Severity { get; init; } = "unknown";
}

public record CycloneDxAffects
{
    [JsonPropertyName("ref")]
    public string Ref { get; init; } = string.Empty;
}
