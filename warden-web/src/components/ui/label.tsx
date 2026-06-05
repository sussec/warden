"use client"

import * as React from "react"
import { Label as KumoLabel } from "@cloudflare/kumo/components/label"

import { cn } from "@/lib/utils"

/**
 * Label — Kumo-backed shim.
 *
 * Preserves the previous shadcn/Radix public API: `React.ComponentProps` of a
 * native `<label>`, so consuming pages keep passing `htmlFor`, `className`,
 * `children`, and any other label attribute without changes.
 *
 * Rendering is delegated to Kumo's `<Label>`, which emits a `<label>` styled
 * with Kumo semantic classes. Kumo only consumes `children`, `htmlFor`,
 * `className`, plus its own `showOptional` / `tooltip` indicators; any other
 * native label attributes are forwarded onto the underlying element.
 */
function Label({
  className,
  children,
  htmlFor,
  ...props
}: React.ComponentProps<"label"> & {
  /** Show a gray "(optional)" indicator after the label text. */
  showOptional?: boolean
  /** Tooltip content rendered next to the label via an info icon. */
  tooltip?: React.ReactNode
}) {
  const { showOptional, tooltip, ...rest } = props

  return (
    <KumoLabel
      htmlFor={htmlFor}
      showOptional={showOptional}
      tooltip={tooltip}
      className={cn(
        "flex items-center gap-2 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </KumoLabel>
  )
}

export { Label }
