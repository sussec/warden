using Warden.Core.Enum;

namespace Warden.Application.Module.Scan;

/// <summary>
/// Canonical UI/API fleet — every plugin is registered as Active on startup.
/// Keep in sync with docker-compose scan profile + web FLEET list.
/// </summary>
public static class FleetScannerCatalog
{
    public static readonly IReadOnlyList<(string Name, ScannerType Type)> All =
    [
        ("semgrep", ScannerType.Sast),
        ("gitleaks", ScannerType.Secret),
        ("trufflehog", ScannerType.Secret),
        ("trivy", ScannerType.Dependency),
        ("grype", ScannerType.Dependency),
        ("osv", ScannerType.Dependency),
        ("cve-lite", ScannerType.Dependency),
        ("cargo-audit", ScannerType.Dependency),
        ("cargo-deny", ScannerType.Dependency),
        ("cargo-geiger", ScannerType.Sast),
        ("trivy-license", ScannerType.Dependency),
        ("kubescape", ScannerType.Sast),
        ("prowler", ScannerType.Cloud),
        ("syft", ScannerType.Dependency),
        ("checkov", ScannerType.Sast),
        ("guarddog", ScannerType.Sast),
        ("deepsec", ScannerType.Sast),
        ("codeql", ScannerType.Sast),
        ("trivy-iac", ScannerType.Sast),
        ("trivy-image", ScannerType.Container),
        ("zap", ScannerType.Dast),
        ("nuclei", ScannerType.Dast),
        ("nikto", ScannerType.Dast),
        ("dependency-check", ScannerType.Dependency),
        ("kingfisher", ScannerType.Secret),
        ("augustus", ScannerType.Ai),
    ];
}
