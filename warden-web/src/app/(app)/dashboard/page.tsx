"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { useRouter } from "next/navigation";
import { Surface } from "@cloudflare/kumo/components/surface";
import { SankeyChart } from "@cloudflare/kumo/components/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { echarts } from "@/lib/echarts";
import { sastStatistic, scaStatistic, trendStatistic } from "@/client/sdk.gen";

const RANGES = [
  { value: "7", label: "Past 7 Days" },
  { value: "30", label: "Past 30 Days" },
  { value: "90", label: "Past 90 Days" },
];

const SEV = [
  { key: "critical", label: "Critical", color: "#e5484d" },
  { key: "high", label: "High", color: "#eb722a" },
  { key: "medium", label: "Medium", color: "#f0a92a" },
  { key: "low", label: "Low", color: "#6b8cff" },
] as const;

const SOURCE_COLOR = "#2f7fdb";
const DEP_COLOR = "#21b3b3";

function n(v: number | undefined | null): number {
  return typeof v === "number" ? v : 0;
}

export default function CommandCenterDashboard() {
  const router = useRouter();
  const [days, setDays] = useState("30");
  const [tab, setTab] = useState<"summary" | "threats" | "health">("threats");

  const range = useMemo(() => {
    const end = new Date();
    return { startDate: subDays(end, Number(days)).toISOString(), endDate: end.toISOString() };
  }, [days]);

  const { data: sast } = useQuery({
    queryKey: ["dashboard", "sast", range],
    queryFn: async () => (await sastStatistic({ body: range, throwOnError: true })).data,
  });
  const { data: sca } = useQuery({
    queryKey: ["dashboard", "sca", range],
    queryFn: async () => (await scaStatistic({ body: range, throwOnError: true })).data,
  });
  const { data: trend } = useQuery({
    queryKey: ["dashboard", "trend", range],
    queryFn: async () => (await trendStatistic({ body: range, throwOnError: true })).data,
  });

  const sastTotal = SEV.reduce((a, s) => a + n(sast?.severity[s.key]), 0);
  const scaTotal = SEV.reduce((a, s) => a + n(sca?.severity[s.key]), 0);
  const sevTotals = SEV.map((s) => ({
    ...s,
    sast: n(sast?.severity[s.key]),
    sca: n(sca?.severity[s.key]),
    total: n(sast?.severity[s.key]) + n(sca?.severity[s.key]),
  }));
  const grandTotal = sastTotal + scaTotal;
  const criticalHigh = sevTotals[0].total + sevTotals[1].total;

  // Sankey threat-flow: sources (Codebase / Dependencies) -> severity buckets.
  const sankey = useMemo(() => {
    const nodes = [
      { id: "codebase", name: "Codebase", value: sastTotal, color: SOURCE_COLOR },
      { id: "deps", name: "Dependencies", value: scaTotal, color: DEP_COLOR },
      ...SEV.map((s) => ({
        id: s.key,
        name: s.label,
        value: n(sast?.severity[s.key]) + n(sca?.severity[s.key]),
        color: s.color,
      })),
    ];
    const links: { source: number; target: number; value: number }[] = [];
    SEV.forEach((s, i) => {
      const ti = 2 + i;
      const a = n(sast?.severity[s.key]);
      const b = n(sca?.severity[s.key]);
      if (a > 0) links.push({ source: 0, target: ti, value: a });
      if (b > 0) links.push({ source: 1, target: ti, value: b });
    });
    return { nodes, links };
  }, [sast, sca, sastTotal, scaTotal]);

  const pointTotal = (p: { critical: number; high: number; medium: number; low: number }) =>
    n(p.critical) + n(p.high) + n(p.medium) + n(p.low);
  const sparkSast = (trend?.sast ?? []).map(pointTotal);
  const sparkSca = (trend?.sca ?? []).map(pointTotal);

  const kpis = [
    { label: "Total Findings", value: grandTotal, accent: "text-foreground" },
    { label: "Critical + High", value: criticalHigh, accent: "text-[color:var(--severity-critical)]" },
    { label: "Open", value: n(sast?.status.open) + n(sca?.status.open), accent: "text-[color:var(--severity-high)]" },
    { label: "Fixed", value: n(sast?.status.fixed) + n(sca?.status.fixed), accent: "text-[color:var(--severity-info)]" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* command bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">Command Center</h1>
          <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium">
            <span className="size-1.5 animate-pulse rounded-full bg-[color:var(--severity-info)]" />
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card p-1 text-sm">
          {(["summary", "threats", "health"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 capitalize transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "health" ? "Operational Health" : t}
            </button>
          ))}
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger size="sm" className="w-40 bg-card">
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
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <Surface key={k.label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <div className={`mt-1 text-3xl font-bold tabular-nums ${k.accent}`}>
              {k.value.toLocaleString()}
            </div>
          </Surface>
        ))}
      </div>

      {/* threat-flow Sankey */}
      <Surface className="rounded-xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">Threat Flow</h2>
            <p className="text-sm text-muted-foreground">
              Findings from sources to severity across the selected window
            </p>
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
        {grandTotal > 0 ? (
          <SankeyChart
            echarts={echarts}
            nodes={sankey.nodes}
            links={sankey.links}
            height={380}
            linkColor="gradient"
            linkOpacity={0.45}
            nodeLabelLayout="stacked"
            onNodeClick={(node) => {
              const sev = SEV.find((s) => s.key === node.id);
              if (sev) router.push(`/finding?severity=${sev.label}`);
            }}
          />
        ) : (
          <div className="flex h-[380px] items-center justify-center text-sm text-muted-foreground">
            No findings in this window.
          </div>
        )}
      </Surface>

      {/* bottom panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* scanner fleet */}
        <Surface className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold">Coverage</h3>
          <p className="text-xs text-muted-foreground">SAST &amp; SCA posture</p>
          <div className="mt-4 space-y-3">
            <CoverageRow label="Code findings (SAST)" value={sastTotal} total={grandTotal} color={SOURCE_COLOR} />
            <CoverageRow label="Dependency vulns (SCA)" value={scaTotal} total={grandTotal} color={DEP_COLOR} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Mini label="Open" value={n(sast?.status.open) + n(sca?.status.open)} />
            <Mini label="Confirmed" value={n(sast?.status.confirmed)} />
            <Mini label="Accepted" value={n(sast?.status.acceptedRisk) + n(sca?.status.ignore)} />
            <Mini label="Fixed" value={n(sast?.status.fixed) + n(sca?.status.fixed)} />
          </div>
        </Surface>

        {/* trend sparklines */}
        <Surface className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold">Activity</h3>
          <p className="text-xs text-muted-foreground">New findings per day</p>
          <div className="mt-4 space-y-4">
            <Spark label="SAST" data={sparkSast} color={SOURCE_COLOR} />
            <Spark label="SCA" data={sparkSca} color={DEP_COLOR} />
          </div>
        </Surface>

        {/* severity table */}
        <Surface className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold">Severity Breakdown</h3>
          <p className="text-xs text-muted-foreground">By source</p>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="pb-2 text-left font-medium">Severity</th>
                <th className="pb-2 text-right font-medium">SAST</th>
                <th className="pb-2 text-right font-medium">SCA</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {sevTotals.map((s) => (
                <tr key={s.key} className="border-t border-border/60">
                  <td className="py-1.5">
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                      style={{ background: `${s.color}22`, color: s.color }}
                    >
                      {s.label}
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{s.sast.toLocaleString()}</td>
                  <td className="py-1.5 text-right tabular-nums">{s.sca.toLocaleString()}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{s.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      </div>
    </div>
  );
}

function CoverageRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{value.toLocaleString()}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <div className="text-lg font-bold tabular-nums">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Spark({ label, data, color }: { label: string; data: number[]; color: string }) {
  const max = Math.max(1, ...data);
  const pts = data.length > 1
    ? data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - (v / max) * 28}`).join(" ")
    : "0,30 100,30";
  const total = data.reduce((a, b) => a + b, 0);
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{total.toLocaleString()} total</span>
      </div>
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="mt-1 h-10 w-full">
        <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
