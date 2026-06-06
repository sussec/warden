using System.Text.Json.Serialization;

namespace Warden.Application.Module.Project.Vex;

/// <summary>
/// OpenVEX v0.2.0 document (https://github.com/openvex/spec). Serialized
/// with explicit property names because the spec uses JSON-LD style keys.
/// </summary>
public record OpenVexDocument
{
    [JsonPropertyName("@context")]
    public string Context { get; init; } = "https://openvex.dev/ns/v0.2.0";

    [JsonPropertyName("@id")]
    public required string Id { get; init; }

    [JsonPropertyName("author")]
    public required string Author { get; init; }

    [JsonPropertyName("role")]
    public string Role { get; init; } = "Document Creator";

    [JsonPropertyName("timestamp")]
    public required string Timestamp { get; init; }

    /// Spec requires an integer, incremented on content change.
    [JsonPropertyName("version")]
    public int Version { get; init; } = 1;

    [JsonPropertyName("statements")]
    public required List<OpenVexStatement> Statements { get; init; }
}

public record OpenVexStatement
{
    [JsonPropertyName("vulnerability")]
    public required OpenVexVulnerability Vulnerability { get; init; }

    [JsonPropertyName("products")]
    public required List<OpenVexProduct> Products { get; init; }

    /// One of: not_affected | affected | fixed | under_investigation.
    [JsonPropertyName("status")]
    public required string Status { get; init; }

    [JsonPropertyName("status_notes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? StatusNotes { get; init; }

    /// Required for not_affected unless impact_statement is present.
    [JsonPropertyName("justification")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Justification { get; init; }

    /// Alternative to justification for not_affected.
    [JsonPropertyName("impact_statement")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ImpactStatement { get; init; }

    /// Required for affected.
    [JsonPropertyName("action_statement")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ActionStatement { get; init; }
}

public record OpenVexVulnerability
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }
}

public record OpenVexProduct
{
    /// IRI identifying the product; a purl when one is known.
    [JsonPropertyName("@id")]
    public required string Id { get; init; }
}
