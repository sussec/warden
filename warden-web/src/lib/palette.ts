/**
 * Warden × Athesis palette — matte black + chatak red only.
 * 25 blacks + 25 reds. Single source for JS/charts (mirrors globals.css).
 */

export const BLACK = {
  0: "#000000",
  1: "#030303",
  2: "#050505",
  3: "#080808",
  4: "#0a0a0a",
  5: "#0c0c0c",
  6: "#111111",
  7: "#141414",
  8: "#1a1a1a",
  9: "#222222",
  10: "#2a2a2a",
  11: "#333333",
  12: "#3a3a3a",
  13: "#4a4a4a",
  14: "#5a5a5a",
  15: "#6a6a6a",
  16: "#7a7a7a",
  17: "#8a8680",
  18: "#a8a49e",
  19: "#cfcbc6",
  20: "#e0dcd6",
  21: "#ebe7e1",
  22: "#f2eeea",
  23: "#faf8f6",
  24: "#ffffff",
} as const;

export const RED = {
  0: "#0a0002",
  1: "#140004",
  2: "#1a0005",
  3: "#2b0008",
  4: "#3d000c",
  5: "#4f0010",
  6: "#660014",
  7: "#7a0019",
  8: "#8f001d",
  9: "#a30022",
  10: "#b80028",
  11: "#cc002c",
  12: "#e00030",
  13: "#ff0033", // chatak laal — brand
  14: "#ff1a47",
  15: "#ff3355", // hover
  16: "#ff4d66",
  17: "#ff6680",
  18: "#ff8099",
  19: "#ff99b0",
  20: "#ffb3c6",
  21: "#ffccdd",
  22: "#ffe0ea",
  23: "#fff0f4",
  24: "#fff8fa",
} as const;

/** Severity as red intensity only (no orange/blue/green). */
export const SEVERITY_HEX = {
  Critical: RED[13],
  High: RED[15],
  Medium: RED[17],
  Low: RED[10],
  Info: BLACK[14],
} as const;

/** Chart series — red spectrum. */
export const CHART_HEX = [RED[13], RED[15], RED[17], RED[11], RED[8]] as const;

export type BlackStep = keyof typeof BLACK;
export type RedStep = keyof typeof RED;
