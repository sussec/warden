"use client";

import { type ReactNode, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CountUp } from "@/components/ui/count-up";
import { prefersReducedMotion } from "@/components/charts/chart-helpers";
import { GlowCard } from "./glow-card";

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

/** Card wrapper with a header row — Techanv ops panel chrome. */
export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  glow = false,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Wrap in the proximity-glow + corner-accent treatment (subtle, opt-in). */
  glow?: boolean;
}) {
  const header = (title || action) && (
    <div className="mb-3 flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
      <div className="min-w-0">
        {title && (
          <h3 className="text-sm font-semibold leading-tight tracking-tight">{title}</h3>
        )}
        {subtitle && (
          <p className="mt-0.5 font-mono text-[11px] tracking-wide text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );

  const surface =
    "flex flex-col rounded-lg border border-border/70 bg-card/80 p-4 backdrop-blur-md warden-ops-panel";

  // Plain (non-glow): the surface itself is the grid item and carries `className`.
  if (!glow) {
    return (
      <div className={`${surface} ${className ?? ""}`}>
        {header}
        {children}
      </div>
    );
  }

  // Glow: GlowCard becomes the grid item (carries `className` so col-spans land
  // on it). The inner surface fills the slot (`h-full`) and owns the corner
  // accent + visual treatment.
  return (
    <GlowCard className={`rounded-lg ${className ?? ""}`}>
      <div className={`${surface} h-full warden-card-accent`}>
        {header}
        {children}
      </div>
    </GlowCard>
  );
}

/** Big number KPI tile. */
export function KpiCard({
  label,
  value,
  count,
  prefix,
  suffix,
  sub,
  accent,
  onClick,
}: {
  label: string;
  /** Pre-formatted display string. Used when `count` is not supplied (e.g. "—"). */
  value: string;
  /** Numeric target — when set, the figure animates up via <CountUp>. */
  count?: number;
  /** Static text rendered before the animated number (e.g. a unit). */
  prefix?: string;
  /** Static text rendered after the animated number (e.g. "%", "d"). */
  suffix?: string;
  sub?: string;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <GlowCard className="rounded-lg">
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className="group warden-card-accent warden-ops-panel flex h-full w-full cursor-pointer flex-col items-start rounded-lg border border-border/70 bg-card/80 p-4 text-left backdrop-blur-md transition-colors enabled:hover:border-primary/40 enabled:hover:bg-card disabled:cursor-default"
      >
        <span className="warden-mono-label">{label}</span>
        <span
          className="mt-2 font-mono text-3xl font-semibold leading-none tracking-tight tabular-nums"
          style={accent ? { color: accent } : undefined}
        >
          {count === undefined ? (
            value
          ) : (
            <>
              {prefix}
              {/* Preserve fractional metrics (e.g. 0.5d MTTR); round whole counts. */}
              <CountUp
                value={count}
                round={Number.isInteger(count)}
                formatOptions={{ maximumFractionDigits: 1 }}
              />
              {suffix}
            </>
          )}
        </span>
        {sub && (
          <span className="mt-1.5 font-mono text-[11px] tracking-wide text-muted-foreground">
            {sub}
          </span>
        )}
      </button>
    </GlowCard>
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
        <span className="truncate pr-2 font-medium">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {fmt(value)}
          {suffix ?? ""}
        </span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-sm bg-muted">
        <div
          className="h-full rounded-sm transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
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
  // Draw-in on load, reduced-motion safe. False on the server and the first
  // client paint (no hydration mismatch); armed in an effect only when the OS
  // permits motion, so under prefers-reduced-motion the areas snap to final.
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    // Arm on the next frame (outside the effect body) so the draw-in plays
    // without a synchronous setState cascading the render.
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny decorative empty-state mark */}
        <img
          src="/dashboard/mark.jpg"
          alt=""
          width={56}
          height={56}
          className="size-14 rounded-md border border-border/60 object-cover opacity-80"
        />
        <p className="text-sm font-medium">No trend data in this window</p>
        <p className="font-mono text-[11px] tracking-wide text-muted-foreground">
          Feed updates as scans complete
        </p>
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
            // Draw-in on load: a quick ease-out sweep, gated on `animate` so it
            // only fires post-mount when motion is allowed (reduced-motion snaps).
            isAnimationActive={animate}
            animationDuration={700}
            animationEasing="ease-out"
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
