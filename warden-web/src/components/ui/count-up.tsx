"use client";

import { type ComponentPropsWithoutRef } from "react";

import { useCountUp, type UseCountUpOptions } from "@/hooks/use-count-up";
import { cn } from "@/lib/utils";

export type CountUpProps = {
  /** The target number to animate to. */
  value: number;
  /** Animation duration in milliseconds. Default 600. */
  durationMs?: number;
  /**
   * Round the displayed value. Defaults to `Math.round` so KPI counters show
   * whole numbers; pass `false` to keep the raw (fractional) animated value.
   */
  round?: boolean;
  /** Locale-format options forwarded to `toLocaleString`. */
  formatOptions?: Intl.NumberFormatOptions;
} & Omit<ComponentPropsWithoutRef<"span">, "children">;

/**
 * Renders an animated, `toLocaleString()`-formatted number.
 * Counts up to `value` via rAF + ease-out, and snaps instantly when the user
 * prefers reduced motion. Tabular figures keep the width stable while counting.
 */
export function CountUp({
  value,
  durationMs,
  round = true,
  formatOptions,
  className,
  ...props
}: CountUpProps) {
  const opts: UseCountUpOptions | undefined =
    durationMs === undefined ? undefined : { durationMs };
  const animated = useCountUp(value, opts);
  const display = round ? Math.round(animated) : animated;

  return (
    <span className={cn("tabular-nums", className)} {...props}>
      {display.toLocaleString(undefined, formatOptions)}
    </span>
  );
}

export default CountUp;
