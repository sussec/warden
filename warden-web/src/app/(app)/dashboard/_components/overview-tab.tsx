"use client";

import Image from "next/image";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { DonutChart } from "@/components/charts/donut-chart";
import { Stagger } from "@/components/ui/reveal";
import {
  getProjectByFilter,
  mttrStatistic,
  sastStatistic,
  scaStatistic,
  trendStatistic,
} from "@/client/sdk.gen";
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
import { EmptyState } from "./empty-state";
import { BLACK, RED } from "@/lib/palette";

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
  const { data: projectPage } = useQuery({
    queryKey: ["dashboard", "projects"],
    queryFn: async () =>
      (await getProjectByFilter({ body: { page: 1, size: 50 }, throwOnError: true })).data,
  });

  // Top projects ranked by weighted risk (critical heaviest).
  const projectCount = projectPage?.count ?? projectPage?.items?.length ?? 0;
  const topProjects = (projectPage?.items ?? [])
    .map((p) => ({
      ...p,
      risk: n(p.severityCritical) * 4 + n(p.severityHigh) * 3 + n(p.severityMedium) * 2 + n(p.severityLow),
    }))
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 8);

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
    { label: "Open", value: n(sast?.status.open), color: RED[13] },
    { label: "Confirmed", value: n(sast?.status.confirmed), color: RED[15] },
    { label: "Accepted risk", value: n(sast?.status.acceptedRisk), color: BLACK[14] },
    { label: "Fixed", value: n(sast?.status.fixed), color: RED[10] },
  ];
  const pipelineMax = Math.max(1, ...pipeline.map((p) => p.value));

  const categoryBars = (sast?.categories ?? [])
    .map((c) => ({
      category: c.category,
      label: CATEGORY_META[c.category]?.label ?? c.category,
      color: CATEGORY_META[c.category]?.color ?? BLACK[16],
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
      accent: RED[13],
      onClick: () => router.push("/finding?severity=Critical&severity=High"),
    },
    {
      label: "Open",
      value: fmt(open),
      count: open,
      sub: "awaiting triage",
      accent: RED[15],
      onClick: () => router.push("/finding"),
    },
    {
      label: "Mean time-to-fix",
      value: mttr ? `${mttr.meanDaysToFix}d` : "—",
      count: mttr ? mttr.meanDaysToFix : undefined,
      suffix: "d",
      sub: mttr ? `${fmt(mttr.fixedCount)} fixed this period` : "",
      accent: RED[11],
    },
    {
      label: "Resolved rate",
      value: `${resolvedRate}%`,
      count: resolvedRate,
      suffix: "%",
      sub: mttr ? `${mttr.meanOpenAgeDays}d avg open age` : "",
      accent: RED[17],
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

      {/* Visual pipeline strip — generated HUD art */}
      <div className="relative overflow-hidden rounded-none border border-border warden-ops-panel">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="relative min-h-[140px] md:min-h-[168px]">
            <Image
              src="/dashboard/pipeline-hud.jpg"
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover object-center opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/10 via-transparent to-background/80 md:to-background" />
          </div>
          <div className="relative flex flex-col justify-center gap-2 p-4 sm:p-5">
            <p className="warden-mono-label">7-tool CI · blocking gates</p>
            <h2 className="text-lg font-normal tracking-tight sm:text-xl">
              security baked into every phase
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              SAST, secrets, SCA, and container signals roll into one posture feed. Critical and high
              stay elevated until a human gate clears them.
            </p>
            <div className="mt-1 flex flex-wrap gap-2 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              <span className="rounded-sm border border-border/70 bg-background/50 px-2 py-1">
                SAST
              </span>
              <span className="rounded-sm border border-border/70 bg-background/50 px-2 py-1">
                SCA
              </span>
              <span className="rounded-sm border border-primary/30 bg-primary/10 px-2 py-1 text-primary">
                Gate active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* trend (wide) + severity donut */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Findings over time"
          subtitle="New findings by severity"
          className="lg:col-span-2"
          glow
        >
          <div className="h-[260px]">
            <TrendArea data={trendData} />
          </div>
        </Panel>
        <Panel title="Severity distribution" subtitle={`${fmt(grand)} total`} glow>
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
              <EmptyState
                compact
                title="No findings in this window"
                description="Telemetry is quiet — gates remain armed."
                image="empty-secure"
              />
            )}
          </div>
        </Panel>
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
              <div className="font-mono text-xl font-medium tabular-nums text-primary">
                {mttr ? `${mttr.meanDaysToFix}d` : "—"}
              </div>
              <div className="warden-mono-label mt-1 justify-center">mean time-to-fix</div>
            </div>
            <div>
              <div className="font-mono text-xl font-semibold tabular-nums">
                {mttr ? `${mttr.meanOpenAgeDays}d` : "—"}
              </div>
              <div className="warden-mono-label mt-1 justify-center">mean open age</div>
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
              <tr className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                <th className="pb-1.5 text-left font-medium">Severity</th>
                <th className="pb-1.5 text-right font-medium">Code</th>
                <th className="pb-1.5 text-right font-medium">Deps</th>
                <th className="pb-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {sevTotals.map((s) => (
                <tr key={s.key} className="border-t border-border/50">
                  <td className="py-1.5">
                    <span
                      className="inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-medium"
                      style={{ background: `${s.color}22`, color: s.color }}
                    >
                      {s.label}
                    </span>
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{fmt(s.sast)}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{fmt(s.sca)}</td>
                  <td className="py-1.5 text-right font-mono font-semibold tabular-nums">
                    {fmt(s.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* top projects by risk */}
      <Panel title="Top projects by risk" subtitle={`${fmt(projectCount)} projects`} glow>
        {topProjects.length === 0 ? (
          <EmptyState
            compact
            title="No projects yet"
            description="Connect a repo to start the security feed."
            image="pipeline-hud"
          />
        ) : (
          <div className="space-y-0.5">
            {topProjects.map((p) => {
              const segs = [
                { v: n(p.severityCritical), c: SEV[0].color },
                { v: n(p.severityHigh), c: SEV[1].color },
                { v: n(p.severityMedium), c: SEV[2].color },
                { v: n(p.severityLow), c: SEV[3].color },
              ];
              const segTotal = segs.reduce((a, s) => a + s.v, 0) || 1;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => router.push(`/project/${p.id}/overview`)}
                  className="group flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-primary/5"
                >
                  <span className="w-44 shrink-0 truncate text-sm font-medium group-hover:text-primary">
                    {p.name}
                  </span>
                  <div className="flex h-1.5 flex-1 overflow-hidden rounded-sm bg-muted">
                    {segs.map((s, i) =>
                      s.v > 0 ? (
                        <div key={i} style={{ width: `${(s.v / segTotal) * 100}%`, background: s.c }} />
                      ) : null,
                    )}
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums">
                    <span style={{ color: SEV[0].color }}>{n(p.severityCritical)}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span style={{ color: SEV[1].color }}>{n(p.severityHigh)}</span>
                  </span>
                  <span className="hidden w-16 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums sm:inline">
                    {fmt(n(p.open))} open
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
