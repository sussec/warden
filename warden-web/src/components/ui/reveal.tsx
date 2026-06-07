"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

/** True when the user has asked the OS to reduce motion (SSR-safe). */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Extends `CSSProperties` to carry the `--reveal-i` stagger custom property
 * without an `any` cast (CSS vars aren't in the base CSSProperties type).
 */
type RevealStyle = CSSProperties & { "--reveal-i"?: number };

export type RevealProps = {
  children: ReactNode;
  /**
   * Stagger index — sets `--reveal-i`, which `.warden-reveal` reads to offset
   * its `animation-delay` (60ms per step). Omit for an immediate reveal.
   */
  index?: number;
  /** Element to render. Defaults to a `div`. */
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  /**
   * `IntersectionObserver` visibility ratio that triggers the reveal.
   * Default 0.05 — fire as soon as a sliver scrolls in.
   */
  threshold?: number;
  /** Root margin forwarded to the observer (e.g. pre-fire below the fold). */
  rootMargin?: string;
};

/**
 * Reveals its children once, the first time they scroll into view — or
 * immediately on mount if they're already on-screen. Adds the `.warden-reveal`
 * class (a one-shot rise-in keyframe) when triggered.
 *
 * - SSR-safe: renders inert markup on the server and on the first client paint,
 *   then arms the observer in an effect.
 * - Reduced-motion safe: a no-op — children render fully visible with no class,
 *   no transform, no observer.
 * - Runs once: the observer disconnects after the first intersection, so the
 *   animation never re-fires on re-render.
 */
export function Reveal({
  children,
  index,
  as,
  className,
  style,
  threshold = 0.05,
  rootMargin,
}: RevealProps) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // No-op under reduced motion: leave children fully visible, never animate.
    if (prefersReducedMotion()) return;

    const node = ref.current;
    if (!node) return;

    // Already revealed (e.g. a remount) — nothing to arm.
    if (revealed) return;

    // Bail out gracefully where IntersectionObserver is unavailable: just show.
    // Defer to the next frame so the setState lands outside the effect body.
    if (typeof IntersectionObserver !== "function") {
      const raf = requestAnimationFrame(() => setRevealed(true));
      return () => cancelAnimationFrame(raf);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [revealed, threshold, rootMargin]);

  const mergedStyle: RevealStyle = { ...style };
  if (typeof index === "number") mergedStyle["--reveal-i"] = index;

  return (
    <Tag
      ref={ref}
      className={cn(revealed && "warden-reveal", className)}
      style={mergedStyle}
    >
      {children}
    </Tag>
  );
}

export type StaggerProps = {
  children: ReactNode;
  /** Element to render as the container. Defaults to a `div`. */
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  /**
   * Starting stagger index for the first child. Each subsequent child
   * increments by 1, so chained `Stagger`s can continue a sequence.
   */
  startIndex?: number;
  /** Visibility ratio forwarded to each child `Reveal`. */
  threshold?: number;
  /** Root margin forwarded to each child `Reveal`. */
  rootMargin?: string;
};

/**
 * Maps over its children, wrapping each in a `<Reveal>` with an incrementing
 * `index` so they cascade in. Inherits all of `Reveal`'s SSR- and
 * reduced-motion safety.
 *
 * Keys are preserved from valid elements where present; otherwise the position
 * index is used. Non-element children (strings, numbers, null) pass through
 * untouched so they don't break the map.
 */
export function Stagger({
  children,
  as,
  className,
  style,
  startIndex = 0,
  threshold,
  rootMargin,
}: StaggerProps) {
  const Tag = (as ?? "div") as ElementType;

  // Stagger index advances only for valid elements (non-element children pass
  // through without consuming a step), derived purely from prior siblings so no
  // post-render reassignment is needed.
  const childArray = Children.toArray(children);
  const items = childArray.map((child, i) => {
    if (!isValidElement(child)) return child;
    const key = child.key ?? i;
    const revealIndex =
      startIndex + childArray.slice(0, i).filter(isValidElement).length;
    return (
      <Reveal key={key} index={revealIndex} threshold={threshold} rootMargin={rootMargin}>
        {cloneElement(child)}
      </Reveal>
    );
  });

  return (
    <Tag className={className} style={style}>
      {items}
    </Tag>
  );
}

export default Reveal;
