"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  Braces,
  Check,
  Copy,
  Container,
  FileWarning,
  Globe,
  History,
  KeyRound,
  PackageSearch,
  Radar,
  ScanSearch,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getScanners } from "@/client/sdk.gen";
import type { ScannerType } from "@/client/types.gen";

// Visual mapping for scanner types — same hue family as the severity palette.
const TYPE_STYLE: Record<ScannerType, string> = {
  Sast: "bg-high/15 text-high",
  Secret: "bg-critical/15 text-critical",
  Dependency: "bg-low/15 text-low",
  Container: "bg-medium/15 text-medium",
  Dast: "bg-info/15 text-info",
  Iast: "bg-muted text-muted-foreground",
};

function TypeBadge({ type }: { type: ScannerType }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", TYPE_STYLE[type])}>
      {type === "Dependency" ? "SCA" : type.toUpperCase()}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// On-demand scan fleet — mirrors the `scan` profile in docker-compose.yml.
// Keep in sync when adding scanner services there.
// ---------------------------------------------------------------------------

type FleetScanner = {
  service: string;
  match: string[]; // registered scanner names this service reports as
  type: ScannerType;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  command: string;
};

const TARGET = "SCAN_TARGET=/path/to/repo";
const RUN = "docker compose --profile scan run --rm";

const FLEET: FleetScanner[] = [
  {
    service: "semgrep",
    match: ["semgrep"],
    type: "Sast",
    description: "Static analysis across 30+ languages with community rulepacks.",
    icon: Braces,
    command: `${TARGET} ${RUN} semgrep`,
  },
  {
    service: "gitleaks",
    match: ["gitleaks"],
    type: "Secret",
    description: "Secret detection on the working tree (API keys, tokens, credentials).",
    icon: KeyRound,
    command: `${TARGET} ${RUN} gitleaks`,
  },
  {
    service: "trufflehog",
    match: ["trufflehog"],
    type: "Secret",
    description: "Git-history secret detection — complements the gitleaks working-tree scan.",
    icon: History,
    command: `${TARGET} ${RUN} trufflehog`,
  },
  {
    service: "trivy",
    match: ["trivy"],
    type: "Dependency",
    description: "Dependency (SCA) scanning of lockfiles and manifests.",
    icon: PackageSearch,
    command: `${TARGET} ${RUN} trivy`,
  },
  {
    service: "grype",
    match: ["grype"],
    type: "Dependency",
    description: "SCA second opinion with SBOM-grade dependency resolution (Syft).",
    icon: Boxes,
    command: `${TARGET} ${RUN} grype`,
  },
  {
    service: "trivy-iac",
    match: ["trivy-iac", "trivy iac"],
    type: "Sast",
    description: "IaC / misconfiguration scanning — Terraform, Kubernetes, Dockerfile.",
    icon: FileWarning,
    command: `${TARGET} ${RUN} trivy-iac`,
  },
  {
    service: "trivy-image",
    match: ["trivy-image", "trivy image"],
    type: "Container",
    description: "Container image vulnerability scanning for any local or remote image ref.",
    icon: Container,
    command: `SCAN_IMAGE_REF=nginx:latest ${RUN} trivy-image`,
  },
  {
    service: "zap",
    match: ["zap", "owasp zap"],
    type: "Dast",
    description: "DAST baseline scan against a running target (passive + spider).",
    icon: Globe,
    command: `SCAN_TARGET_URL=https://target ${RUN} zap`,
  },
  {
    service: "nuclei",
    match: ["nuclei"],
    type: "Dast",
    description: "Template-based vulnerability scanning against a running target.",
    icon: Radar,
    command: `SCAN_TARGET_URL=https://target ${RUN} nuclei`,
  },
];

function CommandSnippet({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-1 rounded-md border bg-muted/50 pl-3">
      <code className="flex-1 truncate py-2 font-mono text-xs text-muted-foreground">
        {command}
      </code>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        aria-label="Copy command"
        onClick={async () => {
          await navigator.clipboard.writeText(command);
          setCopied(true);
          toast.success("Command copied");
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="size-3.5 text-info" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}

export default function ScannerPage() {
  const { data: scanners, isLoading } = useQuery({
    queryKey: ["scanners"],
    queryFn: async () => (await getScanners({ body: {}, throwOnError: true })).data,
  });

  const isRegistered = (fleet: FleetScanner) =>
    (scanners ?? []).some((s) =>
      fleet.match.some((m) => (s.name ?? "").toLowerCase().includes(m)),
    );

  return (
    <div className="flex flex-col gap-4 px-2">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Scanners</h1>
        <p className="text-sm text-muted-foreground">
          Security scan fleet — run on demand, results land in Findings &amp;
          Dependencies
        </p>
      </div>

      {/* registered scanners ------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Scanners</CardTitle>
          <CardDescription>
            Scanners that have reported results to this Warden instance
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-36 rounded-md" />
            ))}
          {!isLoading && (scanners ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No scanners yet — run one below or wire a CI pipeline with a Warden
              access token.
            </p>
          )}
          {(scanners ?? []).map((s) => (
            <div
              key={s.id ?? s.name}
              className="flex items-center gap-2 rounded-md border px-3 py-1.5"
            >
              <span className="size-1.5 rounded-full bg-info" />
              <span className="text-sm font-medium">{s.name}</span>
              <TypeBadge type={s.type} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* on-demand fleet ----------------------------------------------------- */}
      <div>
        <h2 className="text-base font-bold">On-Demand Scan Fleet</h2>
        <p className="text-sm text-muted-foreground">
          Bundled compose profile — needs <code className="font-mono">WARDEN_TOKEN</code>{" "}
          (Setting → Access Token) in <code className="font-mono">.env</code>
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {FLEET.map((f) => (
          <Card key={f.service} className="gap-3">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <f.icon className="size-4 text-muted-foreground" />
                <CardTitle className="font-mono text-sm">{f.service}</CardTitle>
                <TypeBadge type={f.type} />
              </div>
              {isRegistered(f) && (
                <Badge variant="outline" className="border-info/40 text-info">
                  <ScanSearch className="size-3" /> Active
                </Badge>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{f.description}</p>
              <CommandSnippet command={f.command} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
