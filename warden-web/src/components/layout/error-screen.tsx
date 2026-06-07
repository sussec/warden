"use client";

import { type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GlowCard } from "@/app/(app)/dashboard/_components/glow-card";

/**
 * ErrorScreen — premium full-page treatment for 404 / error routes (plan §1.5).
 *
 * The status code gets the neon `.warden-flicker` treatment (flicker + layered
 * text-shadow), toned to `--primary` rather than red so it reads as an accent on
 * a security dashboard. The surrounding card reuses the dashboard premium kit
 * (`GlowCard` proximity glow + `warden-card-accent` corner borders) so error
 * routes feel of-a-piece with the app.
 *
 * Theme-safe: every color resolves from CSS-var tokens (--primary, --card,
 * --border, --muted-foreground), so it reads correctly in both light and dark.
 * Motion-safe: all non-essential animation is disabled under
 * `prefers-reduced-motion` (handled by the `.warden-*`/`.glow-card` rules in
 * globals.css).
 *
 * Reusable across `not-found.tsx` and `app/error/*`.
 */
export type ErrorScreenProps = {
  /** Status code rendered large with the neon flicker (e.g. "404", "403"). */
  code: string;
  /** Short headline below the code. */
  title: string;
  /** Supporting copy. */
  description: ReactNode;
  /** Optional extra controls rendered beside the primary action. */
  action?: ReactNode;
  /** Primary action link target. Defaults to the dashboard. */
  href?: string;
  /** Primary action label. Defaults to "Back to dashboard". */
  actionLabel?: string;
  /**
   * Tone the flicker glow to a severity token instead of `--primary`
   * (e.g. for a true server fault). Pass a CSS color/var; omit for the
   * default `--primary` accent treatment.
   */
  flickerColor?: string;
};

export function ErrorScreen({
  code,
  title,
  description,
  action,
  href = "/dashboard",
  actionLabel = "Back to dashboard",
  flickerColor,
}: ErrorScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <GlowCard className="w-full max-w-md rounded-2xl">
        <div className="warden-card-accent flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-card/70 px-8 py-12 text-center shadow-sm backdrop-blur-md">
          <p
            className="warden-flicker select-none font-mono text-8xl font-bold leading-none tabular-nums sm:text-9xl"
            style={
              flickerColor
                ? ({ "--primary": flickerColor } as CSSProperties)
                : undefined
            }
            aria-hidden="true"
          >
            {code}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link href={href}>{actionLabel}</Link>
            </Button>
            {action}
          </div>
        </div>
      </GlowCard>
    </div>
  );
}

export default ErrorScreen;
