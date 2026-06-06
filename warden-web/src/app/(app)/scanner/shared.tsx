"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  Braces,
  Check,
  Copy,
  Container,
  FileText,
  FileWarning,
  Globe,
  History,
  KeyRound,
  Loader2,
  Bug,
  PackageCheck,
  PackageSearch,
  Play,
  Radar,
  ScanSearch,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { createScanJob, getScanJobs, getScanners } from "@/client/sdk.gen";
import type { ScanJobInfo, ScanJobStatus, ScannerType } from "@/client/types.gen";

// ---- badges ---------------------------------------------------------------

const TYPE_STYLE: Record<ScannerType, string> = {
  Sast: "bg-high/15 text-high",
  Secret: "bg-critical/15 text-critical",
  Dependency: "bg-low/15 text-low",
  Container: "bg-medium/15 text-medium",
  Dast: "bg-info/15 text-info",
  Iast: "bg-muted text-muted-foreground",
  Ai: "bg-primary/15 text-primary",
};

export function TypeBadge({ type }: { type: ScannerType }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", TYPE_STYLE[type])}>
      {type === "Dependency" ? "SCA" : type.toUpperCase()}
    </Badge>
  );
}

const STATUS_STYLE: Record<ScanJobStatus, string> = {
  Queued: "bg-muted text-muted-foreground",
  Running: "bg-low/15 text-low",
  Succeeded: "bg-info/15 text-info",
  Failed: "bg-critical/15 text-critical",
};

export function StatusBadge({ status }: { status: ScanJobStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent gap-1", STATUS_STYLE[status])}>
      {(status === "Running" || status === "Queued") && (
        <Loader2 className="size-3 animate-spin" />
      )}
      {status}
    </Badge>
  );
}

// ---- fleet ----------------------------------------------------------------

type TargetKind = "repository" | "image" | "url" | "llm";

type FleetScanner = {
  service: string;
  match: string[];
  type: ScannerType;
  targetKind: TargetKind;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  command: string;
};

const TARGET = "SCAN_TARGET=/path/to/repo";
const RUN = "docker compose --profile scan run --rm";

const FLEET: FleetScanner[] = [
  { service: "semgrep", match: ["semgrep"], type: "Sast", targetKind: "repository", description: "Static analysis across 30+ languages with community rulepacks.", icon: Braces, command: `${TARGET} ${RUN} semgrep` },
  { service: "gitleaks", match: ["gitleaks"], type: "Secret", targetKind: "repository", description: "Secret detection on the working tree (API keys, tokens, credentials).", icon: KeyRound, command: `${TARGET} ${RUN} gitleaks` },
  { service: "trufflehog", match: ["trufflehog"], type: "Secret", targetKind: "repository", description: "Git-history secret detection — complements the gitleaks working-tree scan.", icon: History, command: `${TARGET} ${RUN} trufflehog` },
  { service: "trivy", match: ["trivy"], type: "Dependency", targetKind: "repository", description: "Dependency (SCA) scanning of lockfiles and manifests.", icon: PackageSearch, command: `${TARGET} ${RUN} trivy` },
  { service: "grype", match: ["grype"], type: "Dependency", targetKind: "repository", description: "SCA second opinion with SBOM-grade dependency resolution (Syft).", icon: Boxes, command: `${TARGET} ${RUN} grype` },
  { service: "osv", match: ["osv", "osv-scanner"], type: "Dependency", targetKind: "repository", description: "Supply-chain SCA across many ecosystems via Google's OSV.dev advisories, including malicious-package detection.", icon: ShieldAlert, command: `${TARGET} ${RUN} osv` },
  { service: "cve-lite", match: ["cve-lite", "cve-lite-cli"], type: "Dependency", targetKind: "repository", description: "JS/TS lockfile SCA (OWASP CVE Lite CLI) — validated fix versions, direct vs transitive classification, npm/pnpm/Yarn/Bun.", icon: PackageCheck, command: `${TARGET} ${RUN} cve-lite` },
  { service: "cargo-audit", match: ["cargo-audit"], type: "Dependency", targetKind: "repository", description: "Rust/Cargo SCA (RustSec cargo-audit) — audits Cargo.lock against the RustSec advisory DB. Rust-native scanner.", icon: PackageSearch, command: `${TARGET} ${RUN} cargo-audit` },
  { service: "syft", match: ["syft"], type: "Dependency", targetKind: "repository", description: "SBOM generation — a full dependency inventory of every component (CycloneDX/SPDX-grade supply-chain baseline).", icon: ScrollText, command: `${TARGET} ${RUN} syft` },
  { service: "checkov", match: ["checkov"], type: "Sast", targetKind: "repository", description: "IaC misconfiguration scanning with a large ruleset — Terraform, CloudFormation, Kubernetes, Helm, Dockerfile, ARM.", icon: ShieldCheck, command: `${TARGET} ${RUN} checkov` },
  { service: "guarddog", match: ["guarddog"], type: "Sast", targetKind: "repository", description: "Malicious-package detection in dependency manifests — typosquatting, suspicious install scripts, obfuscation, exfiltration.", icon: Bug, command: `${TARGET} ${RUN} guarddog` },
  { service: "deepsec", match: ["deepsec"], type: "Sast", targetKind: "repository", description: "AI-agent deep SAST (vercel-labs) — coding agents trace data flow to find logic vulns pattern scanners miss. Uses Warden's AI config; budget-capped.", icon: Sparkles, command: `${TARGET} ${RUN} deepsec` },
  { service: "codeql", match: ["codeql"], type: "Sast", targetKind: "repository", description: "Semantic SAST (GitHub CodeQL) — data-flow/taint queries across JS/TS, Python, Java, C#, Ruby; build-mode none, no project build required.", icon: ScanSearch, command: `${TARGET} ${RUN} codeql` },
  { service: "trivy-iac", match: ["trivy-iac", "trivy iac"], type: "Sast", targetKind: "repository", description: "IaC / misconfiguration scanning — Terraform, Kubernetes, Dockerfile.", icon: FileWarning, command: `${TARGET} ${RUN} trivy-iac` },
  { service: "trivy-image", match: ["trivy-image", "trivy image"], type: "Container", targetKind: "image", description: "Container image vulnerability scanning for any local or remote image ref.", icon: Container, command: `SCAN_IMAGE_REF=nginx:latest ${RUN} trivy-image` },
  { service: "zap", match: ["zap", "owasp zap"], type: "Dast", targetKind: "url", description: "DAST baseline scan against a running target (passive + spider).", icon: Globe, command: `SCAN_TARGET_URL=https://target ${RUN} zap` },
  { service: "nuclei", match: ["nuclei"], type: "Dast", targetKind: "url", description: "Template-based vulnerability scanning against a running target.", icon: Radar, command: `SCAN_TARGET_URL=https://target ${RUN} nuclei` },
  { service: "nikto", match: ["nikto"], type: "Dast", targetKind: "url", description: "Web server DAST — dangerous files/CGIs, outdated server software, and misconfigurations across thousands of checks.", icon: ScanSearch, command: `SCAN_TARGET_URL=https://target ${RUN} nikto` },
  { service: "dependency-check", match: ["dependency-check", "owasp dependency-check"], type: "Dependency", targetKind: "repository", description: "SCA via CPE/NVD matching (OWASP Dependency-Check) — catches bundled libraries purl-based scanners miss. NVD API key recommended.", icon: PackageSearch, command: `NVD_API_KEY=... ${TARGET} ${RUN} dependency-check` },
  { service: "kingfisher", match: ["kingfisher"], type: "Secret", targetKind: "repository", description: "Secret detection with live validation (MongoDB Kingfisher) — confirms whether a leaked credential is still active; validated keys are Critical.", icon: KeyRound, command: `${TARGET} ${RUN} kingfisher` },
  { service: "augustus", match: ["augustus"], type: "Ai", targetKind: "llm", description: "LLM red-team (Praetorian Augustus) — jailbreaks, prompt injection, encoding exploits, data extraction against a model or OpenAI-compatible endpoint.", icon: Sparkles, command: `AUGUSTUS_GENERATOR=openai.OpenAI ${RUN} augustus` },
];

const TARGET_FIELD: Record<TargetKind, { label: string; placeholder: string }> = {
  repository: {
    label: "Repository — git URL or host path",
    placeholder: "https://github.com/org/repo.git  ·  or  /home/me/projects/my-repo",
  },
  image: { label: "Image reference", placeholder: "nginx:1.27" },
  url: { label: "Target URL", placeholder: "https://staging.example.com" },
  llm: { label: "LLM generator / endpoint", placeholder: "openai.OpenAI  ·  or  rest.Rest (set AUGUSTUS_CONFIG)" },
};

// ---- helpers / dialogs ----------------------------------------------------

function CommandSnippet({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-1 rounded-md border bg-muted/50 pl-3">
      <code className="flex-1 truncate py-2 font-mono text-xs text-muted-foreground">{command}</code>
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

function RunDialog({ scanner, onClose }: { scanner: FleetScanner; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState("");
  const [repoName, setRepoName] = useState("");
  const [branch, setBranch] = useState("");
  const field = TARGET_FIELD[scanner.targetKind];

  const run = useMutation({
    mutationFn: async () =>
      (
        await createScanJob({
          body: { scanner: scanner.service, target, repoName: repoName || undefined, branch: branch || undefined },
          throwOnError: true,
        })
      ).data,
    onSuccess: () => {
      toast.success(`${scanner.service} scan queued`);
      queryClient.invalidateQueries({ queryKey: ["scan-jobs"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Failed to queue scan"),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono">
            <scanner.icon className="size-4" /> Run {scanner.service}
          </DialogTitle>
          <DialogDescription>{scanner.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="scan-target">{field.label}</Label>
            <Input id="scan-target" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={field.placeholder} autoFocus />
          </div>
          {scanner.targetKind === "repository" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="scan-repo">Project name (optional)</Label>
                <Input id="scan-repo" value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="my-repo" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="scan-branch">Branch (optional)</Label>
                <Input id="scan-branch" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => run.mutate()} disabled={!target.trim() || run.isPending} className="gap-2">
            {run.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Run scan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogDialog({ job, onClose }: { job: ScanJobInfo; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-mono">{job.scanner} — {job.status}</DialogTitle>
          <DialogDescription className="truncate">{job.target}</DialogDescription>
        </DialogHeader>
        <pre className="max-h-96 overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap">
          {job.log || "No output captured."}
        </pre>
      </DialogContent>
    </Dialog>
  );
}

function duration(job: ScanJobInfo) {
  if (!job.startedAt) return "—";
  const end = job.completedAt ? parseISO(job.completedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - parseISO(job.startedAt).getTime()) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

// ---- shared data hooks ----------------------------------------------------

function useScanners() {
  return useQuery({
    queryKey: ["scanners"],
    queryFn: async () => (await getScanners({ body: {}, throwOnError: true })).data,
  });
}

function useScanJobs() {
  return useQuery({
    queryKey: ["scan-jobs"],
    queryFn: async () => (await getScanJobs({ body: {}, throwOnError: true })).data,
    refetchInterval: (query) =>
      query.state.data?.some((j) => j.status === "Queued" || j.status === "Running") ? 3000 : 15000,
  });
}

/** Single-screen page shell: fixed header + contained-scroll body. */
function Shell({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col gap-4 lg:h-[calc(100dvh-5.5rem)] lg:min-h-0">
      <div className="shrink-0 px-2">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2">{children}</div>
    </div>
  );
}

// ---- section pages --------------------------------------------------------

export function RegisteredScannersSection() {
  const { data: scanners, isLoading } = useScanners();
  return (
    <Shell title="Registered Scanners" desc="Scanners that have reported results to this Warden instance">
      <Card className="bg-card/70 backdrop-blur-md">
        <CardContent className="flex flex-wrap gap-2 pt-6">
          {isLoading && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-36 rounded-md" />)}
          {!isLoading && (scanners ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No scanners yet — run one from the Fleet or wire a CI pipeline with a Warden access token.
            </p>
          )}
          {(scanners ?? []).map((s) => (
            <div key={s.id ?? s.name} className="flex items-center gap-2 rounded-md border border-border/60 bg-card/70 px-3 py-1.5 backdrop-blur-md">
              <span className="size-1.5 rounded-full bg-info" />
              <span className="text-sm font-medium">{s.name}</span>
              <TypeBadge type={s.type} />
            </div>
          ))}
        </CardContent>
      </Card>
    </Shell>
  );
}

export function ScanRunsSection() {
  const { data: jobs } = useScanJobs();
  const [logJob, setLogJob] = useState<ScanJobInfo | null>(null);
  return (
    <Shell title="Scan Runs" desc="On-demand scans executed by Warden — newest first">
      <Card className="bg-card/70 backdrop-blur-md">
        <CardContent className="pt-6">
          {(jobs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet — hit <span className="font-medium">Run</span> on a scanner in the Fleet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scanner</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Queued</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(jobs ?? []).map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono">{job.scanner}</TableCell>
                    <TableCell className="max-w-64 truncate font-mono text-xs text-muted-foreground">{job.target}</TableCell>
                    <TableCell><StatusBadge status={job.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatDistanceToNow(parseISO(job.createdAt), { addSuffix: true })}</TableCell>
                    <TableCell className="tabular-nums">{duration(job)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="size-8" aria-label="View log" onClick={() => setLogJob(job)}>
                        <FileText className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {logJob && <LogDialog job={logJob} onClose={() => setLogJob(null)} />}
    </Shell>
  );
}

export function FleetSection() {
  const { data: scanners } = useScanners();
  const [runScanner, setRunScanner] = useState<FleetScanner | null>(null);
  const isRegistered = useMemo(
    () => (fleet: FleetScanner) => (scanners ?? []).some((s) => fleet.match.some((m) => (s.name ?? "").toLowerCase().includes(m))),
    [scanners],
  );
  return (
    <Shell
      title="On-Demand Scan Fleet"
      desc="Run from here (Warden launches the scanner container) or copy the CLI command — needs WARDEN_TOKEN in .env"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {FLEET.map((f) => (
          <Card key={f.service} className="gap-3 bg-card/70 backdrop-blur-md">
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
              <Button size="sm" variant="secondary" className="w-fit gap-2" onClick={() => setRunScanner(f)}>
                <Play className="size-3.5" /> Run
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {runScanner && <RunDialog scanner={runScanner} onClose={() => setRunScanner(null)} />}
    </Shell>
  );
}
