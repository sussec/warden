"use client"

import * as React from "react"
import { Separator as SeparatorPrimitive } from "@cloudflare/kumo/primitives/separator"

import { cn } from "@/lib/utils"

/**
 * Separator is backed by the Base UI Separator primitive (re-exported by
 * `@cloudflare/kumo/primitives/separator`).
 *
 * The public API mirrors the previous shadcn/Radix shim: it accepts
 * `className`, `orientation`, `decorative`, and any other div props. Base UI
 * has no `decorative` prop (it is always rendered as a presentational
 * separator), so it is accepted for API compatibility and not forwarded to the
 * DOM. Base UI emits a `data-orientation` attribute just like Radix, so the
 * orientation-aware utility classes continue to work.
 */
function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive> & {
  decorative?: boolean
}) {
  // `decorative` is intentionally not forwarded — Base UI's separator does not
  // accept it and would surface it as an unknown DOM attribute.
  void decorative

  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-kumo-hairline data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
