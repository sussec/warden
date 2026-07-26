"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  Braces,
  CheckCircle2,
  Clock3,
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
  Radio,
  Radar,
  ScanSearch,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  XCircle,
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
import { createScanJob, getScanJob, getScanJobs, getScanners } from "@/client/sdk.gen";
import type { ScanJobInfo, ScanJobStatus, ScannerType } from "@/client/types.gen";
import { useScanStream } from "@/lib/scan/use-scan-stream";
import { fetchScanCapability } from "@/lib/scan/capability";
import { redactSecrets } from "@/lib/scan/redact";

// ---- badges ---------------------------------------------------------------

const TYPE_STYLE: Record<ScannerType, string> = {
  Sast: "bg-high/15 text-high",
  Secret: "bg-critical/15 text-critical",
  Dependency: "bg-low/15 text-low",
  Container: "bg-medium/15 text-medium",
  Dast: "bg-info/15 text-info",
  Iast: "bg-muted text-muted-foreground",
  Ai: "bg-primary/15 text-primary",
  Cloud: "bg-info/15 text-info",
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

type TargetKind = "repository" | "image" | "url" | "llm" | "cloud";

type FleetScanner = {
  service: string;
  match: string[];
  type: ScannerType;
  targetKind: TargetKind;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const FLEET: FleetScanner[] = [
  { service: "semgrep", match: ["semgrep"], type: "Sast", targetKind: "repository", description: "Static analysis across 30+ languages with community rulepacks.", icon: Braces },
  { service: "gitleaks", match: ["gitleaks"], type: "Secret", targetKind: "repository", description: "Secret detection on the working tree (API keys, tokens, credentials).", icon: KeyRound },
  { service: "trufflehog", match: ["trufflehog"], type: "Secret", targetKind: "repository", description: "Git-history secret detection — complements the gitleaks working-tree scan.", icon: History },
  { service: "trivy", match: ["trivy"], type: "Dependency", targetKind: "repository", description: "Dependency (SCA) scanning of lockfiles and manifests.", icon: PackageSearch },
  { service: "grype", match: ["grype"], type: "Dependency", targetKind: "repository", description: "SCA second opinion with SBOM-grade dependency resolution (Syft).", icon: Boxes },
  { service: "osv", match: ["osv", "osv-scanner"], type: "Dependency", targetKind: "repository", description: "Supply-chain SCA across many ecosystems via Google's OSV.dev advisories.", icon: ShieldAlert },
  { service: "cve-lite", match: ["cve-lite", "cve-lite-cli"], type: "Dependency", targetKind: "repository", description: "JS/TS lockfile SCA (OWASP CVE Lite CLI) — npm/pnpm/Yarn/Bun.", icon: PackageCheck },
  { service: "cargo-audit", match: ["cargo-audit"], type: "Dependency", targetKind: "repository", description: "Rust/Cargo SCA (RustSec cargo-audit).", icon: PackageSearch },
  { service: "cargo-deny", match: ["cargo-deny"], type: "Dependency", targetKind: "repository", description: "Rust advisories + OSS license policy + banned crates.", icon: ShieldCheck },
  { service: "cargo-geiger", match: ["cargo-geiger"], type: "Sast", targetKind: "repository", description: "Rust unsafe-code usage across the dependency tree.", icon: Bug },
  { service: "trivy-license", match: ["trivy-license"], type: "Dependency", targetKind: "repository", description: "OSS license findings by category (Forbidden/Restricted/…).", icon: ScrollText },
  { service: "kubescape", match: ["kubescape"], type: "Sast", targetKind: "repository", description: "Kubernetes manifest posture (NSA/MITRE/CIS).", icon: Container },
  { service: "prowler", match: ["prowler"], type: "Cloud", targetKind: "cloud", description: "Cloud security posture (AWS/Azure/GCP).", icon: ShieldAlert },
  { service: "syft", match: ["syft"], type: "Dependency", targetKind: "repository", description: "SBOM generation — full dependency inventory.", icon: ScrollText },
  { service: "checkov", match: ["checkov"], type: "Sast", targetKind: "repository", description: "IaC misconfiguration — Terraform, K8s, Dockerfile, ARM.", icon: ShieldCheck },
  { service: "guarddog", match: ["guarddog"], type: "Sast", targetKind: "repository", description: "Malicious-package detection in dependency manifests.", icon: Bug },
  { service: "deepsec", match: ["deepsec"], type: "Sast", targetKind: "repository", description: "AI-agent deep SAST — logic vulns pattern scanners miss.", icon: Sparkles },
  { service: "codeql", match: ["codeql"], type: "Sast", targetKind: "repository", description: "Semantic SAST (GitHub CodeQL) data-flow/taint queries.", icon: ScanSearch },
  { service: "trivy-iac", match: ["trivy-iac", "trivy iac"], type: "Sast", targetKind: "repository", description: "IaC / misconfiguration scanning.", icon: FileWarning },
  { service: "trivy-image", match: ["trivy-image", "trivy image"], type: "Container", targetKind: "image", description: "Container image vulnerability scanning.", icon: Container },
  { service: "zap", match: ["zap", "owasp zap"], type: "Dast", targetKind: "url", description: "DAST baseline scan against a running target.", icon: Globe },
  { service: "nuclei", match: ["nuclei"], type: "Dast", targetKind: "url", description: "Template-based vulnerability scanning.", icon: Radar },
  { service: "nikto", match: ["nikto"], type: "Dast", targetKind: "url", description: "Web server DAST — dangerous files and misconfigs.", icon: ScanSearch },
  { service: "dependency-check", match: ["dependency-check", "owasp dependency-check"], type: "Dependency", targetKind: "repository", description: "SCA via CPE/NVD matching (OWASP Dependency-Check).", icon: PackageSearch },
  { service: "kingfisher", match: ["kingfisher"], type: "Secret", targetKind: "repository", description: "Secret detection with live credential validation.", icon: KeyRound },
  { service: "augustus", match: ["augustus"], type: "Ai", targetKind: "llm", description: "LLM red-team — jailbreaks, prompt injection, extraction.", icon: Sparkles },
];

const TARGET_FIELD: Record<TargetKind, { label: string; placeholder: string; hint: string }> = {
  repository: {
    label: "Git repository URL",
    placeholder: "https://github.com/org/repo.git",
    hint: "Warden clones the repo and runs the scanner. Private repos need SCAN_GIT_TOKEN.",
  },
  image: {
    label: "Image reference",
    placeholder: "nginx:1.27",
    hint: "Any local or remote image the Docker host can pull.",
  },
  url: {
    label: "Target URL",
    placeholder: "https://staging.example.com",
    hint: "Live HTTP(S) endpoint reachable from the scanner network.",
  },
  llm: {
    label: "LLM generator / endpoint",
    placeholder: "openai.OpenAI",
    hint: "Configured generator name for Augustus red-team runs.",
  },
  cloud: {
    label: "Cloud provider",
    placeholder: "aws",
    hint: "aws · azure · gcp — credentials via env on the runner.",
  },
};

// ---- helpers / dialogs ----------------------------------------------------

function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function PipelineStep({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "pending" | "error";
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <div
        className={cn(
          "flex size-7 items-center justify-center border font-mono text-[10px]",
          state === "done" && "border-primary/50 bg-primary/15 text-primary",
          state === "active" && "border-primary bg-primary/20 text-primary",
          state === "pending" && "border-border/60 text-muted-foreground",
          state === "error" && "border-critical/50 bg-critical/15 text-critical",
        )}
      >
        {state === "done" && <CheckCircle2 className="size-3.5" />}
        {state === "active" && <Loader2 className="size-3.5 animate-spin" />}
        {state === "pending" && <span className="size-1.5 bg-current opacity-40" />}
        {state === "error" && <XCircle className="size-3.5" />}
      </div>
      <span
        className={cn(
          "font-mono text-[9px] uppercase tracking-wider",
          state === "active" && "text-primary",
          state === "done" && "text-foreground",
          state === "pending" && "text-muted-foreground",
          state === "error" && "text-critical",
        )}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Run popup: configure → launch → stay open with live pipeline + logs.
 * Status/log truth comes from polling GET /api/scan-job/{id} (always works).
 * SSE stream is optional live boost for mid-run lines.
 */
function RunDialog({
  scanner,
  onClose,
  onQueued,
  runnerReady,
}: {
  scanner: FleetScanner;
  onClose: () => void;
  onQueued?: (jobId: string) => void;
  runnerReady: boolean;
}) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState("");
  const [repoName, setRepoName] = useState("");
  const [branch, setBranch] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"form" | "live">("form");
  const [tick, setTick] = useState(0);
  const [polledStatus, setPolledStatus] = useState<ScanJobStatus | null>(null);
  const [polledLog, setPolledLog] = useState("");
  const field = TARGET_FIELD[scanner.targetKind];
  const logRef = useRef<HTMLDivElement>(null);
  const liveStartedAt = useRef<number | null>(null);

  const { connected, transport, focusedLines, focusedJob, upsertJob, applyJobSnapshot } =
    useScanStream({
      focusJobId: jobId,
      enabled: phase === "live",
    });

  // Poll job while live — authoritative status + full log (stream often misses fast jobs)
  useEffect(() => {
    if (phase !== "live" || !jobId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await getScanJob({
          path: { scanJobId: jobId },
          throwOnError: false,
        });
        if (cancelled || !res.data) return;
        const job = res.data;
        setPolledStatus(job.status);
        if (job.log) setPolledLog(redactSecrets(job.log));
        applyJobSnapshot({
          id: job.id,
          status: job.status,
          scanner: job.scanner ?? undefined,
          target: redactSecrets(job.target) || undefined,
          log: job.log ? redactSecrets(job.log) : job.log,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
        });
        if (job.status === "Succeeded" || job.status === "Failed") {
          queryClient.invalidateQueries({ queryKey: ["scan-jobs"] });
          queryClient.invalidateQueries({ queryKey: ["scanners"] });
          queryClient.invalidateQueries({ queryKey: ["findings"] });
        }
      } catch {
        /* keep polling */
      }
    };

    void poll();
    const id = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [phase, jobId, applyJobSnapshot, queryClient]);

  const status =
    polledStatus ??
    (focusedJob?.status as ScanJobStatus | undefined) ??
    (phase === "live" ? ("Queued" as ScanJobStatus) : null);
  const isTerminal = status === "Succeeded" || status === "Failed";

  // Console lines: stream first, fall back to polled full log
  const consoleLines = useMemo(() => {
    if (focusedLines.length > 0) return focusedLines.map((l) => l.text);
    if (polledLog) return polledLog.split("\n").filter((t) => t.length > 0);
    return [] as string[];
  }, [focusedLines, polledLog]);

  useEffect(() => {
    if (phase !== "live") return;
    if (isTerminal) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [phase, isTerminal]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [consoleLines.length]);

  if (phase === "live" && liveStartedAt.current == null) liveStartedAt.current = Date.now();
  if (phase === "form") liveStartedAt.current = null;

  const elapsedMs = useMemo(() => {
    void tick;
    if (phase !== "live") return 0;
    const start = focusedJob?.startedAt ?? liveStartedAt.current ?? Date.now();
    const end = focusedJob?.endedAt ?? (isTerminal ? Date.now() : Date.now());
    return Math.max(0, end - start);
  }, [focusedJob, phase, tick, isTerminal]);

  const pipeline = useMemo(() => {
    const s = status ?? "Queued";
    if (s === "Failed") {
      return { queued: "done" as const, running: "error" as const, done: "error" as const };
    }
    if (s === "Succeeded") {
      return { queued: "done" as const, running: "done" as const, done: "done" as const };
    }
    if (s === "Running") {
      return { queued: "done" as const, running: "active" as const, done: "pending" as const };
    }
    return { queued: "active" as const, running: "pending" as const, done: "pending" as const };
  }, [status]);

  const run = useMutation({
    mutationFn: async () => {
      const result = await createScanJob({
        body: {
          scanner: scanner.service,
          target,
          repoName: repoName || undefined,
          branch: branch || undefined,
        },
        throwOnError: false,
      });
      if (result.error) {
        const err = result.error as { message?: string } | string;
        const msg =
          typeof err === "string"
            ? err
            : err?.message || `Failed to queue scan (${result.response?.status ?? "?"})`;
        throw new Error(msg);
      }
      if (!result.data) throw new Error("No job returned");
      return result.data;
    },
    onSuccess: (job) => {
      const id = job.id!;
      setJobId(id);
      setPolledStatus("Queued");
      setPolledLog("");
      setPhase("live");
      liveStartedAt.current = Date.now();
      upsertJob({
        jobId: id,
        scanner: scanner.service,
        status: "Queued",
        target,
        lineCount: 0,
      });
      queryClient.invalidateQueries({ queryKey: ["scan-jobs"] });
      onQueued?.(id);
      toast.success(`${scanner.service} launched`);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to queue scan"),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0",
          phase === "live" ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/50 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 font-mono">
            <scanner.icon className="size-4 text-primary" />
            {phase === "form" ? `Run ${scanner.service}` : `${scanner.service} — live`}
            {status && phase === "live" && <StatusBadge status={status} />}
          </DialogTitle>
          <DialogDescription className="truncate font-mono text-xs">
            {phase === "form" ? scanner.description : target}
          </DialogDescription>
        </DialogHeader>

        {phase === "form" ? (
          <>
            <div className="flex flex-col gap-4 overflow-auto px-6 py-4">
              {!runnerReady && (
                <div className="flex items-start gap-2 border border-critical/40 bg-critical/10 px-3 py-2 text-xs text-critical">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  Runner is not ready. Fix capability issues before launching.
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="scan-target">{field.label}</Label>
                <Input
                  id="scan-target"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={field.placeholder}
                  autoFocus
                  className="font-mono text-sm"
                />
                <p className="text-[11px] leading-relaxed text-muted-foreground">{field.hint}</p>
              </div>
              {scanner.targetKind === "repository" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="scan-repo">Project name (optional)</Label>
                    <Input
                      id="scan-repo"
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      placeholder="my-repo"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="scan-branch">Branch (optional)</Label>
                    <Input
                      id="scan-branch"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="main"
                    />
                  </div>
                </div>
              )}
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Live console opens here — status, timer, and full scanner output
              </p>
            </div>
            <DialogFooter className="shrink-0 border-t border-border/50 px-6 py-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={() => run.mutate()}
                disabled={!target.trim() || run.isPending || !runnerReady}
                className="gap-2"
              >
                {run.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                Launch scan
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="shrink-0 space-y-4 border-b border-border/50 px-6 py-4">
              <div className="flex items-start gap-1">
                <PipelineStep label="Queued" state={pipeline.queued} />
                <div className="mt-3.5 h-px flex-1 bg-border/60" />
                <PipelineStep label="Running" state={pipeline.running} />
                <div className="mt-3.5 h-px flex-1 bg-border/60" />
                <PipelineStep
                  label={status === "Failed" ? "Failed" : "Done"}
                  state={pipeline.done}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="border border-border/50 bg-muted/20 px-3 py-2">
                  <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    <Radio className={cn("size-3", connected && "animate-pulse text-primary")} />
                    Feed
                  </div>
                  <p className="mt-1 font-mono text-sm">
                    {connected ? transport.toUpperCase() : "POLL"}
                  </p>
                </div>
                <div className="border border-border/50 bg-muted/20 px-3 py-2">
                  <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    <Clock3 className="size-3" />
                    Elapsed
                  </div>
                  <p className="mt-1 font-mono text-sm tabular-nums">
                    {formatElapsed(elapsedMs || 0)}
                  </p>
                </div>
                <div className="border border-border/50 bg-muted/20 px-3 py-2">
                  <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    <Terminal className="size-3" />
                    Log lines
                  </div>
                  <p className="mt-1 font-mono text-sm tabular-nums">{consoleLines.length}</p>
                </div>
                <div className="border border-border/50 bg-muted/20 px-3 py-2">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Job
                  </div>
                  <p className="mt-1 truncate font-mono text-sm" title={jobId ?? ""}>
                    {jobId?.slice(0, 8)}…
                  </p>
                </div>
              </div>
            </div>

            <div
              ref={logRef}
              className="min-h-[240px] flex-1 overflow-auto bg-[var(--black-2,#0a0a0a)] px-4 py-3 font-mono text-[11px] leading-relaxed text-[var(--black-20,#e8e8e8)] dark:bg-black/70"
            >
              {consoleLines.length === 0 ? (
                <p className="flex items-center gap-2 text-muted-foreground/70">
                  <Loader2 className="size-3.5 animate-spin" />
                  {status === "Queued"
                    ? "Queued — waiting for worker…"
                    : status === "Running"
                      ? "Scanner running — collecting output…"
                      : "Loading job output…"}
                </p>
              ) : (
                consoleLines.map((text, i) => (
                  <div key={`${i}-${text.slice(0, 24)}`} className="whitespace-pre-wrap break-all">
                    <span className="select-none text-primary/40">› </span>
                    {text}
                  </div>
                ))
              )}
            </div>

            <DialogFooter className="shrink-0 border-t border-border/50 px-6 py-3 sm:justify-between">
              <p className="hidden font-mono text-[10px] text-muted-foreground sm:block">
                {isTerminal
                  ? status === "Succeeded"
                    ? "Done — findings are under Findings / Registered scanners."
                    : "Failed — see log above."
                  : "Live updates every second. Close anytime — job keeps running."}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  {isTerminal ? "Close" : "Close"}
                </Button>
                {isTerminal && status === "Failed" && (
                  <Button
                    className="gap-2"
                    onClick={() => {
                      setPhase("form");
                      setJobId(null);
                      setPolledStatus(null);
                      setPolledLog("");
                    }}
                  >
                    <Play className="size-3.5" />
                    Run again
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LogDialog({ job, onClose }: { job: ScanJobInfo; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-mono">
            {job.scanner} — {job.status}
          </DialogTitle>
          <DialogDescription className="truncate font-mono text-xs">
            {redactSecrets(job.target)}
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-96 overflow-auto border border-border/60 bg-black/90 p-3 font-mono text-xs text-primary/90 whitespace-pre-wrap dark:bg-black/60">
          {redactSecrets(job.log) || "No output captured."}
        </pre>
      </DialogContent>
    </Dialog>
  );
}

function RunnerBanner() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["scan-capability"],
    queryFn: fetchScanCapability,
    refetchInterval: 30_000,
    retry: 1,
  });

  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (isError || !data) {
    return (
      <div className="flex items-start gap-2 border border-border/60 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        Could not reach scan runner capability endpoint.
      </div>
    );
  }

  const ok = data.available;
  const isK8s =
    data.backend === "kubernetes" || data.backend === "k8s";
  const pluginCount =
    data.plugins?.filter((p) => p.enabled).length ??
    Object.keys(data.images ?? {}).length;
  const imageReadyCount = data.plugins
    ? data.plugins.filter((p) => p.enabled && p.imageReady).length
    : Object.values(data.images ?? {}).filter(Boolean).length;

  // Pull registry hint from message or default Harbor path
  const registryHint = (() => {
    const m = data.message?.match(/Images pull from\s+(\S+)/i);
    if (m?.[1]) return m[1].replace(/\*+$/, "*");
    return "harbor.techanv.com/library/warden-*";
  })();

  const headline = ok
    ? isK8s
      ? "Kubernetes Jobs ready"
      : "Docker runner ready"
    : isK8s
      ? "Kubernetes runner blocked"
      : "Docker runner blocked";

  const detail = ok
    ? isK8s
      ? `All ${pluginCount || 26} fleet plugins enabled (gitleaks, semgrep, trivy, …). Jobs run in-cluster; images pull from ${registryHint}.`
      : data.message
    : data.message;

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 border px-3 py-3 sm:px-4",
        ok
          ? "border-primary/35 bg-primary/5 text-foreground"
          : "border-critical/40 bg-critical/10 text-critical",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-2 gap-y-1.5">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              ok ? "bg-primary animate-pulse" : "bg-critical",
            )}
            aria-hidden
          />
          <span className={ok ? "text-primary" : undefined}>
            {data.backend}
            {ok ? " · ready" : " · blocked"}
          </span>
        </div>

        <Badge
          variant="outline"
          className={cn(
            "font-mono text-[10px]",
            ok
              ? "border-primary/40 text-primary"
              : "border-critical/50 text-critical",
          )}
        >
          {headline}
        </Badge>

        {pluginCount > 0 && (
          <Badge
            variant="outline"
            className="border-border/70 font-mono text-[10px] text-muted-foreground"
          >
            {pluginCount} plugins
            {ok ? " enabled" : ""}
          </Badge>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
          {isK8s ? (
            <span
              className={cn(
                "border px-1.5 py-0.5",
                ok
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground",
              )}
            >
              jobs ✓
            </span>
          ) : (
            <span
              className={cn(
                "border px-1.5 py-0.5",
                data.socketPresent
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-critical/40 text-critical",
              )}
            >
              socket {data.socketPresent ? "✓" : "✗"}
            </span>
          )}
          <span
            className={cn(
              "border px-1.5 py-0.5",
              data.tokenConfigured
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-critical/40 text-critical",
            )}
          >
            token {data.tokenConfigured ? "✓" : "✗"}
          </span>
          {ok && (
            <span className="border border-border/60 px-1.5 py-0.5 text-muted-foreground">
              images {imageReadyCount}/{pluginCount || "—"}
            </span>
          )}
        </div>
      </div>

      <p
        className={cn(
          "min-w-0 text-xs leading-relaxed sm:text-[13px]",
          ok ? "text-muted-foreground" : "text-critical/90",
        )}
      >
        {detail}
      </p>

      {ok && isK8s && (
        <p className="font-mono text-[10px] tracking-wide text-muted-foreground/80">
          registry{" "}
          <span className="text-foreground/80">{registryHint}</span>
          {" · "}
          use a git URL target (not host paths)
        </p>
      )}
    </div>
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
      query.state.data?.some((j) => j.status === "Queued" || j.status === "Running")
        ? 4000
        : 20000,
  });
}

function useCapability() {
  return useQuery({
    queryKey: ["scan-capability"],
    queryFn: fetchScanCapability,
    refetchInterval: 30_000,
    retry: 1,
  });
}

function Shell({
  title,
  desc,
  actions,
  children,
}: {
  title: string;
  desc: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col gap-4 lg:h-[calc(100dvh-5.5rem)] lg:min-h-0">
      <div className="flex shrink-0 flex-col gap-2 px-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-2">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">{desc}</p>
        </div>
        {actions ? <div className="shrink-0 self-start">{actions}</div> : null}
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto px-1 sm:px-2">{children}</div>
    </div>
  );
}

// ---- section pages --------------------------------------------------------

export function RegisteredScannersSection() {
  const { data: scanners, isLoading } = useScanners();
  const { data: capability } = useCapability();

  // Always show the full 26-plugin fleet. DB + capability enrich status.
  const rows = useMemo(() => {
    const dbNames = new Set(
      (scanners ?? []).map((s) => (s.name ?? "").toLowerCase()).filter(Boolean),
    );
    const imageMap = capability?.images ?? {};

    return FLEET.map((f) => {
      const imageReady = imageMap[f.service];
      return {
        name: f.service,
        type: f.type,
        description: f.description,
        icon: f.icon,
        // Full fleet is always registered (API seeds on boot + catalog).
        imageReady,
        inDb:
          dbNames.has(f.service.toLowerCase()) ||
          f.match.some((m) =>
            [...dbNames].some((n) => n.includes(m) || m.includes(n)),
          ),
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [scanners, capability]);

  const activeCount = rows.length;

  return (
    <Shell
      title="Registered Scanners"
      desc={`${activeCount} fleet plugins registered and Active on this instance`}
      actions={
        <Badge
          variant="outline"
          className="border-primary/40 font-mono text-[10px] text-primary"
        >
          {activeCount} Active
        </Badge>
      }
    >
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-mono text-sm">Full scan fleet</CardTitle>
          <p className="text-xs text-muted-foreground">
            Every plugin is registered for CI + UI runs. Launch from{" "}
            <span className="text-primary">Scan Fleet</span>.
          </p>
        </CardHeader>
        <CardContent className="pt-2">
          {isLoading && (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-40" />
              ))}
            </div>
          )}
          {!isLoading && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center gap-2 border border-border/60 bg-background/40 px-3 py-2"
                >
                  <s.icon className="size-3.5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-sm font-medium">{s.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <TypeBadge type={s.type} />
                      <Badge
                        variant="outline"
                        className="border-primary/40 font-mono text-[9px] text-primary"
                      >
                        Active
                      </Badge>
                      {s.imageReady === false && (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-muted font-mono text-[9px] text-muted-foreground"
                        >
                          no image
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="size-1.5 shrink-0 bg-primary" aria-hidden />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Shell>
  );
}

export function ScanRunsSection() {
  const { data: jobs } = useScanJobs();
  const [logJob, setLogJob] = useState<ScanJobInfo | null>(null);
  const liveCount =
    (jobs ?? []).filter((j) => j.status === "Queued" || j.status === "Running").length;

  return (
    <Shell
      title="Scan Runs"
      desc="Jobs launched from the UI — live stream + history"
      actions={
        liveCount > 0 ? (
          <Badge variant="outline" className="gap-1.5 border-primary/40 font-mono text-primary">
            <Loader2 className="size-3 animate-spin" />
            {liveCount} active
          </Badge>
        ) : null
      }
    >
      <div className="mb-4">
        <RunnerBanner />
      </div>
      <Card className="bg-card">
        <CardContent className="pt-6">
          {(jobs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No runs yet — open{" "}
              <span className="font-medium text-foreground">Scanner Fleet</span> and hit{" "}
              <span className="font-medium text-primary">Run</span>.
            </p>
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
                  <TableRow
                    key={job.id}
                    className={cn(
                      (job.status === "Running" || job.status === "Queued") &&
                        "bg-primary/[0.03]",
                    )}
                  >
                    <TableCell className="font-mono">{job.scanner}</TableCell>
                    <TableCell
                      className="max-w-64 truncate font-mono text-xs text-muted-foreground"
                      title={redactSecrets(job.target)}
                    >
                      {redactSecrets(job.target)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(parseISO(job.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="tabular-nums">{duration(job)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label="View log"
                        onClick={() => setLogJob(job)}
                      >
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
  const { data: jobs } = useScanJobs();
  const { data: capability } = useCapability();
  const [runScanner, setRunScanner] = useState<FleetScanner | null>(null);
  const [typeFilter, setTypeFilter] = useState<ScannerType | "All">("All");
  const [search, setSearch] = useState("");

  const runnerReady = capability?.available === true;
  const imageMap = capability?.images ?? {};

  /** Active = registered in DB (fleet is seeded on API boot) OR present in fleet catalog. */
  const isActive = useMemo(
    () => (fleet: FleetScanner) => {
      // Entire compose/UI fleet is always Active for operators.
      if (FLEET.some((f) => f.service === fleet.service)) return true;
      return (scanners ?? []).some((s) =>
        fleet.match.some((m) => (s.name ?? "").toLowerCase().includes(m)),
      );
    },
    [scanners],
  );

  const activeJobs = useMemo(
    () => (jobs ?? []).filter((j) => j.status === "Queued" || j.status === "Running"),
    [jobs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return FLEET.filter((f) => {
      if (typeFilter !== "All" && f.type !== typeFilter) return false;
      if (!q) return true;
      return (
        f.service.includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.type.toLowerCase().includes(q)
      );
    });
  }, [search, typeFilter]);

  const types = useMemo(() => {
    const set = new Set<ScannerType>();
    FLEET.forEach((f) => set.add(f.type));
    return Array.from(set);
  }, []);

  return (
    <Shell
      title="Scanner Fleet"
      desc="Click Run — live status and logs open in the popup. No CLI."
      actions={
        activeJobs.length > 0 ? (
          <Badge variant="outline" className="gap-1.5 border-primary/40 font-mono text-primary">
            <Loader2 className="size-3 animate-spin" />
            {activeJobs.length} running
          </Badge>
        ) : null
      }
    >
      <div className="mb-4">
        <RunnerBanner />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scanners…"
            className="max-w-xs font-mono text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={typeFilter === "All" ? "default" : "outline"}
              className="h-8 font-mono text-[11px]"
              onClick={() => setTypeFilter("All")}
            >
              All
            </Button>
            {types.map((t) => (
              <Button
                key={t}
                size="sm"
                variant={typeFilter === t ? "default" : "outline"}
                className="h-8 font-mono text-[11px]"
                onClick={() => setTypeFilter(t)}
              >
                {t === "Dependency" ? "SCA" : t}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((f) => {
            const imageReady = imageMap[f.service];
            const hasImageInfo = Object.keys(imageMap).length > 0;
            return (
              <Card
                key={f.service}
                className="group flex flex-col gap-0 overflow-hidden border-border/70 bg-card transition-colors hover:border-primary/40"
              >
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex size-8 shrink-0 items-center justify-center border border-border/60 bg-muted/40 text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                      <f.icon className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate font-mono text-sm">{f.service}</CardTitle>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        <TypeBadge type={f.type} />
                        <Badge
                          variant="outline"
                          className="border-transparent bg-primary/10 font-mono text-[9px] text-primary"
                        >
                          enabled
                        </Badge>
                        {hasImageInfo && imageReady === false && (
                          <Badge
                            variant="outline"
                            className="border-transparent bg-muted font-mono text-[9px] text-muted-foreground"
                          >
                            no image
                          </Badge>
                        )}
                        {hasImageInfo && imageReady === true && (
                          <Badge
                            variant="outline"
                            className="border-transparent bg-info/15 font-mono text-[9px] text-info"
                          >
                            image
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {isActive(f) && (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-primary/40 font-mono text-[10px] text-primary"
                    >
                      Active
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3 pt-0">
                  <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                    {f.description}
                  </p>
                  <Button
                    size="sm"
                    className="w-full gap-2 font-mono text-xs uppercase tracking-wider"
                    onClick={() => setRunScanner(f)}
                    disabled={!runnerReady}
                    title={
                      !runnerReady
                        ? "Runner not ready — mount Docker socket and set WARDEN_TOKEN"
                        : hasImageInfo && imageReady === false
                          ? "Image missing locally — build with: docker compose --profile scan build " +
                            f.service
                          : `Run ${f.service}`
                    }
                  >
                    <Play className="size-3.5" />
                    Run
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No scanners match your filter.
          </p>
        )}
      </div>

      {runScanner && (
        <RunDialog
          scanner={runScanner}
          onClose={() => setRunScanner(null)}
          runnerReady={runnerReady}
        />
      )}
    </Shell>
  );
}
