using System.Globalization;
using Warden.Application.Module.Finding;
using Warden.Core.Enum;

namespace Warden.Application.Module.Ci.Model.Sarif;

// Translates a SARIF 2.1.0 log into the CiFinding model that the existing CI
// ingest pipeline (ICiService.UploadFinding) already understands. Lenient by
// design: missing fields fall back to sensible defaults rather than throwing.
public static class SarifMapper
{
    public static List<CiFinding> Map(SarifLog sarif)
    {
        var findings = new List<CiFinding>();
        if (sarif.Runs == null) return findings;

        foreach (var run in sarif.Runs)
        {
            if (run?.Results == null) continue;

            // Index rules by id, and keep the ordered list for ruleIndex lookups.
            var rules = run.Tool?.Driver?.Rules ?? [];
            var rulesById = new Dictionary<string, SarifReportingDescriptor>();
            foreach (var rule in rules)
                if (!string.IsNullOrEmpty(rule.Id) && !rulesById.ContainsKey(rule.Id!))
                    rulesById[rule.Id!] = rule;

            foreach (var result in run.Results)
            {
                if (result == null) continue;

                var rule = ResolveRule(result, rules, rulesById);
                var ruleId = result.RuleId ?? rule?.Id ?? "unknown";

                var physical = result.Locations?
                    .FirstOrDefault(l => l?.PhysicalLocation != null)?
                    .PhysicalLocation;
                var region = physical?.Region;
                var rawUri = physical?.ArtifactLocation?.Uri;
                var path = NormalizePath(rawUri);
                var startLine = region?.StartLine;

                var identity = $"{ruleId}:{path ?? rawUri ?? string.Empty}:{startLine?.ToString() ?? "0"}";

                var name = !string.IsNullOrEmpty(rule?.Name) ? rule!.Name! : ruleId;
                var description = BuildDescription(result, rule);

                var finding = new CiFinding
                {
                    Identity = identity,
                    RuleId = ruleId,
                    Name = name,
                    Description = description,
                    Category = ResolveCategory(rule),
                    Severity = ResolveSeverity(result, rule),
                    Location = path == null
                        ? null
                        : new FindingLocation
                        {
                            Path = path,
                            Snippet = region?.Snippet?.Text,
                            StartLine = region?.StartLine,
                            EndLine = region?.EndLine,
                            StartColumn = region?.StartColumn,
                            EndColumn = region?.EndColumn
                        },
                    Metadata = BuildMetadata(rule)
                };

                findings.Add(finding);
            }
        }

        return findings;
    }

    private static SarifReportingDescriptor? ResolveRule(
        SarifResult result,
        List<SarifReportingDescriptor> rules,
        Dictionary<string, SarifReportingDescriptor> rulesById)
    {
        if (!string.IsNullOrEmpty(result.RuleId) && rulesById.TryGetValue(result.RuleId!, out var byId))
            return byId;
        if (result.RuleIndex is >= 0 && result.RuleIndex < rules.Count)
            return rules[result.RuleIndex.Value];
        return null;
    }

    private static string BuildDescription(SarifResult result, SarifReportingDescriptor? rule)
    {
        var text = result.Message?.Text;
        if (string.IsNullOrWhiteSpace(text))
            text = rule?.ShortDescription?.Text;

        var full = rule?.FullDescription?.Text;
        if (!string.IsNullOrWhiteSpace(full) && full != text)
            text = string.IsNullOrWhiteSpace(text) ? full : $"{text}\n\n{full}";

        return string.IsNullOrWhiteSpace(text) ? (rule?.Id ?? "No description provided") : text!;
    }

    private static string? ResolveCategory(SarifReportingDescriptor? rule)
    {
        if (rule == null) return null;
        var tag = rule.Properties?.Tags?.FirstOrDefault(t => !string.IsNullOrWhiteSpace(t));
        if (!string.IsNullOrWhiteSpace(tag)) return tag;
        return rule.Properties?.Cwe;
    }

    private static FindingMetadata? BuildMetadata(SarifReportingDescriptor? rule)
    {
        if (rule == null) return null;

        var cwes = new List<string>();
        if (!string.IsNullOrWhiteSpace(rule.Properties?.Cwe))
            cwes.Add(rule.Properties!.Cwe!);
        if (rule.Properties?.Tags != null)
            cwes.AddRange(rule.Properties.Tags
                .Where(t => !string.IsNullOrWhiteSpace(t) &&
                            t.StartsWith("CWE", StringComparison.OrdinalIgnoreCase)));

        var references = new List<string>();
        if (!string.IsNullOrWhiteSpace(rule.HelpUri))
            references.Add(rule.HelpUri!);

        if (cwes.Count == 0 && references.Count == 0)
            return null;

        return new FindingMetadata
        {
            Cwes = cwes.Count > 0 ? cwes.Distinct().ToList() : null,
            References = references.Count > 0 ? references : null
        };
    }

    // SARIF "level": error / warning / note / none.
    // Prefer numeric properties.security-severity (0-10) when present.
    private static FindingSeverity ResolveSeverity(SarifResult result, SarifReportingDescriptor? rule)
    {
        var securitySeverity = result.Properties?.SecuritySeverity ?? rule?.Properties?.SecuritySeverity;
        if (!string.IsNullOrWhiteSpace(securitySeverity) &&
            double.TryParse(securitySeverity, NumberStyles.Float, CultureInfo.InvariantCulture, out var score))
        {
            if (score >= 9.0) return FindingSeverity.Critical;
            if (score >= 7.0) return FindingSeverity.High;
            if (score >= 4.0) return FindingSeverity.Medium;
            if (score > 0.0) return FindingSeverity.Low;
            return FindingSeverity.Info;
        }

        var level = result.Level ?? rule?.DefaultConfiguration?.Level;
        return level?.ToLowerInvariant() switch
        {
            "error" => FindingSeverity.High,
            "warning" => FindingSeverity.Medium,
            "note" => FindingSeverity.Low,
            "none" => FindingSeverity.Info,
            _ => FindingSeverity.Info
        };
    }

    // Strip "file://" scheme and leading slashes so the path is repo-relative.
    private static string? NormalizePath(string? uri)
    {
        if (string.IsNullOrWhiteSpace(uri)) return null;

        var path = uri!;
        if (path.StartsWith("file://", StringComparison.OrdinalIgnoreCase))
            path = path["file://".Length..];

        path = path.TrimStart('/');
        return string.IsNullOrWhiteSpace(path) ? null : path;
    }
}
