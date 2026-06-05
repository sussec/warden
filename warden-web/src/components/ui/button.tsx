"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { Button as KumoButton } from "@cloudflare/kumo/components/button"

import { cn } from "@/lib/utils"

/**
 * Kumo-backed Button shim.
 *
 * The public API (export names, variant/size names, `asChild`, and all native
 * button props) is preserved exactly so consuming pages need no changes.
 *
 * Internally:
 * - The common path renders the Kumo <Button>, mapping the legacy (shadcn)
 *   variant/size names onto Kumo's variant/size/shape.
 * - The `asChild` path keeps a Slot (Kumo's Button does not support Slot) and
 *   applies the same Kumo-semantic classes via `buttonVariants`.
 *
 * `buttonVariants` keeps the legacy variant/size keys (calendar.tsx and
 * pagination.tsx call it directly) but emits Kumo semantic classes only.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-kumo-brand/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-kumo-brand !text-white hover:bg-kumo-brand-hover disabled:bg-kumo-brand/50",
        destructive:
          "bg-kumo-danger !text-white hover:bg-kumo-danger/70 focus-visible:ring-kumo-danger/40",
        outline:
          "bg-transparent text-kumo-default ring ring-kumo-hairline hover:bg-kumo-tint",
        secondary:
          "bg-kumo-base !text-kumo-default ring ring-kumo-hairline hover:bg-kumo-tint disabled:bg-kumo-base/50",
        ghost: "bg-inherit text-kumo-default shadow-none hover:bg-kumo-tint",
        link: "text-kumo-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type LegacyVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>
type LegacySize = NonNullable<VariantProps<typeof buttonVariants>["size"]>

/** Legacy (shadcn) variant name -> Kumo Button variant name. */
const KUMO_VARIANT: Record<
  LegacyVariant,
  "primary" | "secondary" | "ghost" | "destructive" | "outline"
> = {
  default: "primary",
  destructive: "destructive",
  outline: "outline",
  secondary: "secondary",
  ghost: "ghost",
  // Kumo has no `link` variant; render as ghost and let the legacy
  // buttonVariants classes (underline) provide the link affordance.
  link: "ghost",
}

/** Legacy size name -> Kumo Button size. */
const KUMO_SIZE: Record<LegacySize, "xs" | "sm" | "base" | "lg"> = {
  default: "base",
  xs: "xs",
  sm: "sm",
  lg: "lg",
  icon: "base",
  "icon-xs": "xs",
  "icon-sm": "sm",
  "icon-lg": "lg",
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const resolvedVariant = (variant ?? "default") as LegacyVariant
  const resolvedSize = (size ?? "default") as LegacySize

  // `asChild` is not supported by Kumo's Button (no Slot). Keep the Slot path
  // and style it with the same Kumo-semantic classes so the rendered child
  // (e.g. <a>/<Link>) looks identical to a real button.
  if (asChild) {
    return (
      <Slot.Root
        data-slot="button"
        data-variant={resolvedVariant}
        data-size={resolvedSize}
        className={cn(
          buttonVariants({ variant: resolvedVariant, size: resolvedSize }),
          className
        )}
        {...props}
      />
    )
  }

  return (
    <KumoButton
      data-slot="button"
      data-variant={resolvedVariant}
      data-size={resolvedSize}
      variant={KUMO_VARIANT[resolvedVariant]}
      size={KUMO_SIZE[resolvedSize]}
      // Always use Kumo's default `shape="base"`: Kumo's `shape="square"`
      // requires an `aria-label` (icon-only buttons in this codebase don't
      // pass one). The legacy size classes below supply the exact square
      // dimensions (e.g. `size-9` for `size="icon"`) instead.
      shape="base"
      // Re-apply the legacy size/icon classes on top so the exact dimensions
      // (e.g. `size-9` for `size="icon"`) and `link` underline are preserved.
      className={cn(
        buttonVariants({ variant: resolvedVariant, size: resolvedSize }),
        className
      )}
      {...props}
    />
  )
}

export { Button, buttonVariants }
