using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Warden.Application.Exceptions;
using Warden.Application.Module.Osv.Model;

namespace Warden.Application.Module.Osv;

/// <summary>
/// Client for the warden-osv sidecar — a cached facade over OSV.dev.
/// Configured via <c>OSV_SERVICE_URL</c>; when empty the feature is disabled
/// and endpoints return 404 without touching the network.
/// </summary>
public partial class OsvAdvisoryService : IOsvAdvisoryService
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(30) };

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    // CVE-2024-1234, GHSA-xxxx-xxxx-xxxx, OSV-…, PYSEC-…, RUSTSEC-…, GO-… —
    // an advisory id is "PREFIX-rest" with no path/rule separators.
    [GeneratedRegex(@"^[A-Za-z]{2,16}-[A-Za-z0-9][A-Za-z0-9.-]*$")]
    private static partial Regex AdvisoryIdPattern();

    /// Warden package Type → OSV ecosystem naming. Scanners disagree on type
    /// strings (osv-scanner emits OSV ecosystems, grype emits "java-archive"/
    /// "go-module"/…, trivy emits "gobinary"/"jar"/…), so alias them all.
    private static readonly Dictionary<string, string> EcosystemMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["npm"] = "npm",
        ["node"] = "npm",
        ["maven"] = "Maven",
        ["java"] = "Maven",
        ["java-archive"] = "Maven",
        ["java-jar"] = "Maven",
        ["jar"] = "Maven",
        ["pom"] = "Maven",
        ["pip"] = "PyPI",
        ["pypi"] = "PyPI",
        ["python"] = "PyPI",
        ["go"] = "Go",
        ["golang"] = "Go",
        ["go-module"] = "Go",
        ["go-binary"] = "Go",
        ["gomodule"] = "Go",
        ["gobinary"] = "Go",
        ["cargo"] = "crates.io",
        ["crates.io"] = "crates.io",
        ["rust"] = "crates.io",
        ["rust-crate"] = "crates.io",
        ["gem"] = "RubyGems",
        ["rubygems"] = "RubyGems",
        ["nuget"] = "NuGet",
        ["dotnet"] = "NuGet",
        ["composer"] = "Packagist",
        ["packagist"] = "Packagist",
        ["hex"] = "Hex",
        ["pub"] = "Pub",
        ["dart-pub"] = "Pub",
        ["swift"] = "SwiftURL",
        ["debian"] = "Debian",
        ["ubuntu"] = "Ubuntu",
        ["alpine"] = "Alpine",
        ["apk"] = "Alpine",
    };

    private readonly string _baseUrl = Configuration.OsvServiceUrl.TrimEnd('/');

    public bool Enabled => !string.IsNullOrWhiteSpace(_baseUrl);

    public bool IsAdvisoryIdentity(string identity) =>
        !string.IsNullOrWhiteSpace(identity) && AdvisoryIdPattern().IsMatch(identity);

    public async Task<OsvAdvisory?> GetAdvisoryAsync(string id, CancellationToken cancellationToken = default)
    {
        EnsureEnabled();
        var url = $"{_baseUrl}/v1/advisory/{Uri.EscapeDataString(id)}";
        using var res = await Http.GetAsync(url, cancellationToken);
        if (res.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
        await EnsureSuccess(res, cancellationToken);
        var body = await res.Content.ReadAsStringAsync(cancellationToken);
        return JsonSerializer.Deserialize<OsvAdvisory>(body, Json);
    }

    public async Task<List<OsvAdvisory>> GetPackageAdvisoriesAsync(
        string type, string? group, string name, string version, CancellationToken cancellationToken = default)
    {
        EnsureEnabled();
        if (!EcosystemMap.TryGetValue(type.Trim(), out var ecosystem))
        {
            // OS-level / unknown package types ("Unknown", "deb", "rpm", …)
            // simply have no OSV ecosystem — no advisories, not an error.
            return [];
        }
        var osvName = OsvPackageName(ecosystem, group, name);
        var url = $"{_baseUrl}/v1/packages/{Uri.EscapeDataString(ecosystem)}/" +
                  $"{Uri.EscapeDataString(osvName)}/{Uri.EscapeDataString(version)}";
        using var res = await Http.GetAsync(url, cancellationToken);
        await EnsureSuccess(res, cancellationToken);
        var body = await res.Content.ReadAsStringAsync(cancellationToken);
        var parsed = JsonSerializer.Deserialize<PackageAdvisoriesResponse>(body, Json);
        return parsed?.Advisories ?? [];
    }

    /// OSV package naming: Maven uses "group:artifact"; npm scopes are part of
    /// the name already; other ecosystems use the plain name.
    private static string OsvPackageName(string ecosystem, string? group, string name)
    {
        if (string.IsNullOrEmpty(group))
        {
            return name;
        }
        return ecosystem == "Maven" ? $"{group}:{name}" : name;
    }

    private void EnsureEnabled()
    {
        if (!Enabled)
        {
            throw new NotFoundException("OSV advisory service is not configured");
        }
    }

    private static async Task EnsureSuccess(HttpResponseMessage res, CancellationToken cancellationToken)
    {
        if (res.IsSuccessStatusCode)
        {
            return;
        }
        var body = await res.Content.ReadAsStringAsync(cancellationToken);
        throw new HttpRequestException(
            $"warden-osv {(int)res.StatusCode}: {body[..Math.Min(body.Length, 300)]}");
    }

    private sealed record PackageAdvisoriesResponse
    {
        public List<OsvAdvisory>? Advisories { get; set; }
    }
}
