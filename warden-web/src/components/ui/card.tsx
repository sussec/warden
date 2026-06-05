"use client"

import * as React from "react"

import { LayerCard } from "@cloudflare/kumo/components/layer-card"

import { cn } from "@/lib/utils"

/**
 * Card is a Kumo-backed shim.
 *
 * The root `<Card>` renders Kumo's `LayerCard` (the recommended replacement for
 * the deprecated `Surface`) and preserves the original shadcn card silhouette
 * (rounded, hairline border, padding, elevation) using Kumo semantic classes.
 *
 * The sub-parts (`CardHeader`, `CardTitle`, `CardDescription`, `CardAction`,
 * `CardContent`, `CardFooter`) have no Kumo equivalent, so they remain thin
 * elements styled with Kumo semantic classes.
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <LayerCard
      data-slot="card"
      className={cn(
        "flex flex-col gap-6 rounded-xl border border-kumo-hairline bg-kumo-base py-6 text-kumo-default shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold text-kumo-default", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-kumo-subtle", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center border-kumo-hairline px-6 [.border-t]:pt-6",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
