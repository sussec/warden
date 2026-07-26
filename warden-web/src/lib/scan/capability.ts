/** Runner readiness — GET /api/scan-job/capability (UI-only scans). */

export type FleetPluginInfo = {
  service: string;
  targetType: string;
  enabled: boolean;
  imageReady?: boolean;
};

export type ScanRunnerCapability = {
  backend: string;
  available: boolean;
  tokenConfigured: boolean;
  socketPresent: boolean;
  message: string;
  images: Record<string, boolean>;
  /** All fleet plugins (gitleaks, semgrep, …) — enabled for UI Run */
  plugins?: FleetPluginInfo[];
};

export async function fetchScanCapability(): Promise<ScanRunnerCapability> {
  const res = await fetch("/api/scan-job/capability", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Capability check failed (${res.status})`);
  }
  return res.json() as Promise<ScanRunnerCapability>;
}
