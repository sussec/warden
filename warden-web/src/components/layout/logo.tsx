import { cn } from "@/lib/utils";

/**
 * Techanv Warden mark — a geometric shield holding a watch-beacon (sentinel
 * dot + radiating sweep arcs). Inline SVG so `fill="currentColor"` inherits
 * the surrounding text color (azure via text-primary) in light and dark.
 */
export function WardenLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={cn("size-7", className)}
      aria-hidden="true"
    >
      {/* shield outline */}
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M256 30 L450 98 V272 C450 386 368 450 256 484 C144 450 62 386 62 272 V98 Z
           M256 78 L406 130 V272 C406 356 344 408 256 438 C168 408 106 356 106 272 V130 Z"
      />
      {/* watch-beacon */}
      <circle cx="256" cy="300" r="34" fill="currentColor" />
      {/* sweep arcs */}
      <path
        d="M205.1 249.1 A72 72 0 0 1 306.9 249.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="26"
        strokeLinecap="round"
        opacity="0.65"
      />
      <path
        d="M174 218 A116 116 0 0 1 338 218"
        fill="none"
        stroke="currentColor"
        strokeWidth="26"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}

/**
 * Animated variant — shield strokes draw in on mount, then the beacon pulses
 * and the radar arcs ping outward forever (DrawSVG-style, pure CSS, keyframes
 * in globals.css under `.warden-mark`). Honors prefers-reduced-motion.
 */
export function AnimatedWardenLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={cn("warden-mark size-7", className)}
      aria-hidden="true"
    >
      <path
        className="warden-shield"
        fillRule="evenodd"
        d="M256 30 L450 98 V272 C450 386 368 450 256 484 C144 450 62 386 62 272 V98 Z
           M256 78 L406 130 V272 C406 356 344 408 256 438 C168 408 106 356 106 272 V130 Z"
      />
      <circle className="warden-beacon" cx="256" cy="300" r="34" fill="currentColor" />
      <path
        className="warden-arc"
        d="M205.1 249.1 A72 72 0 0 1 306.9 249.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="26"
        strokeLinecap="round"
      />
      <path
        className="warden-arc warden-arc-2"
        d="M174 218 A116 116 0 0 1 338 218"
        fill="none"
        stroke="currentColor"
        strokeWidth="26"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Brand badge — the animated shield in a rounded-rectangle frame with a rotating
 * gradient-ring sweep around it (CSS conic-gradient mask). Logo only, no wordmark.
 * Distinctive, premium, and self-contained; honors prefers-reduced-motion.
 */
export function WardenBadge({ className }: { className?: string }) {
  return (
    <span className={cn("warden-badge relative grid size-10 place-items-center rounded-xl text-primary", className)}>
      <AnimatedWardenLogo className="relative z-10 size-6" />
    </span>
  );
}

/**
 * Horizontal brand lockup — the animated shield mark plus the wordmark, all in
 * one self-contained SVG (no HTML text). The mark inherits the parent color
 * (azure via text-primary); the wordmark is rendered in the foreground color.
 * Shield draws in, beacon pulses, radar arcs ping, wordmark slides in.
 */
export function AnimatedWardenLockup({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 360 80"
      role="img"
      aria-label="Techanv Warden"
      className={cn("warden-mark h-8 w-auto", className)}
    >
      {/* mark — 512-space geometry scaled into a 64px box on the left */}
      <g transform="translate(8 8) scale(0.125)">
        <path
          className="warden-shield"
          fillRule="evenodd"
          d="M256 30 L450 98 V272 C450 386 368 450 256 484 C144 450 62 386 62 272 V98 Z
             M256 78 L406 130 V272 C406 356 344 408 256 438 C168 408 106 356 106 272 V130 Z"
        />
        <circle className="warden-beacon" cx="256" cy="300" r="34" fill="currentColor" />
        <path
          className="warden-arc"
          d="M205.1 249.1 A72 72 0 0 1 306.9 249.1"
          fill="none"
          stroke="currentColor"
          strokeWidth="26"
          strokeLinecap="round"
        />
        <path
          className="warden-arc warden-arc-2"
          d="M174 218 A116 116 0 0 1 338 218"
          fill="none"
          stroke="currentColor"
          strokeWidth="26"
          strokeLinecap="round"
        />
      </g>
      {/* wordmark */}
      <text
        className="warden-wordmark fill-foreground"
        x="84"
        y="51"
        fontFamily="var(--font-mono), ui-monospace, monospace"
        fontSize="27"
        fontWeight="700"
        letterSpacing="1.5"
      >
        TECHANV{" "}
        <tspan className="warden-wordmark-accent fill-primary">WARDEN</tspan>
      </text>
    </svg>
  );
}
