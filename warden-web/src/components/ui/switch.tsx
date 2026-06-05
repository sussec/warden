"use client"

import * as React from "react"
import { Switch as KumoSwitch } from "@cloudflare/kumo/components/switch"

import { cn } from "@/lib/utils"

// Map the legacy (shadcn/Radix) size names onto Kumo's size scale.
// Legacy "default" -> Kumo "base"; legacy "sm" -> Kumo "sm".
const SIZE_MAP = {
  sm: "sm",
  default: "base",
} as const

type LegacySize = keyof typeof SIZE_MAP

function Switch({
  className,
  size = "default",
  ...props
}: Omit<React.ComponentProps<typeof KumoSwitch>, "size"> & {
  size?: LegacySize
}) {
  return (
    <KumoSwitch
      data-slot="switch"
      size={SIZE_MAP[size]}
      className={cn(className)}
      {...props}
    />
  )
}

export { Switch }
