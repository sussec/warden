using System.Text.Json.Serialization;

namespace Warden.Application.Module.Ci.Model.Sarif;

// Minimal, lenient SARIF 2.1.0 shape. Real-world SARIF varies wildly between
// producers (CodeQL, Bandit, gosec, Checkov, ZAP, ...), so everything here is
// nullable and only the fields the mapper consumes are modelled.

public record SarifLog
{
    [JsonPropertyName("version")] public string? Version { get; set; }
    [JsonPropertyName("runs")] public List<SarifRun>? Runs { get; set; }
}

public record SarifRun
{
    [JsonPropertyName("tool")] public SarifTool? Tool { get; set; }
    [JsonPropertyName("results")] public List<SarifResult>? Results { get; set; }
}

public record SarifTool
{
    [JsonPropertyName("driver")] public SarifToolComponent? Driver { get; set; }
}

public record SarifToolComponent
{
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("rules")] public List<SarifReportingDescriptor>? Rules { get; set; }
}

public record SarifReportingDescriptor
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("shortDescription")] public SarifMessage? ShortDescription { get; set; }
    [JsonPropertyName("fullDescription")] public SarifMessage? FullDescription { get; set; }
    [JsonPropertyName("helpUri")] public string? HelpUri { get; set; }
    [JsonPropertyName("defaultConfiguration")] public SarifReportingConfiguration? DefaultConfiguration { get; set; }
    [JsonPropertyName("properties")] public SarifPropertyBag? Properties { get; set; }
}

public record SarifReportingConfiguration
{
    [JsonPropertyName("level")] public string? Level { get; set; }
}

public record SarifResult
{
    [JsonPropertyName("ruleId")] public string? RuleId { get; set; }
    [JsonPropertyName("ruleIndex")] public int? RuleIndex { get; set; }
    [JsonPropertyName("level")] public string? Level { get; set; }
    [JsonPropertyName("message")] public SarifMessage? Message { get; set; }
    [JsonPropertyName("locations")] public List<SarifLocation>? Locations { get; set; }
    [JsonPropertyName("properties")] public SarifPropertyBag? Properties { get; set; }
}

public record SarifMessage
{
    [JsonPropertyName("text")] public string? Text { get; set; }
}

public record SarifLocation
{
    [JsonPropertyName("physicalLocation")] public SarifPhysicalLocation? PhysicalLocation { get; set; }
}

public record SarifPhysicalLocation
{
    [JsonPropertyName("artifactLocation")] public SarifArtifactLocation? ArtifactLocation { get; set; }
    [JsonPropertyName("region")] public SarifRegion? Region { get; set; }
}

public record SarifArtifactLocation
{
    [JsonPropertyName("uri")] public string? Uri { get; set; }
}

public record SarifRegion
{
    [JsonPropertyName("startLine")] public int? StartLine { get; set; }
    [JsonPropertyName("endLine")] public int? EndLine { get; set; }
    [JsonPropertyName("startColumn")] public int? StartColumn { get; set; }
    [JsonPropertyName("endColumn")] public int? EndColumn { get; set; }
    [JsonPropertyName("snippet")] public SarifArtifactContent? Snippet { get; set; }
}

public record SarifArtifactContent
{
    [JsonPropertyName("text")] public string? Text { get; set; }
}

public record SarifPropertyBag
{
    [JsonPropertyName("security-severity")] public string? SecuritySeverity { get; set; }
    [JsonPropertyName("tags")] public List<string>? Tags { get; set; }
    [JsonPropertyName("cwe")] public string? Cwe { get; set; }
}
