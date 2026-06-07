"use client";

import { type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Severity palette — single source of truth, ordered most→least severe.
export const SEV = [
  { key: "critical", label: "Critical", color: "#e5484d" },
  { key: "high", label: "High", color: "#eb722a" },
  { key: "medium", label: "Medium", color: "#f0a92a" },
  { key: "low", label: "Low", color: "#6b8cff" },
] as const;

export const SEVERITY_COLOR: Record<string, string> = {
  Critical: "#e5484d",
  High: "#eb722a",
  Medium: "#f0a92a",
  Low: "#6b8cff",
  Info: "#8b95a5",
};

// Friendly label + colour per scanner category (ScannerType).
export const CATEGORY_META: Record<string, { label: string; color: string }> = {
  Sast: { label: "Code (SAST)", color: "#3b82f6" },
  Secret: { label: "Secrets", color: "#a855f7" },
  Dast: { label: "DAST / Web", color: "#f0a92a" },
  Iast: { label: "IAST", color: "#6b8cff" },
  Container: { label: "Container", color: "#14b8a6" },
  Dependency: { label: "Dependencies", color: "#21b3b3" },
  Ai: { label: "AI / LLM", color: "#ec4899" },
  Cloud: { label: "Cloud (CSPM)", color: "#0ea5e9" },
};

export function n(v: number | undefined | null): number {
  return typeof v === "number" ? v : 0;
}

export function fmt(v: number): string {
  return v.toLocaleString();
}

/** ISO date string -> compact "Jun 5" (UTC, avoids tz drift). */
export function fmtDay(d: string): string {
  const iso = d.length >= 10 ? d.slice(0, 10) : d;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return d.slice(5, 10);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Card wrapper with a header row. */
export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur-md ${className ?? ""}`}
    >
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            {title && <h3 className="text-sm font-semibold leading-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/** Big number KPI tile. */
export function KpiCard({
  label,
  value,
  sub,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="group flex flex-col items-start rounded-xl border border-border/60 bg-card/70 p-4 text-left shadow-sm backdrop-blur-md transition-colors enabled:hover:border-border enabled:hover:bg-card disabled:cursor-default"
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className="mt-1 text-3xl font-bold leading-none tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
      {sub && <span className="mt-1 text-xs text-muted-foreground">{sub}</span>}
    </button>
  );
}

/** Labelled progress bar. */
export function Bar({
  label,
  value,
  total,
  color,
  onClick,
  suffix,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  onClick?: () => void;
  suffix?: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div
      className={onClick ? "cursor-pointer rounded transition-opacity hover:opacity-80" : undefined}
      onClick={onClick}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="truncate pr-2">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {fmt(value)}
          {suffix ?? ""}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/** Small coloured severity chip. */
export function SeverityChip({ severity }: { severity: string }) {
  const color = SEVERITY_COLOR[severity] ?? "#8b95a5";
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{ background: `${color}22`, color }}
    >
      {severity}
    </span>
  );
}

export type TrendDatum = {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

/** Stacked-area trend of findings by severity over time. */
export function TrendArea({ data }: { data: TrendDatum[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
        No trend data in this window.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={220}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <defs>
          {SEV.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.04} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={fmtDay}
          interval="preserveStartEnd"
          minTickGap={40}
          padding={{ left: 8, right: 8 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={36}
          allowDecimals={false}
          tickCount={5}
        />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(label) => fmtDay(String(label))}
          labelStyle={{ color: "var(--muted-foreground)" }}
        />
        {SEV.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stackId="1"
            stroke={s.color}
            strokeWidth={1.5}
            fill={`url(#g-${s.key})`}
            dot={data.length <= 8 ? { r: 2, fill: s.color, strokeWidth: 0 } : false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
