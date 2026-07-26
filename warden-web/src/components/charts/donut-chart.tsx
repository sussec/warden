"use client";

import { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { chartText, mountAnimation, registerCharts } from "./chart-helpers";
import { cn } from "@/lib/utils";

interface DonutChartProps {
  title: string;
  labels: string[];
  values: number[];
  colors: string[];
  onSegmentClick?: (index: number) => void;
  /** When true (default), zero slices are omitted from the ring + legend. */
  hideZeros?: boolean;
  className?: string;
}

/**
 * Responsive severity donut.
 * Chart.js canvas legends collide in narrow cards (garbled labels) — we render
 * an HTML legend that wraps cleanly on mobile and keeps the ring readable.
 */
export function DonutChart({
  title,
  labels,
  values,
  colors,
  onSegmentClick,
  hideZeros = true,
  className,
}: DonutChartProps) {
  registerCharts();
  const textColor = chartText();

  const segments = useMemo(() => {
    const all = labels.map((label, i) => ({
      label,
      value: values[i] ?? 0,
      color: colors[i] ?? "#888",
      sourceIndex: i,
    }));
    return hideZeros ? all.filter((s) => s.value > 0) : all;
  }, [labels, values, colors, hideZeros]);

  const total = useMemo(
    () => segments.reduce((sum, s) => sum + s.value, 0),
    [segments],
  );

  const data = useMemo(
    () => ({
      labels: segments.map((s) => s.label),
      datasets: [
        {
          data: segments.length > 0 ? segments.map((s) => s.value) : [1],
          backgroundColor:
            segments.length > 0 ? segments.map((s) => s.color) : ["#333"],
          hoverBackgroundColor:
            segments.length > 0 ? segments.map((s) => s.color) : ["#333"],
          borderWidth: 0,
          // Keeps the ring from looking like a solid disk on single-segment data
          spacing: segments.length > 1 ? 2 : 0,
        },
      ],
    }),
    [segments],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      layout: {
        // Room for the ring inside the flex area; legend is HTML below
        padding: { top: 4, bottom: 4, left: 4, right: 4 },
      },
      animation: {
        ...mountAnimation(),
        animateRotate: true,
        animateScale: true,
      },
      plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: { label?: string; parsed?: number }) => {
              const v = ctx.parsed ?? 0;
              const pct = total > 0 ? Math.round((v / total) * 100) : 0;
              return ` ${ctx.label}: ${v} (${pct}%)`;
            },
          },
        },
        datalabels: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          display: (ctx: any) => {
            const raw = ctx?.dataset?.data?.[ctx.dataIndex];
            const v = typeof raw === "number" ? raw : 0;
            // Only label slices large enough to fit a digit
            return total > 0 && v / total >= 0.08 && v > 0;
          },
          color: "#fff",
          font: { weight: "bold" as const, size: 12 },
          formatter: (value: number) => (value > 0 ? String(value) : ""),
        },
      },
      onClick: (_e: unknown, elements: { index: number }[]) => {
        if (elements.length === 0) return;
        const seg = segments[elements[0].index];
        if (seg) onSegmentClick?.(seg.sourceIndex);
      },
    }),
    [segments, total, onSegmentClick],
  );

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full min-w-0 flex-col gap-3",
        className,
      )}
    >
      {title ? (
        <p className="shrink-0 truncate text-center text-sm font-medium text-foreground">
          {title}
        </p>
      ) : null}

      {/* Ring fills remaining height; absolute center total */}
      <div className="relative min-h-[140px] w-full min-w-0 flex-1">
        <Doughnut data={data} options={options} />
        {total > 0 && (
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
            aria-hidden
          >
            <span className="font-mono text-2xl font-semibold tabular-nums leading-none text-primary sm:text-3xl">
              {total}
            </span>
            <span className="mt-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              total
            </span>
          </div>
        )}
      </div>

      {/* HTML legend — wraps on narrow cards instead of colliding on canvas */}
      <ul
        className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-1"
        role="list"
      >
        {(hideZeros ? segments : labels.map((label, i) => ({
          label,
          value: values[i] ?? 0,
          color: colors[i] ?? "#888",
          sourceIndex: i,
        }))).map((s) => (
          <li key={s.label}>
            <button
              type="button"
              onClick={() => onSegmentClick?.(s.sourceIndex)}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-none px-1 py-0.5 text-left transition-colors",
                onSegmentClick && "cursor-pointer hover:bg-primary/10",
                !onSegmentClick && "cursor-default",
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-full ring-1 ring-border/60"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <span className="truncate font-mono text-[11px] tracking-wide text-muted-foreground">
                {s.label}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-foreground">
                {s.value}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
