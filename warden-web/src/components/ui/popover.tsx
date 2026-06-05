"use client"

import * as React from "react"
import {
  PopoverRoot as KumoPopoverRoot,
  PopoverTrigger as KumoPopoverTrigger,
  PopoverContent as KumoPopoverContent,
  PopoverTitle as KumoPopoverTitle,
  PopoverDescription as KumoPopoverDescription,
  type PopoverRootProps,
  type PopoverTriggerProps,
  type PopoverContentProps,
  type PopoverTitleProps,
  type PopoverDescriptionProps,
} from "@cloudflare/kumo/components/popover"

import { cn } from "@/lib/utils"

function Popover({ ...props }: PopoverRootProps) {
  return <KumoPopoverRoot data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: PopoverTriggerProps) {
  return <KumoPopoverTrigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: PopoverContentProps) {
  // Kumo's PopoverContent renders the Base UI portal + positioner internally
  // and is already styled with Kumo semantic surface/typography classes.
  return (
    <KumoPopoverContent
      data-slot="popover-content"
      align={align}
      sideOffset={sideOffset}
      className={cn("w-72", className)}
      {...props}
    />
  )
}

// Base UI's Popover positions against its trigger by default; for the rare
// "anchor" use-case Kumo's PopoverContent accepts an `anchor` prop. We keep a
// thin pass-through component so consumers importing PopoverAnchor still work.
function PopoverAnchor({ ...props }: React.ComponentProps<"span">) {
  return <span data-slot="popover-anchor" {...props} />
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-1 text-sm", className)}
      {...props}
    />
  )
}

function PopoverTitle({ className, ...props }: PopoverTitleProps) {
  return (
    <KumoPopoverTitle
      data-slot="popover-title"
      className={cn("font-medium text-kumo-default", className)}
      {...props}
    />
  )
}

function PopoverDescription({
  className,
  ...props
}: PopoverDescriptionProps) {
  return (
    <KumoPopoverDescription
      data-slot="popover-description"
      className={cn("text-kumo-subtle", className)}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
}
