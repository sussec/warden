"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bug,
  CalendarDays,
  Flame,
  Package,
  ShieldCheck,
} from "lucide-react";
import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { sastStatistic, scaStatistic, trendStatistic } from "@/client/sdk.gen";
import type { TrendPoint } from "@/client/types.gen";

// ---------------------------------------------------------------------------
// Chart configs — severity palette shared with the rest of the app
// (globals.css --severity-*), status palette matches the legacy dashboard.
// ---------------------------------------------------------------------------

const severityConfig = {
  critical: { label: "Critical", color: "var(--severity-critical)" },
  high: { label: "High", color: "var(--severity-high)" },
  medium: { label: "Medium", color: "var(--severity-medium)" },
  low: { label: "Low", color: "var(--severity-low)" },
} satisfies ChartConfig;

const sastStatusConfig = {
  open: { label: "Open", color: "var(--muted-foreground)" },
  confirmed: { label: "Fixing", color: "var(--chart-1)" },
  acceptedRisk: { label: "Accepted Risk", color: "var(--severity-high)" },
  fixed: { label: "Fixed", color: "var(--severity-info)" },
} satisfies ChartConfig;

const scaStatusConfig = {
  open: { label: "Open", color: "var(--muted-foreground)" },
  ignore: { label: "Accepted Risk", color: "var(--severity-high)" },
  fixed: { label: "Fixed", color: "var(--severity-info)" },
} satisfies ChartConfig;

const compareConfig = {
  sast: { label: "SAST", color: "var(--chart-1)" },
  sca: { label: "SCA", color: "var(--chart-2)" },
} satisfies ChartConfig;

const topFindingConfig = {
  count: { label: "Findings", color: "var(--chart-2)" },
} satisfies ChartConfig;

const SEVERITY_KEYS = ["critical", "high", "medium", "low"] as const;
const SEVERITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

// Recharts sorts legend/tooltip items alphabetically by default — rank them
// by severity (then workflow state) instead.
const ITEM_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  open: 0,
  confirmed: 1,
  ignore: 2,
  acceptedRisk: 2,
  fixed: 3,
  sast: 0,
  sca: 1,
  count: 0,
};
const rankItem = (item: { dataKey?: unknown; value?: unknown; name?: unknown }) =>
  ITEM_RANK[String(item.dataKey ?? item.name ?? item.value)] ?? 99;

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;

// ---------------------------------------------------------------------------

function fillTrend(points: TrendPoint[] | undefined, start: Date, end: Date) {
  const byDay = new Map(
    (points ?? []).map((p) => [format(parseISO(p.date), "yyyy-MM-dd"), p]),
  );
  return eachDayOfInterval({ start, end }).map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const p = byDay.get(key);
    return {
      date: key,
      critical: p?.critical ?? 0,
      high: p?.high ?? 0,
      medium: p?.medium ?? 0,
      low: p?.low ?? 0,
      total: (p?.critical ?? 0) + (p?.high ?? 0) + (p?.medium ?? 0) + (p?.low ?? 0),
    };
  });
}

function severityPie(series?: {
  critical: number;
  high: number;
  medium: number;
  low: number;
}) {
  return SEVERITY_KEYS.map((key) => ({
    severity: key,
    count: series?.[key] ?? 0,
    fill: `var(--color-${key})`,
  }));
}

function StatusBreakdown({
  items,
}: {
  items: { key: string; label: string; value: number; color: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 px-4 pt-3">
      {items.map((s) => (
        <div key={s.key} className="flex items-center gap-2 text-sm">
          <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
          <span className="truncate text-muted-foreground">{s.label}</span>
          <span className="ml-auto font-medium tabular-nums">{s.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [days, setDays] = useState<string>("30");
  const [trendView, setTrendView] = useState<"sast" | "sca">("sast");

  const range = useMemo(() => {
    const end = new Date();
    return {
      start: subDays(end, Number(days)),
      end,
      body: {
        startDate: subDays(end, Number(days)).toISOString(),
        endDate: end.toISOString(),
      },
    };
  }, [days]);

  const { data: sast } = useQuery({
    queryKey: ["dashboard", "sast", range.body],
    queryFn: async () =>
      (await sastStatistic({ body: range.body, throwOnError: true })).data,
  });
  const { data: sca } = useQuery({
    queryKey: ["dashboard", "sca", range.body],
    queryFn: async () =>
      (await scaStatistic({ body: range.body, throwOnError: true })).data,
  });
  const { data: trend } = useQuery({
    queryKey: ["dashboard", "trend", range.body],
    queryFn: async () =>
      (await trendStatistic({ body: range.body, throwOnError: true })).data,
  });

  // ---- derived series ------------------------------------------------------

  const sastTrend = useMemo(
    () => fillTrend(trend?.sast, range.start, range.end),
    [trend, range],
  );
  const scaTrend = useMemo(
    () => fillTrend(trend?.sca, range.start, range.end),
    [trend, range],
  );
  const areaData = trendView === "sast" ? sastTrend : scaTrend;

  const lineData = useMemo(
    () =>
      sastTrend.map((p, i) => ({
        date: p.date,
        sast: p.total,
        sca: scaTrend[i]?.total ?? 0,
      })),
    [sastTrend, scaTrend],
  );

  const radarData = useMemo(
    () =>
      SEVERITY_KEYS.map((key) => ({
        severity: SEVERITY_LABELS[key],
        sast: sast?.severity[key] ?? 0,
        sca: sca?.severity[key] ?? 0,
      })),
    [sast, sca],
  );

  const sastPie = useMemo(() => severityPie(sast?.severity), [sast]);
  const scaPie = useMemo(() => severityPie(sca?.severity), [sca]);
  const sastTotal = sastPie.reduce((acc, cur) => acc + cur.count, 0);
  const scaTotal = scaPie.reduce((acc, cur) => acc + cur.count, 0);

  const sastStatusTotal =
    (sast?.status.open ?? 0) +
    (sast?.status.confirmed ?? 0) +
    (sast?.status.acceptedRisk ?? 0) +
    (sast?.status.fixed ?? 0);
  const scaStatusTotal =
    (sca?.status.open ?? 0) + (sca?.status.ignore ?? 0) + (sca?.status.fixed ?? 0);

  const topFindings = useMemo(
    () =>
      (sast?.topFindings ?? []).map((f) => ({
        category: f.category,
        count: f.count,
        fill: "var(--color-count)",
      })),
    [sast],
  );

  const topPackages = useMemo(
    () =>
      (sca?.topDependencies ?? []).map((d) => ({
        name: d.name,
        critical: d.critical,
        high: d.high,
        medium: d.medium,
        low: d.low,
      })),
    [sca],
  );

  const kpis = [
    {
      label: "Open Issues",
      value: (sast?.status.open ?? 0) + (sca?.status.open ?? 0),
      hint: "SAST + SCA awaiting triage",
      icon: Bug,
      className: "text-critical",
    },
    {
      label: "Critical Findings",
      value: (sast?.severity.critical ?? 0) + (sca?.severity.critical ?? 0),
      hint: "Highest severity across scans",
      icon: Flame,
      className: "text-high",
    },
    {
      label: "Vulnerable Packages",
      value: scaTotal,
      hint: "Dependencies with known risk",
      icon: Package,
      className: "text-medium",
    },
    {
      label: "Fixed",
      value: (sast?.status.fixed ?? 0) + (sca?.status.fixed ?? 0),
      hint: "Resolved in selected period",
      icon: ShieldCheck,
      className: "text-info",
    },
  ];

  const tickFormatter = (value: string) => format(parseISO(value), "MMM d");

  return (
    <div className="flex flex-col gap-4 px-2">
      {/* header ------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Security Overview</h1>
          <p className="text-sm text-muted-foreground">
            SAST &amp; SCA posture across all projects
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger size="sm" className="w-44 bg-card">
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

      {/* KPI cards ---------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="gap-2 py-4">
            <CardHeader className="flex flex-row items-center justify-between px-4">
              <CardDescription>{kpi.label}</CardDescription>
              <kpi.icon className={`size-4 ${kpi.className}`} />
            </CardHeader>
            <CardContent className="px-4">
              <div className="text-3xl font-bold tabular-nums">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* trend area chart ---------------------------------------------------- */}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Findings Trend</CardTitle>
            <CardDescription>
              New {trendView === "sast" ? "findings" : "vulnerable packages"} per
              day by severity
            </CardDescription>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={trendView}
            onValueChange={(v) => v && setTrendView(v as "sast" | "sca")}
          >
            <ToggleGroupItem value="sast">SAST</ToggleGroupItem>
            <ToggleGroupItem value="sca">SCA</ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          <ChartContainer config={severityConfig} className="aspect-auto h-64 w-full">
            <AreaChart data={areaData} margin={{ top: 12, left: 0, right: 8 }}>
              <defs>
                {SEVERITY_KEYS.map((key) => (
                  <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0.1} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={tickFormatter}
              />
              <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(value) => format(parseISO(value as string), "MMM d, yyyy")}
                  />
                }
              />
              {[...SEVERITY_KEYS].reverse().map((key) => (
                <Area
                  key={key}
                  dataKey={key}
                  type="natural"
                  fill={`url(#fill-${key})`}
                  stroke={`var(--color-${key})`}
                  stackId="severity"
                />
              ))}
              <ChartLegend itemSorter={rankItem} content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* severity donuts + radar --------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle>SAST Severity</CardTitle>
            <CardDescription>Findings by severity</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer config={severityConfig} className="mx-auto aspect-square max-h-56">
              <PieChart>
                <ChartTooltip cursor={false} itemSorter={rankItem} content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={sastPie}
                  dataKey="count"
                  nameKey="severity"
                  innerRadius={55}
                  strokeWidth={5}
                  onClick={(_, i) =>
                    router.push(`/finding?severity=${SEVERITY_LABELS[SEVERITY_KEYS[i]]}`)
                  }
                  className="cursor-pointer"
                >
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                              {sastTotal.toLocaleString()}
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-xs">
                              Findings
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
                <ChartLegend itemSorter={rankItem} content={<ChartLegendContent nameKey="severity" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle>SCA Severity</CardTitle>
            <CardDescription>Vulnerable packages by severity</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer config={severityConfig} className="mx-auto aspect-square max-h-56">
              <PieChart>
                <ChartTooltip cursor={false} itemSorter={rankItem} content={<ChartTooltipContent hideLabel />} />
                <Pie data={scaPie} dataKey="count" nameKey="severity" innerRadius={55} strokeWidth={5}>
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                              {scaTotal.toLocaleString()}
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-xs">
                              Packages
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
                <ChartLegend itemSorter={rankItem} content={<ChartLegendContent nameKey="severity" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle>SAST vs SCA</CardTitle>
            <CardDescription>Severity profile comparison</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer config={compareConfig} className="mx-auto aspect-square max-h-56">
              <RadarChart data={radarData}>
                <ChartTooltip cursor={false} itemSorter={rankItem} content={<ChartTooltipContent indicator="line" />} />
                <PolarAngleAxis dataKey="severity" />
                <PolarGrid />
                <Radar dataKey="sast" fill="var(--color-sast)" fillOpacity={0.5} stroke="var(--color-sast)" />
                <Radar dataKey="sca" fill="var(--color-sca)" fillOpacity={0.4} stroke="var(--color-sca)" />
                <ChartLegend itemSorter={rankItem} content={<ChartLegendContent />} />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* status radials + daily line ------------------------------------------ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle>SAST Status</CardTitle>
            <CardDescription>Remediation workflow state</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer config={sastStatusConfig} className="mx-auto aspect-square max-h-44">
              <RadialBarChart
                data={[
                  {
                    open: sast?.status.open ?? 0,
                    confirmed: sast?.status.confirmed ?? 0,
                    acceptedRisk: sast?.status.acceptedRisk ?? 0,
                    fixed: sast?.status.fixed ?? 0,
                  },
                ]}
                endAngle={360}
                innerRadius="72%"
                outerRadius="100%"
              >
                <PolarAngleAxis type="number" domain={[0, sastStatusTotal || 1]} tick={false} axisLine={false} />
                <ChartTooltip cursor={false} itemSorter={rankItem} content={<ChartTooltipContent hideLabel />} />
                <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 6} className="fill-foreground text-2xl font-bold">
                              {sastStatusTotal.toLocaleString()}
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 14} className="fill-muted-foreground text-xs">
                              Findings
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </PolarRadiusAxis>
                {(["open", "confirmed", "acceptedRisk", "fixed"] as const).map((key) => (
                  <RadialBar
                    key={key}
                    dataKey={key}
                    stackId="status"
                    cornerRadius={4}
                    fill={`var(--color-${key})`}
                    className="stroke-transparent stroke-2"
                  />
                ))}
              </RadialBarChart>
            </ChartContainer>
            <StatusBreakdown
              items={[
                { key: "open", label: "Open", value: sast?.status.open ?? 0, color: "var(--muted-foreground)" },
                { key: "confirmed", label: "Fixing", value: sast?.status.confirmed ?? 0, color: "var(--chart-1)" },
                { key: "acceptedRisk", label: "Accepted Risk", value: sast?.status.acceptedRisk ?? 0, color: "var(--severity-high)" },
                { key: "fixed", label: "Fixed", value: sast?.status.fixed ?? 0, color: "var(--severity-info)" },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle>SCA Status</CardTitle>
            <CardDescription>Dependency remediation state</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer config={scaStatusConfig} className="mx-auto aspect-square max-h-44">
              <RadialBarChart
                data={[
                  {
                    open: sca?.status.open ?? 0,
                    ignore: sca?.status.ignore ?? 0,
                    fixed: sca?.status.fixed ?? 0,
                  },
                ]}
                endAngle={360}
                innerRadius="72%"
                outerRadius="100%"
              >
                <PolarAngleAxis type="number" domain={[0, scaStatusTotal || 1]} tick={false} axisLine={false} />
                <ChartTooltip cursor={false} itemSorter={rankItem} content={<ChartTooltipContent hideLabel />} />
                <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 6} className="fill-foreground text-2xl font-bold">
                              {scaStatusTotal.toLocaleString()}
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 14} className="fill-muted-foreground text-xs">
                              Packages
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </PolarRadiusAxis>
                {(["open", "ignore", "fixed"] as const).map((key) => (
                  <RadialBar
                    key={key}
                    dataKey={key}
                    stackId="status"
                    cornerRadius={4}
                    fill={`var(--color-${key})`}
                    className="stroke-transparent stroke-2"
                  />
                ))}
              </RadialBarChart>
            </ChartContainer>
            <StatusBreakdown
              items={[
                { key: "open", label: "Open", value: sca?.status.open ?? 0, color: "var(--muted-foreground)" },
                { key: "ignore", label: "Accepted Risk", value: sca?.status.ignore ?? 0, color: "var(--severity-high)" },
                { key: "fixed", label: "Fixed", value: sca?.status.fixed ?? 0, color: "var(--severity-info)" },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Daily Activity</CardTitle>
            <CardDescription>New SAST findings vs SCA packages</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ChartContainer config={compareConfig} className="aspect-auto h-56 w-full">
              <LineChart data={lineData} margin={{ top: 12, left: -20, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={tickFormatter}
                />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => format(parseISO(value as string), "MMM d, yyyy")}
                    />
                  }
                />
                <Line dataKey="sast" type="monotone" stroke="var(--color-sast)" strokeWidth={2} dot={false} />
                <Line dataKey="sca" type="monotone" stroke="var(--color-sca)" strokeWidth={2} dot={false} />
                <ChartLegend itemSorter={rankItem} content={<ChartLegendContent />} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* top lists ------------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Findings</CardTitle>
            <CardDescription>Most frequent SAST categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={topFindingConfig} className="aspect-auto h-72 w-full">
              <BarChart
                data={topFindings}
                layout="vertical"
                margin={{ left: 8, right: 32 }}
              >
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="category"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={150}
                  tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 20)}…` : v)}
                />
                <ChartTooltip cursor={false} itemSorter={rankItem} content={<ChartTooltipContent hideLabel />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={4}
                  className="cursor-pointer"
                  onClick={() => router.push("/finding")}
                >
                  <LabelList dataKey="count" position="right" className="fill-foreground" fontSize={12} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Vulnerable Packages</CardTitle>
            <CardDescription>Dependencies stacked by severity</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={severityConfig} className="aspect-auto h-72 w-full">
              <BarChart data={topPackages} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={150}
                  tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 20)}…` : v)}
                />
                <ChartTooltip cursor={false} itemSorter={rankItem} content={<ChartTooltipContent />} />
                {SEVERITY_KEYS.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="severity"
                    fill={`var(--color-${key})`}
                    radius={i === SEVERITY_KEYS.length - 1 ? [0, 4, 4, 0] : 0}
                  />
                ))}
                <ChartLegend itemSorter={rankItem} content={<ChartLegendContent />} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
