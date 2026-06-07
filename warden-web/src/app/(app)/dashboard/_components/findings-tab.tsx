"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { HBarChart } from "@/components/charts/hbar-chart";
import { getFindings, sastStatistic, scaStatistic } from "@/client/sdk.gen";
import { Bar, CATEGORY_META, Panel, SeverityChip, n } from "./dashboard-ui";

const RISK_FILTER = {
  severity: ["Critical", "High"] as const,
  status: ["Open", "Confirmed"] as const,
  sortBy: "Severity" as const,
  desc: true,
  page: 1,
  size: 12,
};

export function FindingsTab({ body }: { body: { startDate: string; endDate: string } }) {
  const router = useRouter();

  const { data: risks, isLoading: risksLoading } = useQuery({
    queryKey: ["dashboard", "topRisks"],
    queryFn: async () =>
      (
        await getFindings({
          body: {
            ...RISK_FILTER,
            severity: [...RISK_FILTER.severity],
            status: [...RISK_FILTER.status],
          },
          throwOnError: true,
        })
      ).data,
  });
  const { data: sast } = useQuery({
    queryKey: ["dashboard", "sast", body],
    queryFn: async () => (await sastStatistic({ body, throwOnError: true })).data,
  });
  const { data: sca } = useQuery({
    queryKey: ["dashboard", "sca", body],
    queryFn: async () => (await scaStatistic({ body, throwOnError: true })).data,
  });

  const riskItems = risks?.items ?? [];

  // Top vulnerable dependencies, ranked by weighted severity.
  const topDeps = (sca?.topDependencies ?? [])
    .map((d) => ({
      label: `${d.name}@${d.version}`,
      score: n(d.critical) * 4 + n(d.high) * 3 + n(d.medium) * 2 + n(d.low),
    }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const topCats = (sast?.topFindings ?? []).slice(0, 8);

  const catBars = [...(sast?.categories ?? [])]
    .map((c) => ({
      category: c.category,
      label: CATEGORY_META[c.category]?.label ?? c.category,
      color: CATEGORY_META[c.category]?.color ?? "#9ca3af",
      count: n(c.count),
    }))
    .sort((a, b) => b.count - a.count);
  const catMax = Math.max(1, ...catBars.map((c) => c.count));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* top risks feed */}
        <Panel
          title="Top risks"
          subtitle="Open critical & high findings"
          className="lg:col-span-2"
          action={
            <button
              type="button"
              onClick={() => router.push("/finding?severity=Critical&severity=High")}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View all →
            </button>
          }
        >
          {risksLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : riskItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No open critical or high findings. 🎉
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {riskItems.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => router.push(`/finding?severity=${f.severity}`)}
                  className="flex w-full items-center gap-3 py-2 text-left transition-colors hover:bg-muted/40"
                >
                  <SeverityChip severity={f.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{f.name ?? f.identity ?? "—"}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {f.scanner ?? f.type}
                      {f.status ? ` · ${f.status}` : ""}
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </Panel>

        {/* category coverage */}
        <Panel title="By category" subtitle="Findings per scanner pillar" className="self-start">
          <div className="space-y-2.5">
            {catBars.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categorised findings.</p>
            ) : (
              catBars.map((c) => (
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
          </div>
        </Panel>
      </div>

      {/* top deps + top categories charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Top vulnerable dependencies" subtitle="Weighted by severity">
          <div className="h-[280px]">
            {topDeps.length > 0 ? (
              <HBarChart
                title=""
                labels={topDeps.map((d) => d.label)}
                values={topDeps.map((d) => d.score)}
                color="--chart-3"
                onBarClick={() => router.push("/finding?type=Dependency")}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No vulnerable dependencies.
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Top finding categories" subtitle="Most common rule groups">
          <div className="h-[280px]">
            {topCats.length > 0 ? (
              <HBarChart
                title=""
                labels={topCats.map((c) => c.category)}
                values={topCats.map((c) => n(c.count))}
                color="--chart-2"
                onBarClick={() => router.push("/finding")}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No finding categories.
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
