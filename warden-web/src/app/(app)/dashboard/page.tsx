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
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from "recharts";
import { Bug, CalendarDays, Flame, Package, ShieldCheck } from "lucide-react";
import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
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
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { sastStatistic, scaStatistic, trendStatistic } from "@/client/sdk.gen";
import type { TrendPoint } from "@/client/types.gen";

const severityConfig = {
  critical: { label: "Critical", color: "var(--severity-critical)" },
  high: { label: "High", color: "var(--severity-high)" },
  medium: { label: "Medium", color: "var(--severity-medium)" },
  low: { label: "Low", color: "var(--severity-low)" },
} satisfies ChartConfig;

const statusConfig = {
  open: { label: "Open", color: "var(--muted-foreground)" },
  confirmed: { label: "Confirmed", color: "var(--chart-1)" },
  acceptedRisk: { label: "Accepted", color: "var(--severity-high)" },
  fixed: { label: "Fixed", color: "var(--severity-info)" },
} satisfies ChartConfig;

const topFindingConfig = {
  count: { label: "Findings", color: "var(--chart-1)" },
} satisfies ChartConfig;

const SEVERITY_KEYS = ["critical", "high", "medium", "low"] as const;
const SEVERITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const ITEM_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  open: 0,
  confirmed: 1,
  acceptedRisk: 2,
  fixed: 3,
};
const rankItem = (item: { dataKey?: unknown; name?: unknown; value?: unknown }) =>
  ITEM_RANK[String(item.dataKey ?? item.name ?? item.value)] ?? 99;

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;

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
    };
  });
}

function severityPie(a?: Record<string, number>, b?: Record<string, number>) {
  return SEVERITY_KEYS.map((key) => ({
    severity: key,
    count: (a?.[key] ?? 0) + (b?.[key] ?? 0),
    fill: `var(--color-${key})`,
  }));
}

function n(v: number | undefined | null): number {
  return typeof v === "number" ? v : 0;
}

/** Frosted bento tile. */
function Tile({
  title,
  desc,
  action,
  className = "",
  children,
}: {
  title?: string;
  desc?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex min-h-0 flex-col rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur-md ${className}`}
    >
      {(title || action) && (
        <div className="mb-1 flex shrink-0 items-start justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold">{title}</h2>}
            {desc && <p className="truncate text-xs text-muted-foreground">{desc}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="min-h-0 flex-1">{children}</div>
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
    queryFn: async () => (await sastStatistic({ body: range.body, throwOnError: true })).data,
  });
  const { data: sca } = useQuery({
    queryKey: ["dashboard", "sca", range.body],
    queryFn: async () => (await scaStatistic({ body: range.body, throwOnError: true })).data,
  });
  const { data: trend } = useQuery({
    queryKey: ["dashboard", "trend", range.body],
    queryFn: async () => (await trendStatistic({ body: range.body, throwOnError: true })).data,
  });

  const areaData = useMemo(
    () => fillTrend(trendView === "sast" ? trend?.sast : trend?.sca, range.start, range.end),
    [trend, trendView, range],
  );
  const sevPie = useMemo(() => severityPie(sast?.severity, sca?.severity), [sast, sca]);
  const sevTotal = sevPie.reduce((a, c) => a + c.count, 0);

  const statusData = [
    {
      open: n(sast?.status.open) + n(sca?.status.open),
      confirmed: n(sast?.status.confirmed),
      acceptedRisk: n(sast?.status.acceptedRisk) + n(sca?.status.ignore),
      fixed: n(sast?.status.fixed) + n(sca?.status.fixed),
    },
  ];
  const statusTotal =
    statusData[0].open + statusData[0].confirmed + statusData[0].acceptedRisk + statusData[0].fixed;

  const topFindings = useMemo(
    () =>
      (sast?.topFindings ?? []).slice(0, 6).map((f) => ({
        category: f.category,
        count: f.count,
        fill: "var(--color-count)",
      })),
    [sast],
  );

  const kpis = [
    {
      label: "Open Issues",
      value: n(sast?.status.open) + n(sca?.status.open),
      hint: "Awaiting triage",
      icon: Bug,
      cls: "text-[color:var(--severity-critical)]",
    },
    {
      label: "Critical",
      value: n(sast?.severity.critical) + n(sca?.severity.critical),
      hint: "Highest severity",
      icon: Flame,
      cls: "text-[color:var(--severity-high)]",
    },
    {
      label: "Vuln. Packages",
      value: SEVERITY_KEYS.reduce((a, k) => a + n(sca?.severity[k]), 0),
      hint: "Known-risk deps",
      icon: Package,
      cls: "text-[color:var(--severity-medium)]",
    },
    {
      label: "Fixed",
      value: n(sast?.status.fixed) + n(sca?.status.fixed),
      hint: "In this period",
      icon: ShieldCheck,
      cls: "text-[color:var(--severity-info)]",
    },
  ];

  const tick = (v: string) => format(parseISO(v), "MMM d");

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3">
      {/* header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Security Overview</h1>
          <p className="text-xs text-muted-foreground">SAST &amp; SCA posture across all projects</p>
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

      {/* bento grid — fills the viewport, no scroll */}
      <div className="grid min-h-0 flex-1 grid-cols-12 grid-rows-[auto_minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
        {/* KPI strip */}
        {kpis.map((k) => (
          <div
            key={k.label}
            className="col-span-6 flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur-md sm:col-span-3"
          >
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted ${k.cls}`}>
              <k.icon className="size-4.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {k.label}
              </p>
              <div className="text-2xl font-bold leading-none tabular-nums">
                {k.value.toLocaleString()}
              </div>
              <p className="truncate text-[11px] text-muted-foreground">{k.hint}</p>
            </div>
          </div>
        ))}

        {/* Trend hero */}
        <Tile
          title="Findings Trend"
          desc={`New ${trendView === "sast" ? "findings" : "vulnerable packages"} per day by severity`}
          className="col-span-12 lg:col-span-8"
          action={
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
          }
        >
          <ChartContainer config={severityConfig} className="h-full w-full">
            <AreaChart data={areaData} margin={{ top: 6, left: 0, right: 6, bottom: 0 }}>
              <defs>
                {SEVERITY_KEYS.map((key) => (
                  <linearGradient key={key} id={`f-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.7} />
                    <stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0.06} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={6} minTickGap={28} tickFormatter={tick} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} fontSize={11} />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" labelFormatter={(v) => format(parseISO(v as string), "MMM d, yyyy")} />}
              />
              {[...SEVERITY_KEYS].reverse().map((key) => (
                <Area key={key} dataKey={key} type="natural" fill={`url(#f-${key})`} stroke={`var(--color-${key})`} stackId="s" />
              ))}
            </AreaChart>
          </ChartContainer>
        </Tile>

        {/* Severity donut (SAST + SCA combined) */}
        <Tile title="Severity" desc="All findings & packages" className="col-span-12 lg:col-span-4">
          <ChartContainer config={severityConfig} className="mx-auto aspect-square h-full">
            <PieChart>
              <ChartTooltip cursor={false} itemSorter={rankItem} content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={sevPie}
                dataKey="count"
                nameKey="severity"
                innerRadius="58%"
                strokeWidth={4}
                className="cursor-pointer"
                onClick={(_, i) => router.push(`/finding?severity=${SEVERITY_LABELS[SEVERITY_KEYS[i]]}`)}
              >
                <Label
                  content={({ viewBox }) =>
                    viewBox && "cx" in viewBox && "cy" in viewBox ? (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-xl font-bold">
                          {sevTotal.toLocaleString()}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 16} className="fill-muted-foreground text-[10px]">
                          Total
                        </tspan>
                      </text>
                    ) : null
                  }
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </Tile>

        {/* Remediation status radial */}
        <Tile title="Remediation" desc="Workflow state" className="col-span-12 sm:col-span-6 lg:col-span-4">
          <div className="flex h-full items-center gap-2">
            <ChartContainer config={statusConfig} className="aspect-square h-full max-h-[150px]">
              <RadialBarChart data={statusData} endAngle={360} innerRadius="68%" outerRadius="100%">
                <PolarAngleAxis type="number" domain={[0, statusTotal || 1]} tick={false} axisLine={false} />
                <ChartTooltip cursor={false} itemSorter={rankItem} content={<ChartTooltipContent hideLabel />} />
                <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                  <Label
                    content={({ viewBox }) =>
                      viewBox && "cx" in viewBox && "cy" in viewBox ? (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 4} className="fill-foreground text-lg font-bold">
                            {statusTotal.toLocaleString()}
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 12} className="fill-muted-foreground text-[10px]">
                            Findings
                          </tspan>
                        </text>
                      ) : null
                    }
                  />
                </PolarRadiusAxis>
                {(["open", "confirmed", "acceptedRisk", "fixed"] as const).map((key) => (
                  <RadialBar key={key} dataKey={key} stackId="st" cornerRadius={3} fill={`var(--color-${key})`} className="stroke-transparent stroke-2" />
                ))}
              </RadialBarChart>
            </ChartContainer>
            <div className="grid flex-1 gap-1 text-sm">
              {(["open", "confirmed", "acceptedRisk", "fixed"] as const).map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: `var(--color-${key})` }} />
                  <span className="truncate text-xs text-muted-foreground">{statusConfig[key].label}</span>
                  <span className="ml-auto text-xs font-semibold tabular-nums">
                    {statusData[0][key].toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Tile>

        {/* Top findings */}
        <Tile title="Top Findings" desc="Most frequent categories" className="col-span-12 sm:col-span-6 lg:col-span-8">
          <ChartContainer config={topFindingConfig} className="h-full w-full">
            <BarChart data={topFindings} layout="vertical" margin={{ left: 4, right: 28, top: 2, bottom: 2 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="category"
                tickLine={false}
                axisLine={false}
                width={150}
                fontSize={11}
                tickFormatter={(v: string) => (v.length > 24 ? v.slice(0, 23) + "…" : v)}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4}>
                <LabelList dataKey="count" position="right" className="fill-foreground" fontSize={11} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </Tile>
      </div>
    </div>
  );
}
