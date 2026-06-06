"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { CalendarDays } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SankeyChart, type SankeyLink, type SankeyNode } from "@/components/charts/sankey-chart";
import { sastStatistic, scaStatistic, trendStatistic } from "@/client/sdk.gen";

const SEV = [
  { key: "critical", label: "Critical", color: "#e5484d" },
  { key: "high", label: "High", color: "#eb722a" },
  { key: "medium", label: "Medium", color: "#f0a92a" },
  { key: "low", label: "Low", color: "#6b8cff" },
] as const;
const CODE_COLOR = "#3b82f6";
const DEP_COLOR = "#21b3b3";

const RANGES = [
  { value: "7", label: "Past 7 days" },
  { value: "30", label: "Past 30 days" },
  { value: "90", label: "Past 90 days" },
];

function n(v: number | undefined | null): number {
  return typeof v === "number" ? v : 0;
}

export default function CommandCenterDashboard() {
  const router = useRouter();
  const [days, setDays] = useState("30");

  const body = useMemo(() => {
    const end = new Date();
    return { startDate: subDays(end, Number(days)).toISOString(), endDate: end.toISOString() };
  }, [days]);

  const { data: sast } = useQuery({
    queryKey: ["dashboard", "sast", body],
    queryFn: async () => (await sastStatistic({ body, throwOnError: true })).data,
  });
  const { data: sca } = useQuery({
    queryKey: ["dashboard", "sca", body],
    queryFn: async () => (await scaStatistic({ body, throwOnError: true })).data,
  });
  const { data: trend } = useQuery({
    queryKey: ["dashboard", "trend", body],
    queryFn: async () => (await trendStatistic({ body, throwOnError: true })).data,
  });

  const sastTotal = SEV.reduce((a, s) => a + n(sast?.severity[s.key]), 0);
  const scaTotal = SEV.reduce((a, s) => a + n(sca?.severity[s.key]), 0);
  const sevTotals = SEV.map((s) => ({
    ...s,
    sast: n(sast?.severity[s.key]),
    sca: n(sca?.severity[s.key]),
    total: n(sast?.severity[s.key]) + n(sca?.severity[s.key]),
  }));
  const grand = sastTotal + scaTotal;
  const criticalHigh = sevTotals[0].total + sevTotals[1].total;
  const open = n(sast?.status.open) + n(sca?.status.open);
  const fixed = n(sast?.status.fixed) + n(sca?.status.fixed);

  // Sankey threat-flow: sources (Code / Dependencies) -> severity.
  const { nodes, links } = useMemo(() => {
    const nodes: SankeyNode[] = [
      { name: "Code", value: sastTotal, color: CODE_COLOR },
      { name: "Dependencies", value: scaTotal, color: DEP_COLOR },
      ...sevTotals.map((s) => ({ name: s.label, value: s.total, color: s.color })),
    ];
    const links: SankeyLink[] = [];
    sevTotals.forEach((s) => {
      if (s.sast > 0) links.push({ source: "Code", target: s.label, value: s.sast });
      if (s.sca > 0) links.push({ source: "Dependencies", target: s.label, value: s.sca });
    });
    return { nodes, links };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sast, sca]);

  const sparkSast = (trend?.sast ?? []).map((p) => n(p.critical) + n(p.high) + n(p.medium) + n(p.low));
  const sparkSca = (trend?.sca ?? []).map((p) => n(p.critical) + n(p.high) + n(p.medium) + n(p.low));

  const kpis = [
    { label: "Total Findings", value: grand, sub: "across all scans", cls: "text-foreground" },
    { label: "Critical + High", value: criticalHigh, sub: "needs attention", cls: "text-[color:var(--severity-critical)]" },
    { label: "Open", value: open, sub: "awaiting triage", cls: "text-[color:var(--severity-high)]" },
    { label: "Fixed", value: fixed, sub: "this period", cls: "text-[color:var(--severity-info)]" },
  ];

  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col gap-3 lg:h-[calc(100dvh-5.5rem)] lg:min-h-0">
      {/* command bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight">Command Center</h1>
          <span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-xs font-medium backdrop-blur-md">
            <span className="size-1.5 animate-pulse rounded-full bg-[color:var(--severity-info)]" />
            LIVE
          </span>
          <p className="hidden text-xs text-muted-foreground sm:block">
            SAST &amp; SCA posture across all projects
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger size="sm" className="w-40 bg-card/70 backdrop-blur-md">
            <CalendarDays className="size-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI strip */}
      <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur-md">
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <div className={`text-2xl font-bold leading-none tabular-nums ${k.cls}`}>{k.value.toLocaleString()}</div>
            <p className="truncate text-[11px] text-muted-foreground">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* threat-flow Sankey — the hero */}
      <div className="flex min-h-[340px] flex-1 flex-col rounded-xl border border-border/60 bg-card/60 p-3 shadow-sm backdrop-blur-md lg:min-h-0">
        <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Threat Flow</h2>
            <p className="text-xs text-muted-foreground">Findings from sources to severity</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {SEV.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1">
          {grand > 0 ? (
            <SankeyChart
              nodes={nodes}
              links={links}
              onNodeClick={(name) => {
                const s = SEV.find((x) => x.label === name);
                if (s) router.push(`/finding?severity=${s.label}`);
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No findings in this window.
            </div>
          )}
        </div>
      </div>

      {/* bottom panels */}
      <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-3">
        {/* coverage */}
        <div className="rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur-md">
          <h3 className="text-sm font-bold">Coverage</h3>
          <div className="mt-2 space-y-2">
            <Bar label="Code findings (SAST)" value={sastTotal} total={grand} color={CODE_COLOR} />
            <Bar label="Dependency vulns (SCA)" value={scaTotal} total={grand} color={DEP_COLOR} />
          </div>
        </div>
        {/* activity */}
        <div className="rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur-md">
          <h3 className="text-sm font-bold">Activity</h3>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Spark label="SAST" data={sparkSast} color={CODE_COLOR} />
            <Spark label="SCA" data={sparkSca} color={DEP_COLOR} />
          </div>
        </div>
        {/* severity table */}
        <div className="rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur-md">
          <h3 className="text-sm font-bold">Severity Breakdown</h3>
          <table className="mt-1 w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="pb-1 text-left font-medium">Severity</th>
                <th className="pb-1 text-right font-medium">SAST</th>
                <th className="pb-1 text-right font-medium">SCA</th>
                <th className="pb-1 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {sevTotals.map((s) => (
                <tr key={s.key} className="border-t border-border/50">
                  <td className="py-1">
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 font-medium" style={{ background: `${s.color}22`, color: s.color }}>
                      {s.label}
                    </span>
                  </td>
                  <td className="py-1 text-right tabular-nums">{s.sast}</td>
                  <td className="py-1 text-right tabular-nums">{s.sca}</td>
                  <td className="py-1 text-right font-semibold tabular-nums">{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{value.toLocaleString()}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Spark({ label, data, color }: { label: string; data: number[]; color: string }) {
  const max = Math.max(1, ...data);
  const pts =
    data.length > 1
      ? data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - (v / max) * 26}`).join(" ")
      : "0,30 100,30";
  const total = data.reduce((a, b) => a + b, 0);
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{total.toLocaleString()}</span>
      </div>
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="mt-1 h-9 w-full">
        <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
