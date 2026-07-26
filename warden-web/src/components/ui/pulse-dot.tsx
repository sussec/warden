"use client";

import { type CSSProperties, type ReactNode } from "react";

/**
 * Live / active status indicators for the security dashboard.
 *
 * Both primitives drive the shared `.warden-pulse-glow` utility (defined in
 * globals.css), which animates a gentle, token-coloured `box-shadow` keyed to
 * `var(--glow, currentColor)`. Motion is disabled under
 * `prefers-reduced-motion: reduce` — the dot/pill stay perfectly legible.
 *
 * Colour is resolved in this priority order:
 *   1. an explicit `color` token (CSS var name or any CSS colour)
 *   2. the `--glow` custom property set on an ancestor
 *   3. `currentColor`
 *
 * Pass a severity / category token for theme-safe colours, e.g.
 *   <PulseDot color="var(--severity-critical)" />
 *   <StatusGlow color="var(--primary)">LIVE</StatusGlow>
 */

/** CSS var that the dashboard's design tokens map onto. */
export type GlowToken = CSSProperties["color"];

/** Build the style object that wires a token into `.warden-pulse-glow`. */
function glowStyle(color: GlowToken | undefined, extra?: CSSProperties): CSSProperties {
  // When a colour is supplied we set both `color` (so `currentColor` resolves)
  // and the `--glow` custom prop the utility reads. Omitting it lets the dot
  // inherit `currentColor` / an ancestor's `--glow`.
  if (color == null) return { ...extra };
  return { color, ["--glow" as string]: color, ...extra };
}

export interface PulseDotProps {
  /**
   * Colour token for the dot + halo. Prefer a CSS var
   * (`var(--severity-high)`, `var(--primary)`); falls back to `currentColor`.
   */
  color?: GlowToken;
  /** Dot diameter in px. Default 8 (matches `text-sm` line metrics). */
  size?: number;
  /** Disable the pulsing halo — renders a calm, static dot. */
  static?: boolean;
  className?: string;
  /** Accessible label; when omitted the dot is purely decorative (aria-hidden). */
  label?: string;
}

/**
 * Tiny pulsing status dot. Use inside pills, table rows, scanner badges, etc.
 *
 * @example
 * <PulseDot color="var(--severity-critical)" label="Critical — active" />
 */
export function PulseDot({
  color,
  size = 8,
  static: isStatic = false,
  className,
  label,
}: PulseDotProps) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={[
        "inline-block shrink-0 rounded-none bg-current align-middle",
        isStatic ? "" : "warden-pulse-glow",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={glowStyle(color, { width: size, height: size })}
    />
  );
}

export interface StatusGlowProps {
  /** Pill content, e.g. "LIVE", "Scanning", "Active". */
  children: ReactNode;
  /**
   * Colour token for the dot, halo and tinted surface. Prefer a CSS var
   * (`var(--primary)`, `var(--severity-info)`); defaults to `var(--primary)`.
   */
  color?: GlowToken;
  /** Hide the leading pulsing dot (text-only glow pill). */
  hideDot?: boolean;
  /** Disable the pulse — useful for paused / idle states. */
  static?: boolean;
  className?: string;
  /** Accessible label override; defaults to the text content. */
  label?: string;
}

/**
 * A compact glowing status pill — a leading {@link PulseDot} plus a tinted,
 * uppercase label on a subtle token-coloured surface. Designed for the
 * dashboard "LIVE" pill and scanner-running badges.
 *
 * @example
 * <StatusGlow color="var(--primary)">LIVE</StatusGlow>
 * <StatusGlow color="var(--severity-info)" hideDot>Scanning</StatusGlow>
 */
export function StatusGlow({
  children,
  color = "var(--primary)",
  hideDot = false,
  static: isStatic = false,
  className,
  label,
}: StatusGlowProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={[
        "inline-flex items-center gap-1.5 rounded-none border px-2 py-0.5",
        "text-[10px] font-semibold uppercase tracking-wide leading-none",
        "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={glowStyle(color, {
        // Tint the surface/border from the same token so it reads as one piece
        // in both light and dark themes (alpha keeps it subtle).
        borderColor: "color-mix(in oklab, currentColor 28%, transparent)",
        background: "color-mix(in oklab, currentColor 10%, transparent)",
      })}
    >
      {!hideDot && <PulseDot color={color} size={7} static={isStatic} />}
      <span className="text-foreground/85">{children}</span>
    </span>
  );
}
