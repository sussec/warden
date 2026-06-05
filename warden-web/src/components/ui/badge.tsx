"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { KUMO_BADGE_BASE_STYLES } from "@cloudflare/kumo/components/badge"

import { cn } from "@/lib/utils"

// Kumo-backed badge shim.
//
// The granular Kumo `Badge` only accepts `{ variant, appearance, className,
// children }` — it does not forward arbitrary span props nor support
// `asChild`. To preserve this file's existing public API
// (`React.ComponentProps<"span"> & { asChild }`), we render Kumo's exported
// base-style constant (`KUMO_BADGE_BASE_STYLES`) plus per-variant Kumo
// semantic-token classes onto our own span/Slot element. Variant names map
// the old shadcn set onto Kumo's color tokens; no raw tailwind colors are
// used.
const badgeVariants = cva(
  cn(
    KUMO_BADGE_BASE_STYLES,
    "shrink-0 gap-1 overflow-hidden border border-transparent transition-[color,box-shadow] [&>svg]:pointer-events-none [&>svg]:size-3"
  ),
  {
    variants: {
      variant: {
        // shadcn "default" -> Kumo primary (inverted fill)
        default: "bg-kumo-badge-inverted text-kumo-badge-inverted",
        // shadcn "secondary" -> Kumo secondary (neutral fill)
        secondary: "bg-kumo-fill text-kumo-badge-neutral-subtle",
        // shadcn "destructive" -> Kumo destructive/red
        destructive: "bg-kumo-badge-red text-white",
        // shadcn "outline" -> Kumo outline (transparent + hairline border)
        outline:
          "border-kumo-fill bg-transparent text-kumo-default",
        // No Kumo equivalent for ghost/link: keep thin semantic fallbacks.
        ghost: "bg-transparent text-kumo-default",
        link: "bg-transparent text-kumo-link underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
