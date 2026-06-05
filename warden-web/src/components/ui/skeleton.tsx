"use client"

import { SkeletonLine } from "@cloudflare/kumo/components/loader"

import { cn } from "@/lib/utils"

/**
 * Skeleton — Kumo-backed shim.
 *
 * Preserves the original shadcn `Skeleton` public API (a `<div>`-shaped
 * loading placeholder driven entirely by the `className` callers pass for
 * sizing/shape, e.g. `h-8 w-36 rounded-md`, `size-16 rounded-full`).
 *
 * Internally this renders Kumo's `SkeletonLine`, which paints the
 * `.skeleton-line` surface (neutral base + animated shimmer, light/dark
 * aware). `SkeletonLine` applies `className` to that same element, and the
 * Tailwind sizing utilities callers provide win over Kumo's `@layer base`
 * defaults — so the caller's width/height/radius are honored exactly.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <SkeletonLine
      data-slot="skeleton"
      className={cn("rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
