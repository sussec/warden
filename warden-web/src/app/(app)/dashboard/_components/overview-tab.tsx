"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { DonutChart } from "@/components/charts/donut-chart";
import { Stagger } from "@/components/ui/reveal";
import { mttrStatistic, sastStatistic, scaStatistic, trendStatistic } from "@/client/sdk.gen";
import {
  Bar,
  CATEGORY_META,
  KpiCard,
  Panel,
  SEV,
  type TrendDatum,
  TrendArea,
  fmt,
  n,
} from "./dashboard-ui";

export function OverviewTab({ body }: { body: { startDate: string; endDate: string } }) {
  const router = useRouter();

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
  const { data: mttr } = useQuery({
    queryKey: ["dashboard", "mttr", body],
    queryFn: async () => (await mttrStatistic({ body, throwOnError: true })).data,
  });

  const sevTotals = SEV.map((s) => ({
    ...s,
    sast: n(sast?.severity[s.key]),
    sca: n(sca?.severity[s.key]),
    total: n(sast?.severity[s.key]) + n(sca?.severity[s.key]),
  }));
  const sastTotal = sevTotals.reduce((a, s) => a + s.sast, 0);
  const scaTotal = sevTotals.reduce((a, s) => a + s.sca, 0);
  const grand = sastTotal + scaTotal;
  const criticalHigh = sevTotals[0].total + sevTotals[1].total;
  const open = n(sast?.status.open) + n(sca?.status.open);
  const fixed = n(sast?.status.fixed) + n(sca?.status.fixed);
  const resolvedRate = grand + fixed > 0 ? Math.round((fixed / (grand + fixed)) * 100) : 0;

  // Merge SAST + SCA trend points by date into one stacked series.
  const trendData = useMemo<TrendDatum[]>(() => {
    const byDate = new Map<string, TrendDatum>();
    for (const p of [...(trend?.sast ?? []), ...(trend?.sca ?? [])]) {
      const cur = byDate.get(p.date) ?? { date: p.date, critical: 0, high: 0, medium: 0, low: 0 };
      cur.critical += n(p.critical);
      cur.high += n(p.high);
      cur.medium += n(p.medium);
      cur.low += n(p.low);
      byDate.set(p.date, cur);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [trend]);

  // Remediation pipeline (SAST finding lifecycle).
  const pipeline = [
    { label: "Open", value: n(sast?.status.open), color: "#eb722a" },
    { label: "Confirmed", value: n(sast?.status.confirmed), color: "#f0a92a" },
    { label: "Accepted risk", value: n(sast?.status.acceptedRisk), color: "#8b95a5" },
    { label: "Fixed", value: n(sast?.status.fixed), color: "#30a46c" },
  ];
  const pipelineMax = Math.max(1, ...pipeline.map((p) => p.value));

  const categoryBars = (sast?.categories ?? [])
    .map((c) => ({
      category: c.category,
      label: CATEGORY_META[c.category]?.label ?? c.category,
      color: CATEGORY_META[c.category]?.color ?? "#9ca3af",
      count: n(c.count),
    }))
    .sort((a, b) => b.count - a.count);
  const catMax = Math.max(scaTotal, ...categoryBars.map((c) => c.count), 1);

  const kpis = [
    {
      label: "Total findings",
      value: fmt(grand),
      count: grand,
      sub: "across all scans",
      onClick: () => router.push("/finding"),
    },
    {
      label: "Critical + High",
      value: fmt(criticalHigh),
      count: criticalHigh,
      sub: "needs attention",
      accent: "#e5484d",
      onClick: () => router.push("/finding?severity=Critical&severity=High"),
    },
    {
      label: "Open",
      value: fmt(open),
      count: open,
      sub: "awaiting triage",
      accent: "#eb722a",
      onClick: () => router.push("/finding"),
    },
    {
      label: "Mean time-to-fix",
      value: mttr ? `${mttr.meanDaysToFix}d` : "—",
      count: mttr ? mttr.meanDaysToFix : undefined,
      suffix: "d",
      sub: mttr ? `${fmt(mttr.fixedCount)} fixed this period` : "",
      accent: "#30a46c",
    },
    {
      label: "Resolved rate",
      value: `${resolvedRate}%`,
      count: resolvedRate,
      suffix: "%",
      sub: mttr ? `${mttr.meanOpenAgeDays}d avg open age` : "",
      accent: "#0ea5e9",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip — cascades in once on mount via staggered reveal. */}
      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </Stagger>

      {/* trend (wide) + severity donut — hero panels carry a slow, low-opacity
          rotating gradient ring (warden-anim-border). The ring sits on an outer
          rounded wrapper that owns the grid placement so it traces the panel
          edge without colliding with the glow-card's own glow layer. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="warden-anim-border rounded-xl lg:col-span-2">
          <Panel
            title="Findings over time"
            subtitle="New findings by severity"
            className="h-full"
            glow
          >
            <div className="h-[260px]">
              <TrendArea data={trendData} />
            </div>
          </Panel>
        </div>
        <div className="warden-anim-border rounded-xl">
          <Panel title="Severity distribution" subtitle={`${fmt(grand)} total`} className="h-full" glow>
            <div className="h-[260px]">
              {grand > 0 ? (
                <DonutChart
                  title=""
                  labels={sevTotals.map((s) => s.label)}
                  values={sevTotals.map((s) => s.total)}
                  colors={sevTotals.map((s) => s.color)}
                  onSegmentClick={(i) => router.push(`/finding?severity=${sevTotals[i].label}`)}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No findings in this window.
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {/* remediation + coverage + severity table */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Remediation pipeline" subtitle="Code finding lifecycle">
          <div className="space-y-2">
            {pipeline.map((p) => (
              <Bar key={p.label} label={p.label} value={p.value} total={pipelineMax} color={p.color} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-3 text-center">
            <div>
              <div className="text-xl font-bold tabular-nums text-[color:var(--severity-info,#30a46c)]">
                {mttr ? `${mttr.meanDaysToFix}d` : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground">mean time-to-fix</div>
            </div>
            <div>
              <div className="text-xl font-bold tabular-nums">{mttr ? `${mttr.meanOpenAgeDays}d` : "—"}</div>
              <div className="text-[11px] text-muted-foreground">mean open age</div>
            </div>
          </div>
        </Panel>

        <Panel title="Coverage by category" subtitle="Findings per scanner pillar">
          <div className="space-y-2">
            {categoryBars.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categorised findings.</p>
            ) : (
              categoryBars.map((c) => (
                <Bar
                  key={c.category}
                  label={c.label}
                  value={c.count}
                  total={catMax}
                  color={c.color}
                  onClick={() => router.push(`/finding?type=${c.category}`)}
                />
              ))
            )}
            <Bar
              label="Dependency inventory (SCA)"
              value={scaTotal}
              total={catMax}
              color={CATEGORY_META.Dependency.color}
            />
          </div>
        </Panel>

        <Panel title="Severity breakdown" subtitle="Code vs dependencies">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="pb-1 text-left font-medium">Severity</th>
                <th className="pb-1 text-right font-medium">Code</th>
                <th className="pb-1 text-right font-medium">Deps</th>
                <th className="pb-1 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {sevTotals.map((s) => (
                <tr key={s.key} className="border-t border-border/50">
                  <td className="py-1.5">
                    <span
                      className="inline-flex items-center rounded px-1.5 py-0.5 font-medium"
                      style={{ background: `${s.color}22`, color: s.color }}
                    >
                      {s.label}
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{fmt(s.sast)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmt(s.sca)}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{fmt(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
