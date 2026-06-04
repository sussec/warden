"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

let registered = false;
export function registerCharts() {
  if (registered) return;
  registered = true;
  ChartJS.register(
    ArcElement,
    BarElement,
    CategoryScale,
    LinearScale,
    Legend,
    Title,
    Tooltip,
    ChartDataLabels,
  );
}

/** Canvas can't resolve CSS var()/oklch strings — read computed values. */
export function cssVar(name: string): string {
  if (typeof window === "undefined") return "#888888";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export const chartText = () => cssVar("--foreground");
export const chartBorder = () => cssVar("--border");
