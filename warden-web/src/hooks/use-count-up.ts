"use client";

import { useEffect, useRef, useState } from "react";

/** Cubic ease-out — fast start, gentle settle. Matches the dashboard's restrained feel. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** True when the user has asked the OS to reduce motion (SSR-safe). */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type UseCountUpOptions = {
  /** Animation duration in milliseconds. Default 600. */
  durationMs?: number;
};

/**
 * Animate a number from its previous value to `target` using requestAnimationFrame
 * with a cubic ease-out. Returns the current animated value.
 *
 * - Snaps instantly to `target` if the user prefers reduced motion.
 * - Animates from the last rendered value whenever `target` changes (re-runs cleanly).
 * - First mount counts up from 0 → target.
 */
export function useCountUp(target: number, opts?: UseCountUpOptions): number {
  const durationMs = opts?.durationMs ?? 600;
  const [value, setValue] = useState<number>(() => (prefersReducedMotion() ? target : 0));

  // Track the value we're animating *from* without retriggering the effect on every frame.
  const fromRef = useRef<number>(prefersReducedMotion() ? target : 0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      fromRef.current = target;
      // Syncs to the OS reduce-motion preference (SSR-unsafe external system):
      // snap straight to `target` when it changes instead of animating.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(target);
      return;
    }

    const from = fromRef.current;
    const delta = target - from;

    // Nothing to animate — settle immediately.
    if (delta === 0) {
      setValue(target);
      return;
    }

    let frame = 0;
    let start: number | null = null;

    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      const t = durationMs > 0 ? Math.min(elapsed / durationMs, 1) : 1;
      const current = from + delta * easeOutCubic(t);

      if (t >= 1) {
        fromRef.current = target;
        setValue(target);
        return;
      }

      setValue(current);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

export default useCountUp;
