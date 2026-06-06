"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { SankeyChart as EChartsSankey } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([EChartsSankey, TooltipComponent, CanvasRenderer]);

export interface SankeyNode {
  name: string;
  value?: number;
  color?: string;
}
export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

/**
 * Command-center threat-flow Sankey on raw ECharts (no component-library
 * dependency). Gradient ribbons, focus-on-hover, dark-surface friendly.
 */
export function SankeyChart({
  nodes,
  links,
  onNodeClick,
}: {
  nodes: SankeyNode[];
  links: SankeyLink[];
  onNodeClick?: (name: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current);
    if (onNodeClick) {
      chart.on("click", (p: { dataType?: string; name?: string }) => {
        if (p.dataType === "node" && p.name) onNodeClick(p.name);
      });
    }
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(
      {
        tooltip: {
          trigger: "item",
          triggerOn: "mousemove",
          backgroundColor: "rgba(20,20,28,0.95)",
          borderColor: "rgba(255,255,255,0.1)",
          textStyle: { color: "#e5e7eb", fontSize: 12 },
        },
        series: [
          {
            type: "sankey",
            left: 8,
            right: 140,
            top: 10,
            bottom: 10,
            nodeWidth: 14,
            nodeGap: 14,
            draggable: false,
            emphasis: { focus: "adjacency" },
            data: nodes.map((n) => ({
              name: n.name,
              value: n.value,
              itemStyle: { color: n.color ?? "#3b82f6", borderColor: "transparent" },
            })),
            links: links.map((l) => ({
              source: l.source,
              target: l.target,
              value: l.value,
            })),
            lineStyle: { color: "gradient", opacity: 0.42, curveness: 0.5 },
            label: {
              color: "#cbd5e1",
              fontSize: 12,
              fontWeight: 500,
              formatter: (p: { name: string; value: number }) =>
                p.value ? `{v|${p.value.toLocaleString()}}\n{n|${p.name}}` : p.name,
              rich: {
                v: { color: "#f8fafc", fontSize: 13, fontWeight: 700, lineHeight: 16 },
                n: { color: "#94a3b8", fontSize: 11, lineHeight: 14 },
              },
            },
          },
        ],
      },
      true,
    );
  }, [nodes, links]);

  return <div ref={ref} className="h-full w-full" />;
}
