"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Database,
  GitBranch,
  HardDrive,
  Info,
  Loader2,
  Mail,
  RefreshCw,
  ScanSearch,
  Server,
  Shield,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getSmtpSetting, testSmtpSetting, updateSmtpSetting } from "@/client/sdk.gen";
import type { SmtpSetting } from "@/client/types.gen";

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ---------- system status types (inline until openapi regen) ---------- */

type ComponentHealth = { ok: boolean; message: string; detail?: string | null };

type SystemStatus = {
  about: {
    product: string;
    description: string;
    version: string;
    framework: string;
    os: string;
    architecture: string;
    hostname: string;
    environment: string;
    startedAt: string;
    uptimeSeconds: number;
    frontendUrl?: string | null;
  };
  health: {
    status: string;
    database: ComponentHealth;
    scanRunner: ComponentHealth;
    smtp: ComponentHealth;
    authentication: ComponentHealth;
    gitHub: ComponentHealth;
    gitLab: ComponentHealth;
  };
  scan: {
    backend: string;
    available: boolean;
    tokenConfigured: boolean;
    imagePrefix: string;
    namespace?: string | null;
    pluginsTotal: number;
    pluginsImageReady: number;
    message: string;
  };
  counts: {
    projects: number;
    findings: number;
    scanJobs: number;
    users: number;
  };
  process: {
    pid: number;
    workingSetMb: number;
    threadCount: number;
  };
};

async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch("/api/setting/system", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`System status failed (${res.status})`);
  return res.json();
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 48) return `${h}h ${rm}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function HealthDot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-none",
        ok ? "bg-primary" : warn ? "bg-medium" : "bg-critical",
      )}
      aria-hidden
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const style =
    s === "healthy"
      ? "border-primary/40 bg-primary/10 text-primary"
      : s === "degraded"
        ? "border-medium/40 bg-medium/10 text-medium"
        : "border-critical/40 bg-critical/10 text-critical";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        style,
      )}
    >
      <HealthDot ok={s === "healthy"} warn={s === "degraded"} />
      {status}
    </span>
  );
}

function HealthRow({
  icon: Icon,
  label,
  health,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  health: ComponentHealth;
}) {
  return (
    <div className="flex items-start gap-3 border border-border/50 bg-background/40 px-3 py-2.5">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center border border-border/60 bg-muted/30">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-foreground">{label}</p>
          <HealthDot ok={health.ok} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {health.ok ? "ok" : "issue"}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{health.message}</p>
        {health.detail ? (
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/80">{health.detail}</p>
        ) : null}
      </div>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="truncate text-xs text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function AboutHealthSection() {
  const query = useQuery({
    queryKey: ["setting-system"],
    queryFn: fetchSystemStatus,
    refetchInterval: 30_000,
  });

  const about = query.data?.about;
  const health = query.data?.health;
  const scan = query.data?.scan;
  const counts = query.data?.counts;
  const process = query.data?.process;

  const startedLabel = useMemo(() => {
    if (!about?.startedAt) return "—";
    try {
      return new Date(about.startedAt).toLocaleString();
    } catch {
      return about.startedAt;
    }
  }, [about?.startedAt]);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="border-border/80 bg-card">
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center border border-border/70 bg-muted/40">
                <Info className="size-4 text-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">About</CardTitle>
                <CardDescription className="mt-1 text-xs leading-relaxed">
                  Product identity and runtime environment for this deployment.
                </CardDescription>
              </div>
            </div>
            {about && (
              <Badge variant="outline" className="font-mono text-[10px]">
                v{about.version}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {query.isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}
          {query.isError && (
            <div className="flex items-start gap-2 border border-critical/40 bg-critical/10 px-3 py-2 text-xs text-critical">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <p>Could not load about info. Check API connectivity.</p>
            </div>
          )}
          {about && (
            <>
              <div>
                <p className="text-sm font-semibold tracking-tight">{about.product}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {about.description}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <MetaCell label="Version" value={about.version} />
                <MetaCell label="Environment" value={about.environment} />
                <MetaCell label="Hostname" value={about.hostname} />
                <MetaCell label="Architecture" value={about.architecture} />
                <MetaCell label="Runtime" value={about.framework} />
                <MetaCell label="OS" value={about.os} />
                <MetaCell label="Started" value={startedLabel} />
                <MetaCell label="Uptime" value={formatUptime(about.uptimeSeconds)} />
                {about.frontendUrl ? (
                  <MetaCell label="Public URL" value={about.frontendUrl} />
                ) : null}
                {process ? (
                  <>
                    <MetaCell label="API PID" value={String(process.pid)} />
                    <MetaCell
                      label="Memory (RSS)"
                      value={`${process.workingSetMb} MB · ${process.threadCount} threads`}
                    />
                  </>
                ) : null}
              </div>
              {counts && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Workspace
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(
                        [
                          ["Projects", counts.projects],
                          ["Findings", counts.findings],
                          ["Scan jobs", counts.scanJobs],
                          ["Users", counts.users],
                        ] as const
                      ).map(([label, n]) => (
                        <div
                          key={label}
                          className="border border-border/50 bg-background/40 px-2.5 py-2 text-center"
                        >
                          <p className="font-mono text-base font-semibold tabular-nums text-foreground">
                            {n.toLocaleString()}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card">
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center border border-border/70 bg-muted/40">
                <Activity className="size-4 text-foreground" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">System health</CardTitle>
                  {health && <StatusBadge status={health.status} />}
                </div>
                <CardDescription className="mt-1 text-xs leading-relaxed">
                  Live checks for database, scan fleet, auth, and integrations.
                </CardDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 font-mono text-[11px]"
              disabled={query.isFetching}
              onClick={() => query.refetch()}
            >
              {query.isFetching ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              <span className="ml-1.5">Refresh</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {query.isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          )}
          {query.isError && (
            <div className="flex items-start gap-2 border border-critical/40 bg-critical/10 px-3 py-2 text-xs text-critical">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <p>{(query.error as Error)?.message || "Health check failed"}</p>
            </div>
          )}
          {health && (
            <>
              <HealthRow icon={Database} label="Database" health={health.database} />
              <HealthRow icon={ScanSearch} label="Scan runner" health={health.scanRunner} />
              <HealthRow icon={Mail} label="SMTP" health={health.smtp} />
              <HealthRow icon={Shield} label="Authentication" health={health.authentication} />
              <HealthRow icon={GitBranch} label="GitHub" health={health.gitHub} />
              <HealthRow icon={GitBranch} label="GitLab" health={health.gitLab} />
            </>
          )}
          {scan && (
            <div className="mt-2 border border-border/50 bg-muted/15 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <HardDrive className="size-3.5 text-muted-foreground" />
                <p className="text-xs font-medium">Scan platform</p>
                {scan.available ? (
                  <CheckCircle2 className="size-3.5 text-primary" />
                ) : (
                  <AlertCircle className="size-3.5 text-critical" />
                )}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <MetaCell label="Backend" value={scan.backend} />
                <MetaCell
                  label="CI token"
                  value={scan.tokenConfigured ? "Configured" : "Missing"}
                />
                <MetaCell label="Image prefix" value={scan.imagePrefix} />
                <MetaCell
                  label="Plugins"
                  value={`${scan.pluginsImageReady}/${scan.pluginsTotal} ready`}
                />
                {scan.namespace ? (
                  <MetaCell label="Namespace" value={scan.namespace} />
                ) : null}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{scan.message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function GeneralSettingPage() {
  const [form, setForm] = useState<SmtpSetting>({ server: "", port: 587, userName: "" });
  const [testEmail, setTestEmail] = useState("");

  const { data } = useQuery({
    queryKey: ["setting-smtp"],
    queryFn: async () => (await getSmtpSetting({ throwOnError: true })).data,
  });
  const [seededFrom, setSeededFrom] = useState<unknown>(null);
  if (data && data !== seededFrom) {
    setSeededFrom(data);
    setForm(data);
  }

  const save = useMutation({
    mutationFn: async () => {
      await updateSmtpSetting({ body: form, throwOnError: true });
    },
    onSuccess: () => toast.success("SMTP settings saved"),
    onError: () => toast.error("Failed to save SMTP settings"),
  });

  const test = useMutation({
    mutationFn: async () =>
      (await testSmtpSetting({ query: { email: testEmail }, throwOnError: true })).data,
    onSuccess: (ok) => (ok ? toast.success("Test email sent") : toast.error("SMTP test failed")),
    onError: (err: unknown) => {
      const detail = (err as { errors?: string[] })?.errors?.[0];
      toast.error(detail ?? "SMTP test failed", { duration: 8000 });
    },
  });

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3 sm:gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-0.5">
        <div>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">General</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground sm:text-sm">
            Platform about info, system health, and outbound email.
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-auto pb-4">
        <section className="space-y-3" aria-labelledby="about-health-title">
          <div className="border-b border-border/50 pb-2">
            <h2
              id="about-health-title"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              About &amp; system health
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
              Deployment identity and live component checks. Auto-refreshes every 30s.
            </p>
          </div>
          <AboutHealthSection />
        </section>

        <section className="space-y-3" aria-labelledby="smtp-title">
          <div className="border-b border-border/50 pb-2">
            <h2
              id="smtp-title"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              Outbound email
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
              SMTP server used for alerts, invites, and notification mail.
            </p>
          </div>

          <Card className="border-border/80 bg-card">
            <CardHeader className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center border border-border/70 bg-muted/40">
                  <Server className="size-4 text-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">SMTP</CardTitle>
                  <CardDescription className="mt-1 text-xs leading-relaxed">
                    Outbound email server configuration.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-server">Server</Label>
                    <Input
                      id="smtp-server"
                      value={form.server}
                      onChange={(e) => setForm((f) => ({ ...f, server: e.target.value }))}
                      required
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-port">Port</Label>
                    <Input
                      id="smtp-port"
                      type="number"
                      value={form.port}
                      onChange={(e) => setForm((f) => ({ ...f, port: num(e.target.value) }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-name">Display name</Label>
                    <Input
                      id="smtp-name"
                      value={form.name ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-user">Username</Label>
                    <Input
                      id="smtp-user"
                      value={form.userName}
                      onChange={(e) => setForm((f) => ({ ...f, userName: e.target.value }))}
                      required
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="smtp-pass">Password</Label>
                    <Input
                      id="smtp-pass"
                      type="password"
                      placeholder="•••••••• (leave blank to keep)"
                      value={form.password ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={form.useSsl ?? false}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, useSsl: v }))}
                    />
                    Use SSL
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={form.ignoreSsl ?? false}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, ignoreSsl: v }))}
                    />
                    Ignore SSL errors
                  </label>
                </div>
                <Separator />
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-test-email">Send test email to</Label>
                    <Input
                      id="smtp-test-email"
                      type="email"
                      className="w-full sm:w-64"
                      placeholder="you@example.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={test.isPending || !testEmail}
                    onClick={() => test.mutate()}
                  >
                    {test.isPending ? "Testing…" : "Send test"}
                  </Button>
                  <Button type="submit" disabled={save.isPending} className="sm:ml-auto">
                    {save.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
