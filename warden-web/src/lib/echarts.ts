// Minimal ECharts core with only the modules Kumo's charts need, registered
// once and shared (tree-shaken: Sankey + tooltip + canvas renderer).
import * as echarts from "echarts/core";
import { SankeyChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([SankeyChart, TooltipComponent, CanvasRenderer]);

export { echarts };
