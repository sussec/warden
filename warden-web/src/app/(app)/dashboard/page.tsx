"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DonutChart } from "@/components/charts/donut-chart";
import { HBarChart } from "@/components/charts/hbar-chart";
import { cssVar } from "@/components/charts/chart-helpers";
import { sastStatistic, scaStatistic } from "@/client/sdk.gen";
import { useTheme } from "@/lib/use-theme";

const SEVERITY_LABELS = ["Critical", "High", "Medium", "Low"];
const severityColors = () => [
  cssVar("--severity-critical"),
  cssVar("--severity-high"),
  cssVar("--severity-medium"),
  cssVar("--severity-low"),
];

export default function DashboardPage() {
  const router = useRouter();
  const { dark } = useTheme(); // re-render charts on theme change
  const [range] = useState(() => ({
    startDate: subDays(new Date(), 30).toISOString(),
    endDate: new Date().toISOString(),
  }));

  const { data: sast } = useQuery({
    queryKey: ["dashboard", "sast", range],
    queryFn: async () =>
      (await sastStatistic({ body: range, throwOnError: true })).data,
  });
  const { data: sca } = useQuery({
    queryKey: ["dashboard", "sca", range],
    queryFn: async () =>
      (await scaStatistic({ body: range, throwOnError: true })).data,
  });

  const colors = useMemo(() => severityColors(), [dark]); // eslint-disable-line react-hooks/exhaustive-deps
  const statusColors = useMemo(
    () => ({
      gray: cssVar("--muted-foreground"),
      teal: cssVar("--chart-1"),
      orange: cssVar("--severity-high"),
      green: cssVar("--severity-info"),
    }),
    [dark], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="flex flex-col gap-4 px-2" key={dark ? "dark" : "light"}>
      <div>
        <Button variant="default" size="sm" className="gap-2">
          <CalendarDays className="size-4" /> Last 30 Days
        </Button>
      </div>

      <h2 className="text-lg font-bold">Static Application Security Testing (SAST)</h2>
      <Card className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
        <DonutChart
          title="Severity"
          labels={SEVERITY_LABELS}
          values={[
            sast?.severity.critical ?? 0,
            sast?.severity.high ?? 0,
            sast?.severity.medium ?? 0,
            sast?.severity.low ?? 0,
          ]}
          colors={colors}
          onSegmentClick={(i) =>
            router.push(`/finding?severity=${SEVERITY_LABELS[i]}`)
          }
        />
        <DonutChart
          title="Status"
          labels={["Open", "Fixing", "Accepted Risk", "Fixed"]}
          values={[
            sast?.status.open ?? 0,
            sast?.status.confirmed ?? 0,
            sast?.status.acceptedRisk ?? 0,
            sast?.status.fixed ?? 0,
          ]}
          colors={[statusColors.gray, statusColors.teal, statusColors.orange, statusColors.green]}
        />
        <HBarChart
          title="Top Finding"
          labels={sast?.topFindings.map((f) => f.category) ?? []}
          values={sast?.topFindings.map((f) => f.count) ?? []}
        />
      </Card>

      <h2 className="text-lg font-bold">Software Composition Analysis (SCA)</h2>
      <Card className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
        <DonutChart
          title="Severity"
          labels={SEVERITY_LABELS}
          values={[
            sca?.severity.critical ?? 0,
            sca?.severity.high ?? 0,
            sca?.severity.medium ?? 0,
            sca?.severity.low ?? 0,
          ]}
          colors={colors}
        />
        <DonutChart
          title="Status"
          labels={["Open", "Accepted Risk", "Fixed"]}
          values={[sca?.status.open ?? 0, sca?.status.ignore ?? 0, sca?.status.fixed ?? 0]}
          colors={[statusColors.gray, statusColors.orange, statusColors.green]}
        />
        <HBarChart
          title="Top Vulnerable Package"
          labels={sca?.topDependencies.map((d) => d.name) ?? []}
          values={
            sca?.topDependencies.map(
              (d) => d.critical + d.high + d.medium + d.low + d.info,
            ) ?? []
          }
        />
      </Card>
    </div>
  );
}
