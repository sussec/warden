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
  // SSR fallback — matte mute grey from the black scale (never cyan/green).
  if (typeof window === "undefined") return "#7a7a7a";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export const chartText = () => cssVar("--foreground");
export const chartBorder = () => cssVar("--border");

/** True when the user has opted into reduced motion (SSR-safe → false). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Mount animation config for chart.js — a tasteful grow/sweep that runs once on
 * mount/data-change. Honours prefers-reduced-motion by collapsing to duration 0
 * (charts snap straight to their final state, no transform).
 */
export function mountAnimation(): { duration: number; easing: "easeOutQuart" } {
  return { duration: prefersReducedMotion() ? 0 : 500, easing: "easeOutQuart" };
}
