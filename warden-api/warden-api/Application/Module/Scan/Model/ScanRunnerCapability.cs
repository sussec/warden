namespace Warden.Application.Module.Scan.Model;

/// <summary>
/// Operator-facing readiness for UI-triggered scans (no CLI required).
/// </summary>
public record ScanRunnerCapability
{
    public required string Backend { get; init; }
    public required bool Available { get; init; }
    public required bool TokenConfigured { get; init; }
    public required bool SocketPresent { get; init; }
    public required string Message { get; init; }
    /// <summary>Scanner service name → local image present (best-effort).</summary>
    public Dictionary<string, bool> Images { get; init; } = new();
    /// <summary>All fleet plugins (gitleaks, semgrep, …) with target type — always listed when API is up.</summary>
    public List<FleetPluginInfo> Plugins { get; init; } = [];
}

public record FleetPluginInfo
{
    public required string Service { get; init; }
    public required string TargetType { get; init; }
    public required bool Enabled { get; init; }
    public bool ImageReady { get; init; }
}
