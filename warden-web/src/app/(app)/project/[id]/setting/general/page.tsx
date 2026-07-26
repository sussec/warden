"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  ScanSearch,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  createScanJob,
  getProjectInfo,
  getDefaultBranchesProject,
  updateDefaultBranchesProject,
  getThresholdProject,
  updateThresholdProject,
} from "@/client/sdk.gen";
import type { ThresholdMode, ThresholdSetting } from "@/client/types.gen";
import { fetchScanCapability } from "@/lib/scan/capability";
import { redactSecrets } from "@/lib/scan/redact";

const MODES: ThresholdMode[] = ["MonitorOnly", "BlockOnConfirmation", "BlockOnDetection"];

/** Repository-target fleet scanners (project scans clone the git URL). */
const PROJECT_SCANNERS = [
  { id: "gitleaks", label: "gitleaks", type: "Secret" },
  { id: "trufflehog", label: "trufflehog", type: "Secret" },
  { id: "cve-lite", label: "cve-lite", type: "SCA" },
  { id: "trivy", label: "trivy", type: "SCA" },
  { id: "semgrep", label: "semgrep", type: "SAST" },
  { id: "osv", label: "osv", type: "SCA" },
  { id: "grype", label: "grype", type: "SCA" },
  { id: "syft", label: "syft", type: "SBOM" },
  { id: "checkov", label: "checkov", type: "IaC" },
  { id: "trivy-iac", label: "trivy-iac", type: "IaC" },
  { id: "kingfisher", label: "kingfisher", type: "Secret" },
  { id: "codeql", label: "codeql", type: "SAST" },
] as const;

const DEFAULT_SCANNERS = ["gitleaks", "cve-lite", "trufflehog"] as const;

function ThresholdForm({
  title,
  value,
  onChange,
}: {
  title: string;
  value: ThresholdSetting;
  onChange: (v: ThresholdSetting) => void;
}) {
  const counts: { key: keyof ThresholdSetting; label: string }[] = [
    { key: "critical", label: "Critical" },
    { key: "high", label: "High" },
    { key: "medium", label: "Medium" },
    { key: "low", label: "Low" },
  ];
  return (
    <div className="flex flex-col gap-3 border border-border/60 p-4">
      <h4 className="font-semibold">{title}</h4>
      <div className="space-y-2">
        <Label>Mode</Label>
        <Select
          value={value.mode ?? "MonitorOnly"}
          onValueChange={(v) => onChange({ ...value, mode: v as ThresholdMode })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {counts.map((c) => (
          <div key={c.key} className="space-y-2">
            <Label>{c.label}</Label>
            <Input
              type="number"
              min={0}
              value={(value[c.key] as number | undefined) ?? 0}
              onChange={(e) => onChange({ ...value, [c.key]: Number(e.target.value) })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectRunScanSection({
  projectId,
  projectName,
  repoUrl,
  defaultBranches,
}: {
  projectId: string;
  projectName?: string | null;
  repoUrl?: string | null;
  defaultBranches: string[];
}) {
  const queryClient = useQueryClient();
  const [scanners, setScanners] = useState<string[]>([...DEFAULT_SCANNERS]);
  const [branch, setBranch] = useState("");
  const [lastResult, setLastResult] = useState<{
    queued: number;
    failed: string[];
    jobIds: string[];
  } | null>(null);

  const capability = useQuery({
    queryKey: ["scan-capability"],
    queryFn: fetchScanCapability,
    refetchInterval: 30_000,
    retry: 1,
  });

  // Branch is optional — do not auto-force a branch (repos may use main/master/develop).
  // Only prefill when the project explicitly configured default branches.
  useEffect(() => {
    // leave empty by default so clone uses remote HEAD; user can pick if listed
  }, [defaultBranches]);

  const target = (repoUrl ?? "").trim();
  const safeTarget = redactSecrets(target);
  const runnerReady = capability.data?.available === true;

  const run = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("This project has no repository URL — cannot scan.");
      if (scanners.length === 0) throw new Error("Select at least one scanner.");
      if (!runnerReady) throw new Error(capability.data?.message || "Scan runner is not ready.");

      const repoName =
        (projectName ?? "").replace(/\//g, "-").trim() ||
        target.replace(/\.git$/i, "").split("/").filter(Boolean).slice(-2).join("-");

      const failed: string[] = [];
      const jobIds: string[] = [];

      for (const scanner of scanners) {
        try {
          const res = await createScanJob({
            body: {
              scanner,
              target,
              repoName,
              branch: branch.trim() || null,
            },
            throwOnError: true,
          });
          if (res.data?.id) jobIds.push(res.data.id);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "queue failed";
          failed.push(`${scanner}: ${msg}`);
        }
      }

      return { queued: jobIds.length, failed, jobIds };
    },
    onSuccess: (r) => {
      setLastResult(r);
      queryClient.invalidateQueries({ queryKey: ["scan-jobs"] });
      if (r.queued > 0) {
        toast.success(`Queued ${r.queued} scan(s)${r.failed.length ? ` · ${r.failed.length} failed` : ""}`);
      } else {
        toast.error(r.failed[0] || "No scans were queued");
      }
    },
    onError: (e: Error) => toast.error(e.message || "Failed to start scan"),
  });

  const imageMap = capability.data?.images ?? {};

  return (
    <Card className="flex flex-col gap-4 border border-border/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center border border-border/70 bg-muted/40">
            <ScanSearch className="size-4 text-foreground" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight">Run scan</h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
              Queue fleet scanners against this project&apos;s repository. Jobs run as Kubernetes
              Jobs; follow progress under Scan Runs.
            </p>
          </div>
        </div>
        {capability.data && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
              runnerReady
                ? "border-primary/35 bg-primary/10 text-primary"
                : "border-critical/40 bg-critical/10 text-critical",
            )}
          >
            <span className={cn("size-1.5", runnerReady ? "bg-primary" : "bg-critical")} />
            {runnerReady ? `${capability.data.backend} ready` : "runner unavailable"}
          </span>
        )}
      </div>

      {!target ? (
        <div className="flex items-start gap-2 border border-medium/40 bg-medium/10 px-3 py-2.5 text-xs">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-medium" />
          <p className="leading-relaxed text-muted-foreground">
            No repository URL on this project. Import from GitHub/GitLab under Settings →
            Integrations, or re-create the project with a git URL.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[11px] text-muted-foreground">Repository target</Label>
              <Input
                value={safeTarget}
                readOnly
                disabled
                className="font-mono text-xs"
                title={safeTarget}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scan-branch" className="text-[11px] text-muted-foreground">
                Branch (optional — empty = remote default)
              </Label>
              {defaultBranches.length > 0 && (
                <Select
                  value={branch || "__default__"}
                  onValueChange={(v) => setBranch(v === "__default__" ? "" : v)}
                >
                  <SelectTrigger id="scan-branch" className="w-full font-mono text-xs">
                    <SelectValue placeholder="Remote default (recommended)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__" className="font-mono text-xs">
                      Remote default (no branch flag)
                    </SelectItem>
                    {defaultBranches.map((b) => (
                      <SelectItem key={b} value={b} className="font-mono text-xs">
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Input
                id="scan-branch"
                className={cn("font-mono text-xs", defaultBranches.length > 0 && "mt-1.5")}
                placeholder="Leave empty for remote default, or type e.g. main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Selected</Label>
              <p className="border border-border/50 bg-muted/20 px-3 py-2 font-mono text-xs tabular-nums">
                {scanners.length} scanner{scanners.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[11px] text-muted-foreground">Scanners</Label>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 font-mono text-[10px]"
                  onClick={() => setScanners(PROJECT_SCANNERS.map((s) => s.id))}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 font-mono text-[10px]"
                  onClick={() => setScanners([...DEFAULT_SCANNERS])}
                >
                  Defaults
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 font-mono text-[10px]"
                  onClick={() => setScanners([])}
                >
                  None
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Scanners">
              {PROJECT_SCANNERS.map((s) => {
                const on = scanners.includes(s.id);
                const imageOk = imageMap[s.id];
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    title={
                      imageOk === false
                        ? `${s.id} — image may be missing in registry`
                        : s.type
                    }
                    onClick={() =>
                      setScanners((prev) =>
                        on ? prev.filter((x) => x !== s.id) : [...new Set([...prev, s.id])],
                      )
                    }
                    className={cn(
                      "border px-2 py-1 font-mono text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/70 text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    {s.label}
                    {imageOk === false ? (
                      <span className="ml-1 text-critical">·</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {scanners.length === 0 && (
              <p className="font-mono text-[10px] text-critical">Select at least one scanner</p>
            )}
          </div>

          {!runnerReady && capability.data && (
            <div className="flex items-start gap-2 border border-critical/40 bg-critical/10 px-3 py-2 text-xs text-critical">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <p className="leading-relaxed">{capability.data.message}</p>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-border/40 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              className="font-mono text-xs"
              disabled={
                run.isPending || !target || scanners.length === 0 || !runnerReady
              }
              onClick={() => run.mutate()}
            >
              {run.isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Queuing…
                </>
              ) : (
                <>
                  <ScanSearch className="mr-1.5 size-3.5" />
                  Run scan ({scanners.length})
                </>
              )}
            </Button>
            <Button asChild type="button" variant="outline" size="sm" className="font-mono text-xs">
              <Link href="/scanner/runs">Open scan runs</Link>
            </Button>
            <p className="text-[10px] leading-relaxed text-muted-foreground sm:ml-auto sm:max-w-xs sm:text-right">
              Private clones use the GitHub/GitLab PAT from Integrations (or{" "}
              <code className="font-mono">SCAN_GIT_TOKEN</code>).
            </p>
          </div>

          {lastResult && (
            <div className="flex flex-col gap-2 border border-primary/30 bg-primary/5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground">
                    {lastResult.queued} scan job{lastResult.queued === 1 ? "" : "s"} queued
                  </p>
                  {lastResult.failed.length > 0 && (
                    <p className="mt-0.5 text-[11px] text-critical">
                      {lastResult.failed.slice(0, 3).join(" · ")}
                      {lastResult.failed.length > 3
                        ? ` · +${lastResult.failed.length - 3} more`
                        : ""}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Project {projectId.slice(0, 8)}… · follow live logs on Scan Runs.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="h-7 font-mono text-[10px]">
                <Link href="/scanner/runs">View runs</Link>
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default function ProjectGeneralSettingPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: info } = useQuery({
    queryKey: ["project-info", id],
    queryFn: async () =>
      (await getProjectInfo({ path: { projectId: id }, throwOnError: true })).data,
  });

  const { data: branchesData } = useQuery({
    queryKey: ["project-default-branches", id],
    queryFn: async () =>
      (await getDefaultBranchesProject({ path: { projectId: id }, throwOnError: true })).data,
  });

  const { data: thresholdData } = useQuery({
    queryKey: ["project-threshold", id],
    queryFn: async () =>
      (await getThresholdProject({ path: { projectId: id }, throwOnError: true })).data,
  });

  const [branches, setBranches] = useState<string[]>([]);
  const [newBranch, setNewBranch] = useState("");
  const [sast, setSast] = useState<ThresholdSetting>({});
  const [sca, setSca] = useState<ThresholdSetting>({});

  const [branchesSeededFrom, setBranchesSeededFrom] = useState<unknown>(null);
  if (branchesData && branchesData !== branchesSeededFrom) {
    setBranchesSeededFrom(branchesData);
    setBranches(branchesData.filter((b): b is string => !!b));
  }

  const [thresholdSeededFrom, setThresholdSeededFrom] = useState<unknown>(null);
  if (thresholdData && thresholdData !== thresholdSeededFrom) {
    setThresholdSeededFrom(thresholdData);
    setSast(thresholdData.sast ?? {});
    setSca(thresholdData.sca ?? {});
  }

  const branchList = useMemo(
    () => branches.filter((b): b is string => !!b),
    [branches],
  );

  const saveBranches = useMutation({
    mutationFn: async () =>
      (
        await updateDefaultBranchesProject({
          path: { projectId: id },
          body: branches,
          throwOnError: true,
        })
      ).data,
    onSuccess: () => {
      toast.success("Default branches saved.");
      queryClient.invalidateQueries({ queryKey: ["project-default-branches", id] });
    },
    onError: () => toast.error("Could not save default branches."),
  });

  const saveThreshold = useMutation({
    mutationFn: async () =>
      (
        await updateThresholdProject({
          path: { projectId: id },
          body: {
            sast: { mode: "MonitorOnly", ...sast },
            sca: { mode: "MonitorOnly", ...sca },
          },
          throwOnError: true,
        })
      ).data,
    onSuccess: () => {
      toast.success("Thresholds saved.");
      queryClient.invalidateQueries({ queryKey: ["project-threshold", id] });
    },
    onError: () => toast.error("Could not save thresholds."),
  });

  function addBranch() {
    const b = newBranch.trim();
    if (b && !branches.includes(b)) setBranches((prev) => [...prev, b]);
    setNewBranch("");
  }

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight">General Settings</h1>
          <p className="text-xs text-muted-foreground">
            Project details, run scan, default branches &amp; security thresholds
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto border border-border bg-card p-4">
        <div className="flex w-full max-w-3xl flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-semibold tracking-tight">General</h2>
            <div className="space-y-2">
              <Label htmlFor="name">Project name</Label>
              {info ? (
                <Input id="name" value={info.name ?? ""} readOnly disabled />
              ) : (
                <Skeleton className="h-9 w-full" />
              )}
            </div>
            {info?.repoUrl && (
              <div className="space-y-2">
                <Label htmlFor="repo">Repository URL</Label>
                <Input
                  id="repo"
                  value={redactSecrets(info.repoUrl)}
                  readOnly
                  disabled
                  className="font-mono text-xs"
                />
              </div>
            )}
          </div>

          <Separator />

          <ProjectRunScanSection
            projectId={id}
            projectName={info?.name}
            repoUrl={info?.repoUrl}
            defaultBranches={branchList}
          />

          <Separator />

          <Card className="flex flex-col gap-3 border border-border/80 p-4">
            <h3 className="font-semibold">Default Branches</h3>
            <div className="flex flex-wrap gap-2">
              {branches.length === 0 && (
                <span className="text-sm text-muted-foreground">No default branches set.</span>
              )}
              {branches.map((b) => (
                <Badge key={b} variant="secondary" className="gap-1">
                  {b}
                  <button
                    type="button"
                    onClick={() => setBranches((prev) => prev.filter((x) => x !== b))}
                    aria-label={`Remove ${b}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                className="w-64"
                placeholder="Add branch…"
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addBranch();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addBranch}>
                <Plus className="size-4" /> Add
              </Button>
            </div>
            <div>
              <Button onClick={() => saveBranches.mutate()} disabled={saveBranches.isPending}>
                {saveBranches.isPending ? "Saving…" : "Save branches"}
              </Button>
            </div>
          </Card>

          <Card className="flex flex-col gap-4 border border-border/80 p-4">
            <h3 className="font-semibold">Security Threshold</h3>
            <ThresholdForm title="SAST" value={sast} onChange={setSast} />
            <ThresholdForm title="SCA" value={sca} onChange={setSca} />
            <div>
              <Button onClick={() => saveThreshold.mutate()} disabled={saveThreshold.isPending}>
                {saveThreshold.isPending ? "Saving…" : "Save thresholds"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
