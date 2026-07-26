"use client";

import { type CSSProperties, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

/**
 * ElasticToggle — a controlled, accessible switch with a springy "elastic"
 * thumb motion.
 *
 * The travelling thumb rides the shared `--ease-elastic` spring easing (a
 * `linear(...)` value defined on `:root` in globals.css) and momentarily
 * stretches along the travel axis as it settles — a subtle, premium accent
 * suited to a security dashboard, never a distraction.
 *
 * Accessibility:
 *   - Renders a real <button role="switch"> with `aria-checked`.
 *   - Toggles on click and on Space / Enter (native button + explicit handler).
 *   - Always pass a descriptive `aria-label` (or wire an external <label> via
 *     `aria-labelledby` through `...rest`).
 *
 * Theme-safe: every colour resolves from CSS-var tokens (`--primary`,
 * `--muted-foreground`, `--card`, `--border`) so it reads correctly in both
 * light and dark.
 *
 * Motion-safe: the elastic spring + thumb-stretch are gated behind the
 * `motion-reduce:` variant (i.e. `@media (prefers-reduced-motion: reduce)`).
 * Under reduced motion the transition and stretch are dropped while the thumb
 * still moves to its state — an instant, fully legible toggle.
 */

export type ElasticToggleSize = "sm" | "default";

export interface ElasticToggleProps
  extends Omit<
    React.ComponentPropsWithoutRef<"button">,
    "onClick" | "onChange" | "type" | "role" | "aria-checked" | "children"
  > {
  /** Controlled checked state. */
  checked: boolean;
  /** Fired with the next checked value when the user toggles. */
  onCheckedChange: (checked: boolean) => void;
  /**
   * Accessible name. Required unless an external label is wired via
   * `aria-labelledby` on `...rest`.
   */
  "aria-label"?: string;
  size?: ElasticToggleSize;
}

const SIZE: Record<
  ElasticToggleSize,
  { track: string; thumb: string; travel: string }
> = {
  // travel = track width - thumb size - (2 * inset)
  default: { track: "h-5 w-9 p-0.5", thumb: "size-4", travel: "1rem" },
  sm: { track: "h-4 w-7 p-0.5", thumb: "size-3", travel: "0.75rem" },
};

// Spring easing for the travelling thumb. Prefers the shared `--ease-elastic`
// token (a `linear(...)` value on :root, Foundation phase); falls back to a
// gentle overshoot cubic-bezier for browsers/contexts where the token is unset
// or `linear()` easing is unsupported.
const ELASTIC_EASE = "var(--ease-elastic, cubic-bezier(0.34, 1.56, 0.64, 1))";

export function ElasticToggle({
  checked,
  onCheckedChange,
  disabled,
  size = "default",
  className,
  "aria-label": ariaLabel,
  style,
  ...rest
}: ElasticToggleProps) {
  const sz = SIZE[size];

  function toggle() {
    if (disabled) return;
    onCheckedChange(!checked);
  }

  // Space/Enter are handled natively by <button>, but we guard against repeat
  // key auto-fire and keep behaviour explicit for assistive tech.
  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggle();
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      data-state={checked ? "checked" : "unchecked"}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      style={
        {
          "--toggle-travel": sz.travel,
          "--toggle-ease": ELASTIC_EASE,
          ...style,
        } as CSSProperties
      }
      className={cn(
        "group/elastic relative inline-flex shrink-0 cursor-pointer items-center rounded-none",
        "border border-border outline-none",
        // Track: matte mute off, chatak red on.
        "bg-muted data-[state=checked]:bg-primary",
        // Track tint transition uses a gentle, professional ease (not elastic).
        "transition-colors duration-200 ease-out",
        // Keyboard focus ring, token-coloured.
        "focus-visible:ring-2 focus-visible:ring-primary/55 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        "disabled:cursor-not-allowed disabled:opacity-50",
        sz.track,
        className
      )}
      {...rest}
    >
      <span
        aria-hidden
        data-slot="elastic-thumb"
        className={cn(
          "pointer-events-none block rounded-none bg-black-22",
          "group-data-[state=checked]/elastic:bg-black-24",
          // Position is *state*, so the translate stays in every motion mode.
          // `transform-origin` flips toward the leading edge so the brief
          // horizontal stretch reads as the thumb "snapping" into place.
          "origin-left will-change-transform",
          "translate-x-0 group-data-[state=checked]/elastic:translate-x-[var(--toggle-travel)]",
          "group-data-[state=checked]/elastic:origin-right",
          // Spring travel timed by the easing token.
          "transition-transform duration-[420ms] ease-[var(--toggle-ease)]",
          // Thumb-stretch: a tactile horizontal squash while pressed; the
          // spring restores it to round on release. Decorative → motion-only.
          "group-active/elastic:scale-x-[1.18] group-active/elastic:scale-y-[0.92]",
          // Reduced motion: drop the transition + stretch, keep the translate —
          // the toggle still moves to its state, just instantly and round.
          "motion-reduce:transition-none motion-reduce:group-active/elastic:scale-x-100 motion-reduce:group-active/elastic:scale-y-100",
          sz.thumb
        )}
      />
    </button>
  );
}

export default ElasticToggle;
