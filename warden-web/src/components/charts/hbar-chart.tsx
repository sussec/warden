"use client";

import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { chartBorder, chartText, cssVar, mountAnimation, registerCharts } from "./chart-helpers";

interface HBarChartProps {
  title: string;
  labels: string[];
  values: number[];
  color?: string; // css var name, default brand chart-2 (copper)
  onBarClick?: (index: number) => void;
}

/** Horizontal bar chart — Top Finding / Top Vulnerable Package parity. */
export function HBarChart({ title, labels, values, color, onBarClick }: HBarChartProps) {
  registerCharts();
  const textColor = chartText();
  const borderColor = chartBorder();
  const barColor = cssVar(color ?? "--chart-2");

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: barColor,
          borderRadius: 4,
        },
      ],
    }),
    [labels, values, barColor],
  );

  const options = useMemo(
    () => ({
      maintainAspectRatio: false,
      indexAxis: "y" as const,
      // Sweep on mount: bars grow out from the axis once, ease-out. Reduced-motion
      // collapses duration to 0 (snaps to final state).
      animation: mountAnimation(),
      plugins: {
        legend: { display: false },
        title: { display: true, text: title, color: textColor, font: { size: 18 } },
        datalabels: { display: false },
      },
      scales: {
        x: {
          ticks: { color: textColor },
          grid: { color: borderColor },
        },
        y: {
          ticks: { color: textColor },
          grid: { display: false },
        },
      },
      onClick: (_e: unknown, elements: { index: number }[]) => {
        if (elements.length > 0) onBarClick?.(elements[0].index);
      },
    }),
    [textColor, borderColor, title, onBarClick],
  );

  return (
    <div className="h-80">
      <Bar data={data} options={options} />
    </div>
  );
}
