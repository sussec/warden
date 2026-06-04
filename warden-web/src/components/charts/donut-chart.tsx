"use client";

import { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { chartText, registerCharts } from "./chart-helpers";

interface DonutChartProps {
  title: string;
  labels: string[];
  values: number[];
  colors: string[];
  onSegmentClick?: (index: number) => void;
}

export function DonutChart({ title, labels, values, colors, onSegmentClick }: DonutChartProps) {
  registerCharts();
  const textColor = chartText();

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          hoverBackgroundColor: colors,
          borderWidth: 0,
        },
      ],
    }),
    [labels, values, colors],
  );

  const options = useMemo(
    () => ({
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top" as const,
          labels: { usePointStyle: true, color: textColor },
        },
        title: {
          display: true,
          text: title,
          color: textColor,
          font: { size: 18 },
        },
        datalabels: {
          display: true,
          color: "#fff",
          font: { weight: "bold" as const, size: 14 },
          formatter: (value: number) => (value > 0 ? value : ""),
        },
      },
      onClick: (_e: unknown, elements: { index: number }[]) => {
        if (elements.length > 0) onSegmentClick?.(elements[0].index);
      },
    }),
    [textColor, title, onSegmentClick],
  );

  return (
    <div className="h-72">
      <Doughnut data={data} options={options} />
    </div>
  );
}
