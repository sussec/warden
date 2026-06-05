"use client"

import * as React from "react"
import {
  Tooltip as KumoTooltip,
  TooltipProvider as KumoTooltipProvider,
} from "@cloudflare/kumo/components/tooltip"

import { cn } from "@/lib/utils"

/**
 * Kumo-backed shim that preserves the shadcn/Radix compound Tooltip API
 * (`Tooltip` + `TooltipTrigger` + `TooltipContent` + `TooltipProvider`).
 *
 * Kumo exposes a flattened tooltip: a single `<Tooltip content render />`
 * component plus a `<TooltipProvider>`. To keep every consuming page working
 * unchanged, `Tooltip` collects the trigger element (from `TooltipTrigger`)
 * and the popup body (from `TooltipContent`) out of its children, then renders
 * the underlying Kumo `<Tooltip>`.
 */

type TooltipProviderProps = React.ComponentProps<typeof KumoTooltipProvider> & {
  /**
   * Radix-era alias for Kumo's `delay`. Accepted so existing call sites
   * (e.g. `<TooltipProvider delayDuration={300}>`) keep working unchanged.
   */
  delayDuration?: number
}

function TooltipProvider({
  delayDuration = 0,
  delay,
  ...props
}: TooltipProviderProps) {
  return (
    <KumoTooltipProvider
      data-slot="tooltip-provider"
      delay={delay ?? delayDuration}
      {...props}
    />
  )
}

type TooltipTriggerProps = React.ComponentProps<"button"> & {
  /** Render the child element as the trigger instead of wrapping in a button. */
  asChild?: boolean
}

function TooltipTrigger(_props: TooltipTriggerProps) {
  // Rendered indirectly by `Tooltip`; this component only carries props/children
  // so the compound API matches Radix. It is never mounted on its own.
  return null
}

type TooltipContentProps = React.ComponentProps<"div"> & {
  sideOffset?: number
}

function TooltipContent(_props: TooltipContentProps) {
  // Carrier component — its children become the Kumo tooltip `content`.
  return null
}

const CONTENT_CLASSES =
  "w-fit rounded-md bg-kumo-elevated px-3 py-1.5 text-xs text-balance text-kumo-default shadow-md"

type KumoTooltipProps = React.ComponentProps<typeof KumoTooltip>
type KumoRender = KumoTooltipProps["render"]

// The compound usage (`<Tooltip><TooltipTrigger /><TooltipContent /></Tooltip>`)
// supplies trigger + content via children, so Kumo's required `content` and its
// `render` must be optional here to match the old Radix `Tooltip` (Root) API.
type TooltipProps = Omit<KumoTooltipProps, "content" | "render"> & {
  content?: React.ReactNode
  render?: KumoRender
  children?: React.ReactNode
}

function Tooltip({ children, content, render, ...props }: TooltipProps) {
  let trigger: KumoRender | React.ReactNode = render
  let triggerAsChild = false
  let contentNode: React.ReactNode = content
  let contentClassName: string | undefined
  const passthrough: React.ReactNode[] = []

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      if (child != null && child !== false) passthrough.push(child)
      return
    }

    if (child.type === TooltipTrigger) {
      const { asChild, children: triggerChildren } =
        child.props as TooltipTriggerProps
      triggerAsChild = Boolean(asChild)
      trigger = triggerChildren as React.ReactNode
      return
    }

    if (child.type === TooltipContent) {
      const { children: bodyChildren, className } =
        child.props as TooltipContentProps
      contentNode = bodyChildren as React.ReactNode
      contentClassName = className
      return
    }

    passthrough.push(child)
  })

  // When the trigger came from `<TooltipTrigger asChild>`, hand the child
  // element directly to Kumo's `render`. A passed-through render function is
  // forwarded as-is; anything else is wrapped so it stays a valid trigger.
  const renderEl: KumoRender = (() => {
    if (typeof trigger === "function") return trigger as KumoRender
    if (React.isValidElement(trigger)) return trigger
    if (trigger == null) return undefined
    return <span>{trigger}</span>
  })()

  return (
    <KumoTooltip
      data-slot="tooltip"
      content={
        <span className={cn(CONTENT_CLASSES, contentClassName)}>
          {contentNode}
        </span>
      }
      render={renderEl}
      {...props}
    >
      {triggerAsChild ? undefined : passthrough}
    </KumoTooltip>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
