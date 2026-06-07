"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * <PageTransition> — re-triggers a quick fade/rise whenever the route changes.
 *
 * The inner wrapper is keyed by `usePathname()`, so React remounts it on every
 * navigation. A fresh mount restarts the one-shot `.warden-reveal` animation
 * (`warden-rise`: opacity 0→1, translateY 8px→0, ~420ms ease-out), giving the
 * whole page a brief settle-in on each route change — not on in-place
 * re-renders, since the key only changes with the pathname.
 *
 * Motion is reduced-motion safe: `.warden-reveal` is disabled under
 * `@media (prefers-reduced-motion: reduce)` in globals.css (opacity 1, no
 * transform), so content appears instantly without movement.
 *
 * Theme-safe by construction: this wrapper sets no colors and only animates
 * opacity/transform, inheriting whatever the page paints via CSS-var tokens.
 */
export function PageTransition({ children }: { children: ReactNode }): ReactNode {
  const pathname = usePathname();

  return (
    <div key={pathname} className="warden-reveal">
      {children}
    </div>
  );
}
