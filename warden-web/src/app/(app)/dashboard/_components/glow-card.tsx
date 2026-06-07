"use client";

import { type CSSProperties, type PointerEvent, type ReactNode, useCallback } from "react";

/**
 * GlowCard — proximity glow wrapper. ⭐ signature interaction (plan §2.1).
 *
 * On `pointermove` it writes three custom properties read by the `.glow-card`
 * rule in globals.css:
 *   --gx / --gy  cursor position in px, relative to the element's top-left
 *   --ga         conic start angle in deg, derived from the center via atan2
 * Properties are set inline (per-instance, no globals) and cleared on leave so
 * the glow falls back to its static hover state.
 *
 * Variants:
 *   - `glow`  (default) KPI/panel border glow (conic sweep + radial spotlight).
 *   - `track` lighter row treatment — radial spotlight following the cursor.
 *
 * Theme-safe (token colors live in CSS) and reduced-motion safe (the CSS
 * disables transitions under `prefers-reduced-motion`).
 */

/** Inline custom props the `.glow-card` CSS consumes. */
type GlowVars = CSSProperties & {
  "--gx"?: string;
  "--gy"?: string;
  "--ga"?: string;
};

export type GlowCardProps = {
  children: ReactNode;
  className?: string;
};

export function GlowCard({ children, className }: GlowCardProps) {
  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Angle (deg) from the element center to the cursor; drives the conic start.
    const angle = (Math.atan2(y - rect.height / 2, x - rect.width / 2) * 180) / Math.PI;

    el.style.setProperty("--gx", `${x}px`);
    el.style.setProperty("--gy", `${y}px`);
    el.style.setProperty("--ga", `${angle}deg`);
  }, []);

  const handlePointerLeave = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.style.removeProperty("--gx");
    el.style.removeProperty("--gy");
    el.style.removeProperty("--ga");
  }, []);

  // Seed the props so the first frame before any pointer event is sane and
  // matches the CSS defaults (centered, no angle).
  const initialVars: GlowVars = { "--gx": "50%", "--gy": "50%", "--ga": "0deg" };

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={initialVars}
      className={`glow-card ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

export default GlowCard;
