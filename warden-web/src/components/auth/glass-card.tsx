"use client";

/**
 * GlassCard — a frosted-glass surface for wrapping the auth (login / forgot /
 * MFA) forms that sit over the ambient <LoginBackdrop>.
 *
 * Design lineage (read & re-toned for a security dashboard):
 *  - glassmorphicSignInForm10 — the frosted card itself: a translucent fill,
 *    a soft blur, and a *light edge* (the original `border-left`/`border-top`
 *    highlight) that catches the backdrop and reads as real glass.
 *  - glassmorphismCreditCard — the deeper `blur(35px)` + thin 2px frame look,
 *    and the long, soft ambient shadow that lifts the card off the page.
 *
 * Hard constraints honoured here:
 *  - THEME-SAFE: every colour resolves from existing CSS-var tokens
 *    (--card / --border / --primary / --muted-foreground / --sidebar). No
 *    hardcoded hex that could break a theme — looks right in BOTH light & dark.
 *  - SUBTLE / professional: the glass is an accent, never a distraction. The
 *    translucency, blur and shadow are tuned down vs. the flashy references.
 *  - REDUCED MOTION: the only motion is the optional pointer-driven proximity
 *    glow (the foundation `.glow-card`), and its JS driver is fully disabled
 *    under `prefers-reduced-motion: reduce` (the CSS itself also no-ops there).
 *  - NO NEW DEPS: pure React + the existing `cn` util + foundation CSS classes.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { cn } from "@/lib/utils";

export interface GlassCardProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * Enable the proximity-glow border (foundation `.glow-card`): a token-tinted
   * spotlight masked to the card border that follows the pointer. Subtle and
   * theme-coloured; automatically inert under reduced-motion. Default: true.
   */
  glow?: boolean;
  /**
   * Visual weight of the frost. `"default"` is the standard auth card; `"strong"`
   * leans into the credit-card reference (deeper blur, thinner-but-brighter
   * frame) for hero / single-card layouts. Default: `"default"`.
   */
  frost?: "default" | "strong";
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Frosted-glass card. Composes the foundation `.glow-card` (opt-in) and drives
 * its `--gx`/`--gy`/`--ga` custom props from pointer movement so the masked
 * border-glow tracks the cursor. The frost surface itself is plain inline
 * token styles so it never depends on a particular Tailwind arbitrary value.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { glow = true, frost = "default", className, style, children, onPointerMove, ...rest },
  forwardedRef,
) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  // Mirror the forwarded ref onto our internal one so the pointer handler can
  // mutate custom props without re-rendering.
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  // Whether the glow JS driver should run (glow requested AND motion allowed).
  const motionRef = useRef(false);
  useEffect(() => {
    motionRef.current = glow && !prefersReducedMotion();
  }, [glow]);

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      onPointerMove?.(event);
      const el = innerRef.current;
      if (!el || !motionRef.current) return;
      const rect = el.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      // Position the radial spotlight, and aim the faint conic sweep at the
      // pointer so the brightest part of the border faces the cursor.
      el.style.setProperty("--gx", `${x}px`);
      el.style.setProperty("--gy", `${y}px`);
      const angle = Math.atan2(y - rect.height / 2, x - rect.width / 2);
      el.style.setProperty("--ga", `${(angle * 180) / Math.PI - 90}deg`);
    },
    [onPointerMove],
  );

  const blur = frost === "strong" ? "28px" : "18px";

  return (
    <div
      ref={setRefs}
      onPointerMove={handlePointerMove}
      className={cn(
        // Layout / shape — squircle-ish radius matching the premium dashboard cards.
        "relative isolate overflow-hidden rounded-2xl",
        // Foundation proximity-glow border (token-tinted, reduced-motion-safe).
        glow && "glow-card",
        className,
      )}
      style={{
        // Translucent token fill — sits over the backdrop so the blur reads.
        background: "color-mix(in oklab, var(--card) 62%, transparent)",
        // Frosted blur (vendor-prefixed for Safari). The wrapper is the glass.
        backdropFilter: `blur(${blur}) saturate(135%)`,
        WebkitBackdropFilter: `blur(${blur}) saturate(135%)`,
        // Subtle base border from the theme token.
        border: "1px solid color-mix(in oklab, var(--border) 80%, transparent)",
        // Light edge (top/left highlight from the references) + ambient lift
        // shadow, both token-driven so they invert correctly per theme.
        boxShadow: [
          // inner top/left highlight — the "glass catches the light" edge
          "inset 0 1px 0 0 color-mix(in oklab, var(--card-foreground) 14%, transparent)",
          "inset 1px 0 0 0 color-mix(in oklab, var(--card-foreground) 8%, transparent)",
          // soft, wide ambient shadow grounded in the sidebar tone
          "0 24px 60px -20px color-mix(in oklab, var(--sidebar) 70%, transparent)",
          // faint primary-tinted halo so the card belongs to the brand palette
          "0 0 0 1px color-mix(in oklab, var(--primary) 6%, transparent)",
        ].join(", "),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
});

export default GlassCard;
