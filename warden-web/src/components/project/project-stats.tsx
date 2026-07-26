"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DonutChart } from "@/components/charts/donut-chart";
import { cssVar } from "@/components/charts/chart-helpers";
import { getProjectStatistic } from "@/client/sdk.gen";
import { useTheme } from "@/lib/use-theme";
import type { SeveritySeries } from "@/client/types.gen";

const SEVERITY_LABELS = ["Critical", "High", "Medium", "Low"];

function severityValues(s: SeveritySeries | undefined): number[] {
  return [s?.critical ?? 0, s?.high ?? 0, s?.medium ?? 0, s?.low ?? 0];
}

/** Compact severity overview for the project Overview header (SAST + SCA donuts + open count). */
export function ProjectStats({ projectId }: { projectId: string }) {
  const { dark } = useTheme(); // re-render charts on theme change

  const { data, isLoading } = useQuery({
    queryKey: ["project-statistic", projectId],
    queryFn: async () =>
      (
        await getProjectStatistic({
          path: { projectId },
          throwOnError: true,
        })
      ).data,
  });

  const severityColors = useMemo(
    () => [
      cssVar("--severity-critical"),
      cssVar("--severity-high"),
      cssVar("--severity-medium"),
      cssVar("--severity-low"),
    ],
    [dark], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (isLoading) {
    return (
      <Card className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
        <Skeleton className="h-56 w-full sm:h-64" />
        <Skeleton className="h-56 w-full sm:h-64" />
        <Skeleton className="h-56 w-full sm:h-64" />
      </Card>
    );
  }

  const sastTotal = severityValues(data?.severitySast).reduce((a, b) => a + b, 0);
  const scaTotal = severityValues(data?.severitySca).reduce((a, b) => a + b, 0);

  return (
    <Card
      className="grid grid-cols-1 gap-4 p-3 sm:p-4 md:grid-cols-3"
      key={dark ? "dark" : "light"}
    >
      <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-none border border-border/60 p-4 sm:min-h-[16rem]">
        <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
          <AlertTriangle className="size-4 text-high" />
          Open Findings
        </span>
        <span className="font-mono text-4xl font-bold tabular-nums sm:text-5xl">
          {data?.openFinding ?? 0}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {sastTotal} SAST &middot; {scaTotal} SCA
        </span>
      </div>
      <div className="flex h-56 min-w-0 flex-col sm:h-64">
        <DonutChart
          title="SAST Severity"
          labels={SEVERITY_LABELS}
          values={severityValues(data?.severitySast)}
          colors={severityColors}
        />
      </div>
      <div className="flex h-56 min-w-0 flex-col sm:h-64">
        <DonutChart
          title="SCA Severity"
          labels={SEVERITY_LABELS}
          values={severityValues(data?.severitySca)}
          colors={severityColors}
        />
      </div>
    </Card>
  );
}
